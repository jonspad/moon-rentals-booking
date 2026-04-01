'use client';

import { useEffect, useState } from 'react';

type Booking = {
  id: number;
  vehicleId: number;
  pickupAt: string;
  returnAt: string;
  fullName: string;
  email: string;
  phone: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
};

type Vehicle = {
  id: number;
  slug: string;
  vin: string | null;
  year: number;
  make: string;
  model: string;
  category: string;
  seats: number;
  transmission: string;
  pricePerDay: number;
  image: string;
  description: string;
  isActive: boolean;
};

function formatDateTime(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadBookings() {
    const res = await fetch('/api/bookings', { cache: 'no-store' });
    const rawText = await res.text();

    if (!res.ok) {
      throw new Error(`Failed to load bookings: ${res.status}`);
    }

    const data = rawText ? JSON.parse(rawText) : {};
    setBookings(Array.isArray(data.bookings) ? data.bookings : []);
  }

  async function loadVehicles() {
    const res = await fetch('/api/vehicles', { cache: 'no-store' });
    const rawText = await res.text();

    if (!res.ok) {
      throw new Error(`Failed to load vehicles: ${res.status}`);
    }

    const data = rawText ? JSON.parse(rawText) : {};
    setVehicles(Array.isArray(data.vehicles) ? data.vehicles : []);
  }

  async function refreshData() {
    try {
      setLoading(true);
      setError('');
      await Promise.all([loadBookings(), loadVehicles()]);
    } catch (err) {
      console.error('Failed to load admin bookings page data:', err);
      setError('Failed to load bookings data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshData();
  }, []);

  async function updateStatus(
    bookingId: number,
    status: 'pending' | 'confirmed' | 'cancelled'
  ) {
    setUpdatingId(bookingId);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: bookingId,
          status,
        }),
      });

      const rawText = await res.text();
      const data = rawText ? JSON.parse(rawText) : {};

      if (!res.ok) {
        setError(data.error || 'Failed to update booking status.');
        return;
      }

      setMessage(`Booking #${bookingId} updated to ${status}.`);
      await loadBookings();
    } catch (err) {
      console.error('Failed to update booking status:', err);
      setError('Failed to update booking status.');
    } finally {
      setUpdatingId(null);
    }
  }

  async function deleteBooking(bookingId: number) {
    const confirmed = window.confirm(
      `Delete booking #${bookingId}? This cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(bookingId);
    setError('');
    setMessage('');

    try {
      const res = await fetch(`/api/bookings?id=${bookingId}`, {
        method: 'DELETE',
        cache: 'no-store',
      });

      const rawText = await res.text();
      const data = rawText ? JSON.parse(rawText) : {};

      if (!res.ok) {
        setError(data.error || 'Failed to delete booking.');
        return;
      }

      setMessage(`Booking #${bookingId} deleted successfully.`);
      await loadBookings();
    } catch (err) {
      console.error('Failed to delete booking:', err);
      setError('Failed to delete booking.');
    } finally {
      setDeletingId(null);
    }
  }

  function getVehicleLabel(vehicleId: number) {
    const vehicle = vehicles.find((v) => v.id === vehicleId);

    if (!vehicle) return `Vehicle ${vehicleId}`;

    return `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  }

  function getStatusClasses(status: Booking['status']) {
    if (status === 'confirmed') {
      return 'bg-green-50 text-green-700 border-green-200';
    }

    if (status === 'cancelled') {
      return 'bg-red-50 text-red-700 border-red-200';
    }

    return 'bg-yellow-50 text-yellow-700 border-yellow-200';
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Bookings</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Review customer booking requests, update status, or remove a booking.
        </p>
      </div>

      {message ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
          Loading bookings...
        </div>
      ) : bookings.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
          No bookings found yet.
        </div>
      ) : (
        bookings
          .slice()
          .sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          .map((booking) => (
            <div
              key={booking.id}
              className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-950"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold">
                      {getVehicleLabel(booking.vehicleId)}
                    </h3>
                    <span className="text-sm text-gray-500">
                      Booking #{booking.id}
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${getStatusClasses(
                        booking.status
                      )}`}
                    >
                      {booking.status}
                    </span>
                  </div>

                  <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                    <p>
                      <span className="font-medium text-black dark:text-white">
                        Customer:
                      </span>{' '}
                      {booking.fullName}
                    </p>
                    <p>
                      <span className="font-medium text-black dark:text-white">
                        Email:
                      </span>{' '}
                      {booking.email}
                    </p>
                    <p>
                      <span className="font-medium text-black dark:text-white">
                        Phone:
                      </span>{' '}
                      {booking.phone}
                    </p>
                    <p>
                      <span className="font-medium text-black dark:text-white">
                        Pickup:
                      </span>{' '}
                      {formatDateTime(booking.pickupAt)}
                    </p>
                    <p>
                      <span className="font-medium text-black dark:text-white">
                        Return:
                      </span>{' '}
                      {formatDateTime(booking.returnAt)}
                    </p>
                    <p>
                      <span className="font-medium text-black dark:text-white">
                        Created:
                      </span>{' '}
                      {formatDateTime(booking.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => updateStatus(booking.id, 'confirmed')}
                    disabled={updatingId === booking.id || booking.status === 'confirmed'}
                    className="rounded-xl border px-4 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    {updatingId === booking.id && booking.status !== 'confirmed'
                      ? 'Updating...'
                      : 'Confirm'}
                  </button>

                  <button
                    type="button"
                    onClick={() => updateStatus(booking.id, 'cancelled')}
                    disabled={updatingId === booking.id || booking.status === 'cancelled'}
                    className="rounded-xl border px-4 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    {updatingId === booking.id && booking.status !== 'cancelled'
                      ? 'Updating...'
                      : 'Cancel'}
                  </button>

                  <button
                    type="button"
                    onClick={() => updateStatus(booking.id, 'pending')}
                    disabled={updatingId === booking.id || booking.status === 'pending'}
                    className="rounded-xl border px-4 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    {updatingId === booking.id && booking.status !== 'pending'
                      ? 'Updating...'
                      : 'Mark Pending'}
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteBooking(booking.id)}
                    disabled={deletingId === booking.id}
                    className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
                  >
                    {deletingId === booking.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          ))
      )}k
    </section>
  );
}