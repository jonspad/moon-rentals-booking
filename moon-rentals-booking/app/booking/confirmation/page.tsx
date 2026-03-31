'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function BookingConfirmationPage() {
  const searchParams = useSearchParams();

  const bookingId = searchParams.get('bookingId') || '';
  const name = searchParams.get('name') || '';
  const vehicle = searchParams.get('vehicle') || '';
  const pickupAt = searchParams.get('pickupAt') || '';
  const returnAt = searchParams.get('returnAt') || '';

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-black dark:text-white">
      <div className="rounded-3xl border border-gray-300 bg-white p-8 dark:border-gray-700 dark:bg-black">
        <h1 className="text-4xl font-bold">Booking Request Submitted</h1>

        <p className="mt-4 text-gray-600 dark:text-gray-300">
          Thank you{name ? `, ${name}` : ''}. Your booking request has been received.
        </p>

        <div className="mt-8 rounded-2xl bg-gray-100 p-5 dark:bg-gray-800">
          <h2 className="text-xl font-semibold">Booking Details</h2>

          <div className="mt-4 space-y-2 text-sm">
            <p>
              <span className="font-medium">Booking ID:</span>{' '}
              {bookingId || 'Not available'}
            </p>
            <p>
              <span className="font-medium">Vehicle:</span>{' '}
              {vehicle || 'Not provided'}
            </p>
            <p>
              <span className="font-medium">Pickup:</span>{' '}
              {pickupAt || 'Not provided'}
            </p>
            <p>
              <span className="font-medium">Return:</span>{' '}
              {returnAt || 'Not provided'}
            </p>
          </div>
        </div>

        <p className="mt-6 text-sm text-gray-600 dark:text-gray-300">
          We have saved your request as pending. An admin can now review and confirm it.
        </p>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/"
            className="rounded-xl border border-gray-300 px-5 py-3 font-medium dark:border-gray-700"
          >
            Back to Home
          </Link>

          <Link
            href="/book"
            className="rounded-xl border border-gray-300 px-5 py-3 font-medium dark:border-gray-700"
          >
            Book Another Vehicle
          </Link>
        </div>
      </div>
    </main>
  );
}