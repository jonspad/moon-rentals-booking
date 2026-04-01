'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

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
  isActive: boolean;
};

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
  isActive: true,
};

function buildSlug(year: string, make: string, model: string) {
  return `${year}-${make}-${model}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function AdminVehiclesPage() {
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
    refreshVehicles();
  }, []);

  const existingGroupIds = useMemo(() => {
    const ids = vehicles
      .map((vehicle) => vehicle.groupId?.trim())
      .filter((id): id is string => Boolean(id));

    return Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b));
  }, [vehicles]);

  const sortedVehicles = useMemo(() => {
    return vehicles
      .slice()
      .sort(
        (a, b) =>
          Number(b.isActive) - Number(a.isActive) ||
          b.year - a.year ||
          a.make.localeCompare(b.make) ||
          a.model.localeCompare(b.model)
      );
  }, [vehicles]);

  function updateForm<K extends keyof VehicleFormState>(
    key: K,
    value: VehicleFormState[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    setSlugEditedManually(false);
    setGroupMode('existing');
    setSelectedGroupId('');
    setNewGroupId('');
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

  async function handleSubmit(e: FormEvent) {
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
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <h2 className="text-2xl font-bold">Manage Vehicles</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Add, edit, disable, or remove inventory directly from the admin panel.
        </p>

        {message ? (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              {editingId === null ? 'Add Vehicle' : `Edit Vehicle #${editingId}`}
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Fill out the fields below and save your inventory changes.
            </p>
          </div>

          {editingId !== null ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border px-4 py-2 text-sm font-medium"
            >
              Cancel Edit
            </button>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <label className="block text-sm font-medium">Group ID</label>

            <select
              value={groupMode === 'new' ? '__new__' : selectedGroupId}
              onChange={(e) => {
                const value = e.target.value;

                if (value === '__new__') {
                  setGroupMode('new');
                  setSelectedGroupId('');
                } else {
                  setGroupMode('existing');
                  setSelectedGroupId(value);
                  setNewGroupId('');
                }

                updateForm('groupId', value === '__new__' ? '' : value);
              }}
              className="w-full rounded-xl border px-3 py-2"
              required={groupMode === 'existing'}
            >
              <option value="">Select a group</option>
              {existingGroupIds.map((groupId) => (
                <option key={groupId} value={groupId}>
                  {groupId}
                </option>
              ))}
              <option value="__new__">+ Create new group</option>
            </select>

            {groupMode === 'new' ? (
              <input
                type="text"
                value={newGroupId}
                onChange={(e) => {
                  setNewGroupId(e.target.value);
                  updateForm('groupId', e.target.value);
                }}
                className="w-full rounded-xl border px-3 py-2"
                placeholder="Enter new group ID"
                required
              />
            ) : null}
          </div>

          <label className="block text-sm font-medium">
            Slug
            <div className="mt-2 flex gap-2">
              <input
                value={form.slug}
                onChange={(e) => {
                  setSlugEditedManually(true);
                  updateForm('slug', e.target.value);
                }}
                className="w-full rounded-xl border px-3 py-2"
                placeholder="2024-tesla-cybertruck"
                required
              />
              <button
                type="button"
                onClick={() => {
                  setSlugEditedManually(true);
                  updateForm('slug', buildSlug(form.year, form.make, form.model));
                }}
                className="rounded-xl border px-3 py-2 text-xs font-medium"
              >
                Auto-generate slug
              </button>
            </div>
          </label>

          <label className="block text-sm font-medium">
            VIN
            <input
              value={form.vin}
              onChange={(e) => updateForm('vin', e.target.value)}
              className="mt-2 w-full rounded-xl border px-3 py-2"
              placeholder="Optional"
            />
          </label>

          <label className="block text-sm font-medium">
            License Plate
            <input
              value={form.licensePlate}
              onChange={(e) => updateForm('licensePlate', e.target.value)}
              className="mt-2 w-full rounded-xl border px-3 py-2"
              placeholder="Optional"
            />
          </label>

          <label className="block text-sm font-medium">
            Year
            <input
              value={form.year}
              onChange={(e) => updateForm('year', e.target.value)}
              className="mt-2 w-full rounded-xl border px-3 py-2"
              placeholder="2024"
              required
            />
          </label>

          <label className="block text-sm font-medium">
            Make
            <input
              value={form.make}
              onChange={(e) => updateForm('make', e.target.value)}
              className="mt-2 w-full rounded-xl border px-3 py-2"
              placeholder="Tesla"
              required
            />
          </label>

          <label className="block text-sm font-medium">
            Model
            <input
              value={form.model}
              onChange={(e) => updateForm('model', e.target.value)}
              className="mt-2 w-full rounded-xl border px-3 py-2"
              placeholder="Cybertruck"
              required
            />
          </label>

          <label className="block text-sm font-medium">
            Category
            <input
              value={form.category}
              onChange={(e) => updateForm('category', e.target.value)}
              className="mt-2 w-full rounded-xl border px-3 py-2"
              placeholder="Truck"
              required
            />
          </label>

          <label className="block text-sm font-medium">
            Color
            <input
              value={form.color}
              onChange={(e) => updateForm('color', e.target.value)}
              className="mt-2 w-full rounded-xl border px-3 py-2"
              placeholder="Silver"
              required
            />
          </label>

          <label className="block text-sm font-medium">
            Seats
            <input
              value={form.seats}
              onChange={(e) => updateForm('seats', e.target.value)}
              className="mt-2 w-full rounded-xl border px-3 py-2"
              placeholder="5"
              required
            />
          </label>

          <label className="block text-sm font-medium">
            Transmission
            <input
              value={form.transmission}
              onChange={(e) => updateForm('transmission', e.target.value)}
              className="mt-2 w-full rounded-xl border px-3 py-2"
              placeholder="Automatic"
              required
            />
          </label>

          <label className="block text-sm font-medium">
            Price Per Day
            <input
              value={form.pricePerDay}
              onChange={(e) => updateForm('pricePerDay', e.target.value)}
              className="mt-2 w-full rounded-xl border px-3 py-2"
              placeholder="199"
              required
            />
          </label>

          <div className="block text-sm font-medium md:col-span-2">
            <span>Vehicle Image</span>

            <div className="mt-2 flex flex-col gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  await handleImageUpload(file);
                  e.currentTarget.value = '';
                }}
                className="w-full rounded-xl border px-3 py-2"
              />

              <input
                value={form.image}
                onChange={(e) => updateForm('image', e.target.value)}
                className="w-full rounded-xl border px-3 py-2"
                placeholder="/uploads/vehicles/example.jpg"
                required
              />

              <p className="text-xs text-gray-500">
                Upload an image or paste an existing image path.
                {uploadingImage ? ' Uploading...' : ''}
              </p>

              {form.image ? (
                <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.image}
                    alt="Vehicle preview"
                    className="h-56 w-full object-cover"
                  />
                </div>
              ) : null}
            </div>
          </div>

          <label className="block text-sm font-medium md:col-span-2">
            Description
            <textarea
              value={form.description}
              onChange={(e) => updateForm('description', e.target.value)}
              className="mt-2 min-h-28 w-full rounded-xl border px-3 py-2"
              placeholder="Describe the vehicle..."
              required
            />
          </label>

          <label className="flex items-center gap-3 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => updateForm('isActive', e.target.checked)}
            />
            <span className="font-medium">Vehicle is active</span>
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={saving || uploadingImage}
              className="rounded-xl border px-5 py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {saving
                ? editingId === null
                  ? 'Creating...'
                  : 'Saving...'
                : editingId === null
                ? 'Add Vehicle'
                : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Inventory</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Review every vehicle currently stored in the database.
          </p>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
            Loading vehicles...
          </div>
        ) : sortedVehicles.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
            No vehicles found.
          </div>
        ) : (
          sortedVehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-950"
            >
              <div className="flex flex-col gap-5 lg:flex-row">
                <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={vehicle.image}
                    alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                    className="h-52 w-full object-cover"
                  />
                </div>

                <div className="flex-1 space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <h4 className="text-xl font-semibold">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </h4>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                        vehicle.isActive
                          ? 'border-green-200 bg-green-50 text-green-700'
                          : 'border-gray-300 bg-gray-100 text-gray-700'
                      }`}
                    >
                      {vehicle.isActive ? 'Active' : 'Inactive'}
                    </span>

                    <span className="text-sm text-gray-500">ID #{vehicle.id}</span>
                  </div>

                  <div className="grid gap-2 text-sm text-gray-600 dark:text-gray-300 md:grid-cols-2">
                    <p>
                      <span className="font-medium text-black dark:text-white">
                        Group:
                      </span>{' '}
                      {vehicle.groupId}
                    </p>
                    <p>
                      <span className="font-medium text-black dark:text-white">
                        Slug:
                      </span>{' '}
                      {vehicle.slug}
                    </p>
                    <p>
                      <span className="font-medium text-black dark:text-white">
                        VIN:
                      </span>{' '}
                      {vehicle.vin || '—'}
                    </p>
                    <p>
                      <span className="font-medium text-black dark:text-white">
                        License Plate:
                      </span>{' '}
                      {vehicle.licensePlate || '—'}
                    </p>
                    <p>
                      <span className="font-medium text-black dark:text-white">
                        Category:
                      </span>{' '}
                      {vehicle.category}
                    </p>
                    <p>
                      <span className="font-medium text-black dark:text-white">
                        Color:
                      </span>{' '}
                      {vehicle.color}
                    </p>
                    <p>
                      <span className="font-medium text-black dark:text-white">
                        Seats:
                      </span>{' '}
                      {vehicle.seats}
                    </p>
                    <p>
                      <span className="font-medium text-black dark:text-white">
                        Transmission:
                      </span>{' '}
                      {vehicle.transmission}
                    </p>
                    <p>
                      <span className="font-medium text-black dark:text-white">
                        Price/Day:
                      </span>{' '}
                      ${vehicle.pricePerDay}
                    </p>
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {vehicle.description}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => fillForm(vehicle)}
                      className="rounded-xl border px-4 py-2 text-sm font-medium"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleVehicleActive(vehicle)}
                      className="rounded-xl border px-4 py-2 text-sm font-medium"
                    >
                      {vehicle.isActive ? 'Disable' : 'Enable'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(vehicle)}
                      disabled={deletingId === vehicle.id}
                      className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
                    >
                      {deletingId === vehicle.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}