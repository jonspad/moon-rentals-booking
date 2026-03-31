'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function BookingConfirmation() {
  const params = useSearchParams();

  const name = params.get('name');
  const vehicle = params.get('vehicle');
  const pickupAt = params.get('pickupAt');
  const returnAt = params.get('returnAt');

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-center">
      <h1 className="text-4xl font-bold">Booking Request Submitted</h1>

      <p className="mt-4 text-gray-600 dark:text-gray-300">
        Thank you{name ? `, ${name}` : ''}. Your request has been received.
      </p>

      <div className="mt-10 rounded-2xl border border-gray-300 p-6 text-left dark:border-gray-700">
        <h2 className="text-xl font-semibold">Booking Details</h2>

        <div className="mt-4 space-y-2 text-sm">
          {vehicle && (
            <p>
              <strong>Vehicle:</strong> {vehicle}
            </p>
          )}

          {pickupAt && (
            <p>
              <strong>Pickup:</strong> {pickupAt}
            </p>
          )}

          {returnAt && (
            <p>
              <strong>Return:</strong> {returnAt}
            </p>
          )}
        </div>
      </div>

      <div className="mt-10 flex justify-center gap-4">
        <Link
          href="/"
          className="rounded-xl border border-gray-300 px-6 py-3 dark:border-gray-700"
        >
          Back to Home
        </Link>

        <Link
          href="/book"
          className="rounded-xl border border-gray-300 px-6 py-3 dark:border-gray-700"
        >
          Book Another Vehicle
        </Link>
      </div>
    </main>
  );
}