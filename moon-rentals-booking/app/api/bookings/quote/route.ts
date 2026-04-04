import { NextRequest, NextResponse } from 'next/server';
import { getBookingComputedTotal, getBookings, recordBookingMessageLog } from '@/lib/bookingStore';
import { prisma } from '@/lib/prisma';
import { sendBookingQuoteUpdatedEmail } from '@/lib/email';
import { getPricingBreakdownText } from '@/lib/bookingPricing';

function getVehicleDisplayName(vehicle: {
  year: number;
  make: string;
  model: string;
  color?: string | null;
}) {
  return `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.color ? ` (${vehicle.color})` : ''}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = Number(body.id);

    if (!id) {
      return NextResponse.json({ error: 'Booking id is required.' }, { status: 400 });
    }

    const bookings = await getBookings();
    const booking = bookings.find((item) => item.id === id);

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: booking.vehicleId },
      select: { year: true, make: true, model: true, color: true, image: true },
    });

    const vehicleName = vehicle
      ? getVehicleDisplayName(vehicle)
      : `Vehicle ${booking.vehicleId}`;

    const estimatedTotal = getBookingComputedTotal(booking);

    await sendBookingQuoteUpdatedEmail({
      to: booking.email,
      name: booking.fullName,
      vehicle: vehicleName,
      pickupAt: booking.pickupAt,
      returnAt: booking.returnAt,
      bookingId: booking.id,
      vehicleImage: vehicle?.image ?? null,
      ratePerDay: booking.pricePerDaySnapshot,
      billableDays: booking.totalDaysSnapshot,
      estimatedTotal,
      baseSubtotal: booking.totalPriceSnapshot,
      discountAmount: booking.discountAmount,
      extraFeeAmount: booking.extraFeeAmount,
      discountBreakdownItems: booking.discountBreakdownItems,
      extraFeeBreakdownItems: booking.extraFeeBreakdownItems,
      finalPriceOverride: booking.finalPriceOverride,
      pricingNote: booking.pricingNote,
    });

    const bodyText = [
      `Your updated quote for ${vehicleName} is ready.`,
      `Booking ID: #${booking.id}`,
      `Pickup: ${booking.pickupAt}`,
      `Return: ${booking.returnAt}`,
      `Rate: $${booking.pricePerDaySnapshot}/day`,
      `Billable Days: ${booking.totalDaysSnapshot}`,
      `Final Total: $${estimatedTotal}`,
      getPricingBreakdownText({
        discountItems: booking.discountBreakdownItems,
        feeItems: booking.extraFeeBreakdownItems,
        pricingNote: booking.pricingNote,
      }),
      'Reply to this email if you have any questions about the updated quote.',
    ]
      .filter(Boolean)
      .join('\n');

    await recordBookingMessageLog({
      bookingId: booking.id,
      kind: 'manual',
      template: 'guest_message',
      recipientEmail: booking.email,
      subject: 'Updated Booking Quote - Moon Rentals',
      body: bodyText,
      updateLastAdminMessage: true,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/bookings/quote error:', error);
    return NextResponse.json({ error: 'Failed to email updated quote.' }, { status: 500 });
  }
}
