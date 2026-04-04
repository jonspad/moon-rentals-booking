import { NextRequest, NextResponse } from 'next/server';
import {
  addBooking,
  deleteBooking,
  getBookingComputedTotal,
  getBookings,
  recordBookingMessageLog,
  updateBookingPricing,
  updateBookingStatus,
} from '@/lib/bookingStore';
import { recordAdminAction } from '@/lib/adminAudit';
import { getBlocks } from '@/lib/blockStore';
import { prisma } from '@/lib/prisma';
import { PricingLineItem, getLineItemsTotal, getPricingBreakdownText } from '@/lib/bookingPricing';
import {
  sendAdminNewBookingEmail,
  sendBookingApprovedEmail,
  sendBookingReceivedEmail,
  sendBookingRejectedEmail,
} from '@/lib/email';

function isOverlapping(
  requestedStart: Date,
  requestedEnd: Date,
  existingStart: Date,
  existingEnd: Date
) {
  return requestedStart < existingEnd && requestedEnd > existingStart;
}

function getVehicleDisplayName(vehicle: {
  year: number;
  make: string;
  model: string;
  color?: string | null;
}) {
  return `${vehicle.year} ${vehicle.make} ${vehicle.model}${
    vehicle.color ? ` (${vehicle.color})` : ''
  }`;
}

function calculateBillableDays(start: Date, end: Date) {
  const diffMs = end.getTime() - start.getTime();
  const msPerDay = 1000 * 60 * 60 * 24;

  if (diffMs <= 0) {
    return 0;
  }

  return Math.ceil(diffMs / msPerDay);
}

function parseIntegerValue(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.round(parsed);
}

function parseNullableIntegerValue(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed);
}

