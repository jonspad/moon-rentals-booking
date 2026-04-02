import { NextRequest, NextResponse } from 'next/server';
import { getBookings, recordAdminMessage } from '@/lib/bookingStore';
import { sendGuestMessageEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const bookingId = Number(body.bookingId);
    const subject = (body.subject || '').trim();
    const message = (body.message || '').trim();

    if (!bookingId || !subject || !message) {
      return NextResponse.json(
        { error: 'bookingId, subject, and message are required.' },
        { status: 400 }
      );
    }

    const bookings = await getBookings();
    const booking = bookings.find((item) => item.id === bookingId);

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found.' },
        { status: 404 }
      );
    }

    await sendGuestMessageEmail({
      to: booking.email,
      name: booking.fullName,
      bookingId: booking.id,
      subject,
      message,
    });

    const updatedBooking = await recordAdminMessage(
      booking.id,
      subject,
      message
    );

    return NextResponse.json({
      success: true,
      booking: updatedBooking,
    });
  } catch (error) {
    console.error('POST /api/bookings/message error:', error);
    return NextResponse.json(
      { error: 'Failed to send guest message.' },
      { status: 500 }
    );
  }
}