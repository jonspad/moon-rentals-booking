'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function formatDateTime(value: string | null) {
  if (!value) return 'N/A';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';

  return date.toLocaleString([], {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getDurationMs(start: string | null, end: string | null) {
  if (!start || !end) return 0;

  const startDate = new Date(start);
  const endDate = new Date(end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return 0;
  }

  const diff = endDate.getTime() - startDate.getTime();
  return diff > 0 ? diff : 0;
}

function getBillableDays(start: string | null, end: string | null) {
  const durationMs = getDurationMs(start, end);

  if (durationMs <= 0) return 0;

  const dayMs = 24 * 60 * 60 * 1000;
  return Math.ceil(durationMs / dayMs);
}

function formatRentalLength(start: string | null, end: string | null) {
  const durationMs = getDurationMs(start, end);

  if (durationMs <= 0) return '—';

  const totalMinutes = Math.floor(durationMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days} day${days === 1 ? '' : 's'}`);
  }

  if (hours > 0) {
    parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  }

  if (minutes > 0) {
    parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
  }

  return parts.join(', ');
}

function formatCurrency(value: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
    return '—';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

export default function BookingConfirmationPage() {
  const searchParams = useSearchParams();

  const bookingId = searchParams.get('bookingId');
  const name = searchParams.get('name');
  const vehicle = searchParams.get('vehicle');
  const pickupAt = searchParams.get('pickupAt');
  const returnAt = searchParams.get('returnAt');
  const pricePerDayParam = searchParams.get('pricePerDay');

  const pricePerDay = pricePerDayParam ? Number(pricePerDayParam) : null;
  const billableDays = getBillableDays(pickupAt, returnAt);
  const rentalLength = formatRentalLength(pickupAt, returnAt);
  const estimatedTotal =
    typeof pricePerDay === 'number' && billableDays > 0
      ? pricePerDay * billableDays
      : null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-50 to-neutral-100 px-6 py-12 text-neutral-900">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <Link
            href="/vehicles"
            className="inline-flex items-center text-sm font-medium text-neutral-600 transition hover:text-black"
          >
            ← Back to Fleet
          </Link>
        </div>

        <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-xl">
          <div className="border-b border-neutral-200 bg-neutral-50 px-8 py-8">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl shadow-sm">
                ✓
              </div>

              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-green-700">
                  Reservation Submitted
                </p>
                <h1 className="mt-1 text-3xl font-bold tracking-tight">
                  Booking Request Received
                </h1>
                <p className="mt-2 text-sm text-neutral-600">
                  Your request has been recorded and is now pending admin approval.
                </p>
              </div>
            </div>
          </div>

          <div className="px-8 py-8">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Booking ID
                </p>
                <p className="mt-2 text-2xl font-bold text-neutral-900">
                  #{bookingId || 'N/A'}
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Guest
                </p>
                <p className="mt-2 text-lg font-semibold text-neutral-900">
                  {name || 'N/A'}
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Vehicle
                </p>
                <p className="mt-2 text-lg font-semibold text-neutral-900">
                  {vehicle || 'N/A'}
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Pickup
                </p>
                <p className="mt-2 text-base font-medium text-neutral-900">
                  {formatDateTime(pickupAt)}
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Return
                </p>
                <p className="mt-2 text-base font-medium text-neutral-900">
                  {formatDateTime(returnAt)}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-neutral-900">
                Pricing Summary
              </h2>

              <div className="mt-4 space-y-3 text-sm text-neutral-700">
                <div className="flex items-center justify-between gap-4">
                  <span>Rental Length</span>
                  <span className="font-medium text-neutral-900">{rentalLength}</span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span>Billable Days</span>
                  <span className="font-medium text-neutral-900">
                    {billableDays > 0 ? billableDays : '—'}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span>Daily Rate</span>
                  <span className="font-medium text-neutral-900">
                    {formatCurrency(pricePerDay)}
                  </span>
                </div>

                <div className="border-t border-neutral-200 pt-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-base font-semibold text-neutral-900">
                      Estimated Total
                    </span>
                    <span className="text-2xl font-bold text-neutral-900">
                      {formatCurrency(estimatedTotal)}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-neutral-500">
                  Pricing shown as an estimate using full-day billing rounded up
                  to the next day.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
              <h2 className="text-lg font-semibold">What happens next?</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                Your booking request is currently pending approval. Please keep
                your booking ID for reference. Our team can review the request,
                confirm availability, and follow up with next steps.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/vehicles"
                className="inline-flex items-center justify-center rounded-2xl border border-neutral-300 px-5 py-3 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-100"
              >
                Browse Fleet
              </Link>

              <Link
                href="/book"
                className="inline-flex items-center justify-center rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                Make Another Booking
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}