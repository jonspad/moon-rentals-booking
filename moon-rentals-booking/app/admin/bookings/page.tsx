'use client';

import { useEffect, useMemo, useState } from 'react';

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

function getStatusClasses(status: Booking['status']) {
  if (status === 'confirmed') {
    return 'border-green-200 bg-green-50 text-green-700';
  }

  if (status === 'cancelled') {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  return 'border-yellow-200 bg-yellow-50 text-yellow-700';
}

function getStatusPriority(status: Booking['status']) {
  if (status === 'pending') return 0;
  if (status === 'confirmed') return 1;
  return 2;
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

      if (status === 'confirmed') {
        setMessage(`Booking #${bookingId} approved.`);
      } else if (status === 'cancelled') {
        setMessage(`Booking #${bookingId} rejected.`);
      } else {
        setMessage(`Booking #${bookingId} moved back to pending.`);
      }

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

  const sortedBookings = useMemo(() => {
    return bookings
      .slice()
      .sort((a, b) => {
        const statusDiff =
          getStatusPriority(a.status) - getStatusPriority(b.status);

        if (statusDiff !== 0) return statusDiff;

        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
  }, [bookings]);

  const pendingCount = bookings.filter((b) => b.status === 'pending').length;
  const confirmedCount = bookings.filter(
    (b) => b.status === 'confirmed'
  ).length;
  const cancelledCount = bookings.filter(
    (b) => b.status === 'cancelled'
  ).length;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
              Bookings
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-gray-300">
              Review customer booking requests, approve or reject them, and keep
              the reservation workflow organized.
            </p>
          </div>

          <button
            onClick={refreshData}
            className="inline-flex rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-50 dark:border-gray-700 dark:text-white dark:hover:bg-gray-900"
          >
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5 shadow-sm">
          <div className="text-sm font-medium text-yellow-800">
            Pending Approval
          </div>
          <div className="mt-2 text-3xl font-semibold text-yellow-900">
            {pendingCount}
          </div>
          <p className="mt-2 text-sm text-yellow-800">
            Booking requests that still need action.
          </p>
        </div>

        <div className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm">
          <div className="text-sm font-medium text-green-800">Approved</div>
          <div className="mt-2 text-3xl font-semibold text-green-900">
            {confirmedCount}
          </div>
          <p className="mt-2 text-sm text-green-800">
            Reservations that have been approved.
          </p>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
          <div className="text-sm font-medium text-red-800">Rejected</div>
          <div className="mt-2 text-3xl font-semibold text-red-900">
            {cancelledCount}
          </div>
          <p className="mt-2 text-sm text-red-800">
            Requests that were declined or cancelled.
          </p>
        </div>
      </section>

      {message ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        {loading ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
            Loading bookings...
          </div>
        ) : sortedBookings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
            No bookings found yet.
          </div>
        ) : (
          <div className="space-y-4">
            {sortedBookings.map((booking) => {
              const statusClasses = getStatusClasses(booking.status);
              const isPending = booking.status === 'pending';
              const isConfirmed = booking.status === 'confirmed';
              const isCancelled = booking.status === 'cancelled';

              return (
                <div
                  key={booking.id}
                  className={`rounded-2xl border p-5 shadow-sm ${
                    isPending
                      ? 'border-yellow-200 bg-yellow-50/60'
                      : isConfirmed
                      ? 'border-green-200 bg-green-50/50'
                      : 'border-red-200 bg-red-50/40'
                  }`}
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                          {getVehicleLabel(booking.vehicleId)}
                        </h2>

                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium capitalize ${statusClasses}`}
                        >
                          {booking.status}
                        </span>

                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Booking #{booking.id}
                        </span>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Customer
                          </div>
                          <div className="mt-1 font-medium text-gray-900 dark:text-white">
                            {booking.fullName}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-300">
                            {booking.email}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-300">
                            {booking.phone}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Pickup
                          </div>
                          <div className="mt-1 text-sm text-gray-800 dark:text-gray-200">
                            {formatDateTime(booking.pickupAt)}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Return
                          </div>
                          <div className="mt-1 text-sm text-gray-800 dark:text-gray-200">
                            {formatDateTime(booking.returnAt)}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Submitted
                          </div>
                          <div className="mt-1 text-sm text-gray-800 dark:text-gray-200">
                            {formatDateTime(booking.createdAt)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex min-w-[260px] flex-col gap-3 xl:items-stretch">
                      <button
                        onClick={() => updateStatus(booking.id, 'confirmed')}
                        disabled={updatingId === booking.id || isConfirmed}
                        className="rounded-xl border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {updatingId === booking.id && !isConfirmed
                          ? 'Updating...'
                          : 'Approve'}
                      </button>

                      <button
                        onClick={() => updateStatus(booking.id, 'cancelled')}
                        disabled={updatingId === booking.id || isCancelled}
                        className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {updatingId === booking.id && !isCancelled
                          ? 'Updating...'
                          : 'Reject'}
                      </button>

                      <button
                        onClick={() => updateStatus(booking.id, 'pending')}
                        disabled={updatingId === booking.id || isPending}
                        className="rounded-xl border border-yellow-300 bg-yellow-50 px-4 py-2 text-sm font-medium text-yellow-700 transition hover:bg-yellow-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {updatingId === booking.id && !isPending
                          ? 'Updating...'
                          : 'Mark Pending'}
                      </button>

                      <button
                        onClick={() => deleteBooking(booking.id)}
                        disabled={deletingId === booking.id}
                        className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900"
                      >
                        {deletingId === booking.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}