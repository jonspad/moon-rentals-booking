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

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function getFromAddress() {
  return 'Moon Rentals <onboarding@resend.dev>';
}

function getEmailShell({
  preheader,
  title,
  eyebrow,
  intro,
  bodyHtml,
}: {
  preheader: string;
  title: string;
  eyebrow: string;
  intro: string;
  bodyHtml: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title}</title>
      </head>
      <body style="margin:0; padding:0; background-color:#f5f5f5; font-family:Arial, Helvetica, sans-serif; color:#171717;">
        <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
          ${preheader}
        </div>

        <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="background-color:#f5f5f5; margin:0; padding:24px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="max-width:640px; background-color:#ffffff; border:1px solid #e5e5e5; border-radius:20px; overflow:hidden;">
                <tr>
                  <td style="background:#111111; padding:24px 32px;">
                    <div style="font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#d4d4d4; font-weight:700;">
                      Moon Rentals
                    </div>
                    <div style="margin-top:10px; font-size:28px; line-height:1.2; font-weight:700; color:#ffffff;">
                      ${title}
                    </div>
                    <div style="margin-top:8px; font-size:14px; line-height:1.6; color:#d4d4d4;">
                      ${intro}
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:32px;">
                    <div style="font-size:12px; letter-spacing:0.14em; text-transform:uppercase; color:#737373; font-weight:700;">
                      ${eyebrow}
                    </div>

                    <div style="margin-top:20px; font-size:15px; line-height:1.7; color:#262626;">
                      ${bodyHtml}
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="border-top:1px solid #e5e5e5; background-color:#fafafa; padding:20px 32px;">
                    <div style="font-size:12px; line-height:1.6; color:#737373;">
                      Moon Rentals<br />
                      Booking notifications sent automatically from your reservation system.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function getDetailTable(rows: Array<{ label: string; value: string }>) {
  return `
    <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="margin:20px 0 24px; border:1px solid #e5e5e5; border-radius:16px; overflow:hidden;">
      ${rows
        .map(
          (row, index) => `
            <tr>
              <td style="padding:14px 16px; font-size:13px; font-weight:700; color:#525252; width:165px; background-color:#fafafa; border-bottom:${index === rows.length - 1 ? '0' : '1px solid #e5e5e5'};">
                ${row.label}
              </td>
              <td style="padding:14px 16px; font-size:14px; color:#171717; border-bottom:${index === rows.length - 1 ? '0' : '1px solid #e5e5e5'};">
                ${row.value}
              </td>
            </tr>
          `
        )
        .join('')}
    </table>
  `;
}

type PricingFields = {
  pricePerDay: number;
  billableDays: number;
  estimatedTotal: number;
};

export async function sendBookingReceivedEmail({
  to,
  name,
  vehicle,
  pickupAt,
  returnAt,
  bookingId,
  pricePerDay,
  billableDays,
  estimatedTotal,
}: {
  to: string;
  name: string;
  vehicle: string;
  pickupAt: string;
  returnAt: string;
  bookingId: number;
} & PricingFields) {
  try {
    const html = getEmailShell({
      preheader: `We received your Moon Rentals booking request #${bookingId}.`,
      title: 'Booking Request Received',
      eyebrow: 'Reservation Submitted',
      intro: 'Your booking request has been received and is now pending review.',
      bodyHtml: `
        <p style="margin:0 0 16px;">Hi ${name},</p>
        <p style="margin:0 0 16px;">
          Thanks for booking with Moon Rentals. Your request has been received successfully and is waiting for admin approval.
        </p>

        ${getDetailTable([
          { label: 'Booking ID', value: `#${bookingId}` },
          { label: 'Vehicle', value: vehicle },
          { label: 'Pickup', value: formatDateTime(pickupAt) },
          { label: 'Return', value: formatDateTime(returnAt) },
          { label: 'Rate', value: `${formatCurrency(pricePerDay)} / day` },
          { label: 'Billable Days', value: String(billableDays) },
          { label: 'Estimated Total', value: formatCurrency(estimatedTotal) },
          { label: 'Status', value: 'Pending approval' },
        ])}

        <p style="margin:0 0 16px;">
          We’ll review the request and follow up as soon as possible with the next step.
        </p>

        <p style="margin:0;">
          — Moon Rentals
        </p>
      `,
    });

    await resend.emails.send({
      from: getFromAddress(),
      to,
      subject: `Booking Request Received #${bookingId} - Moon Rentals`,
      html,
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
  pricePerDay,
  billableDays,
  estimatedTotal,
}: {
  to: string;
  name: string;
  vehicle: string;
  pickupAt: string;
  returnAt: string;
  bookingId: number;
} & PricingFields) {
  try {
    const html = getEmailShell({
      preheader: `Your Moon Rentals booking #${bookingId} has been approved.`,
      title: 'Booking Confirmed',
      eyebrow: 'Reservation Approved',
      intro: 'Your booking has been approved and is now confirmed.',
      bodyHtml: `
        <p style="margin:0 0 16px;">Hi ${name},</p>
        <p style="margin:0 0 16px;">
          Good news — your booking has been approved.
        </p>

        ${getDetailTable([
          { label: 'Booking ID', value: `#${bookingId}` },
          { label: 'Vehicle', value: vehicle },
          { label: 'Pickup', value: formatDateTime(pickupAt) },
          { label: 'Return', value: formatDateTime(returnAt) },
          { label: 'Rate', value: `${formatCurrency(pricePerDay)} / day` },
          { label: 'Billable Days', value: String(billableDays) },
          { label: 'Total', value: formatCurrency(estimatedTotal) },
          { label: 'Status', value: 'Confirmed' },
        ])}

        <p style="margin:0 0 16px;">
          Please keep this email for your records. If you have any questions before pickup, reply back or contact Moon Rentals directly.
        </p>

        <p style="margin:0;">
          — Moon Rentals
        </p>
      `,
    });

    await resend.emails.send({
      from: getFromAddress(),
      to,
      subject: `Booking Confirmed #${bookingId} - Moon Rentals`,
      html,
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
  pricePerDay,
  billableDays,
  estimatedTotal,
}: {
  to: string;
  bookingId: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  vehicle: string;
  pickupAt: string;
  returnAt: string;
} & PricingFields) {
  try {
    const html = getEmailShell({
      preheader: `New Moon Rentals booking #${bookingId} is pending review.`,
      title: 'New Booking Pending Review',
      eyebrow: 'Admin Alert',
      intro: 'A new booking request has been submitted and is waiting for review.',
      bodyHtml: `
        <p style="margin:0 0 16px;">
          A new booking request has been submitted through the Moon Rentals website.
        </p>

        ${getDetailTable([
          { label: 'Booking ID', value: `#${bookingId}` },
          { label: 'Customer', value: customerName },
          { label: 'Email', value: customerEmail },
          { label: 'Phone', value: customerPhone },
          { label: 'Vehicle', value: vehicle },
          { label: 'Pickup', value: formatDateTime(pickupAt) },
          { label: 'Return', value: formatDateTime(returnAt) },
          { label: 'Rate', value: `${formatCurrency(pricePerDay)} / day` },
          { label: 'Billable Days', value: String(billableDays) },
          { label: 'Estimated Total', value: formatCurrency(estimatedTotal) },
          { label: 'Status', value: 'Pending approval' },
        ])}

        <p style="margin:0 0 16px;">
          Log in to the admin dashboard to review and approve or reject this request.
        </p>

        <p style="margin:0;">
          — Moon Rentals System
        </p>
      `,
    });

    await resend.emails.send({
      from: getFromAddress(),
      to,
      subject: `New Booking Pending Review #${bookingId} - Moon Rentals`,
      html,
    });
  } catch (err) {
    console.error('sendAdminNewBookingEmail failed:', err);
  }
}