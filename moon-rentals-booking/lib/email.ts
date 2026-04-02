import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString([], {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getFromAddress() {
  return 'Moon Rentals <onboarding@resend.dev>';
}

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
      from: getFromAddress(),
      to,
      subject: 'Booking Request Received - Moon Rentals',
      html: `
        <div style="font-family: Arial, sans-serif; color: #171717; line-height: 1.6;">
          <h2 style="margin-bottom: 8px;">Booking Request Received</h2>
          <p>Hi ${name},</p>
          <p>Your booking request has been received and is pending approval.</p>

          <p><strong>Booking ID:</strong> ${bookingId}</p>
          <p><strong>Vehicle:</strong> ${vehicle}</p>
          <p><strong>Pickup:</strong> ${formatDateTime(pickupAt)}</p>
          <p><strong>Return:</strong> ${formatDateTime(returnAt)}</p>

          <p>We will review your request and follow up shortly.</p>

          <p>— Moon Rentals</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('sendBookingReceivedEmail failed:', err);
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
      from: getFromAddress(),
      to,
      subject: 'Booking Confirmed - Moon Rentals',
      html: `
        <div style="font-family: Arial, sans-serif; color: #171717; line-height: 1.6;">
          <h2 style="margin-bottom: 8px;">Your Booking is Confirmed 🎉</h2>
          <p>Hi ${name},</p>
          <p>Your booking has been approved.</p>

          <p><strong>Booking ID:</strong> ${bookingId}</p>
          <p><strong>Vehicle:</strong> ${vehicle}</p>
          <p><strong>Pickup:</strong> ${formatDateTime(pickupAt)}</p>
          <p><strong>Return:</strong> ${formatDateTime(returnAt)}</p>

          <p>Please contact us if you have any questions.</p>

          <p>— Moon Rentals</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('sendBookingApprovedEmail failed:', err);
  }
}

export async function sendAdminNewBookingEmail({
  to,
  bookingId,
  customerName,
  customerEmail,
  customerPhone,
  vehicle,
  pickupAt,
  returnAt,
}: {
  to: string;
  bookingId: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  vehicle: string;
  pickupAt: string;
  returnAt: string;
}) {
  try {
    await resend.emails.send({
      from: getFromAddress(),
      to,
      subject: `New Booking Pending Review #${bookingId} - Moon Rentals`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #171717; line-height: 1.6;">
          <h2 style="margin-bottom: 8px;">New Booking Pending Review</h2>
          <p>A new booking request has been submitted and is awaiting admin review.</p>

          <p><strong>Booking ID:</strong> ${bookingId}</p>
          <p><strong>Customer:</strong> ${customerName}</p>
          <p><strong>Email:</strong> ${customerEmail}</p>
          <p><strong>Phone:</strong> ${customerPhone}</p>
          <p><strong>Vehicle:</strong> ${vehicle}</p>
          <p><strong>Pickup:</strong> ${formatDateTime(pickupAt)}</p>
          <p><strong>Return:</strong> ${formatDateTime(returnAt)}</p>

          <p>Log in to the admin dashboard to review this request.</p>

          <p>— Moon Rentals</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('sendAdminNewBookingEmail failed:', err);
  }
}