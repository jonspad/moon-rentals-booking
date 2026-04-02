import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendBookingReceivedEmail({
  to,
  name,
  vehicle,
  pickupAt,
  returnAt,
  bookingId,
}: {
  to: string;
  name: string;
  vehicle: string;
  pickupAt: string;
  returnAt: string;
  bookingId: number;
}) {
  try {
    await resend.emails.send({
      from: 'Moon Rentals <onboarding@resend.dev>',
      to,
      subject: 'Booking Request Received - Moon Rentals',
      html: `
        <h2>Booking Request Received</h2>
        <p>Hi ${name},</p>
        <p>Your booking request has been received and is pending approval.</p>

        <p><strong>Booking ID:</strong> ${bookingId}</p>
        <p><strong>Vehicle:</strong> ${vehicle}</p>
        <p><strong>Pickup:</strong> ${new Date(pickupAt).toLocaleString()}</p>
        <p><strong>Return:</strong> ${new Date(returnAt).toLocaleString()}</p>

        <p>We will review your request and follow up shortly.</p>

        <p>— Moon Rentals</p>
      `,
    });
  } catch (err) {
    console.error('Email send failed:', err);
  }
}

export async function sendBookingApprovedEmail({
  to,
  name,
  vehicle,
  pickupAt,
  returnAt,
  bookingId,
}: {
  to: string;
  name: string;
  vehicle: string;
  pickupAt: string;
  returnAt: string;
  bookingId: number;
}) {
  try {
    await resend.emails.send({
      from: 'Moon Rentals <onboarding@resend.dev>',
      to,
      subject: 'Booking Confirmed - Moon Rentals',
      html: `
        <h2>Your Booking is Confirmed 🎉</h2>
        <p>Hi ${name},</p>
        <p>Your booking has been approved.</p>

        <p><strong>Booking ID:</strong> ${bookingId}</p>
        <p><strong>Vehicle:</strong> ${vehicle}</p>
        <p><strong>Pickup:</strong> ${new Date(pickupAt).toLocaleString()}</p>
        <p><strong>Return:</strong> ${new Date(returnAt).toLocaleString()}</p>

        <p>Please contact us if you have any questions.</p>

        <p>— Moon Rentals</p>
      `,
    });
  } catch (err) {
    console.error('Email send failed:', err);
  }
}