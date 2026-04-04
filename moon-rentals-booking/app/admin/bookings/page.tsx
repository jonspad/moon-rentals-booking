'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type BookingMessageLog = {
  id: number;
  kind: 'manual' | 'automated' | 'resend';
  template:
    | 'booking_received'
    | 'booking_approved'
    | 'booking_rejected'
    | 'booking_cancelled'
    | 'guest_message';
  recipientEmail: string;
  subject: string;
  body: string;
  sentAt: string;
  createdAt: string;
};

type PricingLineItem = {
  label: string;
  amount: number;
};

function parseAdjustmentText(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.*?)[-|:]\s*\$?(\d+(?:\.\d{1,2})?)$/);
      if (!match) return null;
      return {
        label: match[1].trim(),
        amount: Math.round(Number(match[2])),
      } satisfies PricingLineItem;
    })
    .filter((item): item is PricingLineItem => Boolean(item && item.label && Number.isFinite(item.amount) && item.amount > 0));
}

function formatAdjustmentText(items?: PricingLineItem[] | null) {
  if (!items?.length) return '';
  return items.map((item) => `${item.label} - ${item.amount}`).join('\n');
}

function getAdjustmentTotalFromText(value: string) {
  return parseAdjustmentText(value).reduce((sum, item) => sum + item.amount, 0);
}

