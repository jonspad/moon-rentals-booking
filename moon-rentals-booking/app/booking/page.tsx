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
  plate?: string | null;
  dailyRate?: number | null;
  imageUrl?: string | null;
  seats?: number | null;
  transmission?: string | null;
  fuelType?: string | null;
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
  return date.toLocaleString();
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

export default function BookingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const vehicleIdParam = searchParams.get('vehicleId');
  const groupId = searchParams.get('groupId');

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

  const [pickupAt, setPickupAt] = useState(toDatetimeLocalValue(defaultPickup));
  const [returnAt, setReturnAt] = useState(toDatetimeLocalValue(defaultReturn));
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
        setFleetVehicles(
          Array.isArray(vehiclesData.vehicles) ? vehiclesData.vehicles : []
        );
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
    if (!groupId) return fleetVehicles.filter((vehicle) => vehicle.isActive);

    return fleetVehicles.filter((vehicle) => {
      return vehicle.groupId === groupId && vehicle.isActive;
    });
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
          booking.vehicleId === vehicle.id && booking.status !== 'cancelled'
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
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
      <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center justify-center px-4 py-10">
        <div className="w-full rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <h1 className="text-2xl font-bold">Vehicle group not found</h1>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
            We could not find an active vehicle or fleet group for this booking page.
          </p>
          <div className="mt-6">
            <Link
              href="/fleet"
              className="inline-flex rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-900"
            >
              Back to Fleet
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const headerVehicle = selectedVehicle ?? groupSummaryVehicle;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
      <div className="mb-8">
        <Link
          href="/fleet"
          className="text-sm font-medium text-gray-600 transition hover:text-black dark:text-gray-300 dark:hover:text-white"
        >
          ← Back to Fleet
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">
              {groupId ? 'Book This Vehicle Group' : 'Book a Vehicle'}
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Select your dates, choose an available vehicle, and complete your booking.
            </p>
          </div>

          {error ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          ) : null}

          {successMessage ? (
            <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300">
              {successMessage}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="pickupAt"
                  className="mb-2 block text-sm font-medium"
                >
                  Pickup
                </label>
                <input
                  id="pickupAt"
                  type="datetime-local"
                  value={pickupAt}
                  onChange={(e) => setPickupAt(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-black dark:border-gray-700 dark:bg-gray-900 dark:focus:border-white"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="returnAt"
                  className="mb-2 block text-sm font-medium"
                >
                  Return
                </label>
                <input
                  id="returnAt"
                  type="datetime-local"
                  value={returnAt}
                  onChange={(e) => setReturnAt(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-black dark:border-gray-700 dark:bg-gray-900 dark:focus:border-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Available Vehicles
              </label>

              {loadingAvailability ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                  Loading vehicle availability...
                </div>
              ) : availableVehicles.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                  No vehicles are available for the selected dates.
                </div>
              ) : (
                <div className="space-y-3">
                  {availableVehicles.map((vehicle) => {
                    const checked = selectedVehicleId === vehicle.id;

                    return (
                      <label
                        key={vehicle.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                          checked
                            ? 'border-black bg-gray-50 dark:border-white dark:bg-gray-900'
                            : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:hover:bg-gray-900'
                        }`}
                      >
                        <input
                          type="radio"
                          name="vehicleId"
                          value={vehicle.id}
                          checked={checked}
                          onChange={() => setSelectedVehicleId(vehicle.id)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-semibold">
                            {getVehicleDisplayName(vehicle)}
                          </div>
                          <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                            {vehicle.transmission || 'Transmission N/A'}
                            {vehicle.seats ? ` • ${vehicle.seats} seats` : ''}
                            {vehicle.fuelType ? ` • ${vehicle.fuelType}` : ''}
                          </div>
                          <div className="mt-2 text-sm font-medium">
                            {formatCurrency(vehicle.dailyRate)} / day
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-3">
                <label
                  htmlFor="fullName"
                  className="mb-2 block text-sm font-medium"
                >
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-black dark:border-gray-700 dark:bg-gray-900 dark:focus:border-white"
                  placeholder="Your full name"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-black dark:border-gray-700 dark:bg-gray-900 dark:focus:border-white"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="mb-2 block text-sm font-medium"
                >
                  Phone
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-black dark:border-gray-700 dark:bg-gray-900 dark:focus:border-white"
                  placeholder="(555) 555-5555"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || loadingAvailability || availableVehicles.length === 0}
              className="inline-flex rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {submitting ? 'Creating Booking...' : 'Book Now'}
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <h2 className="text-xl font-bold">Booking Summary</h2>

          {headerVehicle ? (
            <div className="mt-4 space-y-4">
              <div>
                <div className="text-lg font-semibold">
                  {getVehicleDisplayName(headerVehicle)}
                </div>
                <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  {headerVehicle.transmission || 'Transmission N/A'}
                  {headerVehicle.seats ? ` • ${headerVehicle.seats} seats` : ''}
                  {headerVehicle.fuelType ? ` • ${headerVehicle.fuelType}` : ''}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                <div className="text-sm font-medium">Selected Dates</div>
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  <div>Pickup: {formatDateTimeLocal(pickupAt)}</div>
                  <div className="mt-1">Return: {formatDateTimeLocal(returnAt)}</div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                <div className="text-sm font-medium">Rate</div>
                <div className="mt-2 text-lg font-semibold">
                  {formatCurrency(headerVehicle.dailyRate)} / day
                </div>
              </div>

              {selectedVehicle ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                  <div className="text-sm font-medium">Selected Vehicle</div>
                  <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    {getVehicleDisplayName(selectedVehicle)}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
              Select dates to view your booking summary.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}