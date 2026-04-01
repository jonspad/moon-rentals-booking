'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function formatDateTime(value: string | null) {
  if (!value) return 'N/A';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';

  return date.toLocaleString();
}

export default function BookingConfirmationPage() {
  const searchParams = useSearchParams();

  const bookingId = searchParams.get('bookingId');
  const name = searchParams.get('name');
  const vehicle = searchParams.get('vehicle');
  const pickupAt = searchParams.get('pickupAt');
  const returnAt = searchParams.get('returnAt');

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-50 to-neutral-100 px-6 py-12 text-neutral-900">
      <div className="mx-auto max-w-3xl">
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
                  Booking Confirmed
                </h1>
                <p className="mt-2 text-sm text-neutral-600">
                  Your request has been successfully recorded for Moon Rentals.
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

            <div className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
              <h2 className="text-lg font-semibold">What happens next?</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                Please keep your booking ID for reference. You can continue browsing
                the fleet or start another reservation below.
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