type Booking = {
  id: number;
  customerId?: number | null;
  vehicleId: number;
  pickupAt: string;
  returnAt: string;
  fullName: string;
  email: string;
  phone: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  pricePerDaySnapshot: number;
  totalDaysSnapshot: number;
  totalPriceSnapshot: number;
  discountAmount: number;
  extraFeeAmount: number;
  discountBreakdownItems?: PricingLineItem[];
  extraFeeBreakdownItems?: PricingLineItem[];
  finalPriceOverride: number | null;
  pricingNote: string | null;
  rejectionReason: string | null;
  lastAdminMessageSubject: string | null;
  lastAdminMessageBody: string | null;
  lastAdminMessagedAt: string | null;
  createdAt: string;
  customer?: {
    id: number;
    verificationStatus: string;
  } | null;
  messageLogs?: BookingMessageLog[];
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

function formatCurrency(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function getComputedFinalTotal(booking: {
  totalPriceSnapshot: number;
  discountAmount?: number | null;
  extraFeeAmount?: number | null;
  finalPriceOverride?: number | null;
}) {
  if (booking.finalPriceOverride != null) {
    return booking.finalPriceOverride;
  }

  return Math.max(
    0,
    booking.totalPriceSnapshot - (booking.discountAmount ?? 0) + (booking.extraFeeAmount ?? 0)
  );
}

function getMessageKindClasses(kind: BookingMessageLog['kind']) {
  if (kind === 'automated') {
    return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300';
  }

  if (kind === 'resend') {
    return 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300';
  }

  return 'border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300';
}

function getTemplateLabel(template: BookingMessageLog['template']) {
  switch (template) {
    case 'booking_received':
      return 'Booking Received';
    case 'booking_approved':
      return 'Booking Approved';
    case 'booking_rejected':
      return 'Booking Rejected';
    case 'booking_cancelled':
      return 'Booking Cancelled';
    case 'guest_message':
      return 'Guest Message';
    default:
      return template;
  }
}

export default function AdminBookingsPage() {
  const searchParams = useSearchParams();
  const highlightedBookingId = Number(searchParams.get('bookingId')) || null;
  const bookingRefs = useRef<Record<number, HTMLElement | null>>({});

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [messagingId, setMessagingId] = useState<number | null>(null);
  const [resendingLogId, setResendingLogId] = useState<number | null>(null);
  const [savingPricingId, setSavingPricingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [rejectionReasons, setRejectionReasons] = useState<Record<number, string>>(
    {}
  );
  const [messageSubjects, setMessageSubjects] = useState<Record<number, string>>(
    {}
  );
  const [messageBodies, setMessageBodies] = useState<Record<number, string>>({});
  const [messageRecipients, setMessageRecipients] = useState<Record<number, string>>(
    {}
  );
  const [resendRecipients, setResendRecipients] = useState<Record<number, string>>(
    {}
  );
  const [discountInputs, setDiscountInputs] = useState<Record<number, string>>({});
  const [extraFeeInputs, setExtraFeeInputs] = useState<Record<number, string>>({});
  const [finalOverrideInputs, setFinalOverrideInputs] = useState<Record<number, string>>(
    {}
  );
  const [discountBreakdownInputs, setDiscountBreakdownInputs] = useState<Record<number, string>>({});
  const [extraFeeBreakdownInputs, setExtraFeeBreakdownInputs] = useState<Record<number, string>>({});
  const [pricingNotes, setPricingNotes] = useState<Record<number, string>>({});
  const [emailingQuoteId, setEmailingQuoteId] = useState<number | null>(null);
  const [expandedMessageLogId, setExpandedMessageLogId] = useState<number | null>(
    null
  );
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

    setMessageRecipients((prev) => {
      const next = { ...prev };
      for (const booking of nextBookings) {
        if (next[booking.id] === undefined) {
          next[booking.id] = booking.email || '';
        }
      }
      return next;
    });

    setResendRecipients((prev) => {
      const next = { ...prev };
      for (const booking of nextBookings) {
        for (const log of booking.messageLogs || []) {
          if (next[log.id] === undefined) {
            next[log.id] = log.recipientEmail || '';
          }
        }
      }
      return next;
    });

    setDiscountInputs((prev) => {
      const next = { ...prev };
      for (const booking of nextBookings) {
        if (next[booking.id] === undefined) {
          next[booking.id] = String(booking.discountAmount ?? 0);
        }
      }
      return next;
    });

    setExtraFeeInputs((prev) => {
      const next = { ...prev };
      for (const booking of nextBookings) {
        if (next[booking.id] === undefined) {
          next[booking.id] = String(booking.extraFeeAmount ?? 0);
        }
      }
      return next;
    });

    setDiscountBreakdownInputs((prev) => {
      const next = { ...prev };
      for (const booking of nextBookings) {
        if (next[booking.id] === undefined) {
          next[booking.id] = formatAdjustmentText(booking.discountBreakdownItems);
        }
      }
      return next;
    });

    setExtraFeeBreakdownInputs((prev) => {
      const next = { ...prev };
      for (const booking of nextBookings) {
        if (next[booking.id] === undefined) {
          next[booking.id] = formatAdjustmentText(booking.extraFeeBreakdownItems);
        }
      }
      return next;
    });

    setFinalOverrideInputs((prev) => {
      const next = { ...prev };
      for (const booking of nextBookings) {
        if (next[booking.id] === undefined) {
          next[booking.id] =
            booking.finalPriceOverride == null ? '' : String(booking.finalPriceOverride);
        }
      }
      return next;
    });

    setPricingNotes((prev) => {
      const next = { ...prev };
      for (const booking of nextBookings) {
        if (next[booking.id] === undefined) {
          next[booking.id] = booking.pricingNote || '';
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

  useEffect(() => {
    if (!highlightedBookingId || loading) return;

    const bookingExists = bookings.some((booking) => booking.id === highlightedBookingId);

    if (!bookingExists) {
      setError(`Booking #${highlightedBookingId} was not found.`);
      return;
    }

    const timer = window.setTimeout(() => {
      const element = bookingRefs.current[highlightedBookingId];
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    return () => window.clearTimeout(timer);
  }, [highlightedBookingId, bookings, loading]);

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

  async function savePricing(bookingId: number) {
    setSavingPricingId(bookingId);
    setError('');
    setMessage('');

    try {
      const discountItems = parseAdjustmentText(discountBreakdownInputs[bookingId] || '');
      const extraFeeItems = parseAdjustmentText(extraFeeBreakdownInputs[bookingId] || '');
      const derivedDiscountAmount = getAdjustmentTotalFromText(discountBreakdownInputs[bookingId] || '');
      const derivedExtraFeeAmount = getAdjustmentTotalFromText(extraFeeBreakdownInputs[bookingId] || '');
      const discountAmount = discountItems.length
        ? derivedDiscountAmount
        : Math.max(0, Number(discountInputs[bookingId] || 0));
      const extraFeeAmount = extraFeeItems.length
        ? derivedExtraFeeAmount
        : Math.max(0, Number(extraFeeInputs[bookingId] || 0));
      const finalOverrideRaw = (finalOverrideInputs[bookingId] || '').trim();
      const finalPriceOverride = finalOverrideRaw === '' ? null : Number(finalOverrideRaw);

      if (Number.isNaN(discountAmount) || Number.isNaN(extraFeeAmount)) {
        setError('Discount and extra fee must be valid numbers.');
        return;
      }

      if (finalPriceOverride != null && (Number.isNaN(finalPriceOverride) || finalPriceOverride < 0)) {
        setError('Final price override must be blank or a valid non-negative number.');
        return;
      }

      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: bookingId,
          discountAmount,
          extraFeeAmount,
          discountBreakdownItems: discountItems,
          extraFeeBreakdownItems: extraFeeItems,
          finalPriceOverride,
          pricingNote: pricingNotes[bookingId] || '',
        }),
      });

      const rawText = await res.text();
      const data = rawText ? JSON.parse(rawText) : {};

      if (!res.ok) {
        setError(data.error || 'Failed to save pricing.');
        return;
      }

      setMessage(`Pricing saved for booking #${bookingId}.`);
      await loadBookings();
    } catch (err) {
      console.error('Failed to save pricing:', err);
      setError('Failed to save pricing.');
    } finally {
      setSavingPricingId(null);
    }
  }

  async function emailUpdatedQuote(bookingId: number) {
    setEmailingQuoteId(bookingId);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/bookings/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: bookingId }),
      });

      const rawText = await res.text();
      const data = rawText ? JSON.parse(rawText) : {};

      if (!res.ok) {
        setError(data.error || 'Failed to email updated quote.');
        return;
      }

      setMessage(`Updated quote emailed for booking #${bookingId}.`);
      await loadBookings();
    } catch (err) {
      console.error('Failed to email updated quote:', err);
      setError('Failed to email updated quote.');
    } finally {
      setEmailingQuoteId(null);
    }
  }

  async function sendGuestMessage(bookingId: number) {
    setMessagingId(bookingId);
    setError('');
    setMessage('');

    try {
      const subject = (messageSubjects[bookingId] || '').trim();
      const body = (messageBodies[bookingId] || '').trim();
      const toEmail = (messageRecipients[bookingId] || '').trim();

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
          toEmail,
        }),
      });

      const rawText = await res.text();
      const data = rawText ? JSON.parse(rawText) : {};

      if (!res.ok) {
        setError(data.error || 'Failed to send guest message.');
        return;
      }

      setMessage(`Message sent for booking #${bookingId}.`);
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

  async function resendLoggedMessage(messageLogId: number, bookingId: number) {
    setResendingLogId(messageLogId);
    setError('');
    setMessage('');

    try {
      const toEmail = (resendRecipients[messageLogId] || '').trim();

      const res = await fetch('/api/bookings/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageLogId,
          toEmail,
        }),
      });

      const rawText = await res.text();
      const data = rawText ? JSON.parse(rawText) : {};

      if (!res.ok) {
        setError(data.error || 'Failed to resend message.');
        return;
      }

      setMessage(`Message resent for booking #${bookingId}.`);
      await loadBookings();
    } catch (err) {
      console.error('Failed to resend message:', err);
      setError('Failed to resend message.');
    } finally {
      setResendingLogId(null);
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

  function getVerificationClasses(verificationStatus: string | undefined) {
    if (verificationStatus === 'approved') {
      return 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300';
    }

    if (verificationStatus === 'rejected') {
      return 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300';
    }

    return 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300';
  }

  const bookingStats = useMemo(() => {
    const pending = bookings.filter((booking) => booking.status === 'pending').length;
    const confirmed = bookings.filter((booking) => booking.status === 'confirmed').length;
    const cancelled = bookings.filter((booking) => booking.status === 'cancelled').length;

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
          Review requests, manage guest communication, and now adjust final pricing before approval.
        </p>
      </div>

      {highlightedBookingId ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
          Focused from calendar: booking #{highlightedBookingId}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
          <p className="mt-2 text-3xl font-bold">{bookingStats.total}</p>
        </div>
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 shadow-sm dark:border-yellow-900 dark:bg-yellow-950/30">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">Pending</p>
          <p className="mt-2 text-3xl font-bold text-yellow-800 dark:text-yellow-200">{bookingStats.pending}</p>
        </div>
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 shadow-sm dark:border-green-900 dark:bg-green-950/30">
          <p className="text-sm text-green-700 dark:text-green-300">Confirmed</p>
          <p className="mt-2 text-3xl font-bold text-green-800 dark:text-green-200">{bookingStats.confirmed}</p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm dark:border-red-900 dark:bg-red-950/30">
          <p className="text-sm text-red-700 dark:text-red-300">Cancelled</p>
          <p className="mt-2 text-3xl font-bold text-red-800 dark:text-red-200">{bookingStats.cancelled}</p>
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
              onChange={(e) => setStatusFilter(e.target.value as 'all' | Booking['status'])}
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
            const isHighlighted = highlightedBookingId === booking.id;
            const verificationStatus = booking.customer?.verificationStatus ?? 'pending';
            const isVerificationApproved = verificationStatus === 'approved';
            const computedFinalTotal = getComputedFinalTotal(booking);
            const previewFinalTotal = (() => {
              const discountBreakdownTotal = getAdjustmentTotalFromText(discountBreakdownInputs[booking.id] || '');
              const extraFeeBreakdownTotal = getAdjustmentTotalFromText(extraFeeBreakdownInputs[booking.id] || '');
              const discount = discountBreakdownTotal || Math.max(0, Number(discountInputs[booking.id] || 0));
              const extraFee = extraFeeBreakdownTotal || Math.max(0, Number(extraFeeInputs[booking.id] || 0));
              const overrideRaw = (finalOverrideInputs[booking.id] || '').trim();
              const override = overrideRaw === '' ? null : Number(overrideRaw);
              if (override != null && !Number.isNaN(override)) return override;
              return Math.max(0, booking.totalPriceSnapshot - discount + extraFee);
            })();

            return (
              <article
                key={booking.id}
                ref={(element) => {
                  bookingRefs.current[booking.id] = element;
                }}
                className={[
                  'rounded-2xl border bg-white p-5 shadow-sm dark:bg-gray-950',
                  isHighlighted
                    ? 'border-blue-400 ring-2 ring-blue-200 dark:border-blue-500 dark:ring-blue-900/50'
                    : 'border-gray-200 dark:border-gray-800',
                ].join(' ')}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-semibold">
                        <Link
                          href={`/admin/vehicles?vehicleId=${booking.vehicleId}`}
                          className="text-blue-600 transition hover:underline dark:text-blue-400"
                        >
                          {vehicleLabel}
                        </Link>
                      </h3>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getStatusClasses(booking.status)}`}>
                        {booking.status}
                      </span>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getVerificationClasses(verificationStatus)}`}>
                        verification: {verificationStatus}
                      </span>
                    </div>

                    <div className="grid gap-3 text-sm text-gray-700 dark:text-gray-300 md:grid-cols-2">
                      <p><span className="font-semibold text-black dark:text-white">Booking ID:</span> #{booking.id}</p>
                      <p><span className="font-semibold text-black dark:text-white">Created:</span> {formatDateTime(booking.createdAt)}</p>
                      <p>
                        <span className="font-semibold text-black dark:text-white">Customer:</span>{' '}
                        {booking.customerId ? (
                          <Link href={`/admin/customers/${booking.customerId}`} className="text-blue-600 transition hover:underline dark:text-blue-400">
                            {booking.fullName}
                          </Link>
                        ) : (
                          booking.fullName
                        )}
                      </p>
                      <p><span className="font-semibold text-black dark:text-white">Email:</span> {booking.email}</p>
                      <p><span className="font-semibold text-black dark:text-white">Phone:</span> {booking.phone}</p>
                      <p><span className="font-semibold text-black dark:text-white">Pickup:</span> {formatDateTime(booking.pickupAt)}</p>
                      <p><span className="font-semibold text-black dark:text-white">Return:</span> {formatDateTime(booking.returnAt)}</p>
                      <p><span className="font-semibold text-black dark:text-white">Rental dates:</span> {formatDateOnly(booking.pickupAt)} → {formatDateOnly(booking.returnAt)}</p>
                    </div>

                    {!isVerificationApproved ? (
                      <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300">
                        Customer verification is not approved. Review customer documents before confirming this booking.
                      </div>
                    ) : null}
                  </div>

                  <div className="flex w-full flex-col gap-2 lg:w-56">
                    <button
                      onClick={() => updateStatus(booking.id, 'confirmed')}
                      disabled={updatingId === booking.id || booking.status === 'confirmed' || !isVerificationApproved}
                      className="rounded-xl border border-green-300 px-4 py-2 text-sm font-medium text-green-700 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950/30"
                    >
                      {updatingId === booking.id && booking.status !== 'confirmed' ? 'Updating...' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => updateStatus(booking.id, 'cancelled')}
                      disabled={updatingId === booking.id || booking.status === 'cancelled'}
                      className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30"
                    >
                      {updatingId === booking.id && booking.status !== 'cancelled' ? 'Updating...' : 'Cancel / Reject'}
                    </button>
                    <button
                      onClick={() => updateStatus(booking.id, 'pending')}
                      disabled={updatingId === booking.id || booking.status === 'pending'}
                      className="rounded-xl border border-yellow-300 px-4 py-2 text-sm font-medium text-yellow-700 transition hover:bg-yellow-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-yellow-800 dark:text-yellow-300 dark:hover:bg-yellow-950/30"
                    >
                      {updatingId === booking.id && booking.status !== 'pending' ? 'Updating...' : 'Mark Pending'}
                    </button>
                    <button
                      onClick={() => setOpenComposerId((prev) => (prev === booking.id ? null : booking.id))}
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
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">Pricing</div>
                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                          Snapshot pricing is preserved. Adjustments here let you set the final approved total.
                        </p>
                      </div>
                      <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                        <div>Saved final</div>
                        <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(computedFinalTotal)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                        <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Daily Rate</div>
                        <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(booking.pricePerDaySnapshot)}</div>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                        <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Billable Days</div>
                        <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{booking.totalDaysSnapshot}</div>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                        <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Base Subtotal</div>
                        <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(booking.totalPriceSnapshot)}</div>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                        <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Preview Final Total</div>
                        <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(previewFinalTotal)}</div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Discount Amount</label>
                        <input
                          type="number"
                          min="0"
                          value={discountInputs[booking.id] ?? '0'}
                          onChange={(e) => setDiscountInputs((prev) => ({ ...prev, [booking.id]: e.target.value }))}
                          className={fieldClassName}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Extra Fee Amount</label>
                        <input
                          type="number"
                          min="0"
                          value={extraFeeInputs[booking.id] ?? '0'}
                          onChange={(e) => setExtraFeeInputs((prev) => ({ ...prev, [booking.id]: e.target.value }))}
                          className={fieldClassName}
                        />
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Discount Breakdown</label>
                        <textarea
                          rows={3}
                          value={discountBreakdownInputs[booking.id] ?? ''}
                          onChange={(e) => setDiscountBreakdownInputs((prev) => ({ ...prev, [booking.id]: e.target.value }))}
                          className={fieldClassName}
                          placeholder="Example:\nRepeat guest discount - 25\nManual approval adjustment - 15"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Extra Fee Breakdown</label>
                        <textarea
                          rows={3}
                          value={extraFeeBreakdownInputs[booking.id] ?? ''}
                          onChange={(e) => setExtraFeeBreakdownInputs((prev) => ({ ...prev, [booking.id]: e.target.value }))}
                          className={fieldClassName}
                          placeholder="Example:\nSmoking fee - 100\nLate return fee - 50"
                        />
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Enter each line as description - amount. When breakdown lines are present, the totals above are calculated from those items and included in guest emails.
                    </div>

                    <div className="mt-3">
                      <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Final Price Override</label>
                      <input
                        type="number"
                        min="0"
                        value={finalOverrideInputs[booking.id] ?? ''}
                        onChange={(e) => setFinalOverrideInputs((prev) => ({ ...prev, [booking.id]: e.target.value }))}
                        className={fieldClassName}
                        placeholder="Leave blank to use subtotal - discount + fees"
                      />
                    </div>

                    <div className="mt-3">
                      <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Pricing Note</label>
                      <textarea
                        rows={3}
                        value={pricingNotes[booking.id] ?? ''}
                        onChange={(e) => setPricingNotes((prev) => ({ ...prev, [booking.id]: e.target.value }))}
                        className={fieldClassName}
                        placeholder="Example: waived delivery fee, repeat guest discount, manual weekend quote"
                      />
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Guest approval emails will use the saved final total.
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => emailUpdatedQuote(booking.id)}
                          disabled={emailingQuoteId === booking.id}
                          className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-900"
                        >
                          {emailingQuoteId === booking.id ? 'Emailing...' : 'Email Updated Quote'}
                        </button>
                        <button
                          onClick={() => savePricing(booking.id)}
                          disabled={savingPricingId === booking.id}
                          className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-900"
                        >
                          {savingPricingId === booking.id ? 'Saving...' : 'Save Pricing'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">Rejection / cancellation message</div>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                      This message will be included if you cancel or reject the booking.
                    </p>
                    <textarea
                      value={rejectionReasons[booking.id] ?? ''}
                      onChange={(e) => setRejectionReasons((prev) => ({ ...prev, [booking.id]: e.target.value }))}
                      rows={5}
                      className={fieldClassName}
                      placeholder="Example: We’re unable to approve this request because the vehicle is unavailable for the requested dates."
                    />
                    {booking.rejectionReason ? (
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">Current saved message: {booking.rejectionReason}</div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">Message History</div>
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Automated, manual, and resent messages for this booking.</p>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{(booking.messageLogs || []).length} sent</div>
                  </div>

                  <div className="mt-3 space-y-3">
                    {(booking.messageLogs || []).length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gray-300 px-3 py-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">No messages have been logged yet.</div>
                    ) : (
                      (booking.messageLogs || []).map((log) => {
                        const isExpanded = expandedMessageLogId === log.id;
                        return (
                          <div key={log.id} className="rounded-xl border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                            <button
                              type="button"
                              onClick={() => setExpandedMessageLogId((prev) => (prev === log.id ? null : log.id))}
                              className="flex w-full items-start justify-between gap-3 text-left"
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${getMessageKindClasses(log.kind)}`}>{log.kind}</span>
                                  <span className="rounded-full border border-gray-300 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-700 dark:border-gray-700 dark:text-gray-300">{getTemplateLabel(log.template)}</span>
                                </div>
                                <div className="mt-2 text-sm font-medium text-gray-900 dark:text-white">{log.subject}</div>
                                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{formatDateTime(log.sentAt)} • {log.recipientEmail}</div>
                              </div>
                              <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{isExpanded ? 'Hide' : 'Open'}</span>
                            </button>

                            {isExpanded ? (
                              <div className="mt-3 space-y-3">
                                <div className="whitespace-pre-wrap rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white">{log.body}</div>
                                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_140px]">
                                  <input
                                    type="email"
                                    value={resendRecipients[log.id] ?? ''}
                                    onChange={(e) => setResendRecipients((prev) => ({ ...prev, [log.id]: e.target.value }))}
                                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-black dark:border-gray-700 dark:bg-gray-900 dark:focus:border-white"
                                    placeholder="Resend to email"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => resendLoggedMessage(log.id, booking.id)}
                                    disabled={resendingLogId === log.id}
                                    className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-900"
                                  >
                                    {resendingLogId === log.id ? 'Resending...' : 'Resend'}
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {composerOpen ? (
                  <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">Send message to guest</div>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Use this for follow-up questions, requesting more info, or providing updates.</p>
                    <input
                      type="email"
                      value={messageRecipients[booking.id] ?? ''}
                      onChange={(e) => setMessageRecipients((prev) => ({ ...prev, [booking.id]: e.target.value }))}
                      className={fieldClassName}
                      placeholder="Send to email"
                    />
                    <input
                      type="text"
                      value={messageSubjects[booking.id] ?? ''}
                      onChange={(e) => setMessageSubjects((prev) => ({ ...prev, [booking.id]: e.target.value }))}
                      className={fieldClassName}
                      placeholder="Subject"
                    />
                    <textarea
                      value={messageBodies[booking.id] ?? ''}
                      onChange={(e) => setMessageBodies((prev) => ({ ...prev, [booking.id]: e.target.value }))}
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
