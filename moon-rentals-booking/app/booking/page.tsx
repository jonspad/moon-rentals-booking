'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

type Vehicle = {
  id: number;
  make: string;
  model: string;
  year: number;
  color?: string | null;
  licensePlate?: string | null;
  pricePerDay?: number | null;
  image?: string | null;
  seats?: number | null;
  transmission?: string | null;
  isActive: boolean;
  groupId?: string | null;
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
};

type VehicleBlock = {
  id: number;
  vehicleId: number;
  start: string;
  end: string;
  reason?: string | null;
};

function formatCurrency(value?: number | null) {
  if (typeof value !== 'number') return 'Call for pricing';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

function formatDateTimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';

  return date.toLocaleString([], {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function toDatetimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function isOverlapping(
  requestedStart: Date,
  requestedEnd: Date,
  existingStart: Date,
  existingEnd: Date
) {
  return requestedStart < existingEnd && requestedEnd > existingStart;
}

function getVehicleDisplayName(vehicle: Vehicle) {
  return `${vehicle.year} ${vehicle.make} ${vehicle.model}${
    vehicle.color ? ` (${vehicle.color})` : ''
  }`;
}

function isValidDatetimeLocal(value: string | null) {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
}

function getDurationMs(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return 0;
  }

  const diff = endDate.getTime() - startDate.getTime();
  return diff > 0 ? diff : 0;
}

function getBillableDays(start: string, end: string) {
  const durationMs = getDurationMs(start, end);

  if (durationMs <= 0) return 0;

  const dayMs = 24 * 60 * 60 * 1000;
  return Math.ceil(durationMs / dayMs);
}

function formatRentalLength(start: string, end: string) {
  const durationMs = getDurationMs(start, end);

  if (durationMs <= 0) return '—';

  const totalMinutes = Math.floor(durationMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days} day${days === 1 ? '' : 's'}`);
  }

  if (hours > 0) {
    parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  }

  if (minutes > 0) {
    parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
  }

  return parts.join(', ');
}

export default function BookingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const vehicleIdParam = searchParams.get('vehicleId');
  const groupId = searchParams.get('groupId');
  const pickupAtParam = searchParams.get('pickupAt');
  const returnAtParam = searchParams.get('returnAt');

  const [fleetVehicles, setFleetVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blocks, setBlocks] = useState<VehicleBlock[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const now = new Date();
  const defaultPickup = new Date(now.getTime() + 60 * 60 * 1000);
  const defaultReturn = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  const initialPickupAt = isValidDatetimeLocal(pickupAtParam)
    ? pickupAtParam!
    : toDatetimeLocalValue(defaultPickup);

  const initialReturnAt = isValidDatetimeLocal(returnAtParam)
    ? returnAtParam!
    : toDatetimeLocalValue(defaultReturn);

  const [pickupAt, setPickupAt] = useState(initialPickupAt);
  const [returnAt, setReturnAt] = useState(initialReturnAt);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(
    vehicleIdParam ? Number(vehicleIdParam) : null
  );
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    async function loadAvailabilityData() {
      setLoadingAvailability(true);
      setError('');

      try {
        const [bookingsRes, blocksRes, vehiclesRes] = await Promise.all([
          fetch('/api/bookings', { cache: 'no-store' }),
          fetch('/api/vehicle-blocks', { cache: 'no-store' }),
          fetch('/api/vehicles', { cache: 'no-store' }),
        ]);

        const bookingsText = await bookingsRes.text();
        const blocksText = await blocksRes.text();
        const vehiclesText = await vehiclesRes.text();

        const bookingsData = bookingsText ? JSON.parse(bookingsText) : {};
        const blocksData = blocksText ? JSON.parse(blocksText) : {};
        const vehiclesData = vehiclesText ? JSON.parse(vehiclesText) : {};

        setBookings(Array.isArray(bookingsData.bookings) ? bookingsData.bookings : []);
        setBlocks(Array.isArray(blocksData.blocks) ? blocksData.blocks : []);
        setFleetVehicles(Array.isArray(vehiclesData.vehicles) ? vehiclesData.vehicles : []);
      } catch (err) {
        console.error('Failed to load booking availability data:', err);
        setError('Failed to load availability data for this vehicle group.');
      } finally {
        setLoadingAvailability(false);
      }
    }

    loadAvailabilityData();
  }, []);

  const groupVehicles = useMemo(() => {
    if (!groupId) {
      return fleetVehicles.filter((vehicle) => vehicle.isActive);
    }

    return fleetVehicles.filter(
      (vehicle) => vehicle.groupId === groupId && vehicle.isActive
    );
  }, [fleetVehicles, groupId]);

  const groupSummaryVehicle = useMemo(() => {
    if (groupVehicles.length === 0) return null;
    return groupVehicles[0];
  }, [groupVehicles]);

  const availableVehicles = useMemo(() => {
    const pickup = new Date(pickupAt);
    const dropoff = new Date(returnAt);

    if (Number.isNaN(pickup.getTime()) || Number.isNaN(dropoff.getTime())) {
      return [];
    }

    if (dropoff <= pickup) {
      return [];
    }

    return groupVehicles.filter((vehicle) => {
      const vehicleBlocks = blocks.filter((block) => block.vehicleId === vehicle.id);

      const blocked = vehicleBlocks.some((block) => {
        const start = new Date(block.start);
        const end = new Date(block.end);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          return false;
        }

        return isOverlapping(pickup, dropoff, start, end);
      });

      if (blocked) return false;

      const vehicleBookings = bookings.filter(
        (booking) =>
          booking.vehicleId === vehicle.id && booking.status === 'confirmed'
      );

      const booked = vehicleBookings.some((booking) => {
        const start = new Date(booking.pickupAt);
        const end = new Date(booking.returnAt);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          return false;
        }

        return isOverlapping(pickup, dropoff, start, end);
      });

      return !booked;
    });
  }, [groupVehicles, blocks, bookings, pickupAt, returnAt]);

  useEffect(() => {
    if (selectedVehicleId == null && availableVehicles.length > 0) {
      setSelectedVehicleId(availableVehicles[0].id);
      return;
    }

    if (
      selectedVehicleId != null &&
      !availableVehicles.some((vehicle) => vehicle.id === selectedVehicleId)
    ) {
      setSelectedVehicleId(availableVehicles.length > 0 ? availableVehicles[0].id : null);
    }
  }, [availableVehicles, selectedVehicleId]);

  const selectedVehicle = useMemo(() => {
    if (selectedVehicleId == null) return null;
    return availableVehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null;
  }, [availableVehicles, selectedVehicleId]);

  const headerVehicle = selectedVehicle ?? groupSummaryVehicle;

  const dailyRate = selectedVehicle?.pricePerDay ?? headerVehicle?.pricePerDay ?? null;

  const rentalLength = useMemo(() => {
    return formatRentalLength(pickupAt, returnAt);
  }, [pickupAt, returnAt]);

  const billableDays = useMemo(() => {
    return getBillableDays(pickupAt, returnAt);
  }, [pickupAt, returnAt]);

  const estimatedTotal = useMemo(() => {
    if (typeof dailyRate !== 'number' || billableDays <= 0) return null;
    return dailyRate * billableDays;
  }, [dailyRate, billableDays]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!selectedVehicleId) {
      setError('Please select an available vehicle.');
      return;
    }

    const pickup = new Date(pickupAt);
    const dropoff = new Date(returnAt);

    if (Number.isNaN(pickup.getTime()) || Number.isNaN(dropoff.getTime())) {
      setError('Please enter valid pickup and return dates.');
      return;
    }

    if (dropoff <= pickup) {
      setError('Return date must be after pickup date.');
      return;
    }

    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      setError('Please complete all contact fields.');
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vehicleId: selectedVehicleId,
          pickupAt,
          returnAt,
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
        }),
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};

      if (!res.ok) {
        setError(data.error || 'Failed to create booking.');
        return;
      }

      const booking = data.booking;
      setSuccessMessage('Booking created successfully.');

      const vehicleName = selectedVehicle
        ? getVehicleDisplayName(selectedVehicle)
        : 'Vehicle';

      if (booking?.id) {
        const params = new URLSearchParams({
          bookingId: String(booking.id),
          name: fullName.trim(),
          vehicle: vehicleName,
          pickupAt,
          returnAt,
        });

        router.push(`/booking-confirmation?${params.toString()}`);
        return;
      }

      router.refresh();
    } catch (err) {
      console.error('Booking submit failed:', err);
      setError('Something went wrong while creating the booking.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!loadingAvailability && !groupSummaryVehicle) {
    return (
      <main className="min-h-screen bg-white px-6 py-10 text-black">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-bold">Vehicle group not found</h1>
            <p className="mt-3 text-gray-600">
              We could not find an active vehicle or fleet group for this booking page.
            </p>
            <div className="mt-6">
              <Link
                href="/vehicles"
                className="inline-flex rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Back to Fleet
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-10 text-neutral-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <Link href="/vehicles" className="text-sm text-neutral-600 hover:text-black">
            ← Back to Fleet
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h1 className="text-4xl font-bold tracking-tight">
              {groupId ? 'Book This Vehicle Group' : 'Book a Vehicle'}
            </h1>
            <p className="mt-3 text-neutral-600">
              Select your dates, choose an available vehicle, and complete your booking.
            </p>

            {error ? (
              <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {successMessage ? (
              <div className="mt-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {successMessage}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-neutral-800">
                    Pickup
                  </span>
                  <input
                    type="datetime-local"
                    value={pickupAt}
                    onChange={(e) => setPickupAt(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-black"
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-neutral-800">
                    Return
                  </span>
                  <input
                    type="datetime-local"
                    value={returnAt}
                    onChange={(e) => setReturnAt(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-black"
                    required
                  />
                </label>
              </div>

              <div>
                <h2 className="mb-3 text-sm font-medium text-neutral-800">
                  Available Vehicles
                </h2>

                {loadingAvailability ? (
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-600">
                    Loading vehicle availability...
                  </div>
                ) : availableVehicles.length === 0 ? (
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-600">
                    No vehicles are available for the selected dates.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {availableVehicles.map((vehicle) => {
                      const checked = selectedVehicleId === vehicle.id;

                      return (
                        <label
                          key={vehicle.id}
                          className={`block cursor-pointer rounded-2xl border p-4 transition ${
                            checked
                              ? 'border-black bg-neutral-50'
                              : 'border-neutral-200 bg-white hover:border-neutral-300'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="radio"
                              name="selectedVehicle"
                              checked={checked}
                              onChange={() => setSelectedVehicleId(vehicle.id)}
                              className="mt-1"
                            />

                            <div className="min-w-0 flex-1">
                              <div className="text-lg font-semibold">
                                {getVehicleDisplayName(vehicle)}
                              </div>

                              <div className="mt-1 text-sm text-neutral-600">
                                {vehicle.transmission || 'Transmission N/A'}
                                {vehicle.seats ? ` • ${vehicle.seats} seats` : ''}
                              </div>

                              <div className="mt-3 text-xl font-semibold">
                                {formatCurrency(vehicle.pricePerDay)} / day
                              </div>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-neutral-800">
                    Full Name
                  </span>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-black"
                    placeholder="Your full name"
                    required
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_190px]">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-neutral-800">
                    Email
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-black"
                    placeholder="you@example.com"
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-neutral-800">
                    Phone
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-black"
                    placeholder="(555) 555-5555"
                    required
                  />
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting || availableVehicles.length === 0}
                  className="inline-flex rounded-2xl bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Creating Booking...' : 'Book Now'}
                </button>
              </div>
            </form>
          </div>

          <aside className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold">Booking Summary</h2>

            {headerVehicle ? (
              <>
                <div className="mt-6">
                  <div className="text-2xl font-bold">
                    {getVehicleDisplayName(headerVehicle)}
                  </div>
                  <div className="mt-1 text-neutral-600">
                    {headerVehicle.transmission || 'Transmission N/A'}
                    {headerVehicle.seats ? ` • ${headerVehicle.seats} seats` : ''}
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-neutral-200 p-4">
                  <div className="text-sm font-medium text-neutral-800">Selected Dates</div>
                  <div className="mt-3 space-y-2 text-sm text-neutral-700">
                    <div>Pickup: {formatDateTimeLocal(pickupAt)}</div>
                    <div>Return: {formatDateTimeLocal(returnAt)}</div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-neutral-200 p-4">
                  <div className="text-sm font-medium text-neutral-800">Rate</div>
                  <div className="mt-3 text-2xl font-bold">
                    {formatCurrency(dailyRate)} / day
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-neutral-200 p-4">
                  <div className="text-sm font-medium text-neutral-800">
                    Estimated Charges
                  </div>

                  <div className="mt-3 space-y-3 text-sm text-neutral-700">
                    <div className="flex items-center justify-between gap-4">
                      <span>Rental Length</span>
                      <span className="font-medium text-neutral-900">{rentalLength}</span>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span>Billable Days</span>
                      <span className="font-medium text-neutral-900">
                        {billableDays > 0 ? billableDays : '—'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span>Daily Rate</span>
                      <span className="font-medium text-neutral-900">
                        {formatCurrency(dailyRate)}
                      </span>
                    </div>

                    <div className="border-t border-neutral-200 pt-3">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-base font-semibold text-neutral-900">
                          Estimated Total
                        </span>
                        <span className="text-2xl font-bold text-neutral-900">
                          {estimatedTotal != null
                            ? formatCurrency(estimatedTotal)
                            : '—'}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-neutral-500">
                      Pricing shown as an estimate using full-day billing rounded up
                      to the next day.
                    </p>
                  </div>
                </div>

                {selectedVehicle ? (
                  <div className="mt-4 rounded-2xl border border-neutral-200 p-4">
                    <div className="text-sm font-medium text-neutral-800">
                      Selected Vehicle
                    </div>
                    <div className="mt-3 text-neutral-700">
                      {getVehicleDisplayName(selectedVehicle)}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
                Select dates to view your booking summary.
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}