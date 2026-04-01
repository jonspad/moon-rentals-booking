'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

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

type VehicleGroupResult = {
  groupId: string;
  make: string;
  model: string;
  category: string;
  seats: number;
  transmission: string;
  pricePerDay: number;
  image: string;
  description: string;
  availableCount: number;
  availableColors: string[];
  vehicles: Vehicle[];
};

type TimeOption = {
  value: string;
  label: string;
};

function generateTimeOptions(): TimeOption[] {
  const options: TimeOption[] = [];

  for (let hour = 0; hour < 24; hour++) {
    for (const minute of [0, 30]) {
      const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      const displayHour = hour % 12 === 0 ? 12 : hour % 12;
      const ampm = hour < 12 ? 'AM' : 'PM';
      const label = `${displayHour}:${String(minute).padStart(2, '0')} ${ampm}`;

      options.push({ value, label });
    }
  }

  return options;
}

function combineDateAndTime(date: string, time: string): string {
  if (!date || !time) return '';
  return `${date}T${time}`;
}

function formatDateTimeForDisplay(value: string): string {
  if (!value) return '';

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

export default function BookPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedGroupId = searchParams.get('groupId');
  const selectedMake = searchParams.get('make') || '';
  const selectedModel = searchParams.get('model') || '';

  const timeOptions = useMemo(() => generateTimeOptions(), []);

  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('10:00');
  const [returnDate, setReturnDate] = useState('');
  const [returnTime, setReturnTime] = useState('10:30');

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pickupAt = useMemo(
    () => combineDateAndTime(pickupDate, pickupTime),
    [pickupDate, pickupTime]
  );

  const returnAt = useMemo(
    () => combineDateAndTime(returnDate, returnTime),
    [returnDate, returnTime]
  );

  const invalidDateRange = useMemo(() => {
    if (!pickupAt || !returnAt) return false;
    return new Date(pickupAt) >= new Date(returnAt);
  }, [pickupAt, returnAt]);

  const groupedVehicles = useMemo(() => {
    const groups = new Map<string, VehicleGroupResult>();

    for (const vehicle of vehicles) {
      if (selectedGroupId && vehicle.groupId !== selectedGroupId) {
        continue;
      }

      const existing = groups.get(vehicle.groupId);

      if (!existing) {
        groups.set(vehicle.groupId, {
          groupId: vehicle.groupId,
          make: vehicle.make,
          model: vehicle.model,
          category: vehicle.category,
          seats: vehicle.seats,
          transmission: vehicle.transmission,
          pricePerDay: vehicle.pricePerDay,
          image: vehicle.image,
          description: vehicle.description,
          availableCount: 1,
          availableColors:
            vehicle.color && vehicle.color !== 'Unknown' ? [vehicle.color] : [],
          vehicles: [vehicle],
        });
      } else {
        existing.availableCount += 1;
        existing.vehicles.push(vehicle);

        if (
          vehicle.color &&
          vehicle.color !== 'Unknown' &&
          !existing.availableColors.includes(vehicle.color)
        ) {
          existing.availableColors.push(vehicle.color);
        }

        if (vehicle.pricePerDay < existing.pricePerDay) {
          existing.pricePerDay = vehicle.pricePerDay;
        }
      }
    }

    return Array.from(groups.values()).sort((a, b) => {
      if (a.make !== b.make) {
        return a.make.localeCompare(b.make);
      }

      return a.model.localeCompare(b.model);
    });
  }, [vehicles, selectedGroupId]);

  async function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!pickupAt || !returnAt) {
      setError('Please select both pickup and return date/time.');
      return;
    }

    if (new Date(pickupAt) >= new Date(returnAt)) {
      setError('Return date/time must be later than pickup date/time.');
      return;
    }

    setLoading(true);
    setError('');
    setVehicles([]);
    setHasSearched(true);

    try {
      const res = await fetch('/api/search-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickupAt, returnAt }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Search failed');
        return;
      }

      setVehicles(data.vehicles || []);
    } catch (err) {
      console.error('FETCH ERROR:', err);
      setError('Something went wrong while checking availability.');
    } finally {
      setLoading(false);
    }
  }

  function handleClearDates() {
    setPickupDate('');
    setPickupTime('10:00');
    setReturnDate('');
    setReturnTime('10:30');
    setVehicles([]);
    setError('');
    setHasSearched(false);
  }

  function handleClearVehicleFilter() {
    router.push('/book');
  }

  const selectedVehicleLabel =
    selectedMake || selectedModel
      ? `${selectedMake} ${selectedModel}`.trim()
      : selectedGroupId
      ? 'Selected Vehicle'
      : '';

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 text-black dark:text-white">
      <h1 className="text-3xl font-bold">
        {selectedGroupId ? 'Check Availability for This Vehicle' : 'Book Your Vehicle'}
      </h1>

      <p className="mt-2 text-gray-600 dark:text-gray-300">
        {selectedGroupId
          ? 'Select your dates to check availability for the vehicle you chose from the fleet page.'
          : 'Select your dates to see available vehicles.'}
      </p>

      {selectedGroupId && (
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-gray-300 bg-white p-5 dark:border-gray-700 dark:bg-gray-950 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Searching within</div>
            <div className="text-lg font-semibold">
              {selectedVehicleLabel || 'Selected vehicle group'}
            </div>
          </div>

          <button
            type="button"
            onClick={handleClearVehicleFilter}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium dark:border-gray-700"
          >
            Search All Vehicles Instead
          </button>
        </div>
      )}

      <form
        onSubmit={handleSearch}
        className="mt-8 grid gap-4 rounded-2xl border border-gray-300 p-6 dark:border-gray-700 md:grid-cols-4"
      >
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium">
            Pickup Date &amp; Time
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="date"
              value={pickupDate}
              onChange={(e) => setPickupDate(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-black dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              required
            />
            <select
              value={pickupTime}
              onChange={(e) => setPickupTime(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-black dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              required
            >
              {timeOptions.map((option) => (
                <option key={`pickup-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium">
            Return Date &amp; Time
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-black dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              required
            />
            <select
              value={returnTime}
              onChange={(e) => setReturnTime(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-black dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              required
            >
              {timeOptions.map((option) => (
                <option key={`return-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading || invalidDateRange}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2 font-medium text-black dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            {loading ? 'Searching...' : 'Search Availability'}
          </button>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={handleClearDates}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2 font-medium text-black dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            Clear Dates
          </button>
        </div>
      </form>

      {invalidDateRange && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          Return date/time must be later than pickup date/time.
        </p>
      )}

      {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {hasSearched && !error && !loading && (
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
          Search results for{' '}
          <span className="font-medium">{formatDateTimeForDisplay(pickupAt)}</span> to{' '}
          <span className="font-medium">{formatDateTimeForDisplay(returnAt)}</span>
          {selectedGroupId ? (
            <>
              {' '}
              in <span className="font-medium">{selectedVehicleLabel || 'selected vehicle group'}</span>
            </>
          ) : null}
        </p>
      )}

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groupedVehicles.map((group) => (
          <div
            key={group.groupId}
            className="rounded-2xl border border-gray-300 bg-white p-5 text-black dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          >
            {group.image ? (
              <img
                src={group.image}
                alt={`${group.make} ${group.model}`}
                className="mb-4 h-48 w-full rounded-xl object-cover"
              />
            ) : null}

            <h2 className="text-xl font-semibold">
              {group.make} {group.model}
            </h2>

            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{group.category}</p>

            <p className="mt-3 text-sm">
              {group.seats} seats • {group.transmission}
            </p>

            <p className="mt-3 text-xl font-bold">From ${group.pricePerDay}/day</p>

            <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">{group.description}</p>

            <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
              <span className="font-medium">Available units:</span> {group.availableCount}
            </p>

            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              <span className="font-medium">Available colors:</span>{' '}
              {group.availableColors.length > 0
                ? group.availableColors.join(', ')
                : 'Not specified'}
            </p>

            <Link
              href={`/booking?groupId=${encodeURIComponent(
                group.groupId
              )}&pickupAt=${encodeURIComponent(pickupAt)}&returnAt=${encodeURIComponent(
                returnAt
              )}`}
              className="mt-4 inline-block rounded-xl border border-gray-300 bg-white px-4 py-2 text-black dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            >
              Select Vehicle
            </Link>
          </div>
        ))}
      </section>

      {!loading && !hasSearched && !error && (
        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
          No vehicles shown yet. Select dates to begin.
        </p>
      )}

      {!loading && hasSearched && groupedVehicles.length === 0 && !error && (
        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
          {selectedGroupId
            ? 'That vehicle is not available for the selected dates.'
            : 'No vehicles are available for the selected dates.'}
        </p>
      )}

      <div className="mt-10">
        <Link
          href="/vehicles"
          className="text-sm text-gray-600 underline-offset-4 hover:underline dark:text-gray-300"
        >
          Back to Fleet
        </Link>
      </div>
    </main>
  );
}