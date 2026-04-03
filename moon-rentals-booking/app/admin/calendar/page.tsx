'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

type Booking = {
  id: number;
  vehicleId: number;
  pickupAt: string;
  returnAt: string;
  fullName: string;
  email: string;
  phone: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
};

type Vehicle = {
  id: number;
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

type CalendarEventType = 'booking' | 'block';
type CalendarFilter = 'all' | 'bookings' | 'blocks';
type BlockScope = 'single' | 'selected' | 'all';

type CalendarEvent = {
  id: string;
  type: CalendarEventType;
  sourceId: number | null;
  linkHref: string;
  vehicleIds: number[];
  title: string;
  subtitle: string;
  start: string;
  end: string;
  status?: Booking['status'];
};

type TimeOption = {
  value: string;
  label: string;
};

function generateTimeOptions(): TimeOption[] {
  const options: TimeOption[] = [];

  for (let hour = 0; hour < 24; hour++) {
    for (const minute of [0, 30]) {
      const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
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

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfCalendarGrid(date: Date) {
  const first = startOfMonth(date);
  const dayOfWeek = first.getDay();
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - dayOfWeek);
  return startOfDay(gridStart);
}

function endOfCalendarGrid(date: Date) {
  const last = endOfMonth(date);
  const dayOfWeek = last.getDay();
  const remaining = 6 - dayOfWeek;
  const gridEnd = new Date(last);
  gridEnd.setDate(last.getDate() + remaining);
  return endOfDay(gridEnd);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

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

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString([], {
    year: 'numeric',
    month: 'long',
  });
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getVehicleLabel(vehicleId: number, vehicles: Vehicle[]) {
  const vehicle = vehicles.find((item) => item.id === vehicleId);

  if (!vehicle) return `Vehicle ${vehicleId}`;

  return `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
}

function eventMatchesDay(event: CalendarEvent, day: Date) {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = endOfDay(day).getTime();

  const eventStart = new Date(event.start).getTime();
  const eventEnd = new Date(event.end).getTime();

  return eventStart <= dayEnd && eventEnd >= dayStart;
}

function getEventPillClasses(event: CalendarEvent) {
  if (event.type === 'block') {
    return 'border-gray-300 bg-gray-100 text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';
  }

  if (event.status === 'confirmed') {
    return 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300';
  }

  if (event.status === 'cancelled') {
    return 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300';
  }

  return 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300';
}

export default function AdminCalendarPage() {
  const today = useMemo(() => startOfDay(new Date()), []);
  const timeOptions = useMemo(() => generateTimeOptions(), []);

  const [viewDate, setViewDate] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blockGroups, setBlockGroups] = useState<BlockGroup[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [eventFilter, setEventFilter] = useState<CalendarFilter>('all');
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');

  const [creatingBlock, setCreatingBlock] = useState(false);
  const [blockScope, setBlockScope] = useState<BlockScope>('single');
  const [fullDayBlock, setFullDayBlock] = useState(true);
  const [blockVehicleId, setBlockVehicleId] = useState('');
  const [selectedBlockVehicleIds, setSelectedBlockVehicleIds] = useState<number[]>([]);
  const [blockGroupName, setBlockGroupName] = useState('');
  const [blockStartDate, setBlockStartDate] = useState(() => toDateInputValue(new Date()));
  const [blockStartTime, setBlockStartTime] = useState('10:00');
  const [blockEndDate, setBlockEndDate] = useState(() => toDateInputValue(new Date()));
  const [blockEndTime, setBlockEndTime] = useState('10:30');
  const [blockReason, setBlockReason] = useState('');

  const blockStart = useMemo(() => {
    if (!blockStartDate) return '';
    return fullDayBlock
      ? `${blockStartDate}T00:00`
      : combineDateAndTime(blockStartDate, blockStartTime);
  }, [blockStartDate, blockStartTime, fullDayBlock]);

  const blockEnd = useMemo(() => {
    if (!blockEndDate) return '';
    return fullDayBlock
      ? `${blockEndDate}T23:59`
      : combineDateAndTime(blockEndDate, blockEndTime);
  }, [blockEndDate, blockEndTime, fullDayBlock]);

  const invalidBlockRange = useMemo(() => {
    if (!blockStart || !blockEnd) return false;
    return new Date(blockStart) >= new Date(blockEnd);
  }, [blockStart, blockEnd]);

  async function loadVehicles() {
    const res = await fetch('/api/vehicles', { cache: 'no-store' });
    const rawText = await res.text();

    if (!res.ok) {
      throw new Error(`Failed to load vehicles: ${res.status}`);
    }

    const data = rawText ? JSON.parse(rawText) : {};
    setVehicles(Array.isArray(data.vehicles) ? data.vehicles : []);
  }

  async function loadBookings() {
    const res = await fetch('/api/bookings', { cache: 'no-store' });
    const rawText = await res.text();

    if (!res.ok) {
      throw new Error(`Failed to load bookings: ${res.status}`);
    }

    const data = rawText ? JSON.parse(rawText) : {};
    setBookings(Array.isArray(data.bookings) ? data.bookings : []);
  }

  async function loadBlocks() {
    const res = await fetch('/api/vehicle-blocks', { cache: 'no-store' });
    const rawText = await res.text();

    if (!res.ok) {
      throw new Error(`Failed to load blocks: ${res.status}`);
    }

    const data = rawText ? JSON.parse(rawText) : {};
    setBlockGroups(Array.isArray(data.blockGroups) ? data.blockGroups : []);
  }

  async function refreshData(showFullLoader = false) {
    try {
      if (showFullLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError('');
      await Promise.all([loadVehicles(), loadBookings(), loadBlocks()]);
    } catch (err) {
      console.error('Failed to load calendar data:', err);
      setError('Failed to load calendar data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void refreshData(true);
  }, []);

  useEffect(() => {
    const dateValue = toDateInputValue(selectedDate);
    setBlockStartDate(dateValue);
    setBlockEndDate(dateValue);
    setBlockStartTime('10:00');
    setBlockEndTime('10:30');
  }, [selectedDate]);

  useEffect(() => {
    if (blockScope !== 'single') {
      setBlockVehicleId('');
    }

    if (blockScope !== 'selected') {
      setSelectedBlockVehicleIds([]);
    }
  }, [blockScope]);

  function resetBlockForm() {
    const dateValue = toDateInputValue(selectedDate);

    setBlockScope('single');
    setFullDayBlock(true);
    setBlockVehicleId('');
    setSelectedBlockVehicleIds([]);
    setBlockGroupName('');
    setBlockStartDate(dateValue);
    setBlockStartTime('10:00');
    setBlockEndDate(dateValue);
    setBlockEndTime('10:30');
    setBlockReason('');
  }

  function toggleSelectedBlockVehicle(vehicleId: number) {
    setSelectedBlockVehicleIds((prev) =>
      prev.includes(vehicleId)
        ? prev.filter((id) => id !== vehicleId)
        : [...prev, vehicleId]
    );
  }

  function selectAllVehiclesForMultiBlock() {
    setSelectedBlockVehicleIds(
      vehicleOptions
        .filter((vehicle) => vehicle.isActive)
        .map((vehicle) => vehicle.id)
    );
  }

  function clearSelectedVehiclesForMultiBlock() {
    setSelectedBlockVehicleIds([]);
  }

  async function handleCreateBlock(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreatingBlock(true);
    setError('');
    setMessage('');

    try {
      if (!blockStart || !blockEnd) {
        setError('Block start and block end are required.');
        return;
      }

      if (new Date(blockStart) >= new Date(blockEnd)) {
        setError('Block end must be later than block start.');
        return;
      }

      let vehicleIds: number[] = [];

      if (blockScope === 'all') {
        vehicleIds = vehicles
          .filter((vehicle) => vehicle.isActive)
          .map((vehicle) => vehicle.id);

        if (vehicleIds.length === 0) {
          setError('No active vehicles are available to block.');
          return;
        }
      } else if (blockScope === 'single') {
        if (!blockVehicleId) {
          setError('Please select a vehicle.');
          return;
        }

        vehicleIds = [Number(blockVehicleId)];
      } else {
        if (selectedBlockVehicleIds.length === 0) {
          setError('Select at least one vehicle.');
          return;
        }

        vehicleIds = selectedBlockVehicleIds;
      }

      const res = await fetch('/api/vehicle-blocks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vehicleIds,
          start: blockStart,
          end: blockEnd,
          reason: blockReason,
          groupName: blockGroupName,
        }),
      });

      const rawText = await res.text();
      const data = rawText ? JSON.parse(rawText) : {};

      if (!res.ok) {
        setError(data.error || 'Failed to create block.');
        return;
      }

      resetBlockForm();

      if (blockScope === 'all') {
        setMessage(
          `Created ${fullDayBlock ? 'full-day ' : ''}block group across ${vehicleIds.length} active vehicles.`
        );
      } else {
        setMessage(
          `Block group created for ${vehicleIds.length} vehicle${vehicleIds.length === 1 ? '' : 's'}${fullDayBlock ? ' (full day)' : ''}.`
        );
      }

      await loadBlocks();
    } catch (err) {
      console.error('Failed to create block from calendar:', err);
      setError(err instanceof Error ? err.message : 'Failed to create block.');
    } finally {
      setCreatingBlock(false);
    }
  }

  const allEvents = useMemo<CalendarEvent[]>(() => {
    const bookingEvents: CalendarEvent[] = bookings.map((booking) => ({
      id: `booking-${booking.id}`,
      sourceId: booking.id,
      type: 'booking',
      vehicleIds: [booking.vehicleId],
      title: getVehicleLabel(booking.vehicleId, vehicles),
      subtitle: `${booking.fullName} • ${booking.status}`,
      start: booking.pickupAt,
      end: booking.returnAt,
      status: booking.status,
      linkHref: `/admin/bookings?bookingId=${booking.id}`,
    }));

    const groupedBlockEvents: CalendarEvent[] = blockGroups.map((group) => {
      const vehicleIds = group.vehicles.map((vehicle) => vehicle.vehicleId);
      const vehicleCount = vehicleIds.length;

      let title = group.name;
      if (!title.trim()) {
        title =
          vehicleCount === 1
            ? group.vehicles[0]?.label || 'Vehicle block'
            : `${vehicleCount} vehicle block`;
      }

      return {
        id: group.groupId ? `block-group-${group.groupId}` : group.key,
        sourceId: group.groupId,
        type: 'block',
        vehicleIds,
        title,
        subtitle:
          group.reason?.trim() ||
          (vehicleCount === 1
            ? group.vehicles[0]?.label || 'Manual block'
            : `${vehicleCount} vehicles blocked`),
        start: group.start,
        end: group.end,
        linkHref: group.groupId
          ? `/admin/blocks?blockGroupId=${group.groupId}`
          : '/admin/blocks',
      };
    });

    return [...bookingEvents, ...groupedBlockEvents].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );
  }, [bookings, blockGroups, vehicles]);

  const filteredEvents = useMemo(() => {
    return allEvents.filter((event) => {
      if (eventFilter === 'bookings' && event.type !== 'booking') {
        return false;
      }

      if (eventFilter === 'blocks' && event.type !== 'block') {
        return false;
      }

      if (vehicleFilter !== 'all' && !event.vehicleIds.includes(Number(vehicleFilter))) {
        return false;
      }

      return true;
    });
  }, [allEvents, eventFilter, vehicleFilter]);

  const calendarDays = useMemo(() => {
    const start = startOfCalendarGrid(viewDate);
    const end = endOfCalendarGrid(viewDate);

    const days: Date[] = [];
    let cursor = new Date(start);

    while (cursor <= end) {
      days.push(new Date(cursor));
      cursor = addDays(cursor, 1);
    }

    return days;
  }, [viewDate]);

  const selectedDayEvents = useMemo(() => {
    return filteredEvents.filter((event) => eventMatchesDay(event, selectedDate));
  }, [filteredEvents, selectedDate]);

  const upcomingEvents = useMemo(() => {
    const now = Date.now();

    return filteredEvents
      .filter((event) => new Date(event.end).getTime() >= now)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 10);
  }, [filteredEvents]);

  const activeMonthStats = useMemo(() => {
    const monthStart = startOfMonth(viewDate).getTime();
    const monthEnd = endOfMonth(viewDate).getTime();

    const monthEvents = filteredEvents.filter((event) => {
      const start = new Date(event.start).getTime();
      const end = new Date(event.end).getTime();

      return start <= monthEnd && end >= monthStart;
    });

    return {
      total: monthEvents.length,
      bookings: monthEvents.filter((event) => event.type === 'booking').length,
      blocks: monthEvents.filter((event) => event.type === 'block').length,
    };
  }, [filteredEvents, viewDate]);

  const vehicleOptions = useMemo(() => {
    return vehicles
      .slice()
      .sort(
        (a, b) =>
          b.year - a.year ||
          a.make.localeCompare(b.make) ||
          a.model.localeCompare(b.model)
      );
  }, [vehicles]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Calendar</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            View bookings and grouped manual blocks on one calendar so you can
            create cleaner parent blocks and jump straight into block management.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setViewDate(
                (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
              )
            }
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
          >
            Previous
          </button>

          <button
            type="button"
            onClick={() => {
              const now = new Date();
              setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
              setSelectedDate(startOfDay(now));
            }}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
          >
            Today
          </button>

          <button
            type="button"
            onClick={() =>
              setViewDate(
                (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
              )
            }
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
          >
            Next
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Events this month
          </p>
          <p className="mt-2 text-3xl font-bold">{activeMonthStats.total}</p>
        </div>

        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 shadow-sm dark:border-yellow-900 dark:bg-yellow-950/30">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            Bookings this month
          </p>
          <p className="mt-2 text-3xl font-bold text-yellow-800 dark:text-yellow-200">
            {activeMonthStats.bookings}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-300 bg-gray-50 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Blocks this month
          </p>
          <p className="mt-2 text-3xl font-bold">{activeMonthStats.blocks}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-xl font-semibold">{formatMonthLabel(viewDate)}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Select a day to inspect bookings and grouped blocks.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium">Event type</label>
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value as CalendarFilter)}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                <option value="all">All events</option>
                <option value="bookings">Bookings only</option>
                <option value="blocks">Blocks only</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Vehicle</label>
              <select
                value={vehicleFilter}
                onChange={(e) => setVehicleFilter(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                <option value="all">All vehicles</option>
                {vehicleOptions.map((vehicle) => (
                  <option key={vehicle.id} value={String(vehicle.id)}>
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Jump to date</label>
              <input
                type="date"
                value={toDateInputValue(selectedDate)}
                onChange={(e) => {
                  const next = startOfDay(new Date(`${e.target.value}T12:00:00`));
                  setSelectedDate(next);
                  setViewDate(new Date(next.getFullYear(), next.getMonth(), 1));
                }}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
          <span className="rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 font-medium text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300">
            Pending booking
          </span>
          <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 font-medium text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300">
            Confirmed booking
          </span>
          <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 font-medium text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
            Cancelled booking
          </span>
          <span className="rounded-full border border-gray-300 bg-gray-100 px-3 py-1 font-medium text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
            Manual block group
          </span>
        </div>

        {message ? (
          <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-6 text-sm shadow-sm dark:border-gray-800 dark:bg-gray-950">
            Loading calendar...
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
            <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="px-2 py-3">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {calendarDays.map((day) => {
                const isCurrentMonth = day.getMonth() === viewDate.getMonth();
                const isToday = isSameDay(day, today);
                const isSelected = isSameDay(day, selectedDate);
                const dayEvents = filteredEvents.filter((event) =>
                  eventMatchesDay(event, day)
                );
                const visibleEvents = dayEvents.slice(0, 3);
                const hiddenCount = Math.max(dayEvents.length - visibleEvents.length, 0);

                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(startOfDay(day))}
                    className={[
                      'min-h-36 cursor-pointer border-b border-r border-gray-200 p-2 text-left align-top transition dark:border-gray-800',
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/20'
                        : 'bg-white hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-900',
                    ].join(' ')}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span
                        className={[
                          'inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold',
                          isToday
                            ? 'bg-black text-white dark:bg-white dark:text-black'
                            : '',
                          !isCurrentMonth
                            ? 'text-gray-400 dark:text-gray-600'
                            : 'text-gray-900 dark:text-white',
                        ].join(' ')}
                      >
                        {day.getDate()}
                      </span>

                      {dayEvents.length > 0 ? (
                        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                          {dayEvents.length}
                        </span>
                      ) : null}
                    </div>

                    <div className="space-y-1">
                      {visibleEvents.map((event) => (
                        <Link
                          key={`${event.id}-${day.toISOString()}`}
                          href={event.linkHref}
                          onClick={(e) => e.stopPropagation()}
                          className={`block truncate rounded-lg border px-2 py-1 text-[11px] font-medium hover:opacity-90 ${getEventPillClasses(
                            event
                          )}`}
                          title={`${event.type === 'block' ? 'Block' : event.status} • ${event.title}`}
                        >
                          {event.type === 'block'
                            ? `Block • ${event.title}`
                            : `${event.status} • ${event.title}`}
                        </Link>
                      ))}

                      {hiddenCount > 0 ? (
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">
                          +{hiddenCount} more
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950 xl:col-span-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Create block from calendar</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Selected day: {formatDayLabel(selectedDate)}
              </p>
            </div>

            <button
              type="button"
              onClick={resetBlockForm}
              className="rounded-xl border border-gray-300 px-3 py-2 text-xs font-medium transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
            >
              Reset
            </button>
          </div>

          <form onSubmit={handleCreateBlock} className="mt-4 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Block scope</label>
              <div className="grid gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setBlockScope('single')}
                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                    blockScope === 'single'
                      ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                      : 'border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900'
                  }`}
                >
                  One vehicle
                </button>
                <button
                  type="button"
                  onClick={() => setBlockScope('selected')}
                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                    blockScope === 'selected'
                      ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                      : 'border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900'
                  }`}
                >
                  Selected vehicles
                </button>
                <button
                  type="button"
                  onClick={() => setBlockScope('all')}
                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                    blockScope === 'all'
                      ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                      : 'border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900'
                  }`}
                >
                  All active vehicles
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Parent Block Name</label>
              <input
                type="text"
                value={blockGroupName}
                onChange={(e) => setBlockGroupName(e.target.value)}
                placeholder="Maintenance, Weekend Trip, Owner Hold, etc."
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </div>

            {blockScope === 'single' ? (
              <div>
                <label className="mb-2 block text-sm font-medium">Vehicle</label>
                <select
                  value={blockVehicleId}
                  onChange={(e) => setBlockVehicleId(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                  required
                >
                  <option value="">Select a vehicle</option>
                  {vehicleOptions.map((vehicle) => (
                    <option key={vehicle.id} value={String(vehicle.id)}>
                      {vehicle.year} {vehicle.make} {vehicle.model}
                      {!vehicle.isActive ? ' (Inactive)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {blockScope === 'selected' ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold">Choose vehicles</h4>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      This creates one parent block with multiple vehicles inside it.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={selectAllVehiclesForMultiBlock}
                      className="rounded-xl border border-gray-300 px-3 py-1.5 text-xs font-medium transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
                    >
                      Select All Active
                    </button>
                    <button
                      type="button"
                      onClick={clearSelectedVehiclesForMultiBlock}
                      className="rounded-xl border border-gray-300 px-3 py-1.5 text-xs font-medium transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid gap-2">
                  {vehicleOptions.map((vehicle) => {
                    const checked = selectedBlockVehicleIds.includes(vehicle.id);

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
                          onChange={() => toggleSelectedBlockVehicle(vehicle.id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <span>
                          {vehicle.year} {vehicle.make} {vehicle.model}
                          {!vehicle.isActive ? ' (Inactive)' : ''}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {blockScope === 'all' ? (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
                This will create one grouped block across all active vehicles.
              </div>
            ) : null}

            <div>
              <label className="inline-flex items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={fullDayBlock}
                  onChange={(e) => setFullDayBlock(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Full-day block
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">Start date</label>
                <input
                  type="date"
                  value={blockStartDate}
                  onChange={(e) => setBlockStartDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                  required
                />
              </div>

              {!fullDayBlock ? (
                <div>
                  <label className="mb-2 block text-sm font-medium">Start time</label>
                  <select
                    value={blockStartTime}
                    onChange={(e) => setBlockStartTime(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                    required
                  >
                    {timeOptions.map((option) => (
                      <option key={`start-${option.value}`} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-sm font-medium">End date</label>
                <input
                  type="date"
                  value={blockEndDate}
                  onChange={(e) => setBlockEndDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                  required
                />
              </div>

              {!fullDayBlock ? (
                <div>
                  <label className="mb-2 block text-sm font-medium">End time</label>
                  <select
                    value={blockEndTime}
                    onChange={(e) => setBlockEndTime(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                    required
                  >
                    {timeOptions.map((option) => (
                      <option key={`end-${option.value}`} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Reason</label>
              <input
                type="text"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Maintenance, owner hold, cleaning buffer, holiday, etc."
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </div>

            {invalidBlockRange ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                Block end must be later than block start.
              </div>
            ) : null}

            <button
              type="submit"
              disabled={creatingBlock || invalidBlockRange}
              className="w-full rounded-xl border border-black bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white dark:bg-white dark:text-black"
            >
              {creatingBlock
                ? 'Creating block...'
                : `Create ${fullDayBlock ? 'Full-Day ' : ''}Grouped Block`}
            </button>

            <Link
              href="/admin/blocks"
              className="block text-center text-sm text-gray-500 underline-offset-4 hover:underline dark:text-gray-400"
            >
              Open full Vehicle Blocks page
            </Link>
          </form>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950 xl:col-span-1">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">{formatDayLabel(selectedDate)}</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Events on the selected day.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refreshData(false)}
              disabled={refreshing}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-900"
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {selectedDayEvents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                No bookings or blocks on this day.
              </div>
            ) : (
              selectedDayEvents.map((event) => (
                <article
                  key={`${event.id}-detail`}
                  className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getEventPillClasses(
                        event
                      )}`}
                    >
                      {event.type === 'block'
                        ? 'Manual Block Group'
                        : `${event.status} Booking`}
                    </span>
                  </div>

                  <h4 className="mt-3 text-base font-semibold">{event.title}</h4>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    {event.subtitle}
                  </p>

                  <div className="mt-3 grid gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <p>
                      <span className="font-semibold text-black dark:text-white">
                        Start:
                      </span>{' '}
                      {formatDateTime(event.start)}
                    </p>
                    <p>
                      <span className="font-semibold text-black dark:text-white">
                        End:
                      </span>{' '}
                      {formatDateTime(event.end)}
                    </p>
                    <p>
                      <span className="font-semibold text-black dark:text-white">
                        Vehicles:
                      </span>{' '}
                      {event.vehicleIds.length}
                    </p>
                  </div>

                  <div className="mt-4">
                    <Link
                      href={event.linkHref}
                      className="inline-flex rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                    >
                      Open {event.type === 'booking' ? `Booking #${event.sourceId}` : 'Block Group'}
                    </Link>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950 xl:col-span-1">
          <h3 className="text-lg font-semibold">Upcoming events</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Next 10 bookings and grouped blocks based on the current filters.
          </p>

          <div className="mt-4 space-y-3">
            {upcomingEvents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                No upcoming events match the current filters.
              </div>
            ) : (
              upcomingEvents.map((event) => (
                <article
                  key={`${event.id}-upcoming`}
                  className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getEventPillClasses(
                        event
                      )}`}
                    >
                      {event.type === 'block'
                        ? 'Manual Block Group'
                        : `${event.status} Booking`}
                    </span>
                  </div>

                  <h4 className="mt-3 text-base font-semibold">{event.title}</h4>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    {event.subtitle}
                  </p>
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    {formatDateTime(event.start)} → {formatDateTime(event.end)}
                  </p>

                  <div className="mt-4">
                    <Link
                      href={event.linkHref}
                      className="inline-flex rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                    >
                      Open {event.type === 'booking' ? `Booking #${event.sourceId}` : 'Block Group'}
                    </Link>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}