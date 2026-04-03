import { NextRequest, NextResponse } from 'next/server';
import {
  getBookingMessageLogById,
  getBookings,
  recordBookingMessageLog,
} from '@/lib/bookingStore';
import { sendGuestMessageEmail } from '@/lib/email';

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const bookingId = Number(body.bookingId);
    const messageLogId = Number(body.messageLogId);
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const toEmail = normalizeEmail(body.toEmail);

    if (messageLogId) {
      const existingLog = await getBookingMessageLogById(messageLogId);

      if (!existingLog) {
        return NextResponse.json(
          { error: 'Message history item not found.' },
          { status: 404 }
        );
      }

      const recipientEmail = toEmail || existingLog.recipientEmail;

      if (!recipientEmail) {
        return NextResponse.json(
          { error: 'Recipient email is required for resend.' },
          { status: 400 }
        );
      }

      await sendGuestMessageEmail({
        to: recipientEmail,
        name: existingLog.booking.fullName,
        bookingId: existingLog.booking.id,
        subject: existingLog.subject,
        message: existingLog.body,
      });

      await recordBookingMessageLog({
        bookingId: existingLog.booking.id,
        kind: 'resend',
        template: existingLog.template,
        recipientEmail,
        subject: existingLog.subject,
        body: existingLog.body,
        updateLastAdminMessage: true,
      });

      return NextResponse.json({
        success: true,
      });
    }

    if (!bookingId) {
      return NextResponse.json(
        { error: 'bookingId is required.' },
        { status: 400 }
      );
    }

    if (!subject || !message) {
      return NextResponse.json(
        { error: 'Subject and message are required.' },
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

    const recipientEmail = toEmail || booking.email;

    if (!recipientEmail) {
      return NextResponse.json(
        { error: 'Recipient email is required.' },
        { status: 400 }
      );
    }

    await sendGuestMessageEmail({
      to: recipientEmail,
      name: booking.fullName,
      bookingId: booking.id,
      subject,
      message,
    });

    await recordBookingMessageLog({
      bookingId: booking.id,
      kind: 'manual',
      template: 'guest_message',
      recipientEmail,
      subject,
      body: message,
      updateLastAdminMessage: true,
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('POST /api/bookings/message error:', error);
    return NextResponse.json(
      { error: 'Failed to send guest message.' },
      { status: 500 }
    );
  }
}