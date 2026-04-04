import { Resend } from 'resend';
import { PricingLineItem, formatMoney } from './bookingPricing';

const resend = new Resend(process.env.RESEND_API_KEY);

type BookingPricingFields = {
  ratePerDay?: number | null;
  billableDays?: number | null;
  estimatedTotal?: number | null;
  baseSubtotal?: number | null;
  discountAmount?: number | null;
  extraFeeAmount?: number | null;
  discountBreakdownItems?: PricingLineItem[] | null;
  extraFeeBreakdownItems?: PricingLineItem[] | null;
  finalPriceOverride?: number | null;
  pricingNote?: string | null;
};

type BookingEmailBase = {
  to: string;
  name: string;
  vehicle: string;
  pickupAt: string;
  returnAt: string;
  bookingId: number;
  vehicleImage?: string | null;
} & BookingPricingFields;

type AdminBookingEmail = {
  to: string;
  bookingId: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  vehicle: string;
  pickupAt: string;
  returnAt: string;
  vehicleImage?: string | null;
} & BookingPricingFields;

type RejectedEmail = BookingEmailBase & {
  reason?: string | null;
  mode: 'rejected' | 'cancelled';
};

type GuestMessageEmail = {
  to: string;
  name: string;
  bookingId: number;
  subject: string;
  message: string;
};

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

function formatRate(value?: number | null) {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }

  return `${formatMoney(value)} / day`;
}

function getFromAddress() {
  return 'Moon Rentals <onboarding@resend.dev>';
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getBaseUrl() {
  return (
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    ''
  ).replace(/\/+$/, '');
}

function toAbsoluteUrl(value?: string | null) {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    if (/localhost|127\.0\.0\.1/i.test(trimmed)) {
      return null;
    }
    return trimmed;
  }

  const baseUrl = getBaseUrl();

  if (!baseUrl || /localhost|127\.0\.0\.1/i.test(baseUrl)) {
    return null;
  }

  if (trimmed.startsWith('/')) {
    return `${baseUrl}${trimmed}`;
  }

  return `${baseUrl}/${trimmed}`;
}

function getAdminUrl() {
  const baseUrl = getBaseUrl();
  return baseUrl ? `${baseUrl}/admin` : '#';
}

function getStatusBadge(status: string) {
  return `
    <div style="display:inline-block; padding:8px 14px; border-radius:999px; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; background:#f3f4f6; color:#111827; border:1px solid #e5e7eb;">
      ${escapeHtml(status)}
    </div>
  `;
}

function getCtaButton(label: string, href: string) {
  return `
    <a
      href="${escapeHtml(href)}"
      style="display:inline-block; background:#111111; color:#ffffff; text-decoration:none; padding:14px 22px; border-radius:12px; font-size:14px; font-weight:700;"
    >
      ${escapeHtml(label)}
    </a>
  `;
}

function getDetailRow(label: string, value: string) {
  return `
    <tr>
      <td style="padding:16px 18px; font-size:14px; color:#6b7280; border-bottom:1px solid #e5e7eb; width:42%; background:#fafafa; font-weight:600;">
        ${escapeHtml(label)}
      </td>
      <td style="padding:16px 18px; font-size:15px; color:#111827; border-bottom:1px solid #e5e7eb;">
        ${value}
      </td>
    </tr>
  `;
}

