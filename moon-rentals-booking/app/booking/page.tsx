'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { vehicles } from '@/lib/vehicles';

type Vehicle = {
  id: number;
  groupId: string;
  color: string;
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

type Block = {
  id: number;
  vehicleId: number;
  start: string;
  end: string;
  reason: string;
};

function isOverlapping(
  requestedStart: Date,
  requestedEnd: Date,
  existingStart: Date,
  existingEnd: Date
) {
  return requestedStart < existingEnd && requestedEnd > existingStart;
}

export default function BookingPage() {
  const searchParams = useSearchParams();

  const groupId = searchParams.get('groupId') || '';
  const pickupAt = searchParams.get('pickupAt') || '';
  const returnAt = searchParams.get('returnAt') || '';

  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [error, setError] = useState('');

  const groupVehicles = useMemo(() => {
    return vehicles.filter((vehicle) => {
      return vehicle.groupId === groupId && vehicle.isActive;
    });
  }, [groupId]);

  const groupSummaryVehicle = groupVehicles[0];

  useEffect(() => {
    async function loadAvailabilityData() {
      setLoadingAvailability(true);
      setError('');

      try {
        const [bookingsRes, blocksRes] = await Promise.all([
          fetch('/api/bookings', { cache: 'no-store' }),
          fetch('/api/vehicle-blocks', { cache: 'no-store' }),
        ]);

        const bookingsText = await bookingsRes.text();
        const blocksText = await blocksRes.text();

        const bookingsData = bookingsText ? JSON.parse(bookingsText) : {};
        const blocksData = blocksText ? JSON.parse(blocksText) : {};

        setBookings(Array.isArray(bookingsData.bookings) ? bookingsData.bookings : []);
        setBlocks(Array.isArray(blocksData.blocks) ? blocksData.blocks : []);
      } catch (err) {
        console.error('Failed to load booking availability data:', err);
        setError('Failed to load availability data for this vehicle group.');
      } finally {
        setLoadingAvailability(false);
      }
    }

    if (pickupAt && returnAt && groupId) {
      loadAvailabilityData();
    } else {
      setLoadingAvailability(false);
    }
  }, [groupId, pickupAt, returnAt]);

  const availableVehicles = useMemo(() => {
    if (!pickupAt || !returnAt) return [];

    const pickupDate = new Date(pickupAt);
    const returnDate = new Date(returnAt);

    if (
      Number.isNaN(pickupDate.getTime()) ||
      Number.isNaN(returnDate.getTime()) ||
      returnDate <= pickupDate
    ) {
      return [];
    }

    return groupVehicles.filter((vehicle) => {
      const blocked = blocks.some((block) => {
        if (block.vehicleId !== vehicle.id) return false;

        const blockStart = new Date(block.start);
        const blockEnd = new Date(block.end);

        if (Number.isNaN(blockStart.getTime()) || Number.isNaN(blockEnd.getTime())) {
          return false;
        }

        return isOverlapping(pickupDate, returnDate, blockStart, blockEnd);
      });

      if (blocked) return false;

      const booked = bookings.some((booking) => {
        if (booking.vehicleId !== vehicle.id) return false;
        if (booking.status === 'cancelled') return false;

        const bookingStart = new Date(booking.pickupAt);
        const bookingEnd = new Date(booking.returnAt);

        if (Number.isNaN(bookingStart.getTime()) || Number.isNaN(bookingEnd.getTime())) {
          return false;
        }

        return isOverlapping(pickupDate, returnDate, bookingStart, bookingEnd);
      });

      return !booked;
    });
  }, [groupVehicles, bookings, blocks, pickupAt, returnAt]);

  const selectedVehicle = useMemo(() => {
    return availableVehicles.find((vehicle) => vehicle.id === Number(selectedVehicleId));
  }, [availableVehicles, selectedVehicleId]);

  const totalDays = useMemo(() => {
    if (!pickupAt || !returnAt) return 0;

    const start = new Date(pickupAt);
    const end = new Date(returnAt);

    const ms = end.getTime() - start.getTime();
    if (Number.isNaN(ms) || ms <= 0) return 0;

    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  }, [pickupAt, returnAt]);

  const estimatedTotal = selectedVehicle
    ? totalDays * selectedVehicle.pricePerDay
    : groupSummaryVehicle
      ? totalDays * groupSummaryVehicle.pricePerDay
      : 0;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoadingSubmit(true);
    setError('');

    try {
      const vehicleId = Number(selectedVehicleId);

      if (!vehicleId) {
        setError('Please select an available vehicle/color first.');
        return;
      }

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId,
          pickupAt,
          returnAt,
          fullName,
          email,
          phone,
        }),
      });

      const rawText = await res.text();
      const data = rawText ? JSON.parse(rawText) : {};

      if (!res.ok) {
        setError(data.error || 'Failed to create booking.');
        return;
      }

      const selectedVehicleLabel = selectedVehicle
        ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}${
            selectedVehicle.color !== 'Unknown' ? ` - ${selectedVehicle.color}` : ''
          }`
        : `${groupSummaryVehicle.year} ${groupSummaryVehicle.make} ${groupSummaryVehicle.model}`;

      const params = new URLSearchParams({
        bookingId: String(data.booking?.id ?? ''),
        name: fullName,
        vehicle: selectedVehicleLabel,
        pickupAt,
        returnAt,
      });

      window.location.href = `/booking/confirmation?${params.toString()}`;
      return;
    } catch (err) {
      console.error('Booking submit error:', err);
      setError(
        err instanceof Error
          ? `Something went wrong while submitting your booking: ${err.message}`
          : 'Something went wrong while submitting your booking.'
      );
    } finally {
      setLoadingSubmit(false);
    }
  }

  if (!groupId) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 text-black dark:text-white">
        <h1 className="text-3xl font-bold">Booking</h1>
        <p className="mt-4 text-red-600 dark:text-red-400">
          Missing vehicle group. Please go back and search again.
        </p>
      </main>
    );
  }

  if (!groupSummaryVehicle) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 text-black dark:text-white">
        <h1 className="text-3xl font-bold">Booking</h1>
        <p className="mt-4 text-red-600 dark:text-red-400">Vehicle group not found.</p>
      </main>
    );
  }

  if (!pickupAt || !returnAt) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 text-black dark:text-white">
        <h1 className="text-3xl font-bold">Booking</h1>
        <p className="mt-4 text-red-600 dark:text-red-400">
          Missing pickup or return date. Please go back and search again.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 text-black dark:text-white">
      <h1 className="text-3xl font-bold">Complete Your Booking</h1>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <section className="rounded-2xl border border-gray-300 bg-white p-6 text-black dark:border-gray-700 dark:bg-black dark:text-white">
          {groupSummaryVehicle.image ? (
            <img
              src={groupSummaryVehicle.image}
              alt={`${groupSummaryVehicle.make} ${groupSummaryVehicle.model}`}
              className="mb-4 h-64 w-full rounded-xl object-cover"
            />
          ) : null}

          <h2 className="text-2xl font-semibold">
            {groupSummaryVehicle.make} {groupSummaryVehicle.model}
          </h2>

          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            {groupSummaryVehicle.category}
          </p>

          <p className="mt-3 text-sm">
            {groupSummaryVehicle.seats} seats • {groupSummaryVehicle.transmission}
          </p>

          <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
            {groupSummaryVehicle.description}
          </p>

          <div className="mt-6 space-y-2 rounded-xl bg-gray-100 p-4 text-black dark:bg-gray-800 dark:text-white">
            <p className="text-sm">
              <span className="font-medium">Pickup:</span> {pickupAt}
            </p>
            <p className="text-sm">
              <span className="font-medium">Return:</span> {returnAt}
            </p>
            <p className="text-sm">
              <span className="font-medium">Estimated days:</span> {totalDays}
            </p>
            <p className="text-sm">
              <span className="font-medium">Available units in pool:</span>{' '}
              {availableVehicles.length}
            </p>
            <p className="text-lg font-semibold">Estimated Total: ${estimatedTotal}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-300 bg-white p-6 text-black dark:border-gray-700 dark:bg-black dark:text-white">
          <h2 className="text-xl font-semibold">Choose Your Vehicle</h2>

          {loadingAvailability ? (
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
              Loading available units...
            </p>
          ) : availableVehicles.length === 0 ? (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400">
              No units in this vehicle pool are available for the selected dates.
            </p>
          ) : (
            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium">Available colors / units</label>
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-black dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                required
              >
                <option value="">Select an available unit</option>
                {availableVehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.color !== 'Unknown' ? vehicle.color : 'Color not specified'} • Unit #
                    {vehicle.id}
                  </option>
                ))}
              </select>
            </div>
          )}

          <h2 className="mt-8 text-xl font-semibold">Your Information</h2>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-black dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-black dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-black dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loadingSubmit || availableVehicles.length === 0}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2 font-medium text-black disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            >
              {loadingSubmit ? 'Submitting...' : 'Submit Booking Request'}
            </button>
          </form>

          {selectedVehicle && (
            <p className="mt-4 text-sm text-gray-700 dark:text-gray-300">
              Selected: {selectedVehicle.make} {selectedVehicle.model} —{' '}
              {selectedVehicle.color !== 'Unknown'
                ? selectedVehicle.color
                : 'Color not specified'}
            </p>
          )}

          {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </section>
      </div>
    </main>
  );
}