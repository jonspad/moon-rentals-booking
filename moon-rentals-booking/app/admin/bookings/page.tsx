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

type SortOption =
  | 'created-desc'
  | 'created-asc'
  | 'pickup-asc'
  | 'return-asc';

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

function formatDateOnly(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
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

  const [rejectionReasons, setRejectionReasons] = useState<Record<number, string>>(
    {}
  );
  const [messageSubjects, setMessageSubjects] = useState<Record<number, string>>(
    {}
  );
  const [messageBodies, setMessageBodies] = useState<Record<number, string>>({});
  const [openComposerId, setOpenComposerId] = useState<number | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Booking['status']>('all');
  const [sortBy, setSortBy] = useState<SortOption>('created-desc');

  const fieldClassName =
    'mt-3 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:placeholder:text-neutral-500';

  async function loadBookings() {
    const res = await fetch('/api/bookings', { cache: 'no-store' });
    const rawText = await res.text();

    if (!res.ok) {
      throw new Error(`Failed to load bookings: ${res.status}`);
    }

    const data = rawText ? JSON.parse(rawText) : {};
    const nextBookings = Array.isArray(data.bookings) ? data.bookings : [];

    setBookings(nextBookings);

    setRejectionReasons((prev) => {
      const next = { ...prev };

      for (const booking of nextBookings) {
        if (next[booking.id] === undefined) {
          next[booking.id] = booking.rejectionReason || '';
        }
      }

      return next;
    });
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
      setMessageSubjects((prev) => ({ ...prev, [bookingId]: '' }));
      setMessageBodies((prev) => ({ ...prev, [bookingId]: '' }));
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
      return 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300';
    }

    if (status === 'cancelled') {
      return 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300';
    }

    return 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300';
  }

  const bookingStats = useMemo(() => {
    const pending = bookings.filter((booking) => booking.status === 'pending').length;
    const confirmed = bookings.filter(
      (booking) => booking.status === 'confirmed'
    ).length;
    const cancelled = bookings.filter(
      (booking) => booking.status === 'cancelled'
    ).length;

    return {
      total: bookings.length,
      pending,
      confirmed,
      cancelled,
    };
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    let next = bookings.filter((booking) => {
      if (statusFilter !== 'all' && booking.status !== statusFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const vehicleLabel = getVehicleLabel(booking.vehicleId).toLowerCase();

      return (
        String(booking.id).includes(normalizedSearch) ||
        booking.fullName.toLowerCase().includes(normalizedSearch) ||
        booking.email.toLowerCase().includes(normalizedSearch) ||
        booking.phone.toLowerCase().includes(normalizedSearch) ||
        vehicleLabel.includes(normalizedSearch)
      );
    });

    next = next.sort((a, b) => {
      if (sortBy === 'created-asc') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }

      if (sortBy === 'pickup-asc') {
        return new Date(a.pickupAt).getTime() - new Date(b.pickupAt).getTime();
      }

      if (sortBy === 'return-asc') {
        return new Date(a.returnAt).getTime() - new Date(b.returnAt).getTime();
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return next;
  }, [bookings, search, statusFilter, sortBy, vehicles]);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Bookings</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Review customer booking requests, approve or decline them, search faster,
          and message guests directly from the admin panel.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
          <p className="mt-2 text-3xl font-bold">{bookingStats.total}</p>
        </div>

        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 shadow-sm dark:border-yellow-900 dark:bg-yellow-950/30">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">Pending</p>
          <p className="mt-2 text-3xl font-bold text-yellow-800 dark:text-yellow-200">
            {bookingStats.pending}
          </p>
        </div>

        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 shadow-sm dark:border-green-900 dark:bg-green-950/30">
          <p className="text-sm text-green-700 dark:text-green-300">Confirmed</p>
          <p className="mt-2 text-3xl font-bold text-green-800 dark:text-green-200">
            {bookingStats.confirmed}
          </p>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm dark:border-red-900 dark:bg-red-950/30">
          <p className="text-sm text-red-700 dark:text-red-300">Cancelled</p>
          <p className="mt-2 text-3xl font-bold text-red-800 dark:text-red-200">
            {bookingStats.cancelled}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium">Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, phone, booking ID, vehicle..."
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-black dark:border-gray-700 dark:bg-gray-900"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Status</label>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'all' | Booking['status'])
              }
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-black dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending only</option>
              <option value="confirmed">Confirmed only</option>
              <option value="cancelled">Cancelled only</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Sort by</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-black dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="created-desc">Newest created first</option>
              <option value="created-asc">Oldest created first</option>
              <option value="pickup-asc">Pickup soonest first</option>
              <option value="return-asc">Return soonest first</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              setSearch('');
              setStatusFilter('all');
              setSortBy('created-desc');
            }}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
          >
            Reset filters
          </button>

          <button
            onClick={refreshData}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
          >
            Refresh
          </button>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing {filteredBookings.length} of {bookings.length} bookings
          </p>
        </div>
      </div>

      {message ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm shadow-sm dark:border-gray-800 dark:bg-gray-950">
          Loading bookings...
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400">
          No bookings match the current filters.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((booking) => {
            const vehicleLabel = getVehicleLabel(booking.vehicleId);
            const composerOpen = openComposerId === booking.id;

            return (
              <article
                key={booking.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-semibold">{vehicleLabel}</h3>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getStatusClasses(
                          booking.status
                        )}`}
                      >
                        {booking.status}
                      </span>
                    </div>

                    <div className="grid gap-3 text-sm text-gray-700 dark:text-gray-300 md:grid-cols-2">
                      <p>
                        <span className="font-semibold text-black dark:text-white">
                          Booking ID:
                        </span>{' '}
                        #{booking.id}
                      </p>
                      <p>
                        <span className="font-semibold text-black dark:text-white">
                          Created:
                        </span>{' '}
                        {formatDateTime(booking.createdAt)}
                      </p>
                      <p>
                        <span className="font-semibold text-black dark:text-white">
                          Customer:
                        </span>{' '}
                        {booking.fullName}
                      </p>
                      <p>
                        <span className="font-semibold text-black dark:text-white">
                          Email:
                        </span>{' '}
                        {booking.email}
                      </p>
                      <p>
                        <span className="font-semibold text-black dark:text-white">
                          Phone:
                        </span>{' '}
                        {booking.phone}
                      </p>
                      <p>
                        <span className="font-semibold text-black dark:text-white">
                          Pickup:
                        </span>{' '}
                        {formatDateTime(booking.pickupAt)}
                      </p>
                      <p>
                        <span className="font-semibold text-black dark:text-white">
                          Return:
                        </span>{' '}
                        {formatDateTime(booking.returnAt)}
                      </p>
                      <p>
                        <span className="font-semibold text-black dark:text-white">
                          Rental dates:
                        </span>{' '}
                        {formatDateOnly(booking.pickupAt)} →{' '}
                        {formatDateOnly(booking.returnAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex w-full flex-col gap-2 lg:w-56">
                    <button
                      onClick={() => updateStatus(booking.id, 'confirmed')}
                      disabled={updatingId === booking.id || booking.status === 'confirmed'}
                      className="rounded-xl border border-green-300 px-4 py-2 text-sm font-medium text-green-700 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950/30"
                    >
                      {updatingId === booking.id && booking.status !== 'confirmed'
                        ? 'Updating...'
                        : 'Confirm'}
                    </button>

                    <button
                      onClick={() => updateStatus(booking.id, 'cancelled')}
                      disabled={updatingId === booking.id || booking.status === 'cancelled'}
                      className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30"
                    >
                      {updatingId === booking.id && booking.status !== 'cancelled'
                        ? 'Updating...'
                        : 'Cancel / Reject'}
                    </button>

                    <button
                      onClick={() => updateStatus(booking.id, 'pending')}
                      disabled={updatingId === booking.id || booking.status === 'pending'}
                      className="rounded-xl border border-yellow-300 px-4 py-2 text-sm font-medium text-yellow-700 transition hover:bg-yellow-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-yellow-800 dark:text-yellow-300 dark:hover:bg-yellow-950/30"
                    >
                      {updatingId === booking.id && booking.status !== 'pending'
                        ? 'Updating...'
                        : 'Mark Pending'}
                    </button>

                    <button
                      onClick={() =>
                        setOpenComposerId((prev) => (prev === booking.id ? null : booking.id))
                      }
                      className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
                    >
                      {composerOpen ? 'Close Message' : 'Message Guest'}
                    </button>

                    <button
                      onClick={() => deleteBooking(booking.id)}
                      disabled={deletingId === booking.id}
                      className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-900"
                    >
                      {deletingId === booking.id ? 'Deleting...' : 'Delete Booking'}
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      Rejection / cancellation message
                    </div>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                      This message will be included if you cancel or reject the booking.
                    </p>

                    <textarea
                      value={rejectionReasons[booking.id] ?? ''}
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
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}