function getSummaryTable({
  bookingId,
  vehicle,
  pickupAt,
  returnAt,
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
  status,
  includeCustomer,
  customerName,
  customerEmail,
  customerPhone,
}: {
  bookingId: number;
  vehicle: string;
  pickupAt: string;
  returnAt: string;
  status: string;
  includeCustomer?: boolean;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
} & BookingPricingFields) {
  const rows = [
    getDetailRow('Booking ID', `<strong>#${bookingId}</strong>`),
    ...(includeCustomer && customerName
      ? [getDetailRow('Customer', escapeHtml(customerName))]
      : []),
    ...(includeCustomer && customerEmail
      ? [
          getDetailRow(
            'Email',
            `<a href="mailto:${escapeHtml(customerEmail)}" style="color:#2563eb; text-decoration:underline;">${escapeHtml(customerEmail)}</a>`
          ),
        ]
      : []),
    ...(includeCustomer && customerPhone
      ? [getDetailRow('Phone', escapeHtml(customerPhone))]
      : []),
    getDetailRow('Vehicle', escapeHtml(vehicle)),
    getDetailRow('Pickup', escapeHtml(formatDateTime(pickupAt))),
    getDetailRow('Return', escapeHtml(formatDateTime(returnAt))),
    getDetailRow('Rate', escapeHtml(formatRate(ratePerDay))),
    getDetailRow(
      'Billable Days',
      billableDays == null ? '—' : escapeHtml(String(billableDays))
    ),
    getDetailRow('Base Subtotal', escapeHtml(formatMoney(baseSubtotal ?? estimatedTotal))),
    ...(discountAmount && discountAmount > 0
      ? [
          getDetailRow(
            'Discounts',
            escapeHtml(`-${formatMoney(discountAmount)}`) +
              (discountBreakdownItems?.length
                ? `<div style="margin-top:8px; color:#6b7280; font-size:13px; line-height:1.6;">${discountBreakdownItems
                    .map((item) => `• ${escapeHtml(item.label)}: -${escapeHtml(formatMoney(item.amount))}`)
                    .join('<br />')}</div>`
                : '')
          ),
        ]
      : []),
    ...(extraFeeAmount && extraFeeAmount > 0
      ? [
          getDetailRow(
            'Extra Fees',
            escapeHtml(formatMoney(extraFeeAmount)) +
              (extraFeeBreakdownItems?.length
                ? `<div style="margin-top:8px; color:#6b7280; font-size:13px; line-height:1.6;">${extraFeeBreakdownItems
                    .map((item) => `• ${escapeHtml(item.label)}: ${escapeHtml(formatMoney(item.amount))}`)
                    .join('<br />')}</div>`
                : '')
          ),
        ]
      : []),
    ...(finalPriceOverride != null
      ? [getDetailRow('Final Price Override', escapeHtml(formatMoney(finalPriceOverride)))]
      : []),
    ...(pricingNote?.trim() ? [getDetailRow('Pricing Note', escapeHtml(pricingNote.trim()))] : []),
    getDetailRow('Final Total', `<strong>${escapeHtml(formatMoney(estimatedTotal))}</strong>`),
    getDetailRow('Status', getStatusBadge(status)),
  ].join('');

  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate; border-spacing:0; border:1px solid #e5e7eb; border-radius:18px; overflow:hidden; background:#ffffff;">
      ${rows}
    </table>
  `;
}

function getVehicleImageBlock(vehicleImage?: string | null, vehicle?: string) {
  const src = toAbsoluteUrl(vehicleImage);

  if (!src) {
    return '';
  }

  return `
    <div style="margin:0 0 24px 0;">
      <img
        src="${escapeHtml(src)}"
        alt="${escapeHtml(vehicle || 'Vehicle image')}"
        style="display:block; width:100%; max-width:560px; height:auto; border-radius:18px; border:1px solid #e5e7eb;"
      />
    </div>
  `;
}

function getEmailShell({
  eyebrow,
  title,
  subtitle,
  sectionLabel,
  introHtml,
  bodyHtml,
  footerNote,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  sectionLabel: string;
  introHtml: string;
  bodyHtml: string;
  footerNote: string;
}) {
  return `
    <!doctype html>
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(title)}</title>
      </head>
      <body style="margin:0; padding:0; background:#f3f4f6; font-family:Arial, Helvetica, sans-serif; color:#111827;">
        <div style="padding:28px 10px;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:640px; margin:0 auto; border-collapse:separate; border-spacing:0; background:#ffffff; border:1px solid #e5e7eb; border-radius:20px; overflow:hidden;">
            <tr>
              <td style="background:#0a0a0a; color:#ffffff; padding:22px 30px 26px 30px;">
                <div style="font-size:13px; letter-spacing:0.2em; font-weight:700; text-transform:uppercase; opacity:0.9;">
                  ${escapeHtml(eyebrow)}
                </div>
                <div style="margin-top:12px; font-size:24px; line-height:1.25; font-weight:800;">
                  ${escapeHtml(title)}
                </div>
                <div style="margin-top:10px; font-size:16px; line-height:1.6; color:#e5e7eb;">
                  ${escapeHtml(subtitle)}
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:32px 30px 24px 30px;">
                <div style="font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#6b7280; font-weight:700; margin-bottom:22px;">
                  ${escapeHtml(sectionLabel)}
                </div>

                ${introHtml}
                ${bodyHtml}
              </td>
            </tr>

            <tr>
              <td style="padding:18px 30px 26px 30px; border-top:1px solid #e5e7eb; color:#6b7280; font-size:13px; line-height:1.7;">
                <div style="font-weight:700; color:#6b7280;">Moon Rentals</div>
                <div>${escapeHtml(footerNote)}</div>
              </td>
            </tr>
          </table>
        </div>
      </body>
    </html>
  `;
}

export async function sendBookingReceivedEmail({
  to,
  name,
  vehicle,
  pickupAt,
  returnAt,
  bookingId,
  vehicleImage,
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
}: BookingEmailBase) {
  try {
    await resend.emails.send({
      from: getFromAddress(),
      to,
      subject: 'Booking Request Received - Moon Rentals',
      html: getEmailShell({
        eyebrow: 'Moon Rentals',
        title: 'Booking Request Received',
        subtitle:
          'Your booking request has been received and is now pending review.',
        sectionLabel: 'Reservation Submitted',
        introHtml: `
          <div style="font-size:16px; line-height:1.8; color:#111827; margin-bottom:22px;">
            Hi ${escapeHtml(name)},
            <br /><br />
            Thanks for booking with Moon Rentals. Your request has been received successfully and is waiting for admin approval.
          </div>
        `,
        bodyHtml: `
          ${getVehicleImageBlock(vehicleImage, vehicle)}
          ${getSummaryTable({
            bookingId,
            vehicle,
            pickupAt,
            returnAt,
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
            status: 'Pending approval',
          })}
          <div style="margin-top:26px; font-size:16px; line-height:1.8; color:#111827;">
            We’ll review the request and follow up as soon as possible with the next step.
            <br /><br />
            — Moon Rentals
          </div>
        `,
        footerNote:
          'Booking notifications sent automatically from your reservation system.',
      }),
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
  vehicleImage,
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
}: BookingEmailBase) {
  try {
    await resend.emails.send({
      from: getFromAddress(),
      to,
      subject: 'Booking Confirmed - Moon Rentals',
      html: getEmailShell({
        eyebrow: 'Moon Rentals',
        title: 'Your Booking Is Confirmed',
        subtitle: 'Your reservation has been approved and is now confirmed.',
        sectionLabel: 'Reservation Approved',
        introHtml: `
          <div style="font-size:16px; line-height:1.8; color:#111827; margin-bottom:22px;">
            Hi ${escapeHtml(name)},
            <br /><br />
            Great news — your booking has been approved. Your reservation details are below.
          </div>
        `,
        bodyHtml: `
          ${getVehicleImageBlock(vehicleImage, vehicle)}
          ${getSummaryTable({
            bookingId,
            vehicle,
            pickupAt,
            returnAt,
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
            status: 'Confirmed',
          })}
          <div style="margin-top:26px; font-size:16px; line-height:1.8; color:#111827;">
            If you have any questions before pickup, just reply to this email.
            <br /><br />
            — Moon Rentals
          </div>
        `,
        footerNote:
          'This confirmation was sent automatically from your reservation system.',
      }),
    });
  } catch (err) {
    console.error('sendBookingApprovedEmail failed:', err);
  }
}

export async function sendBookingQuoteUpdatedEmail({
  to,
  name,
  vehicle,
  pickupAt,
  returnAt,
  bookingId,
  vehicleImage,
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
}: BookingEmailBase) {
  try {
    await resend.emails.send({
      from: getFromAddress(),
      to,
      subject: 'Updated Booking Quote - Moon Rentals',
      html: getEmailShell({
        eyebrow: 'Moon Rentals',
        title: 'Your Updated Booking Quote',
        subtitle: 'Here is the latest pricing breakdown for your reservation.',
        sectionLabel: 'Quote Update',
        introHtml: `
          <div style="font-size:16px; line-height:1.8; color:#111827; margin-bottom:22px;">
            Hi ${escapeHtml(name)},
            <br /><br />
            We updated the pricing for your reservation. The current quote and itemized adjustments are below.
          </div>
        `,
        bodyHtml: `
          ${getVehicleImageBlock(vehicleImage, vehicle)}
          ${getSummaryTable({
            bookingId,
            vehicle,
            pickupAt,
            returnAt,
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
            status: 'Quote updated',
          })}
          <div style="margin-top:26px; font-size:16px; line-height:1.8; color:#111827;">
            If you have any questions about this quote, just reply to this email.
            <br /><br />
            — Moon Rentals
          </div>
        `,
        footerNote: 'This quote update was sent from your reservation system.',
      }),
    });
  } catch (err) {
    console.error('sendBookingQuoteUpdatedEmail failed:', err);
  }
}

export async function sendBookingRejectedEmail({
  to,
  name,
  vehicle,
  pickupAt,
  returnAt,
  bookingId,
  vehicleImage,
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
  reason,
  mode,
}: RejectedEmail) {
  const title =
    mode === 'cancelled' ? 'Your Booking Has Been Cancelled' : 'Booking Request Update';

  const subtitle =
    mode === 'cancelled'
      ? 'Your confirmed booking has been cancelled.'
      : 'Your booking request was not approved.';

  const statusLabel = mode === 'cancelled' ? 'Cancelled' : 'Not approved';

  const intro =
    mode === 'cancelled'
      ? `Hi ${escapeHtml(name)},<br /><br />We wanted to let you know that your confirmed booking has been cancelled.`
      : `Hi ${escapeHtml(name)},<br /><br />Thank you for your interest in booking with Moon Rentals. At this time, we’re unable to approve this request.`;

  const reasonBlock =
    reason && reason.trim()
      ? `
        <div style="margin-top:22px; padding:18px; border:1px solid #f3d2d2; border-radius:16px; background:#fff7f7;">
          <div style="font-size:12px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#b91c1c; margin-bottom:8px;">
            Message from Moon Rentals
          </div>
          <div style="font-size:15px; line-height:1.7; color:#111827;">
            ${escapeHtml(reason.trim())}
          </div>
        </div>
      `
      : '';

  try {
    await resend.emails.send({
      from: getFromAddress(),
      to,
      subject:
        mode === 'cancelled'
          ? 'Booking Cancelled - Moon Rentals'
          : 'Booking Request Update - Moon Rentals',
      html: getEmailShell({
        eyebrow: 'Moon Rentals',
        title,
        subtitle,
        sectionLabel: 'Reservation Update',
        introHtml: `
          <div style="font-size:16px; line-height:1.8; color:#111827; margin-bottom:22px;">
            ${intro}
          </div>
        `,
        bodyHtml: `
          ${getVehicleImageBlock(vehicleImage, vehicle)}
          ${getSummaryTable({
            bookingId,
            vehicle,
            pickupAt,
            returnAt,
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
            status: statusLabel,
          })}
          ${reasonBlock}
          <div style="margin-top:26px; font-size:16px; line-height:1.8; color:#111827;">
            Please reply to this email if you’d like to discuss other availability or have any questions.
            <br /><br />
            — Moon Rentals
          </div>
        `,
        footerNote: 'This reservation update was sent automatically from your booking system.',
      }),
    });
  } catch (err) {
    console.error('sendBookingRejectedEmail failed:', err);
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
  vehicleImage,
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
}: AdminBookingEmail) {
  try {
    await resend.emails.send({
      from: getFromAddress(),
      to,
      subject: `New Booking Pending Review #${bookingId} - Moon Rentals`,
      html: getEmailShell({
        eyebrow: 'Moon Rentals',
        title: 'New Booking Pending Review',
        subtitle:
          'A new booking request has been submitted and is waiting for review.',
        sectionLabel: 'Admin Alert',
        introHtml: `
          <div style="font-size:16px; line-height:1.8; color:#111827; margin-bottom:22px;">
            A new booking request has been submitted through the Moon Rentals website.
          </div>
        `,
        bodyHtml: `
          ${getVehicleImageBlock(vehicleImage, vehicle)}
          ${getSummaryTable({
            bookingId,
            vehicle,
            pickupAt,
            returnAt,
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
            status: 'Pending approval',
            includeCustomer: true,
            customerName,
            customerEmail,
            customerPhone,
          })}
          <div style="margin-top:26px;">
            ${getCtaButton('Open Admin Dashboard', getAdminUrl())}
          </div>
          <div style="margin-top:22px; font-size:16px; line-height:1.8; color:#111827;">
            Log in to the admin dashboard to review and approve or decline this request.
            <br /><br />
            — Moon Rentals System
          </div>
        `,
        footerNote: 'Administrative booking alert sent automatically.',
      }),
    });
  } catch (err) {
    console.error('sendAdminNewBookingEmail failed:', err);
  }
}