function buildReceivedLogMessage(input: {
  vehicle: string;
  pickupAt: string;
  returnAt: string;
  bookingId: number;
  ratePerDay?: number | null;
  billableDays?: number | null;
  estimatedTotal?: number | null;
  discountItems?: PricingLineItem[] | null;
  feeItems?: PricingLineItem[] | null;
  pricingNote?: string | null;
}) {
  return [
    `Your booking request for ${input.vehicle} has been received and is pending review.`,
    `Booking ID: #${input.bookingId}`,
    `Pickup: ${input.pickupAt}`,
    `Return: ${input.returnAt}`,
    input.ratePerDay != null ? `Rate: $${input.ratePerDay}/day` : '',
    input.billableDays != null ? `Billable Days: ${input.billableDays}` : '',
    input.estimatedTotal != null
      ? `Estimated Total: $${input.estimatedTotal}`
      : '',
    getPricingBreakdownText({
      discountItems: input.discountItems,
      feeItems: input.feeItems,
      pricingNote: input.pricingNote,
    }),
    `We’ll review the request and follow up as soon as possible.`,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildApprovedLogMessage(input: {
  vehicle: string;
  pickupAt: string;
  returnAt: string;
  bookingId: number;
  ratePerDay?: number | null;
  billableDays?: number | null;
  estimatedTotal?: number | null;
  discountItems?: PricingLineItem[] | null;
  feeItems?: PricingLineItem[] | null;
  pricingNote?: string | null;
}) {
  return [
    `Your booking has been approved for ${input.vehicle}.`,
    `Booking ID: #${input.bookingId}`,
    `Pickup: ${input.pickupAt}`,
    `Return: ${input.returnAt}`,
    input.ratePerDay != null ? `Rate: $${input.ratePerDay}/day` : '',
    input.billableDays != null ? `Billable Days: ${input.billableDays}` : '',
    input.estimatedTotal != null
      ? `Final Total: $${input.estimatedTotal}`
      : '',
    getPricingBreakdownText({
      discountItems: input.discountItems,
      feeItems: input.feeItems,
      pricingNote: input.pricingNote,
    }),
    `If you have any questions before pickup, just reply to this email.`,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildRejectedLogMessage(input: {
  vehicle: string;
  pickupAt: string;
  returnAt: string;
  bookingId: number;
  reason?: string | null;
  mode: 'rejected' | 'cancelled';
}) {
  const intro =
    input.mode === 'cancelled'
      ? `Your confirmed booking for ${input.vehicle} has been cancelled.`
      : `We’re unable to approve your booking request for ${input.vehicle} at this time.`;

  return [
    intro,
    `Booking ID: #${input.bookingId}`,
    `Pickup: ${input.pickupAt}`,
    `Return: ${input.returnAt}`,
    input.reason?.trim() ? `Reason: ${input.reason.trim()}` : '',
    `Please reply to this email if you’d like to discuss other availability or have any questions.`,
  ]
    .filter(Boolean)
    .join('\n');
}

async function getVehicleForBooking(vehicleId: number) {
  return prisma.vehicle.findFirst({
    where: {
      id: vehicleId,
      isActive: true,
    },
    select: {
      id: true,
      year: true,
      make: true,
      model: true,
      color: true,
      pricePerDay: true,
      image: true,
    },
  });
}

async function findConflicts(input: {
  vehicleId: number;
  pickupDate: Date;
  returnDate: Date;
  excludeBookingId?: number;
}) {
  const [blocks, bookings] = await Promise.all([getBlocks(), getBookings()]);

  const conflictingBlock = blocks.find((block) => {
    if (block.vehicleId !== input.vehicleId) return false;

    const blockStart = new Date(block.start);
    const blockEnd = new Date(block.end);

    if (Number.isNaN(blockStart.getTime()) || Number.isNaN(blockEnd.getTime())) {
      return false;
    }

    return isOverlapping(input.pickupDate, input.returnDate, blockStart, blockEnd);
  });

  const conflictingBooking = bookings.find((booking) => {
    if (booking.id === input.excludeBookingId) return false;
    if (booking.vehicleId !== input.vehicleId) return false;
    if (booking.status !== 'confirmed') return false;

    const bookingStart = new Date(booking.pickupAt);
    const bookingEnd = new Date(booking.returnAt);

    if (
      Number.isNaN(bookingStart.getTime()) ||
      Number.isNaN(bookingEnd.getTime())
    ) {
      return false;
    }

    return isOverlapping(input.pickupDate, input.returnDate, bookingStart, bookingEnd);
  });

  return { conflictingBlock, conflictingBooking };
}

export async function GET() {
  try {
    const bookings = await prisma.booking.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: {
            id: true,
            verificationStatus: true,
          },
        },
        messageLogs: {
          orderBy: { sentAt: 'desc' },
          select: {
            id: true,
            kind: true,
            template: true,
            recipientEmail: true,
            subject: true,
            body: true,
            sentAt: true,
            createdAt: true,
          },
        },
      },
    });

    return NextResponse.json({ bookings });
  } catch (error) {
    console.error('GET /api/bookings error:', error);
    return NextResponse.json(
      { error: 'Failed to load bookings.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const vehicleId = Number(body.vehicleId);
    const customerId = Number(body.customerId);
    const pickupAt = body.pickupAt;
    const returnAt = body.returnAt;
    const autoConfirm = body.autoConfirm === true;
    const fullName = (body.fullName || '').trim();
    const email = (body.email || '').trim();
    const phone = (body.phone || '').trim();

    if (!vehicleId || !pickupAt || !returnAt) {
      return NextResponse.json(
        {
          error: 'vehicleId, pickupAt, and returnAt are required.',
        },
        { status: 400 }
      );
    }

    const vehicle = await getVehicleForBooking(vehicleId);

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found.' }, { status: 404 });
    }

    const pickupDate = new Date(pickupAt);
    const returnDate = new Date(returnAt);

    if (
      Number.isNaN(pickupDate.getTime()) ||
      Number.isNaN(returnDate.getTime())
    ) {
      return NextResponse.json(
        { error: 'Invalid date format.' },
        { status: 400 }
      );
    }

    if (returnDate <= pickupDate) {
      return NextResponse.json(
        { error: 'Return date must be after pickup date.' },
        { status: 400 }
      );
    }

    const { conflictingBlock, conflictingBooking } = await findConflicts({
      vehicleId,
      pickupDate,
      returnDate,
    });

    if (conflictingBlock) {
      return NextResponse.json(
        { error: 'This vehicle is blocked for the selected dates.' },
        { status: 409 }
      );
    }

    if (conflictingBooking) {
      return NextResponse.json(
        { error: 'This vehicle is already booked for the selected dates.' },
        { status: 409 }
      );
    }

    let customer:
      | {
          id: number;
          fullName: string;
          email: string;
          phone: string;
        }
      | null = null;

    if (customerId) {
      const existingCustomer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
        },
      });

      if (!existingCustomer) {
        return NextResponse.json(
          { error: 'Customer not found.' },
          { status: 404 }
        );
      }

      customer = existingCustomer;
    } else {
      if (!fullName || !email || !phone) {
        return NextResponse.json(
          {
            error:
              'vehicleId, pickupAt, returnAt, fullName, email, and phone are required.',
          },
          { status: 400 }
        );
      }

      const normalizedName = fullName.trim();
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedPhone = phone.trim();

      let existingCustomer = await prisma.customer.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingCustomer) {
        const shouldUpdate =
          existingCustomer.fullName !== normalizedName ||
          existingCustomer.phone !== normalizedPhone;

        if (shouldUpdate) {
          existingCustomer = await prisma.customer.update({
            where: { id: existingCustomer.id },
            data: {
              fullName: normalizedName,
              phone: normalizedPhone,
            },
          });
        }
      } else {
        existingCustomer = await prisma.customer.create({
          data: {
            fullName: normalizedName,
            email: normalizedEmail,
            phone: normalizedPhone,
          },
        });
      }

      customer = {
        id: existingCustomer.id,
        fullName: existingCustomer.fullName,
        email: existingCustomer.email,
        phone: existingCustomer.phone,
      };
    }

    const totalDaysSnapshot = calculateBillableDays(pickupDate, returnDate);
    const pricePerDaySnapshot = vehicle.pricePerDay;
    const totalPriceSnapshot = totalDaysSnapshot * pricePerDaySnapshot;
    const nextStatus = autoConfirm ? 'confirmed' : 'pending';

    const booking = await addBooking({
      vehicleId,
      customerId: customer.id,
      pickupAt,
      returnAt,
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      status: nextStatus,
      pricePerDaySnapshot,
      totalDaysSnapshot,
      totalPriceSnapshot,
      discountAmount: 0,
      extraFeeAmount: 0,
      discountBreakdownItems: [],
      extraFeeBreakdownItems: [],
      finalPriceOverride: null,
      pricingNote: null,
    });

    const vehicleName = getVehicleDisplayName(vehicle);
    const adminNotificationEmail = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
    const finalTotal = getBookingComputedTotal(booking);

    if (autoConfirm) {
      const subject = 'Booking Confirmed - Moon Rentals';
      const bodyText = buildApprovedLogMessage({
        vehicle: vehicleName,
        pickupAt,
        returnAt,
        bookingId: booking.id,
        ratePerDay: pricePerDaySnapshot,
        billableDays: totalDaysSnapshot,
        estimatedTotal: finalTotal,
        discountItems: booking.discountBreakdownItems,
        feeItems: booking.extraFeeBreakdownItems,
        pricingNote: booking.pricingNote,
      });

      await sendBookingApprovedEmail({
        to: customer.email,
        name: customer.fullName,
        vehicle: vehicleName,
        pickupAt,
        returnAt,
        bookingId: booking.id,
        vehicleImage: vehicle.image,
        ratePerDay: pricePerDaySnapshot,
        billableDays: totalDaysSnapshot,
        estimatedTotal: finalTotal,
        baseSubtotal: booking.totalPriceSnapshot,
        discountAmount: booking.discountAmount,
        extraFeeAmount: booking.extraFeeAmount,
        discountBreakdownItems: booking.discountBreakdownItems,
        extraFeeBreakdownItems: booking.extraFeeBreakdownItems,
        finalPriceOverride: booking.finalPriceOverride,
        pricingNote: booking.pricingNote,
      });

      await recordBookingMessageLog({
        bookingId: booking.id,
        kind: 'automated',
        template: 'booking_approved',
        recipientEmail: customer.email,
        subject,
        body: bodyText,
      });

      await recordAdminAction({
        action: 'BOOKING_CREATED_AND_CONFIRMED',
        entity: 'booking',
        entityId: booking.id,
        metadata: {
          customerId: customer.id,
          vehicleId,
          pickupAt,
          returnAt,
          finalTotal,
        },
      });
    } else {
      const guestSubject = 'Booking Request Received - Moon Rentals';
      const guestBody = buildReceivedLogMessage({
        vehicle: vehicleName,
        pickupAt,
        returnAt,
        bookingId: booking.id,
        ratePerDay: pricePerDaySnapshot,
        billableDays: totalDaysSnapshot,
        estimatedTotal: totalPriceSnapshot,
        discountItems: booking.discountBreakdownItems,
        feeItems: booking.extraFeeBreakdownItems,
        pricingNote: booking.pricingNote,
      });

      await sendBookingReceivedEmail({
        to: customer.email,
        name: customer.fullName,
        vehicle: vehicleName,
        pickupAt,
        returnAt,
        bookingId: booking.id,
        vehicleImage: vehicle.image,
        ratePerDay: pricePerDaySnapshot,
        billableDays: totalDaysSnapshot,
        estimatedTotal: totalPriceSnapshot,
        baseSubtotal: totalPriceSnapshot,
        discountAmount: 0,
        extraFeeAmount: 0,
        discountBreakdownItems: [],
        extraFeeBreakdownItems: [],
        finalPriceOverride: null,
        pricingNote: null,
      });

      await recordBookingMessageLog({
        bookingId: booking.id,
        kind: 'automated',
        template: 'booking_received',
        recipientEmail: customer.email,
        subject: guestSubject,
        body: guestBody,
      });

      if (adminNotificationEmail) {
        await sendAdminNewBookingEmail({
          to: adminNotificationEmail,
          bookingId: booking.id,
          customerName: customer.fullName,
          customerEmail: customer.email,
          customerPhone: customer.phone,
          vehicle: vehicleName,
          pickupAt,
          returnAt,
          vehicleImage: vehicle.image,
          ratePerDay: pricePerDaySnapshot,
          billableDays: totalDaysSnapshot,
          estimatedTotal: totalPriceSnapshot,
          baseSubtotal: totalPriceSnapshot,
          discountAmount: 0,
          extraFeeAmount: 0,
          finalPriceOverride: null,
        });
      }

      await recordAdminAction({
        action: 'BOOKING_CREATED',
        entity: 'booking',
        entityId: booking.id,
        metadata: {
          customerId: customer.id,
          vehicleId,
          pickupAt,
          returnAt,
          status: nextStatus,
          estimatedTotal: totalPriceSnapshot,
        },
      });
    }

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    console.error('POST /api/bookings error:', error);
    return NextResponse.json(
      { error: 'Failed to create booking.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const id = Number(body.id);
    const status = body.status;
    const rejectionReason =
      typeof body.rejectionReason === 'string' ? body.rejectionReason : '';

    if (!id) {
      return NextResponse.json(
        { error: 'Booking id is required.' },
        { status: 400 }
      );
    }

    const existingBookings = await getBookings();
    const currentBooking = existingBookings.find((booking) => booking.id === id);

    if (!currentBooking) {
      return NextResponse.json(
        { error: 'Booking not found.' },
        { status: 404 }
      );
    }

    const hasPricingPayload =
      body.discountAmount !== undefined ||
      body.extraFeeAmount !== undefined ||
      body.discountBreakdownItems !== undefined ||
      body.extraFeeBreakdownItems !== undefined ||
      body.finalPriceOverride !== undefined ||
      body.pricingNote !== undefined;

    let pricingUpdatedBooking = currentBooking;

    if (hasPricingPayload) {
      const discountBreakdownItems = Array.isArray(body.discountBreakdownItems)
        ? body.discountBreakdownItems
        : currentBooking.discountBreakdownItems;
      const extraFeeBreakdownItems = Array.isArray(body.extraFeeBreakdownItems)
        ? body.extraFeeBreakdownItems
        : currentBooking.extraFeeBreakdownItems;
      const discountAmount = Math.max(
        0,
        body.discountAmount !== undefined
          ? parseIntegerValue(body.discountAmount, currentBooking.discountAmount)
          : getLineItemsTotal(discountBreakdownItems)
      );
      const extraFeeAmount = Math.max(
        0,
        body.extraFeeAmount !== undefined
          ? parseIntegerValue(body.extraFeeAmount, currentBooking.extraFeeAmount)
          : getLineItemsTotal(extraFeeBreakdownItems)
      );
      const finalPriceOverride = parseNullableIntegerValue(body.finalPriceOverride);
      const pricingNote =
        typeof body.pricingNote === 'string'
          ? body.pricingNote
          : currentBooking.pricingNote;

      if (finalPriceOverride != null && finalPriceOverride < 0) {
        return NextResponse.json(
          { error: 'Final price override cannot be negative.' },
          { status: 400 }
        );
      }

      const updatedPricing = await updateBookingPricing(id, {
        discountAmount,
        extraFeeAmount,
        discountBreakdownItems,
        extraFeeBreakdownItems,
        finalPriceOverride,
        pricingNote,
      });

      if (!updatedPricing) {
        return NextResponse.json(
          { error: 'Failed to update pricing.' },
          { status: 500 }
        );
      }

      pricingUpdatedBooking = updatedPricing;

      await recordAdminAction({
        action: 'BOOKING_PRICING_UPDATED',
        entity: 'booking',
        entityId: id,
        metadata: {
          discountAmount,
          extraFeeAmount,
          discountBreakdownItems,
          extraFeeBreakdownItems,
          finalPriceOverride,
          pricingNote: pricingNote?.trim() || null,
          computedTotal: getBookingComputedTotal(updatedPricing),
        },
      });
    }

    if (status === undefined) {
      return NextResponse.json({ booking: pricingUpdatedBooking });
    }

    if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid booking status.' },
        { status: 400 }
      );
    }

    if (status === 'confirmed' && pricingUpdatedBooking.status !== 'confirmed') {
      const pickupDate = new Date(pricingUpdatedBooking.pickupAt);
      const returnDate = new Date(pricingUpdatedBooking.returnAt);

      const { conflictingBlock, conflictingBooking } = await findConflicts({
        vehicleId: pricingUpdatedBooking.vehicleId,
        pickupDate,
        returnDate,
        excludeBookingId: pricingUpdatedBooking.id,
      });

      if (conflictingBlock) {
        return NextResponse.json(
          { error: 'This booking overlaps an existing vehicle block.' },
          { status: 409 }
        );
      }

      if (conflictingBooking) {
        return NextResponse.json(
          { error: 'This booking overlaps another confirmed booking.' },
          { status: 409 }
        );
      }
    }

    const updatedBooking = await updateBookingStatus(id, status, {
      rejectionReason,
    });

    if (!updatedBooking) {
      return NextResponse.json(
        { error: 'Booking not found.' },
        { status: 404 }
      );
    }

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: updatedBooking.vehicleId,
      },
      select: {
        year: true,
        make: true,
        model: true,
        color: true,
        image: true,
      },
    });

    const vehicleName = vehicle
      ? getVehicleDisplayName(vehicle)
      : `Vehicle ${updatedBooking.vehicleId}`;

    const ratePerDay = updatedBooking.pricePerDaySnapshot;
    const billableDays = updatedBooking.totalDaysSnapshot;
    const baseSubtotal = updatedBooking.totalPriceSnapshot;
    const discountAmount = updatedBooking.discountAmount;
    const extraFeeAmount = updatedBooking.extraFeeAmount;
    const discountBreakdownItems = updatedBooking.discountBreakdownItems;
    const extraFeeBreakdownItems = updatedBooking.extraFeeBreakdownItems;
    const finalPriceOverride = updatedBooking.finalPriceOverride;
    const pricingNote = updatedBooking.pricingNote;
    const estimatedTotal = getBookingComputedTotal(updatedBooking);

    if (status === 'confirmed' && pricingUpdatedBooking.status !== 'confirmed') {
      const subject = 'Booking Confirmed - Moon Rentals';
      const bodyText = buildApprovedLogMessage({
        vehicle: vehicleName,
        pickupAt: updatedBooking.pickupAt,
        returnAt: updatedBooking.returnAt,
        bookingId: updatedBooking.id,
        ratePerDay,
        billableDays,
        estimatedTotal,
        discountItems: discountBreakdownItems,
        feeItems: extraFeeBreakdownItems,
        pricingNote,
      });

      await sendBookingApprovedEmail({
        to: updatedBooking.email,
        name: updatedBooking.fullName,
        vehicle: vehicleName,
        pickupAt: updatedBooking.pickupAt,
        returnAt: updatedBooking.returnAt,
        bookingId: updatedBooking.id,
        vehicleImage: vehicle?.image ?? null,
        ratePerDay,
        billableDays,
        estimatedTotal,
        baseSubtotal,
        discountAmount,
        extraFeeAmount,
        discountBreakdownItems,
        extraFeeBreakdownItems,
        finalPriceOverride,
        pricingNote,
      });

      await recordBookingMessageLog({
        bookingId: updatedBooking.id,
        kind: 'automated',
        template: 'booking_approved',
        recipientEmail: updatedBooking.email,
        subject,
        body: bodyText,
      });

      await recordAdminAction({
        action: 'BOOKING_CONFIRMED',
        entity: 'booking',
        entityId: updatedBooking.id,
        metadata: {
          vehicleId: updatedBooking.vehicleId,
          finalTotal: estimatedTotal,
        },
      });
    }

    if (status === 'cancelled' && pricingUpdatedBooking.status !== 'cancelled') {
      const mode = pricingUpdatedBooking.status === 'confirmed' ? 'cancelled' : 'rejected';
      const subject =
        mode === 'cancelled'
          ? 'Booking Cancelled - Moon Rentals'
          : 'Booking Request Update - Moon Rentals';

      const bodyText = buildRejectedLogMessage({
        vehicle: vehicleName,
        pickupAt: updatedBooking.pickupAt,
        returnAt: updatedBooking.returnAt,
        bookingId: updatedBooking.id,
        reason: updatedBooking.rejectionReason,
        mode,
      });

      await sendBookingRejectedEmail({
        to: updatedBooking.email,
        name: updatedBooking.fullName,
        vehicle: vehicleName,
        pickupAt: updatedBooking.pickupAt,
        returnAt: updatedBooking.returnAt,
        bookingId: updatedBooking.id,
        vehicleImage: vehicle?.image ?? null,
        ratePerDay,
        billableDays,
        estimatedTotal,
        baseSubtotal,
        discountAmount,
        extraFeeAmount,
        finalPriceOverride,
        reason: updatedBooking.rejectionReason,
        mode,
      });

      await recordBookingMessageLog({
        bookingId: updatedBooking.id,
        kind: 'automated',
        template: mode === 'cancelled' ? 'booking_cancelled' : 'booking_rejected',
        recipientEmail: updatedBooking.email,
        subject,
        body: bodyText,
      });

      await recordAdminAction({
        action: mode === 'cancelled' ? 'BOOKING_CANCELLED' : 'BOOKING_REJECTED',
        entity: 'booking',
        entityId: updatedBooking.id,
        metadata: {
          vehicleId: updatedBooking.vehicleId,
          reason: updatedBooking.rejectionReason,
        },
      });
    }

    return NextResponse.json({ booking: updatedBooking });
  } catch (error) {
    console.error('PATCH /api/bookings error:', error);
    return NextResponse.json(
      { error: 'Failed to update booking.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Booking id is required.' },
        { status: 400 }
      );
    }

    const deleted = await deleteBooking(Number(id));

    if (!deleted) {
      return NextResponse.json(
        { error: 'Booking not found.' },
        { status: 404 }
      );
    }

    await recordAdminAction({
      action: 'BOOKING_DELETED',
      entity: 'booking',
      entityId: Number(id),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/bookings error:', error);
    return NextResponse.json(
      { error: 'Failed to delete booking.' },
      { status: 500 }
    );
  }
}
