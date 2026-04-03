import { NextRequest, NextResponse } from 'next/server';
import {
  addBooking,
  deleteBooking,
  getBookings,
  recordBookingMessageLog,
  updateBookingStatus,
} from '@/lib/bookingStore';
import { getBlocks } from '@/lib/blockStore';
import { prisma } from '@/lib/prisma';
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

function buildReceivedLogMessage(input: {
  vehicle: string;
  pickupAt: string;
  returnAt: string;
  bookingId: number;
  ratePerDay?: number | null;
  billableDays?: number | null;
  estimatedTotal?: number | null;
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
}) {
  return [
    `Your booking has been approved for ${input.vehicle}.`,
    `Booking ID: #${input.bookingId}`,
    `Pickup: ${input.pickupAt}`,
    `Return: ${input.returnAt}`,
    input.ratePerDay != null ? `Rate: $${input.ratePerDay}/day` : '',
    input.billableDays != null ? `Billable Days: ${input.billableDays}` : '',
    input.estimatedTotal != null
      ? `Estimated Total: $${input.estimatedTotal}`
      : '',
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
    const pickupAt = body.pickupAt;
    const returnAt = body.returnAt;
    const fullName = (body.fullName || '').trim();
    const email = (body.email || '').trim();
    const phone = (body.phone || '').trim();

    if (!vehicleId || !pickupAt || !returnAt || !fullName || !email || !phone) {
      return NextResponse.json(
        {
          error:
            'vehicleId, pickupAt, returnAt, fullName, email, and phone are required.',
        },
        { status: 400 }
      );
    }

    const vehicle = await prisma.vehicle.findFirst({
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

    const blocks = await getBlocks();
    const conflictingBlock = blocks.find((block) => {
      if (block.vehicleId !== vehicleId) return false;

      const blockStart = new Date(block.start);
      const blockEnd = new Date(block.end);

      if (
        Number.isNaN(blockStart.getTime()) ||
        Number.isNaN(blockEnd.getTime())
      ) {
        return false;
      }

      return isOverlapping(pickupDate, returnDate, blockStart, blockEnd);
    });

    if (conflictingBlock) {
      return NextResponse.json(
        { error: 'This vehicle is blocked for the selected dates.' },
        { status: 409 }
      );
    }

    const existingBookings = await getBookings();
    const conflictingBooking = existingBookings.find((booking) => {
      if (booking.vehicleId !== vehicleId) return false;
      if (booking.status !== 'confirmed') return false;

      const bookingStart = new Date(booking.pickupAt);
      const bookingEnd = new Date(booking.returnAt);

      if (
        Number.isNaN(bookingStart.getTime()) ||
        Number.isNaN(bookingEnd.getTime())
      ) {
        return false;
      }

      return isOverlapping(pickupDate, returnDate, bookingStart, bookingEnd);
    });

    if (conflictingBooking) {
      return NextResponse.json(
        { error: 'This vehicle is already booked for the selected dates.' },
        { status: 409 }
      );
    }

    const normalizedName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();

    let customer = await prisma.customer.findUnique({
      where: { email: normalizedEmail },
    });

    if (customer) {
      const shouldUpdate =
        customer.fullName !== normalizedName || customer.phone !== normalizedPhone;

      if (shouldUpdate) {
        customer = await prisma.customer.update({
          where: { id: customer.id },
          data: {
            fullName: normalizedName,
            phone: normalizedPhone,
          },
        });
      }
    } else {
      customer = await prisma.customer.create({
        data: {
          fullName: normalizedName,
          email: normalizedEmail,
          phone: normalizedPhone,
        },
      });
    }

    const booking = await addBooking({
      vehicleId,
      customerId: customer.id,
      pickupAt,
      returnAt,
      fullName: normalizedName,
      email: normalizedEmail,
      phone: normalizedPhone,
      status: 'pending',
    });

    const vehicleName = getVehicleDisplayName(vehicle);
    const billableDays = calculateBillableDays(pickupDate, returnDate);
    const ratePerDay = vehicle.pricePerDay;
    const estimatedTotal = billableDays * ratePerDay;
    const adminNotificationEmail = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();

    const guestSubject = 'Booking Request Received - Moon Rentals';
    const guestBody = buildReceivedLogMessage({
      vehicle: vehicleName,
      pickupAt,
      returnAt,
      bookingId: booking.id,
      ratePerDay,
      billableDays,
      estimatedTotal,
    });

    await sendBookingReceivedEmail({
      to: normalizedEmail,
      name: normalizedName,
      vehicle: vehicleName,
      pickupAt,
      returnAt,
      bookingId: booking.id,
      vehicleImage: vehicle.image,
      ratePerDay,
      billableDays,
      estimatedTotal,
    });

    await recordBookingMessageLog({
      bookingId: booking.id,
      kind: 'automated',
      template: 'booking_received',
      recipientEmail: normalizedEmail,
      subject: guestSubject,
      body: guestBody,
    });

    if (adminNotificationEmail) {
      await sendAdminNewBookingEmail({
        to: adminNotificationEmail,
        bookingId: booking.id,
        customerName: normalizedName,
        customerEmail: normalizedEmail,
        customerPhone: normalizedPhone,
        vehicle: vehicleName,
        pickupAt,
        returnAt,
        vehicleImage: vehicle.image,
        ratePerDay,
        billableDays,
        estimatedTotal,
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

    if (!id || !status) {
      return NextResponse.json(
        { error: 'Booking id and status are required.' },
        { status: 400 }
      );
    }

    if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid booking status.' },
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
        pricePerDay: true,
        image: true,
      },
    });

    const vehicleName = vehicle
      ? getVehicleDisplayName(vehicle)
      : `Vehicle ${updatedBooking.vehicleId}`;

    const pickupDate = new Date(updatedBooking.pickupAt);
    const returnDate = new Date(updatedBooking.returnAt);
    const billableDays =
      Number.isNaN(pickupDate.getTime()) || Number.isNaN(returnDate.getTime())
        ? null
        : calculateBillableDays(pickupDate, returnDate);

    const ratePerDay = vehicle?.pricePerDay ?? null;
    const estimatedTotal =
      billableDays != null && ratePerDay != null
        ? billableDays * ratePerDay
        : null;

    if (status === 'confirmed' && currentBooking.status !== 'confirmed') {
      const subject = 'Booking Confirmed - Moon Rentals';
      const bodyText = buildApprovedLogMessage({
        vehicle: vehicleName,
        pickupAt: updatedBooking.pickupAt,
        returnAt: updatedBooking.returnAt,
        bookingId: updatedBooking.id,
        ratePerDay,
        billableDays,
        estimatedTotal,
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
      });

      await recordBookingMessageLog({
        bookingId: updatedBooking.id,
        kind: 'automated',
        template: 'booking_approved',
        recipientEmail: updatedBooking.email,
        subject,
        body: bodyText,
      });
    }

    if (status === 'cancelled' && currentBooking.status !== 'cancelled') {
      const mode = currentBooking.status === 'confirmed' ? 'cancelled' : 'rejected';
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
    }

    return NextResponse.json({ booking: updatedBooking });
  } catch (error) {
    console.error('PATCH /api/bookings error:', error);
    return NextResponse.json(
      { error: 'Failed to update booking status.' },
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/bookings error:', error);
    return NextResponse.json(
      { error: 'Failed to delete booking.' },
      { status: 500 }
    );
  }
}