export async function sendGuestMessageEmail({
  to,
  name,
  bookingId,
  subject,
  message,
}: GuestMessageEmail) {
  try {
    await resend.emails.send({
      from: getFromAddress(),
      to,
      subject,
      html: getEmailShell({
        eyebrow: 'Moon Rentals',
        title: subject,
        subtitle: `Message regarding booking #${bookingId}.`,
        sectionLabel: 'Guest Communication',
        introHtml: `
          <div style="font-size:16px; line-height:1.8; color:#111827; margin-bottom:22px;">
            Hi ${escapeHtml(name)},
            <br /><br />
            A member of the Moon Rentals team sent you the message below regarding your booking.
          </div>
        `,
        bodyHtml: `
          <div style="padding:20px; border:1px solid #e5e7eb; border-radius:18px; background:#fafafa;">
            <div style="font-size:15px; line-height:1.8; color:#111827; white-space:pre-wrap;">
              ${escapeHtml(message)}
            </div>
          </div>
          <div style="margin-top:26px; font-size:16px; line-height:1.8; color:#111827;">
            You can reply to this email if you need anything else.
            <br /><br />
            — Moon Rentals
          </div>
        `,
        footerNote: 'This message was sent from the Moon Rentals admin dashboard.',
      }),
    });
  } catch (err) {
    console.error('sendGuestMessageEmail failed:', err);
  }
}
