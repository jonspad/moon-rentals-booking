'use client';

import { useMemo, useState } from 'react';

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

export default function HomePage() {
  const [pickupAt, setPickupAt] = useState('');
  const [returnAt, setReturnAt] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const invalidDateRange = useMemo(() => {
    if (!pickupAt || !returnAt) return false;
    return new Date(pickupAt) > new Date(returnAt);
  }, [pickupAt, returnAt]);

  async function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!pickupAt || !returnAt) {
      setError('Please select both pickup and return date/time.');
      return;
    }

    if (new Date(pickupAt) > new Date(returnAt)) {
      setError('Return date/time must be the same as or later than pickup date/time.');
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

  function handleClear() {
    setPickupAt('');
    setReturnAt('');
    setVehicles([]);
    setError('');
    setHasSearched(false);
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-bold">Moon Rentals</h1>

      <p className="mt-2 text-gray-600">
        Select your dates to see available vehicles.
      </p>

      <form
        onSubmit={handleSearch}
        className="mt-8 grid gap-4 rounded-2xl border p-6 md:grid-cols-4"
      >
        <div>
          <label className="mb-2 block text-sm font-medium">
            Pickup Date &amp; Time
          </label>
          <input
            type="datetime-local"
            value={pickupAt}
            onChange={(e) => setPickupAt(e.target.value)}
            className="w-full rounded-xl border px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Return Date &amp; Time
          </label>
          <input
            type="datetime-local"
            value={returnAt}
            onChange={(e) => setReturnAt(e.target.value)}
            className="w-full rounded-xl border px-3 py-2"
            required
          />
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading || invalidDateRange}
            className="w-full rounded-xl border px-4 py-2 font-medium"
          >
            {loading ? 'Searching...' : 'Search Availability'}
          </button>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={handleClear}
            className="w-full rounded-xl border px-4 py-2 font-medium"
          >
            Clear
          </button>
        </div>
      </form>

      {invalidDateRange && (
        <p className="mt-4 text-sm text-red-600">
          Return date/time must be the same as or later than pickup date/time.
        </p>
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {hasSearched && !error && !loading && (
        <p className="mt-4 text-sm text-gray-600">
          Search results for <span className="font-medium">{pickupAt}</span> to{' '}
          <span className="font-medium">{returnAt}</span>
        </p>
      )}

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {vehicles.map((vehicle) => (
          <div key={vehicle.id} className="rounded-2xl border p-5">
            {vehicle.image ? (
              <img
                src={vehicle.image}
                alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                className="mb-4 h-48 w-full rounded-xl object-cover"
              />
            ) : null}

            <h2 className="text-xl font-semibold">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h2>

            <p className="mt-1 text-sm text-gray-600">{vehicle.category}</p>

            <p className="mt-3 text-sm">
              {vehicle.seats} seats • {vehicle.transmission}
            </p>

            <p className="mt-3 text-lg font-semibold">
              ${vehicle.pricePerDay}/day
            </p>

            <p className="mt-3 text-sm text-gray-700">{vehicle.description}</p>

            <button className="mt-4 rounded-xl border px-4 py-2">
              Select Vehicle
            </button>
          </div>
        ))}
      </section>

      {!loading && !hasSearched && !error && (
        <p className="mt-6 text-sm text-gray-500">
          No vehicles shown yet. Select dates to begin.
        </p>
      )}

      {!loading && hasSearched && vehicles.length === 0 && !error && (
        <p className="mt-6 text-sm text-gray-500">
          No vehicles are available for the selected dates.
        </p>
      )}
    </main>
  );
}