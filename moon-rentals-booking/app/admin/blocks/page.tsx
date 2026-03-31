'use client';

import { useEffect, useState } from 'react';

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

type VehicleBlock = {
  id: number;
  vehicleId: number;
  start: string;
  end: string;
  reason: string;
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

export default function AdminBlocksPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [blocks, setBlocks] = useState<VehicleBlock[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadVehicles() {
    const res = await fetch('/api/vehicles', { cache: 'no-store' });
    const rawText = await res.text();

    if (!res.ok) {
      throw new Error(`Failed to load vehicles: ${res.status}`);
    }

    const data = rawText ? JSON.parse(rawText) : {};
    setVehicles(Array.isArray(data.vehicles) ? data.vehicles : []);
  }

  async function loadBlocks() {
    const res = await fetch('/api/vehicle-blocks', { cache: 'no-store' });
    const rawText = await res.text();

    if (!res.ok) {
      throw new Error(`Failed to load blocks: ${res.status}`);
    }

    const data = rawText ? JSON.parse(rawText) : {};
    setBlocks(Array.isArray(data.blocks) ? data.blocks : []);
  }

  async function refreshData() {
    try {
      setError('');
      await Promise.all([loadVehicles(), loadBlocks()]);
    } catch (err) {
      console.error('Failed to load blocks page data:', err);
      setError('Failed to load vehicles or blocks.');
    }
  }

  useEffect(() => {
    refreshData();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/vehicle-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId: Number(vehicleId),
          start,
          end,
          reason,
        }),
      });

      const rawText = await res.text();
      const data = rawText ? JSON.parse(rawText) : {};

      if (!res.ok) {
        setError(data.error || 'Failed to create block.');
        return;
      }

      setMessage('Block created successfully.');
      setVehicleId('');
      setStart('');
      setEnd('');
      setReason('');
      await loadBlocks();
    } catch (err) {
      console.error('Create block error:', err);
      setError('Something went wrong while creating the block.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(blockId: number) {
    setDeletingId(blockId);
    setError('');
    setMessage('');

    try {
      const res = await fetch(`/api/vehicle-blocks?id=${blockId}`, {
        method: 'DELETE',
        cache: 'no-store',
      });

      const rawText = await res.text();
      const data = rawText ? JSON.parse(rawText) : {};

      if (!res.ok) {
        setError(data.error || 'Failed to delete block.');
        return;
      }

      setMessage('Block deleted successfully.');
      await loadBlocks();
    } catch (err) {
      console.error('Delete block error:', err);
      setError('Something went wrong while deleting the block.');
    } finally {
      setDeletingId(null);
    }
  }

  function getVehicleLabel(id: number) {
    const vehicle = vehicles.find((v) => v.id === id);
    if (!vehicle) return `Vehicle ${id}`;
    return `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold">Vehicle Blocks</h2>
      <p className="mt-2 text-gray-600 dark:text-gray-300">
        Add manual blockout dates so vehicles cannot be booked during those times.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-8 grid gap-4 rounded-2xl border border-gray-300 bg-white p-6 dark:border-gray-700 dark:bg-gray-950 md:grid-cols-2"
      >
        <div>
          <label className="mb-2 block text-sm font-medium">Vehicle</label>
          <select
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className="w-full rounded-xl border px-3 py-2"
            required
          >
            <option value="">Select a vehicle</option>
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
            className="w-full rounded-xl border px-3 py-2"
            placeholder="Maintenance, Turo booking, owner hold, etc."
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Block Start</label>
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full rounded-xl border px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Block End</label>
          <input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="w-full rounded-xl border px-3 py-2"
            required
          />
        </div>

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl border px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {loading ? 'Saving...' : 'Add Block'}
          </button>
        </div>
      </form>

      {message ? <p className="mt-4 text-sm text-green-600">{message}</p> : null}
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <section className="mt-8">
        <h3 className="text-xl font-semibold">Current Blocks</h3>

        <div className="mt-4 space-y-4">
          {blocks.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No blocks added yet.
            </p>
          ) : (
            blocks.map((block) => (
              <div
                key={block.id}
                className="rounded-2xl border border-gray-300 bg-white p-5 dark:border-gray-700 dark:bg-gray-950"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h4 className="text-lg font-semibold">
                      {getVehicleLabel(block.vehicleId)}
                    </h4>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      Start: {formatDateTime(block.start)}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      End: {formatDateTime(block.end)}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Reason: {block.reason || 'Manual blockout'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(block.id)}
                    disabled={deletingId === block.id}
                    className="rounded-xl border px-4 py-2 text-sm font-medium disabled:opacity-60"
                  >
                    {deletingId === block.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </section>
  );
}