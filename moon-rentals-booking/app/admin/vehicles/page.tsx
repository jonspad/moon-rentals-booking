'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';

type Vehicle = {
  id: number;
  groupId: string;
  slug: string;
  vin: string | null;
  licensePlate: string | null;
  year: number;
  make: string;
  model: string;
  category: string;
  color: string;
  seats: number;
  transmission: string;
  pricePerDay: number;
  image: string;
  description: string;
  internalNotes: string | null;
  isActive: boolean;
};

type VehicleFormState = {
  groupId: string;
  slug: string;
  vin: string;
  licensePlate: string;
  year: string;
  make: string;
  model: string;
  category: string;
  color: string;
  seats: string;
  transmission: string;
  pricePerDay: string;
  image: string;
  description: string;
  internalNotes: string;
  isActive: boolean;
};

type InventoryStatusFilter = 'all' | 'active' | 'inactive';

const initialForm: VehicleFormState = {
  groupId: '',
  slug: '',
  vin: '',
  licensePlate: '',
  year: '',
  make: '',
  model: '',
  category: '',
  color: '',
  seats: '',
  transmission: '',
  pricePerDay: '',
  image: '',
  description: '',
  internalNotes: '',
  isActive: true,
};

function buildSlug(year: string, make: string, model: string) {
  return `${year}-${make}-${model}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function AdminVehiclesPage() {
  const searchParams = useSearchParams();
  const focusedVehicleId = Number(searchParams.get('vehicleId')) || null;

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState<VehicleFormState>(initialForm);
  const [slugEditedManually, setSlugEditedManually] = useState(false);
  const [groupMode, setGroupMode] = useState<'existing' | 'new'>('existing');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [newGroupId, setNewGroupId] = useState('');
  const [showAllVehicles, setShowAllVehicles] = useState(!focusedVehicleId);
  const [showForm, setShowForm] = useState(!focusedVehicleId);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InventoryStatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');

  async function loadVehicles() {
    const res = await fetch('/api/admin/vehicles', { cache: 'no-store' });
    const rawText = await res.text();
    const data = rawText ? JSON.parse(rawText) : {};

    if (!res.ok) {
      throw new Error(data.error || 'Failed to load vehicles.');
    }

    setVehicles(Array.isArray(data.vehicles) ? data.vehicles : []);
  }

  async function refreshVehicles() {
    try {
      setLoading(true);
      setError('');
      await loadVehicles();
    } catch (err) {
      console.error('Failed to refresh vehicles:', err);
      setError('Failed to load vehicles.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshVehicles();
  }, []);

  useEffect(() => {
    setShowAllVehicles(!focusedVehicleId);
    setShowForm(!focusedVehicleId);
  }, [focusedVehicleId]);

  const existingGroupIds = useMemo(() => {
    const ids = vehicles
      .map((vehicle) => vehicle.groupId?.trim())
      .filter((id): id is string => Boolean(id));

    return Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b));
  }, [vehicles]);

  const categories = useMemo(() => {
    const values = vehicles
      .map((vehicle) => vehicle.category?.trim())
      .filter((value): value is string => Boolean(value));

    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [vehicles]);

  const inventoryStats = useMemo(() => {
    const active = vehicles.filter((vehicle) => vehicle.isActive).length;
    const inactive = vehicles.length - active;
    const avgRate =
      vehicles.length > 0
        ? Math.round(
            vehicles.reduce((sum, vehicle) => sum + vehicle.pricePerDay, 0) /
              vehicles.length
          )
        : 0;

    return {
      total: vehicles.length,
      active,
      inactive,
      avgRate,
    };
  }, [vehicles]);

  const sortedVehicles = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const next = vehicles.filter((vehicle) => {
      if (statusFilter === 'active' && !vehicle.isActive) return false;
      if (statusFilter === 'inactive' && vehicle.isActive) return false;

      if (categoryFilter !== 'all' && vehicle.category !== categoryFilter) {
        return false;
      }

      if (groupFilter !== 'all' && vehicle.groupId !== groupFilter) {
        return false;
      }

      if (!normalizedSearch) return true;

      const haystack = [
        vehicle.groupId,
        vehicle.slug,
        vehicle.vin ?? '',
        vehicle.licensePlate ?? '',
        String(vehicle.year),
        vehicle.make,
        vehicle.model,
        vehicle.category,
        vehicle.color,
        vehicle.transmission,
        vehicle.description,
        vehicle.internalNotes ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });

    return next.sort(
      (a, b) =>
        Number(b.isActive) - Number(a.isActive) ||
        b.year - a.year ||
        a.make.localeCompare(b.make) ||
        a.model.localeCompare(b.model)
    );
  }, [vehicles, search, statusFilter, categoryFilter, groupFilter]);

  const focusedVehicle = useMemo(() => {
    if (!focusedVehicleId) return null;
    return vehicles.find((vehicle) => vehicle.id === focusedVehicleId) ?? null;
  }, [vehicles, focusedVehicleId]);

  const hasActiveFilters =
    search.trim() !== '' ||
    statusFilter !== 'all' ||
    categoryFilter !== 'all' ||
    groupFilter !== 'all';

  const displayedVehicles = useMemo(() => {
    if (focusedVehicle && !showAllVehicles && !hasActiveFilters) {
      return [focusedVehicle];
    }

    return sortedVehicles;
  }, [focusedVehicle, showAllVehicles, hasActiveFilters, sortedVehicles]);

  function updateForm<K extends keyof VehicleFormState>(
    key: K,
    value: VehicleFormState[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    setSlugEditedManually(false);
    setGroupMode('existing');
    setSelectedGroupId('');
    setNewGroupId('');
  }

  function openCreateForm() {
    resetForm();
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function fillForm(vehicle: Vehicle) {
    setEditingId(vehicle.id);

    setForm({
      groupId: vehicle.groupId,
      slug: vehicle.slug,
      vin: vehicle.vin ?? '',
      licensePlate: vehicle.licensePlate ?? '',
      year: String(vehicle.year),
      make: vehicle.make,
      model: vehicle.model,
      category: vehicle.category,
      color: vehicle.color,
      seats: String(vehicle.seats),
      transmission: vehicle.transmission,
      pricePerDay: String(vehicle.pricePerDay),
      image: vehicle.image,
      description: vehicle.description,
      internalNotes: vehicle.internalNotes ?? '',
      isActive: vehicle.isActive,
    });

    setSlugEditedManually(true);

    const existingId = vehicle.groupId?.trim() || '';

    if (existingId && existingGroupIds.includes(existingId)) {
      setGroupMode('existing');
      setSelectedGroupId(existingId);
      setNewGroupId('');
    } else if (existingId) {
      setGroupMode('new');
      setSelectedGroupId('');
      setNewGroupId(existingId);
    } else {
      setGroupMode('existing');
      setSelectedGroupId('');
      setNewGroupId('');
    }

    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  useEffect(() => {
    if (slugEditedManually) return;

    const nextSlug = buildSlug(form.year, form.make, form.model);

    setForm((prev) => ({
      ...prev,
      slug: nextSlug,
    }));
  }, [form.year, form.make, form.model, slugEditedManually]);

  async function handleImageUpload(file: File) {
    setUploadingImage(true);
    setError('');
    setMessage('');

    try {
      const body = new FormData();
      body.append('file', file);

      const res = await fetch('/api/admin/uploads/vehicle-image', {
        method: 'POST',
        body,
      });

      const rawText = await res.text();
      const data = rawText ? JSON.parse(rawText) : {};

      if (!res.ok) {
        setError(data.error || 'Failed to upload image.');
        return;
      }

      updateForm('image', data.imagePath || '');
      setMessage('Image uploaded successfully.');
    } catch (err) {
      console.error('Image upload failed:', err);
      setError('Failed to upload image.');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const resolvedGroupId =
        groupMode === 'new' ? newGroupId.trim() : selectedGroupId.trim();

      const payload = {
        groupId: resolvedGroupId,
        slug: form.slug.trim(),
        vin: form.vin.trim(),
        licensePlate: form.licensePlate.trim(),
        year: form.year,
        make: form.make.trim(),
        model: form.model.trim(),
        category: form.category.trim(),
        color: form.color.trim(),
        seats: form.seats,
        transmission: form.transmission.trim(),
        pricePerDay: form.pricePerDay,
        image: form.image.trim(),
        description: form.description.trim(),
        internalNotes: form.internalNotes.trim(),
        isActive: form.isActive,
      };

      const url =
        editingId === null
          ? '/api/admin/vehicles'
          : `/api/admin/vehicles/${editingId}`;
      const method = editingId === null ? 'POST' : 'PATCH';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const rawText = await res.text();
      const data = rawText ? JSON.parse(rawText) : {};

      if (!res.ok) {
        setError(data.error || 'Failed to save vehicle.');
        return;
      }

      setMessage(
        editingId === null
          ? 'Vehicle created successfully.'
          : 'Vehicle updated successfully.'
      );

      resetForm();
      setShowForm(false);
      await loadVehicles();
    } catch (err) {
      console.error('Failed to save vehicle:', err);
      setError('Failed to save vehicle.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleVehicleActive(vehicle: Vehicle) {
    setError('');
    setMessage('');

    try {
      const res = await fetch(`/api/admin/vehicles/${vehicle.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: !vehicle.isActive,
        }),
      });

      const rawText = await res.text();
      const data = rawText ? JSON.parse(rawText) : {};

      if (!res.ok) {
        setError(data.error || 'Failed to update vehicle status.');
        return;
      }

      setMessage(
        `${vehicle.year} ${vehicle.make} ${vehicle.model} ${
          vehicle.isActive ? 'disabled' : 'enabled'
        }.`
      );

      await loadVehicles();
    } catch (err) {
      console.error('Failed to toggle vehicle status:', err);
      setError('Failed to update vehicle status.');
    }
  }

  async function handleDelete(vehicle: Vehicle) {
    const confirmed = window.confirm(
      `Delete ${vehicle.year} ${vehicle.make} ${vehicle.model}?`
    );

    if (!confirmed) return;

    setDeletingId(vehicle.id);
    setError('');
    setMessage('');

    try {
      const res = await fetch(`/api/admin/vehicles/${vehicle.id}`, {
        method: 'DELETE',
      });

      const rawText = await res.text();
      const data = rawText ? JSON.parse(rawText) : {};

      if (!res.ok) {
        setError(data.error || 'Failed to delete vehicle.');
        return;
      }

      setMessage(`${vehicle.year} ${vehicle.make} ${vehicle.model} deleted.`);
      await loadVehicles();

      if (editingId === vehicle.id) {
        resetForm();
        setShowForm(false);
      }
    } catch (err) {
      console.error('Failed to delete vehicle:', err);
      setError('Failed to delete vehicle.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Manage Vehicles</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Add inventory, edit details, and quickly search or filter the current
          fleet.
        </p>
      </div>

      {focusedVehicleId && focusedVehicle && !showAllVehicles && !hasActiveFilters ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
          Focused vehicle view: {focusedVehicle.year} {focusedVehicle.make}{' '}
          {focusedVehicle.model} (Vehicle #{focusedVehicle.id})
        </div>
      ) : null}

      {focusedVehicleId && !focusedVehicle && !loading ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          Vehicle #{focusedVehicleId} was not found.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total vehicles
          </p>
          <p className="mt-2 text-3xl font-bold">{inventoryStats.total}</p>
        </div>

        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 shadow-sm dark:border-green-900 dark:bg-green-950/30">
          <p className="text-sm text-green-700 dark:text-green-300">Active</p>
          <p className="mt-2 text-3xl font-bold text-green-800 dark:text-green-200">
            {inventoryStats.active}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-300 bg-gray-50 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-600 dark:text-gray-300">Inactive</p>
          <p className="mt-2 text-3xl font-bold">{inventoryStats.inactive}</p>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm dark:border-blue-900 dark:bg-blue-950/30">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Avg daily rate
          </p>
          <p className="mt-2 text-3xl font-bold text-blue-800 dark:text-blue-200">
            {formatMoney(inventoryStats.avgRate)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Vehicle tools</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Search the fleet, focus a specific vehicle, or open the form only
              when needed.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openCreateForm}
              className="rounded-xl border border-black bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 dark:border-white dark:bg-white dark:text-black"
            >
              Add new vehicle
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
            <h3 className="text-lg font-semibold">
              {editingId === null ? 'Add Vehicle' : `Edit Vehicle #${editingId}`}
            </h3>

            <form onSubmit={handleSubmit} className="mt-5 space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Group mode
                  </label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setGroupMode('existing')}
                      className={`rounded-xl border px-4 py-2 text-sm font-medium ${
                        groupMode === 'existing'
                          ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                          : 'border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900'
                      }`}
                    >
                      Existing group
                    </button>
                    <button
                      type="button"
                      onClick={() => setGroupMode('new')}
                      className={`rounded-xl border px-4 py-2 text-sm font-medium ${
                        groupMode === 'new'
                          ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                          : 'border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900'
                      }`}
                    >
                      New group
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Group ID
                  </label>
                  {groupMode === 'existing' ? (
                    <select
                      value={selectedGroupId}
                      onChange={(e) => {
                        setSelectedGroupId(e.target.value);
                        updateForm('groupId', e.target.value);
                      }}
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                    >
                      <option value="">Select a group</option>
                      {existingGroupIds.map((groupId) => (
                        <option key={groupId} value={groupId}>
                          {groupId}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={newGroupId}
                      onChange={(e) => {
                        setNewGroupId(e.target.value);
                        updateForm('groupId', e.target.value);
                      }}
                      placeholder="Enter new group ID"
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                    />
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Year</label>
                  <input
                    value={form.year}
                    onChange={(e) => updateForm('year', e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Make</label>
                  <input
                    value={form.make}
                    onChange={(e) => updateForm('make', e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Model</label>
                  <input
                    value={form.model}
                    onChange={(e) => updateForm('model', e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Slug</label>
                  <input
                    value={form.slug}
                    onChange={(e) => {
                      setSlugEditedManually(true);
                      updateForm('slug', e.target.value);
                    }}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Category
                  </label>
                  <input
                    value={form.category}
                    onChange={(e) => updateForm('category', e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Color</label>
                  <input
                    value={form.color}
                    onChange={(e) => updateForm('color', e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Seats</label>
                  <input
                    value={form.seats}
                    onChange={(e) => updateForm('seats', e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Transmission
                  </label>
                  <input
                    value={form.transmission}
                    onChange={(e) => updateForm('transmission', e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Price / day
                  </label>
                  <input
                    value={form.pricePerDay}
                    onChange={(e) => updateForm('pricePerDay', e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">VIN</label>
                  <input
                    value={form.vin}
                    onChange={(e) => updateForm('vin', e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    License plate
                  </label>
                  <input
                    value={form.licensePlate}
                    onChange={(e) => updateForm('licensePlate', e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium">
                    Image path
                  </label>
                  <input
                    value={form.image}
                    onChange={(e) => updateForm('image', e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                    required
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <label className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900">
                      <span>{uploadingImage ? 'Uploading...' : 'Upload image'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingImage}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            void handleImageUpload(file);
                          }
                          e.currentTarget.value = '';
                        }}
                      />
                    </label>

                    {form.image ? (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Current image: {form.image}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium">
                    Description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => updateForm('description', e.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium">
                    Internal notes
                  </label>
                  <textarea
                    value={form.internalNotes}
                    onChange={(e) => updateForm('internalNotes', e.target.value)}
                    rows={4}
                    placeholder="Internal-only notes for admin use"
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                  />
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    These notes are for admin use only and should not appear on
                    the public site.
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="inline-flex items-center gap-3 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => updateForm('isActive', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    Vehicle is active
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl border border-black bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white dark:bg-white dark:text-black"
                >
                  {saving
                    ? editingId === null
                      ? 'Creating...'
                      : 'Saving...'
                    : editingId === null
                    ? 'Create Vehicle'
                    : 'Save Changes'}
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-medium transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
                >
                  Clear Form
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="grid gap-4 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="mb-2 block text-sm font-medium">Search</label>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (focusedVehicleId) {
                  setShowAllVehicles(true);
                }
              }}
              placeholder="Search make, model, group, VIN, plate, category, notes..."
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as InventoryStatusFilter);
                if (focusedVehicleId) {
                  setShowAllVehicles(true);
                }
              }}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="all">All vehicles</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                if (focusedVehicleId) {
                  setShowAllVehicles(true);
                }
              }}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium">Group</label>
            <select
              value={groupFilter}
              onChange={(e) => {
                setGroupFilter(e.target.value);
                if (focusedVehicleId) {
                  setShowAllVehicles(true);
                }
              }}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="all">All groups</option>
              {existingGroupIds.map((groupId) => (
                <option key={groupId} value={groupId}>
                  {groupId}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-end gap-3 lg:col-span-3">
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setCategoryFilter('all');
                setGroupFilter('all');
                setShowAllVehicles(!focusedVehicleId);
              }}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
            >
              Reset filters
            </button>

            {focusedVehicle ? (
              <button
                type="button"
                onClick={() => setShowAllVehicles((prev) => !prev)}
                className="rounded-xl border border-blue-300 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/30"
              >
                {showAllVehicles ? 'Show focused vehicle' : 'Show all vehicles'}
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => {
                void refreshVehicles();
              }}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
            >
              Refresh inventory
            </button>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Showing {displayedVehicles.length} of {vehicles.length} vehicles
            </p>
          </div>
        </div>
      </div>

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

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm shadow-sm dark:border-gray-800 dark:bg-gray-950">
          Loading vehicles...
        </div>
      ) : displayedVehicles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400">
          No vehicles match the current filters.
        </div>
      ) : (
        <div className="space-y-4">
          {displayedVehicles.map((vehicle) => {
            const isFocused =
              focusedVehicleId === vehicle.id &&
              !showAllVehicles &&
              !hasActiveFilters;

            return (
              <article
                key={vehicle.id}
                className={`rounded-2xl border bg-white p-5 shadow-sm dark:bg-gray-950 ${
                  isFocused
                    ? 'border-blue-400 ring-2 ring-blue-200 dark:border-blue-500 dark:ring-blue-900/50'
                    : 'border-gray-200 dark:border-gray-800'
                }`}
              >
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex flex-col gap-4 md:flex-row">
                    {vehicle.image ? (
                      <img
                        src={vehicle.image}
                        alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                        className="h-36 w-full rounded-2xl object-cover md:w-56"
                      />
                    ) : (
                      <div className="flex h-36 w-full items-center justify-center rounded-2xl border border-dashed border-gray-300 text-sm text-gray-500 md:w-56 dark:border-gray-700 dark:text-gray-400">
                        No image
                      </div>
                    )}

                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-xl font-semibold">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </h3>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                            vehicle.isActive
                              ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300'
                              : 'border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
                          }`}
                        >
                          {vehicle.isActive ? 'Active' : 'Inactive'}
                        </span>
                        {isFocused ? (
                          <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                            Selected from admin link
                          </span>
                        ) : null}
                      </div>

                      <div className="grid gap-2 text-sm text-gray-700 dark:text-gray-300 md:grid-cols-2">
                        <p>
                          <span className="font-semibold text-black dark:text-white">
                            Vehicle ID:
                          </span>{' '}
                          #{vehicle.id}
                        </p>
                        <p>
                          <span className="font-semibold text-black dark:text-white">
                            Group:
                          </span>{' '}
                          {vehicle.groupId || '—'}
                        </p>
                        <p>
                          <span className="font-semibold text-black dark:text-white">
                            Slug:
                          </span>{' '}
                          {vehicle.slug}
                        </p>
                        <p>
                          <span className="font-semibold text-black dark:text-white">
                            Category:
                          </span>{' '}
                          {vehicle.category}
                        </p>
                        <p>
                          <span className="font-semibold text-black dark:text-white">
                            Color:
                          </span>{' '}
                          {vehicle.color}
                        </p>
                        <p>
                          <span className="font-semibold text-black dark:text-white">
                            Seats:
                          </span>{' '}
                          {vehicle.seats}
                        </p>
                        <p>
                          <span className="font-semibold text-black dark:text-white">
                            Transmission:
                          </span>{' '}
                          {vehicle.transmission}
                        </p>
                        <p>
                          <span className="font-semibold text-black dark:text-white">
                            Price/day:
                          </span>{' '}
                          {formatMoney(vehicle.pricePerDay)}
                        </p>
                        <p>
                          <span className="font-semibold text-black dark:text-white">
                            VIN:
                          </span>{' '}
                          {vehicle.vin || '—'}
                        </p>
                        <p>
                          <span className="font-semibold text-black dark:text-white">
                            Plate:
                          </span>{' '}
                          {vehicle.licensePlate || '—'}
                        </p>
                      </div>

                      <p className="max-w-3xl text-sm text-gray-600 dark:text-gray-300">
                        {vehicle.description}
                      </p>

                      {vehicle.internalNotes ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
                          <p className="font-semibold text-amber-800 dark:text-amber-200">
                            Internal notes
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-amber-700 dark:text-amber-300">
                            {vehicle.internalNotes}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex w-full flex-col gap-2 xl:w-56">
                    <button
                      type="button"
                      onClick={() => fillForm(vehicle)}
                      className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
                    >
                      Edit Vehicle
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        void toggleVehicleActive(vehicle);
                      }}
                      className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
                    >
                      {vehicle.isActive ? 'Disable Vehicle' : 'Enable Vehicle'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        void handleDelete(vehicle);
                      }}
                      disabled={deletingId === vehicle.id}
                      className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30"
                    >
                      {deletingId === vehicle.id ? 'Deleting...' : 'Delete Vehicle'}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}