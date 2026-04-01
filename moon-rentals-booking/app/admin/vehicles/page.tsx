'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Vehicle = {
  id: number;
  groupId: string;
  slug: string;
  vin: string | null;
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
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState<VehicleFormState>(initialForm);

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

  const sortedVehicles = useMemo(() => {
    return vehicles
      .slice()
      .sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.year - a.year);
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
  }

  function fillForm(vehicle: Vehicle) {
    setEditingId(vehicle.id);
    setForm({
      groupId: vehicle.groupId,
      slug: vehicle.slug,
      vin: vehicle.vin ?? '',
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

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const payload = {
        groupId: form.groupId,
        slug: form.slug,
        vin: form.vin,
        year: form.year,
        make: form.make,
        model: form.model,
        category: form.category,
        color: form.color,
        seats: form.seats,
        transmission: form.transmission,
        pricePerDay: form.pricePerDay,
        image: form.image,
        description: form.description,
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
    <section className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Manage Vehicles</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Add, edit, disable, or remove inventory directly from the admin panel.
        </p>
      </div>

      {message ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-950">
        <div className="mb-6 flex items-center justify-between gap-4">
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

        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium">Group ID</span>
            <input
              value={form.groupId}
              onChange={(e) => updateForm('groupId', e.target.value)}
              className="w-full rounded-xl border px-3 py-2"
              placeholder="cybertruck"
              required
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium">Slug</span>
            <div className="space-y-2">
              <input
                value={form.slug}
                onChange={(e) => updateForm('slug', e.target.value)}
                className="w-full rounded-xl border px-3 py-2"
                placeholder="2024-tesla-cybertruck"
                required
              />
              <button
                type="button"
                onClick={() =>
                  updateForm('slug', buildSlug(form.year, form.make, form.model))
                }
                className="rounded-xl border px-3 py-2 text-xs font-medium"
              >
                Auto-generate slug
              </button>
            </div>
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium">VIN</span>
            <input
              value={form.vin}
              onChange={(e) => updateForm('vin', e.target.value)}
              className="w-full rounded-xl border px-3 py-2"
              placeholder="Optional"
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium">Year</span>
            <input
              type="number"
              value={form.year}
              onChange={(e) => updateForm('year', e.target.value)}
              className="w-full rounded-xl border px-3 py-2"
              placeholder="2024"
              required
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium">Make</span>
            <input
              value={form.make}
              onChange={(e) => updateForm('make', e.target.value)}
              className="w-full rounded-xl border px-3 py-2"
              placeholder="Tesla"
              required
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium">Model</span>
            <input
              value={form.model}
              onChange={(e) => updateForm('model', e.target.value)}
              className="w-full rounded-xl border px-3 py-2"
              placeholder="Cybertruck"
              required
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium">Category</span>
            <input
              value={form.category}
              onChange={(e) => updateForm('category', e.target.value)}
              className="w-full rounded-xl border px-3 py-2"
              placeholder="Truck"
              required
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium">Color</span>
            <input
              value={form.color}
              onChange={(e) => updateForm('color', e.target.value)}
              className="w-full rounded-xl border px-3 py-2"
              placeholder="Silver"
              required
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium">Seats</span>
            <input
              type="number"
              value={form.seats}
              onChange={(e) => updateForm('seats', e.target.value)}
              className="w-full rounded-xl border px-3 py-2"
              placeholder="5"
              required
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium">Transmission</span>
            <input
              value={form.transmission}
              onChange={(e) => updateForm('transmission', e.target.value)}
              className="w-full rounded-xl border px-3 py-2"
              placeholder="Automatic"
              required
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium">Price Per Day</span>
            <input
              type="number"
              value={form.pricePerDay}
              onChange={(e) => updateForm('pricePerDay', e.target.value)}
              className="w-full rounded-xl border px-3 py-2"
              placeholder="199"
              required
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium">Image Path</span>
            <input
              value={form.image}
              onChange={(e) => updateForm('image', e.target.value)}
              className="w-full rounded-xl border px-3 py-2"
              placeholder="/vehicles/example.jpg"
              required
            />
          </label>

          <label className="space-y-2 text-sm md:col-span-2">
            <span className="font-medium">Description</span>
            <textarea
              value={form.description}
              onChange={(e) => updateForm('description', e.target.value)}
              className="min-h-28 w-full rounded-xl border px-3 py-2"
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
              disabled={saving}
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
                    <p><span className="font-medium text-black dark:text-white">Group:</span> {vehicle.groupId}</p>
                    <p><span className="font-medium text-black dark:text-white">Slug:</span> {vehicle.slug}</p>
                    <p><span className="font-medium text-black dark:text-white">VIN:</span> {vehicle.vin || '—'}</p>
                    <p><span className="font-medium text-black dark:text-white">Category:</span> {vehicle.category}</p>
                    <p><span className="font-medium text-black dark:text-white">Color:</span> {vehicle.color}</p>
                    <p><span className="font-medium text-black dark:text-white">Seats:</span> {vehicle.seats}</p>
                    <p><span className="font-medium text-black dark:text-white">Transmission:</span> {vehicle.transmission}</p>
                    <p><span className="font-medium text-black dark:text-white">Price/Day:</span> ${vehicle.pricePerDay}</p>
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