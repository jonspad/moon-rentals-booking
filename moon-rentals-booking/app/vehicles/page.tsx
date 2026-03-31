'use client';

import { useEffect, useState } from 'react';
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

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    async function loadVehicles() {
      const res = await fetch('/api/vehicles');
      const data = await res.json();

      setVehicles(data.vehicles || []);
    }

    loadVehicles();
  }, []);

  // group by groupId
  const grouped = Object.values(
    vehicles.reduce((acc: any, v) => {
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
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-bold">Our Fleet</h1>

      <p className="mt-2 text-gray-600 dark:text-gray-300">
        Browse available vehicles. Select dates later to check availability.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {grouped.map((v: any) => (
          <div
            key={v.groupId}
            className="rounded-2xl border border-gray-300 bg-white p-5 dark:border-gray-700 dark:bg-gray-950"
          >
            {v.image && (
              <img
                src={v.image}
                className="mb-4 h-48 w-full rounded-xl object-cover"
              />
            )}

            <h2 className="text-xl font-semibold">
              {v.make} {v.model}
            </h2>

            <p className="text-sm text-gray-600 dark:text-gray-300">
              {v.category}
            </p>

            <p className="mt-2 text-sm">
              {v.seats} seats • {v.transmission}
            </p>

            <p className="mt-3 text-lg font-bold">
              From ${v.pricePerDay}/day
            </p>

            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {v.description}
            </p>

            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {v.count} available units
            </p>

            <Link
              href="/book"
              className="mt-4 inline-block rounded-xl border border-gray-300 px-4 py-2 dark:border-gray-700"
            >
              Check Availability
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}