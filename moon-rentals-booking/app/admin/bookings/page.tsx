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
        headers: { 'Content-Type': 'application/json' },
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
    <section>
      <h2 className="text-2xl font-semibold">Bookings</h2>
      <p className="mt-2 text-gray-600 dark:text-gray-300">
        Review customer booking requests and update status.
      </p>

      {message ? <p className="mt-4 text-sm text-green-600">{message}</p> : null}
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <div className="mt-8 space-y-4">
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading bookings...</p>
        ) : bookings.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No bookings found yet.
          </p>
        ) : (
          bookings
            .slice()
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )
            .map((booking) => (
              <div
                key={booking.id}
                className="rounded-2xl border border-gray-300 bg-white p-5 dark:border-gray-700 dark:bg-gray-950"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">
                      {getVehicleLabel(booking.vehicleId)}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      Booking #{booking.id}
                    </p>
                  </div>

                  <div
                    className={`rounded-xl border px-3 py-1 text-sm font-medium ${getStatusClasses(
                      booking.status
                    )}`}
                  >
                    {booking.status}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-sm">
                      <span className="font-medium">Customer:</span>{' '}
                      {booking.fullName}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Email:</span> {booking.email}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Phone:</span> {booking.phone}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm">
                      <span className="font-medium">Pickup:</span>{' '}
                      {formatDateTime(booking.pickupAt)}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Return:</span>{' '}
                      {formatDateTime(booking.returnAt)}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Created:</span>{' '}
                      {formatDateTime(booking.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
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
                </div>
              </div>
            ))
        )}
      </div>
    </section>
  );
}