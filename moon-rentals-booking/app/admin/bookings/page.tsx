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
  rejectionReason: string | null;
  lastAdminMessageSubject: string | null;
  lastAdminMessageBody: string | null;
  lastAdminMessagedAt: string | null;
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

function formatDateTime(value: string | null) {
  if (!value) return '—';

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
  const [messagingId, setMessagingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [rejectionReasons, setRejectionReasons] = useState<Record<number, string>>({});
  const [messageSubjects, setMessageSubjects] = useState<Record<number, string>>({});
  const [messageBodies, setMessageBodies] = useState<Record<number, string>>({});
  const [openComposerId, setOpenComposerId] = useState<number | null>(null);

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
      const rejectionReason =
        status === 'cancelled' ? (rejectionReasons[bookingId] || '').trim() : '';

      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: bookingId,
          status,
          rejectionReason,
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

  async function sendGuestMessage(bookingId: number) {
    setMessagingId(bookingId);
    setError('');
    setMessage('');

    try {
      const subject = (messageSubjects[bookingId] || '').trim();
      const body = (messageBodies[bookingId] || '').trim();

      if (!subject || !body) {
        setError('Please enter both a subject and a message before sending.');
        return;
      }

      const res = await fetch('/api/bookings/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingId,
          subject,
          message: body,
        }),
      });

      const rawText = await res.text();
      const data = rawText ? JSON.parse(rawText) : {};

      if (!res.ok) {
        setError(data.error || 'Failed to send guest message.');
        return;
      }

      setMessage(`Message sent to guest for booking #${bookingId}.`);

      setMessageSubjects((prev) => ({
        ...prev,
        [bookingId]: '',
      }));

      setMessageBodies((prev) => ({
        ...prev,
        [bookingId]: '',
      }));

      await loadBookings();
    } catch (err) {
      console.error('Failed to send guest message:', err);
      setError('Failed to send guest message.');
    } finally {
      setMessagingId(null);
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
      return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800';
    }

    if (status === 'cancelled') {
      return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800';
    }

    return 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-800';
  }

  const fieldClassName =
    'mt-3 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:placeholder:text-neutral-500';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Bookings</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Review customer booking requests, approve or decline them, and message
          guests directly from the admin panel.
        </p>
      </div>

      {message ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white">
          Loading bookings...
        </div>
      ) : bookings.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white">
          No bookings found yet.
        </div>
      ) : (
        <div className="space-y-5">
          {bookings
            .slice()
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )
            .map((booking) => {
              const composerOpen = openComposerId === booking.id;

              return (
                <div
                  key={booking.id}
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2 text-gray-900 dark:text-white">
                      <div className="text-lg font-semibold">
                        {getVehicleLabel(booking.vehicleId)}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <span>Booking #{booking.id}</span>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(
                            booking.status
                          )}`}
                        >
                          {booking.status}
                        </span>
                      </div>

                      <div className="space-y-1 text-sm">
                        <div>
                          <span className="font-medium">Customer:</span>{' '}
                          {booking.fullName}
                        </div>
                        <div>
                          <span className="font-medium">Email:</span>{' '}
                          {booking.email}
                        </div>
                        <div>
                          <span className="font-medium">Phone:</span>{' '}
                          {booking.phone}
                        </div>
                        <div>
                          <span className="font-medium">Pickup:</span>{' '}
                          {formatDateTime(booking.pickupAt)}
                        </div>
                        <div>
                          <span className="font-medium">Return:</span>{' '}
                          {formatDateTime(booking.returnAt)}
                        </div>
                        <div>
                          <span className="font-medium">Created:</span>{' '}
                          {formatDateTime(booking.createdAt)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => updateStatus(booking.id, 'confirmed')}
                        disabled={
                          updatingId === booking.id ||
                          booking.status === 'confirmed'
                        }
                        className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 disabled:opacity-50 dark:border-neutral-700 dark:text-white"
                      >
                        {updatingId === booking.id &&
                        booking.status !== 'confirmed'
                          ? 'Updating...'
                          : 'Confirm'}
                      </button>

                      <button
                        type="button"
                        onClick={() => updateStatus(booking.id, 'cancelled')}
                        disabled={
                          updatingId === booking.id ||
                          booking.status === 'cancelled'
                        }
                        className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50 dark:border-red-800 dark:text-red-300"
                      >
                        {updatingId === booking.id &&
                        booking.status !== 'cancelled'
                          ? 'Updating...'
                          : 'Cancel / Reject'}
                      </button>

                      <button
                        type="button"
                        onClick={() => updateStatus(booking.id, 'pending')}
                        disabled={
                          updatingId === booking.id || booking.status === 'pending'
                        }
                        className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 disabled:opacity-50 dark:border-neutral-700 dark:text-white"
                      >
                        {updatingId === booking.id &&
                        booking.status !== 'pending'
                          ? 'Updating...'
                          : 'Mark Pending'}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setOpenComposerId((prev) =>
                            prev === booking.id ? null : booking.id
                          )
                        }
                        className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 dark:border-neutral-700 dark:text-white"
                      >
                        {composerOpen ? 'Close Message' : 'Message Guest'}
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteBooking(booking.id)}
                        disabled={deletingId === booking.id}
                        className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50 dark:border-red-800 dark:text-red-300"
                      >
                        {deletingId === booking.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-5 lg:grid-cols-2">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        Rejection / cancellation message
                      </div>
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                        This message will be included if you cancel or reject the
                        booking.
                      </p>

                      <textarea
                        value={rejectionReasons[booking.id] ?? booking.rejectionReason ?? ''}
                        onChange={(e) =>
                          setRejectionReasons((prev) => ({
                            ...prev,
                            [booking.id]: e.target.value,
                          }))
                        }
                        rows={5}
                        className={fieldClassName}
                        placeholder="Example: We’re unable to approve this request because the vehicle is unavailable for the requested dates."
                      />

                      {booking.rejectionReason ? (
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          Current saved message: {booking.rejectionReason}
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        Last guest message
                      </div>
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                        Most recent manual email sent from admin.
                      </p>

                      <div className="mt-3 space-y-2 text-sm text-gray-900 dark:text-white">
                        <div>
                          <span className="font-medium">Subject:</span>{' '}
                          {booking.lastAdminMessageSubject || '—'}
                        </div>
                        <div>
                          <span className="font-medium">Sent:</span>{' '}
                          {formatDateTime(booking.lastAdminMessagedAt)}
                        </div>
                        <div className="whitespace-pre-wrap rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white">
                          {booking.lastAdminMessageBody || 'No manual guest message sent yet.'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {composerOpen ? (
                    <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        Send message to guest
                      </div>
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                        Use this for follow-up questions, requesting more info, or
                        providing updates.
                      </p>

                      <input
                        type="text"
                        value={messageSubjects[booking.id] ?? ''}
                        onChange={(e) =>
                          setMessageSubjects((prev) => ({
                            ...prev,
                            [booking.id]: e.target.value,
                          }))
                        }
                        className={fieldClassName}
                        placeholder="Subject"
                      />

                      <textarea
                        value={messageBodies[booking.id] ?? ''}
                        onChange={(e) =>
                          setMessageBodies((prev) => ({
                            ...prev,
                            [booking.id]: e.target.value,
                          }))
                        }
                        rows={6}
                        className={fieldClassName}
                        placeholder="Write your message to the guest here..."
                      />

                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => sendGuestMessage(booking.id)}
                          disabled={messagingId === booking.id}
                          className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 disabled:opacity-50 dark:border-neutral-700 dark:text-white"
                        >
                          {messagingId === booking.id ? 'Sending...' : 'Send Guest Message'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}