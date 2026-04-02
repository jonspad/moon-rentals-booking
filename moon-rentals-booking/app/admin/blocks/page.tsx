'use client';

import { useEffect, useMemo, useState } from 'react';

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

type TimeOption = {
  value: string;
  label: string;
};

function generateTimeOptions(): TimeOption[] {
  const options: TimeOption[] = [];

  for (let hour = 0; hour < 24; hour++) {
    for (const minute of [0, 30]) {
      const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(
        2,
        '0'
      )}`;
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

function formatDateTime(value: string): string {
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
  const timeOptions = useMemo(() => generateTimeOptions(), []);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [blocks, setBlocks] = useState<VehicleBlock[]>([]);

  const [vehicleId, setVehicleId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('10:30');
  const [reason, setReason] = useState('');

  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [selectedBlockIds, setSelectedBlockIds] = useState<number[]>([]);

  const start = useMemo(
    () => combineDateAndTime(startDate, startTime),
    [startDate, startTime]
  );

  const end = useMemo(
    () => combineDateAndTime(endDate, endTime),
    [endDate, endTime]
  );

  const invalidDateRange = useMemo(() => {
    if (!start || !end) return false;
    return new Date(start) >= new Date(end);
  }, [start, end]);

  const sortedBlocks = useMemo(() => {
    return blocks
      .slice()
      .sort(
        (a: VehicleBlock, b: VehicleBlock) =>
          new Date(b.start).getTime() - new Date(a.start).getTime()
      );
  }, [blocks]);

  const allVisibleSelected =
    sortedBlocks.length > 0 &&
    sortedBlocks.every((block: VehicleBlock) => selectedBlockIds.includes(block.id));

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
    const nextBlocks: VehicleBlock[] = Array.isArray(data.blocks) ? data.blocks : [];
    setBlocks(nextBlocks);

    setSelectedBlockIds((prev: number[]) =>
      prev.filter((id: number) =>
        nextBlocks.some((block: VehicleBlock) => block.id === id)
      )
    );
  }

  async function refreshData() {
    try {
      setPageLoading(true);
      setError('');
      await Promise.all([loadVehicles(), loadBlocks()]);
    } catch (err) {
      console.error('Failed to load admin blocks page data:', err);
      setError('Failed to load vehicles or blocks.');
    } finally {
      setPageLoading(false);
    }
  }

  useEffect(() => {
    void refreshData();
  }, []);

  async function handleSubmit() {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (!vehicleId || !start || !end) {
        setError('Vehicle, block start, and block end are required.');
        return;
      }

      if (new Date(start) >= new Date(end)) {
        setError('Block end must be later than block start.');
        return;
      }

      const res = await fetch('/api/vehicle-blocks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      setStartDate('');
      setStartTime('10:00');
      setEndDate('');
      setEndTime('10:30');
      setReason('');
      await loadBlocks();
    } catch (err) {
      console.error('Create block error:', err);
      setError('Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(blockId: number) {
    const confirmed = window.confirm('Delete this vehicle block?');
    if (!confirmed) return;

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
      setError('Something went wrong while deleting.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleBulkDelete() {
    if (selectedBlockIds.length === 0) {
      setError('Select at least one block to delete.');
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedBlockIds.length} selected block${
        selectedBlockIds.length === 1 ? '' : 's'
      }?`
    );

    if (!confirmed) return;

    setBulkDeleting(true);
    setError('');
    setMessage('');

    try {
      const results = await Promise.all(
        selectedBlockIds.map(async (blockId: number) => {
          const res = await fetch(`/api/vehicle-blocks?id=${blockId}`, {
            method: 'DELETE',
            cache: 'no-store',
          });

          const rawText = await res.text();
          const data = rawText ? JSON.parse(rawText) : {};

          if (!res.ok) {
            throw new Error(data.error || `Failed to delete block ${blockId}.`);
          }

          return data;
        })
      );

      if (results.length > 0) {
        setMessage(
          `Deleted ${results.length} block${results.length === 1 ? '' : 's'} successfully.`
        );
      }

      setSelectedBlockIds([]);
      await loadBlocks();
    } catch (err) {
      console.error('Bulk delete blocks error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong while deleting selected blocks.'
      );
    } finally {
      setBulkDeleting(false);
    }
  }

  function toggleBlockSelection(blockId: number) {
    setSelectedBlockIds((prev: number[]) =>
      prev.includes(blockId)
        ? prev.filter((id: number) => id !== blockId)
        : [...prev, blockId]
    );
  }

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      setSelectedBlockIds((prev: number[]) =>
        prev.filter(
          (id: number) => !sortedBlocks.some((block: VehicleBlock) => block.id === id)
        )
      );
      return;
    }

    setSelectedBlockIds((prev: number[]) => {
      const next = new Set(prev);
      for (const block of sortedBlocks) {
        next.add(block.id);
      }
      return Array.from(next);
    });
  }

  function clearSelection() {
    setSelectedBlockIds([]);
  }

  function getVehicleLabel(id: number) {
    const vehicle = vehicles.find((v: Vehicle) => v.id === id);

    if (!vehicle) return `Vehicle ${id}`;

    return `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Vehicle Blocks</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Add manual blockout dates so vehicles cannot be booked during those times.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
          className="grid gap-4 md:grid-cols-2"
        >
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium">Vehicle</label>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-black dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              required
            >
              <option value="">Select a vehicle</option>
              {vehicles.map((vehicle: Vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Block Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-black dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Block Start Time</label>
            <select
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-black dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              required
            >
              {timeOptions.map((option: TimeOption) => (
                <option key={`start-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Block End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-black dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Block End Time</label>
            <select
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-black dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              required
            >
              {timeOptions.map((option: TimeOption) => (
                <option key={`end-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium">Reason</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-black dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              placeholder="Maintenance, Turo booking, owner hold, etc."
            />
          </div>

          {invalidDateRange ? (
            <div className="md:col-span-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              Block end must be later than block start.
            </div>
          ) : null}

          {message ? (
            <div className="md:col-span-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">
              {message}
            </div>
          ) : null}

          {error ? (
            <div className="md:col-span-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          ) : null}

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={loading || invalidDateRange}
              className="rounded-xl border border-black bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white dark:bg-white dark:text-black"
            >
              {loading ? 'Saving...' : 'Add Block'}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Current Blocks</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Select multiple blocks to remove them in one action.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={toggleSelectAllVisible}
              disabled={pageLoading || sortedBlocks.length === 0}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-900"
            >
              {allVisibleSelected ? 'Unselect All' : 'Select All'}
            </button>

            <button
              type="button"
              onClick={clearSelection}
              disabled={selectedBlockIds.length === 0}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-900"
            >
              Clear Selection
            </button>

            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkDeleting || selectedBlockIds.length === 0}
              className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30"
            >
              {bulkDeleting
                ? 'Deleting Selected...'
                : `Delete Selected (${selectedBlockIds.length})`}
            </button>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          {selectedBlockIds.length} selected
        </div>

        <div className="mt-6">
          {pageLoading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm shadow-sm dark:border-gray-800 dark:bg-gray-950">
              Loading blocks...
            </div>
          ) : sortedBlocks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              No blocks added yet.
            </div>
          ) : (
            <div className="space-y-4">
              {sortedBlocks.map((block: VehicleBlock) => {
                const isSelected = selectedBlockIds.includes(block.id);

                return (
                  <article
                    key={block.id}
                    className={`rounded-2xl border bg-white p-5 shadow-sm transition dark:bg-gray-950 ${
                      isSelected
                        ? 'border-blue-400 ring-2 ring-blue-200 dark:border-blue-500 dark:ring-blue-900/50'
                        : 'border-gray-200 dark:border-gray-800'
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex gap-4">
                        <div className="pt-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleBlockSelection(block.id)}
                            className="h-4 w-4 rounded border-gray-300"
                            aria-label={`Select block ${block.id}`}
                          />
                        </div>

                        <div>
                          <h4 className="text-lg font-semibold">
                            {getVehicleLabel(block.vehicleId)}
                          </h4>

                          <div className="mt-3 grid gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <p>
                              <span className="font-semibold text-black dark:text-white">
                                Block ID:
                              </span>{' '}
                              #{block.id}
                            </p>
                            <p>
                              <span className="font-semibold text-black dark:text-white">
                                Start:
                              </span>{' '}
                              {formatDateTime(block.start)}
                            </p>
                            <p>
                              <span className="font-semibold text-black dark:text-white">
                                End:
                              </span>{' '}
                              {formatDateTime(block.end)}
                            </p>
                            <p>
                              <span className="font-semibold text-black dark:text-white">
                                Reason:
                              </span>{' '}
                              {block.reason || 'Manual blockout'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex w-full flex-col gap-2 lg:w-40">
                        <button
                          type="button"
                          onClick={() => handleDelete(block.id)}
                          disabled={deletingId === block.id || bulkDeleting}
                          className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30"
                        >
                          {deletingId === block.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}