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
      const res = await fetch('/api/vehicles', { cache: 'no-store' });
      const data = await res.json();
      setVehicles(data.vehicles || []);
    }

    loadVehicles();
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
    <main className="mx-auto max-w-6xl px-6 py-12 text-black dark:text-white">
      <h1 className="text-3xl font-bold">Our Fleet</h1>

      <p className="mt-2 text-gray-600 dark:text-gray-300">
        Search the fleet first, then check availability for the exact vehicle you want.
      </p>

      <div className="mt-8 rounded-2xl border border-gray-300 bg-white p-5 dark:border-gray-700 dark:bg-gray-950">
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Search Vehicles</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search make, model, category, or keyword (ex: Ford, SUV, Tesla)"
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-black outline-none transition focus:border-black dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </label>

        <div className="mt-3 text-sm text-gray-600 dark:text-gray-300">
          Showing {filteredVehicles.length} of {grouped.length} vehicle groups
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filteredVehicles.map((v) => (
          <div
            key={v.groupId}
            className="rounded-2xl border border-gray-300 bg-white p-5 dark:border-gray-700 dark:bg-gray-950"
          >
            {v.image && (
              <img
                src={v.image}
                alt={`${v.make} ${v.model}`}
                className="mb-4 h-48 w-full rounded-xl object-cover"
              />
            )}

            <h2 className="text-xl font-semibold">
              {v.make} {v.model}
            </h2>

            <p className="text-sm text-gray-600 dark:text-gray-300">{v.category}</p>

            <p className="mt-2 text-sm">
              {v.seats} seats • {v.transmission}
            </p>

            <p className="mt-3 text-lg font-bold">From ${v.pricePerDay}/day</p>

            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {v.description}
            </p>

            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {v.count} available units
            </p>

            <div className="mt-4 flex gap-3">
              <Link
                href={`/book?groupId=${encodeURIComponent(v.groupId)}&make=${encodeURIComponent(
                  v.make
                )}&model=${encodeURIComponent(v.model)}`}
                className="inline-block rounded-xl border border-gray-300 px-4 py-2 dark:border-gray-700"
              >
                Check Availability
              </Link>

              <Link
                href="/book"
                className="inline-block rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300"
              >
                Broad Search
              </Link>
            </div>
          </div>
        ))}
      </div>

      {filteredVehicles.length === 0 && (
        <div className="mt-8 rounded-2xl border border-gray-300 bg-white p-6 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300">
          No vehicles matched your search.
        </div>
      )}
    </main>
  );
}