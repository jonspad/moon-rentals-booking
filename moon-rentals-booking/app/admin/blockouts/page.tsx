'use client';

import { useEffect, useMemo, useState } from 'react';

type Blockout = {
  id: number;
  vehicleId: number | null;
  start: string;
  end: string;
  reason: string;
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

function formatDateTime(value: string) {
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

export default function AdminBlockoutsPage() {
  const [blockouts, setBlockouts] = useState<Blockout[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('Manual blockout');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const sortedBlockouts = useMemo(() => {
    return blockouts
      .slice()
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [blockouts]);

  async function loadData() {
    try {
      setLoading(true);
      setError('');

      const [blockoutRes, vehiclesRes] = await Promise.all([
        fetch('/api/blockouts', { cache: 'no-store' }),
        fetch('/api/vehicles', { cache: 'no-store' }),
      ]);

      const [blockoutText, vehiclesText] = await Promise.all([
        blockoutRes.text(),
        vehiclesRes.text(),
      ]);

      if (!blockoutRes.ok) {
        throw new Error('Failed to load blockouts.');
      }

      if (!vehiclesRes.ok) {
        throw new Error('Failed to load vehicles.');
      }

      const blockoutData = blockoutText ? JSON.parse(blockoutText) : {};
      const vehiclesData = vehiclesText ? JSON.parse(vehiclesText) : {};

      setBlockouts(Array.isArray(blockoutData.blockouts) ? blockoutData.blockouts : []);
      setVehicles(Array.isArray(vehiclesData.vehicles) ? vehiclesData.vehicles : []);
    } catch (err) {
      console.error(err);
      setError('Failed to load blockouts.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/blockouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId: vehicleId === '' ? null : Number(vehicleId),
          start,
          end,
          reason,
        }),
      });

      const rawText = await res.text();
      const data = rawText ? JSON.parse(rawText) : {};

      if (!res.ok) {
        setError(data.error || 'Failed to create blockout.');
        return;
      }

      setMessage('Blockout created successfully.');
      setVehicleId('');
      setStart('');
      setEnd('');
      setReason('Manual blockout');
      await loadData();
    } catch (err) {
      console.error(err);
      setError('Failed to create blockout.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    setError('');
    setMessage('');

    try {
      const res = await fetch(`/api/blockouts?id=${id}`, {
        method: 'DELETE',
      });

      const rawText = await res.text();
      const data = rawText ? JSON.parse(rawText) : {};

      if (!res.ok) {
        setError(data.error || 'Failed to delete blockout.');
        return;
      }

      setMessage(`Blockout #${id} removed.`);
      await loadData();
    } catch (err) {
      console.error(err);
      setError('Failed to delete blockout.');
    } finally {
      setDeletingId(null);
    }
  }

  function getVehicleLabel(id: number | null) {
    if (id === null) return 'All Vehicles';

    const vehicle = vehicles.find((v) => v.id === id);
    if (!vehicle) return `Vehicle ${id}`;

    return `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold">Blocked Dates</h2>
      <p className="mt-2 text-gray-600 dark:text-gray-300">
        Add or remove manual blockouts used by availability searches.
      </p>

      {message && <p className="mt-4 text-sm text-green-600">{message}</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <form
        onSubmit={handleCreate}
        className="mt-8 grid gap-4 rounded-2xl border border-gray-300 bg-white p-6 dark:border-gray-700 dark:bg-gray-950 md:grid-cols-2"
      >
        <div>
          <label className="mb-2 block text-sm font-medium">Vehicle</label>
          <select
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="">All Vehicles</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.year} {vehicle.make} {vehicle.model}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Reason</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Start</label>
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">End</label>
          <input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
            required
          />
        </div>

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900"
          >
            {saving ? 'Saving...' : 'Create Blockout'}
          </button>
        </div>
      </form>

      <section className="mt-8 space-y-4">
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading blockouts...</p>
        ) : sortedBlockouts.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No blockouts found.
          </p>
        ) : (
          sortedBlockouts.map((blockout) => (
            <div
              key={blockout.id}
              className="rounded-2xl border border-gray-300 bg-white p-5 dark:border-gray-700 dark:bg-gray-950"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold">
                    {getVehicleLabel(blockout.vehicleId)}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    Blockout #{blockout.id}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(blockout.id)}
                  disabled={deletingId === blockout.id}
                  className="rounded-xl border px-4 py-2 text-sm font-medium disabled:opacity-60"
                >
                  {deletingId === blockout.id ? 'Removing...' : 'Remove'}
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <p className="text-sm">
                  <span className="font-medium">Start:</span>{' '}
                  {formatDateTime(blockout.start)}
                </p>
                <p className="text-sm">
                  <span className="font-medium">End:</span>{' '}
                  {formatDateTime(blockout.end)}
                </p>
                <p className="text-sm md:col-span-2">
                  <span className="font-medium">Reason:</span> {blockout.reason}
                </p>
              </div>
            </div>
          ))
        )}
      </section>
    </section>
  );
}