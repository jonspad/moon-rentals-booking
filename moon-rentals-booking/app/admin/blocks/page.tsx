'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

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

type BlockVehicle = {
  blockId: number;
  vehicleId: number;
  label: string;
};

type BlockGroup = {
  key: string;
  groupId: number | null;
  legacy: boolean;
  name: string;
  reason: string;
  start: string;
  end: string;
  createdAt: string;
  updatedAt: string;
  blockIds: number[];
  vehicles: BlockVehicle[];
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

function getInitialExpandedKeys(groups: BlockGroup[], targetGroupId: string | null) {
  if (!targetGroupId) return [];
  return groups
    .filter((group) => String(group.groupId) === targetGroupId)
    .map((group) => group.key);
}

export default function AdminBlocksPage() {
  const searchParams = useSearchParams();
  const targetGroupId = searchParams.get('blockGroupId');

  const timeOptions = useMemo(() => generateTimeOptions(), []);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [blockGroups, setBlockGroups] = useState<BlockGroup[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [selectedGroupKeys, setSelectedGroupKeys] = useState<string[]>([]);

  const [groupName, setGroupName] = useState('');
  const [reason, setReason] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('10:30');
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<number[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deletingGroupKey, setDeletingGroupKey] = useState<string | null>(null);
  const [deletingBlockId, setDeletingBlockId] = useState<number | null>(null);
  const [addingToGroupKey, setAddingToGroupKey] = useState<string | null>(null);

  const [groupAddSelections, setGroupAddSelections] = useState<Record<string, number[]>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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

  const sortedVehicles = useMemo(() => {
    return vehicles
      .slice()
      .sort(
        (a, b) =>
          b.year - a.year ||
          a.make.localeCompare(b.make) ||
          a.model.localeCompare(b.model)
      );
  }, [vehicles]);

  const allVisibleSelected =
    blockGroups.length > 0 &&
    blockGroups.every((group) => selectedGroupKeys.includes(group.key));

  async function loadVehicles() {
    const res = await fetch('/api/vehicles', { cache: 'no-store' });
    const rawText = await res.text();

    if (!res.ok) {
      throw new Error(`Failed to load vehicles: ${res.status}`);
    }

    const data = rawText ? JSON.parse(rawText) : {};
    setVehicles(Array.isArray(data.vehicles) ? data.vehicles : []);
  }

  async function loadBlockGroups() {
    const res = await fetch('/api/vehicle-blocks', { cache: 'no-store' });
    const rawText = await res.text();

    if (!res.ok) {
      throw new Error(`Failed to load blocks: ${res.status}`);
    }

    const data = rawText ? JSON.parse(rawText) : {};
    const nextGroups: BlockGroup[] = Array.isArray(data.blockGroups)
      ? data.blockGroups
      : [];

    setBlockGroups(nextGroups);

    setSelectedGroupKeys((prev) =>
      prev.filter((key) => nextGroups.some((group) => group.key === key))
    );

    setExpandedKeys((prev) => {
      const validPrev = prev.filter((key) =>
        nextGroups.some((group) => group.key === key)
      );

      if (validPrev.length > 0) {
        return validPrev;
      }

      return getInitialExpandedKeys(nextGroups, targetGroupId);
    });
  }

  async function refreshData() {
    try {
      setPageLoading(true);
      setError('');
      await Promise.all([loadVehicles(), loadBlockGroups()]);
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

  useEffect(() => {
    if (!targetGroupId || blockGroups.length === 0) return;

    const matchingKeys = getInitialExpandedKeys(blockGroups, targetGroupId);
    if (matchingKeys.length === 0) return;

    setExpandedKeys((prev) => Array.from(new Set([...prev, ...matchingKeys])));
  }, [targetGroupId, blockGroups]);

  function resetForm() {
    setGroupName('');
    setReason('');
    setStartDate('');
    setStartTime('10:00');
    setEndDate('');
    setEndTime('10:30');
    setSelectedVehicleIds([]);
  }

  function openCreateForm() {
    resetForm();
    setError('');
    setMessage('');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toggleExpanded(groupKey: string) {
    setExpandedKeys((prev) =>
      prev.includes(groupKey)
        ? prev.filter((key) => key !== groupKey)
        : [...prev, groupKey]
    );
  }

  function toggleGroupSelection(groupKey: string) {
    setSelectedGroupKeys((prev) =>
      prev.includes(groupKey)
        ? prev.filter((key) => key !== groupKey)
        : [...prev, groupKey]
    );
  }

  function toggleVehicleSelection(vehicleId: number) {
    setSelectedVehicleIds((prev) =>
      prev.includes(vehicleId)
        ? prev.filter((id) => id !== vehicleId)
        : [...prev, vehicleId]
    );
  }

  function selectAllVehicles() {
    setSelectedVehicleIds(sortedVehicles.map((vehicle) => vehicle.id));
  }

  function clearVehicleSelection() {
    setSelectedVehicleIds([]);
  }

  function toggleGroupAddSelection(groupKey: string, vehicleId: number) {
    setGroupAddSelections((prev) => {
      const existing = prev[groupKey] ?? [];
      const next = existing.includes(vehicleId)
        ? existing.filter((id) => id !== vehicleId)
        : [...existing, vehicleId];

      return {
        ...prev,
        [groupKey]: next,
      };
    });
  }

  function setGroupAddAll(groupKey: string, vehicleIds: number[]) {
    setGroupAddSelections((prev) => ({
      ...prev,
      [groupKey]: vehicleIds,
    }));
  }

  function clearGroupAddSelection(groupKey: string) {
    setGroupAddSelections((prev) => ({
      ...prev,
      [groupKey]: [],
    }));
  }

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      setSelectedGroupKeys([]);
      return;
    }

    setSelectedGroupKeys(blockGroups.map((group) => group.key));
  }

  async function handleSubmit() {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (selectedVehicleIds.length === 0 || !start || !end) {
        setError('Select at least one vehicle, plus a start and end date/time.');
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
          vehicleIds: selectedVehicleIds,
          start,
          end,
          reason,
          groupName,
        }),
      });

      const rawText = await res.text();
      const data = rawText ? JSON.parse(rawText) : {};

      if (!res.ok) {
        setError(data.error || 'Failed to create block group.');
        return;
      }

      setMessage('Block group created successfully.');
      resetForm();
      setShowForm(false);
      await loadBlockGroups();
    } catch (err) {
      console.error('Create block group error:', err);
      setError('Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function deleteLegacyGroup(group: BlockGroup) {
    for (const blockId of group.blockIds) {
      const res = await fetch(`/api/vehicle-blocks?id=${blockId}`, {
        method: 'DELETE',
        cache: 'no-store',
      });

      if (!res.ok) {
        const rawText = await res.text();
        const data = rawText ? JSON.parse(rawText) : {};
        throw new Error(data.error || `Failed to delete legacy block ${blockId}.`);
      }
    }
  }

  async function handleDeleteGroup(group: BlockGroup) {
    const confirmed = window.confirm(
      `Delete this block group and all ${group.vehicles.length} vehicle assignments?`
    );

    if (!confirmed) return;

    setDeletingGroupKey(group.key);
    setError('');
    setMessage('');

    try {
      if (group.groupId) {
        const res = await fetch(`/api/vehicle-blocks?groupId=${group.groupId}`, {
          method: 'DELETE',
          cache: 'no-store',
        });

        const rawText = await res.text();
        const data = rawText ? JSON.parse(rawText) : {};

        if (!res.ok) {
          setError(data.error || 'Failed to delete block group.');
          return;
        }
      } else {
        await deleteLegacyGroup(group);
      }

      setMessage('Block group deleted successfully.');
      await loadBlockGroups();
    } catch (err) {
      console.error('Delete group error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setDeletingGroupKey(null);
    }
  }

  async function handleDeleteSingleBlock(blockId: number) {
    const confirmed = window.confirm('Remove this vehicle from the block?');
    if (!confirmed) return;

    setDeletingBlockId(blockId);
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
        setError(data.error || 'Failed to remove vehicle from block.');
        return;
      }

      setMessage('Vehicle removed from block.');
      await loadBlockGroups();
    } catch (err) {
      console.error('Delete single block error:', err);
      setError('Something went wrong while removing the vehicle.');
    } finally {
      setDeletingBlockId(null);
    }
  }

  async function handleBulkDelete() {
    if (selectedGroupKeys.length === 0) {
      setError('Select at least one group to delete.');
      return;
    }

    const targetGroups = blockGroups.filter((group) =>
      selectedGroupKeys.includes(group.key)
    );

    const confirmed = window.confirm(
      `Delete ${targetGroups.length} selected block group${
        targetGroups.length === 1 ? '' : 's'
      }?`
    );

    if (!confirmed) return;

    setBulkDeleting(true);
    setError('');
    setMessage('');

    try {
      for (const group of targetGroups) {
        if (group.groupId) {
          const res = await fetch(`/api/vehicle-blocks?groupId=${group.groupId}`, {
            method: 'DELETE',
            cache: 'no-store',
          });

          if (!res.ok) {
            const rawText = await res.text();
            const data = rawText ? JSON.parse(rawText) : {};
            throw new Error(data.error || `Failed to delete ${group.name}.`);
          }
        } else {
          await deleteLegacyGroup(group);
        }
      }

      setSelectedGroupKeys([]);
      setMessage(
        `Deleted ${targetGroups.length} block group${
          targetGroups.length === 1 ? '' : 's'
        } successfully.`
      );
      await loadBlockGroups();
    } catch (err) {
      console.error('Bulk delete groups error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong while deleting selected groups.'
      );
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleAddVehiclesToGroup(group: BlockGroup) {
    if (!group.groupId) {
      setError('Legacy block groups cannot be expanded with new vehicles.');
      return;
    }

    const vehicleIds = groupAddSelections[group.key] ?? [];

    if (vehicleIds.length === 0) {
      setError('Select at least one vehicle to add.');
      return;
    }

    setAddingToGroupKey(group.key);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/vehicle-blocks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          blockGroupId: group.groupId,
          vehicleIds,
        }),
      });

      const rawText = await res.text();
      const data = rawText ? JSON.parse(rawText) : {};

      if (!res.ok) {
        setError(data.error || 'Failed to add vehicles to block.');
        return;
      }

      setGroupAddSelections((prev) => ({
        ...prev,
        [group.key]: [],
      }));
      setMessage('Vehicles added to block successfully.');
      await loadBlockGroups();
    } catch (err) {
      console.error('Add vehicles to group error:', err);
      setError('Something went wrong while adding vehicles.');
    } finally {
      setAddingToGroupKey(null);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Vehicle Blocks</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Create grouped vehicle blocks, expand them when needed, and manage the
          vehicles inside each block without clutter.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Block tools</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Create one parent block group, then manage vehicles inside it.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openCreateForm}
              className="rounded-xl border border-black bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 dark:border-white dark:bg-white dark:text-black"
            >
              Add block
            </button>

            {showForm ? (
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
              >
                Close form
              </button>
            ) : null}
          </div>
        </div>

        {showForm ? (
          <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-900/40">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSubmit();
              }}
              className="space-y-5"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Parent Block Name
                  </label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-black dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    placeholder="Maintenance, Weekend Trip, Owner Hold, etc."
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Reason</label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-black dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    placeholder="Optional extra details"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Block Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-black dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Block Start Time
                  </label>
                  <select
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-black dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    required
                  >
                    {timeOptions.map((option) => (
                      <option key={`start-${option.value}`} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Block End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-black dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Block End Time
                  </label>
                  <select
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-black dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    required
                  >
                    {timeOptions.map((option) => (
                      <option key={`end-${option.value}`} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold">Vehicles in this block</h4>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Select one or many vehicles to include in the parent block.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={selectAllVehicles}
                      className="rounded-xl border border-gray-300 px-3 py-1.5 text-xs font-medium transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={clearVehicleSelection}
                      className="rounded-xl border border-gray-300 px-3 py-1.5 text-xs font-medium transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {sortedVehicles.map((vehicle) => {
                    const checked = selectedVehicleIds.includes(vehicle.id);

                    return (
                      <label
                        key={vehicle.id}
                        className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition ${
                          checked
                            ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30'
                            : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleVehicleSelection(vehicle.id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <span>
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {invalidDateRange ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                  Block end must be later than block start.
                </div>
              ) : null}

              {message ? (
                <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">
                  {message}
                </div>
              ) : null}

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                  {error}
                </div>
              ) : null}

              <div>
                <button
                  type="submit"
                  disabled={loading || invalidDateRange}
                  className="rounded-xl border border-black bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white dark:bg-white dark:text-black"
                >
                  {loading ? 'Saving...' : 'Create Parent Block'}
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </div>

      {message && !showForm ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">
          {message}
        </div>
      ) : null}

      {error && !showForm ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Current Blocks</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Parent groups stay compact until opened. Delete the full parent, remove
              single vehicles, or add new vehicles into an existing block.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={toggleSelectAllVisible}
              disabled={pageLoading || blockGroups.length === 0}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-900"
            >
              {allVisibleSelected ? 'Unselect All' : 'Select All'}
            </button>

            <button
              type="button"
              onClick={() => setSelectedGroupKeys([])}
              disabled={selectedGroupKeys.length === 0}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-900"
            >
              Clear Selection
            </button>

            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkDeleting || selectedGroupKeys.length === 0}
              className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30"
            >
              {bulkDeleting
                ? 'Deleting Selected...'
                : `Delete Selected (${selectedGroupKeys.length})`}
            </button>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          {selectedGroupKeys.length} selected
        </div>

        <div className="mt-6">
          {pageLoading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm shadow-sm dark:border-gray-800 dark:bg-gray-950">
              Loading blocks...
            </div>
          ) : blockGroups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              No blocks added yet.
            </div>
          ) : (
            <div className="space-y-4">
              {blockGroups.map((group) => {
                const isSelected = selectedGroupKeys.includes(group.key);
                const isExpanded = expandedKeys.includes(group.key);
                const assignedVehicleIds = new Set(
                  group.vehicles.map((vehicle) => vehicle.vehicleId)
                );
                const availableVehiclesToAdd = sortedVehicles.filter(
                  (vehicle) => !assignedVehicleIds.has(vehicle.id)
                );
                const groupAddVehicleIds = groupAddSelections[group.key] ?? [];

                return (
                  <article
                    key={group.key}
                    className={`rounded-2xl border bg-white p-5 shadow-sm transition dark:bg-gray-950 ${
                      isSelected
                        ? 'border-blue-400 ring-2 ring-blue-200 dark:border-blue-500 dark:ring-blue-900/50'
                        : 'border-gray-200 dark:border-gray-800'
                    }`}
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex gap-4">
                          <div className="pt-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleGroupSelection(group.key)}
                              className="h-4 w-4 rounded border-gray-300"
                              aria-label={`Select ${group.name}`}
                            />
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-lg font-semibold">{group.name}</h4>
                              {group.legacy ? (
                                <span className="rounded-full border border-yellow-200 bg-yellow-50 px-2.5 py-1 text-xs font-medium text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300">
                                  Legacy
                                </span>
                              ) : null}
                              <span className="rounded-full border border-gray-300 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                                {group.vehicles.length} vehicle
                                {group.vehicles.length === 1 ? '' : 's'}
                              </span>
                            </div>

                            <div className="mt-3 grid gap-2 text-sm text-gray-700 dark:text-gray-300">
                              {group.groupId ? (
                                <p>
                                  <span className="font-semibold text-black dark:text-white">
                                    Parent ID:
                                  </span>{' '}
                                  #{group.groupId}
                                </p>
                              ) : null}

                              <p>
                                <span className="font-semibold text-black dark:text-white">
                                  Start:
                                </span>{' '}
                                {formatDateTime(group.start)}
                              </p>
                              <p>
                                <span className="font-semibold text-black dark:text-white">
                                  End:
                                </span>{' '}
                                {formatDateTime(group.end)}
                              </p>
                              <p>
                                <span className="font-semibold text-black dark:text-white">
                                  Reason:
                                </span>{' '}
                                {group.reason || 'Manual blockout'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(group.key)}
                            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
                          >
                            {isExpanded ? 'Collapse' : 'Expand'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteGroup(group)}
                            disabled={deletingGroupKey === group.key || bulkDeleting}
                            className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30"
                          >
                            {deletingGroupKey === group.key
                              ? 'Deleting...'
                              : 'Delete Parent'}
                          </button>
                        </div>
                      </div>

                      {isExpanded ? (
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
                          <div>
                            <h5 className="text-sm font-semibold">Vehicles in this block</h5>

                            <div className="mt-3 space-y-3">
                              {group.vehicles.map((vehicle) => (
                                <div
                                  key={vehicle.blockId}
                                  className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950 md:flex-row md:items-center md:justify-between"
                                >
                                  <div>
                                    <p className="font-medium">{vehicle.label}</p>
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                      Block item #{vehicle.blockId}
                                    </p>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSingleBlock(vehicle.blockId)}
                                    disabled={
                                      deletingBlockId === vehicle.blockId || bulkDeleting
                                    }
                                    className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30"
                                  >
                                    {deletingBlockId === vehicle.blockId
                                      ? 'Removing...'
                                      : 'Remove Vehicle'}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="mt-6">
                            <h5 className="text-sm font-semibold">Add vehicles to this block</h5>

                            {group.legacy ? (
                              <div className="mt-3 rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300">
                                This is a legacy group created from older flat block records.
                                You can delete it, but adding vehicles is only available on new
                                grouped blocks.
                              </div>
                            ) : availableVehiclesToAdd.length === 0 ? (
                              <div className="mt-3 rounded-2xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                All vehicles are already in this block.
                              </div>
                            ) : (
                              <div className="mt-3 space-y-4">
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setGroupAddAll(
                                        group.key,
                                        availableVehiclesToAdd.map((vehicle) => vehicle.id)
                                      )
                                    }
                                    className="rounded-xl border border-gray-300 px-3 py-1.5 text-xs font-medium transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
                                  >
                                    Select All Available
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => clearGroupAddSelection(group.key)}
                                    className="rounded-xl border border-gray-300 px-3 py-1.5 text-xs font-medium transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
                                  >
                                    Clear
                                  </button>
                                </div>

                                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                  {availableVehiclesToAdd.map((vehicle) => {
                                    const checked = groupAddVehicleIds.includes(vehicle.id);

                                    return (
                                      <label
                                        key={`${group.key}-${vehicle.id}`}
                                        className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition ${
                                          checked
                                            ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30'
                                            : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() =>
                                            toggleGroupAddSelection(group.key, vehicle.id)
                                          }
                                          className="h-4 w-4 rounded border-gray-300"
                                        />
                                        <span>
                                          {vehicle.year} {vehicle.make} {vehicle.model}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleAddVehiclesToGroup(group)}
                                  disabled={
                                    addingToGroupKey === group.key ||
                                    groupAddVehicleIds.length === 0
                                  }
                                  className="rounded-xl border border-black bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white dark:bg-white dark:text-black"
                                >
                                  {addingToGroupKey === group.key
                                    ? 'Adding Vehicles...'
                                    : `Add Selected Vehicles (${groupAddVehicleIds.length})`}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : null}
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