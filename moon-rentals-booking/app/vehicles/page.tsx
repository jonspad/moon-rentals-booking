'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Vehicle = {
  groupId: string;
  make: string;
  model: string;
  category: string;
  seats: number;
  transmission: string;
  pricePerDay: number;
  image: string;
  description: string;
};

type GroupedVehicle = Vehicle & {
  count: number;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function loadVehicles() {
      try {
        const res = await fetch('/api/vehicles', { cache: 'no-store' });
        const data = await res.json();
        setVehicles(data.vehicles || []);
      } catch (error) {
        console.error('Failed to load vehicles:', error);
        setVehicles([]);
      }
    }

    void loadVehicles();
  }, []);

  const grouped = useMemo(() => {
    return Object.values(
      vehicles.reduce((acc: Record<string, GroupedVehicle>, v) => {
        if (!acc[v.groupId]) {
          acc[v.groupId] = {
            ...v,
            count: 1,
          };
        } else {
          acc[v.groupId].count += 1;
        }

        return acc;
      }, {})
    ).sort((a, b) => {
      if (a.make !== b.make) {
        return a.make.localeCompare(b.make);
      }

      return a.model.localeCompare(b.model);
    });
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    const term = normalize(search);

    if (!term) return grouped;

    return grouped.filter((vehicle) => {
      const haystack = [
        vehicle.make,
        vehicle.model,
        vehicle.category,
        vehicle.transmission,
        vehicle.description,
        `${vehicle.make} ${vehicle.model}`,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [grouped, search]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 text-black dark:text-white">
      <section className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Our Fleet</h1>
        <p className="mt-3 max-w-2xl text-base text-gray-600 dark:text-gray-300">
          Search the fleet first, then check availability for the exact vehicle you want.
        </p>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <label className="block">
          <span className="mb-3 block text-sm font-semibold tracking-wide text-gray-900 dark:text-white">
            Search Vehicles
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search make, model, category, or keyword (ex: Ford, SUV, Tesla)"
            style={{
              color: 'white',
              WebkitTextFillColor: 'white',
              caretColor: 'white',
              backgroundColor: '#111827',
            }}
            className="w-full rounded-2xl border border-gray-200 px-5 py-4 text-base placeholder:text-gray-400 outline-none transition focus:border-white focus:ring-2 focus:ring-white dark:border-gray-700"
          />
        </label>

        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Showing{' '}
          <span className="font-semibold text-gray-900 dark:text-white">
            {filteredVehicles.length}
          </span>{' '}
          of{' '}
          <span className="font-semibold text-gray-900 dark:text-white">
            {grouped.length}
          </span>{' '}
          vehicle groups
        </div>
      </section>

      <section className="mt-10 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
        {filteredVehicles.map((v) => (
          <article
            key={v.groupId}
            className="group overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl dark:border-gray-800 dark:bg-gray-950"
          >
            <div className="border-b border-gray-100 bg-gradient-to-b from-gray-50 to-white p-6 dark:border-gray-800 dark:from-gray-900 dark:to-gray-950">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="inline-flex rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                    {v.category}
                  </div>
                </div>

                <div className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white dark:bg-white dark:text-black">
                  {v.count} Available
                </div>
              </div>

              <div className="mt-5 flex h-56 items-center justify-center rounded-2xl bg-white p-4 dark:bg-gray-900">
                {v.image ? (
                  <img
                    src={v.image}
                    alt={`${v.make} ${v.model}`}
                    className="max-h-full w-full object-contain transition duration-300 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="text-sm text-gray-400">No image available</div>
                )}
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-black dark:text-white">
                    {v.make} {v.model}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                    {v.description}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                  {v.seats} Seats
                </span>
                <span className="rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                  {v.transmission}
                </span>
              </div>

              <div className="mt-6 flex items-end justify-between gap-4">
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Starting from</div>
                  <div className="text-3xl font-bold tracking-tight text-black dark:text-white">
                    ${v.pricePerDay}
                    <span className="ml-1 text-base font-medium text-gray-500 dark:text-gray-400">
                      /day
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Link
                  href={`/book?groupId=${encodeURIComponent(v.groupId)}&make=${encodeURIComponent(
                    v.make
                  )}&model=${encodeURIComponent(v.model)}`}
                  className="inline-flex items-center justify-center rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                >
                  Check Availability
                </Link>

                <Link
                  href="/book"
                  className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-gray-900"
                >
                  Broad Search
                </Link>
              </div>
            </div>
          </article>
        ))}
      </section>

      {filteredVehicles.length === 0 && (
        <div className="mt-10 rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300">
          No vehicles matched your search.
        </div>
      )}
    </main>
  );
}