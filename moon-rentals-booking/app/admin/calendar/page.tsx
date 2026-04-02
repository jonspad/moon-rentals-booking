'use client';

import { useEffect, useMemo, useState } from 'react';

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

type CalendarEventType = 'booking' | 'block';
type CalendarFilter = 'all' | 'bookings' | 'blocks';

type CalendarEvent = {
  id: string;
  sourceId: number;
  type: CalendarEventType;
  vehicleId: number;
  title: string;
  subtitle: string;
  start: string;
  end: string;
  status?: Booking['status'];
};

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
  const [viewDate, setViewDate] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blocks, setBlocks] = useState<VehicleBlock[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [eventFilter, setEventFilter] = useState<CalendarFilter>('all');
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');

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
    setBlocks(Array.isArray(data.blocks) ? data.blocks : []);
  }

  async function refreshData() {
    try {
      setLoading(true);
      setError('');
      await Promise.all([loadVehicles(), loadBookings(), loadBlocks()]);
    } catch (err) {
      console.error('Failed to load calendar data:', err);
      setError('Failed to load calendar data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshData();
  }, []);

  const allEvents = useMemo<CalendarEvent[]>(() => {
    const bookingEvents: CalendarEvent[] = bookings.map((booking) => ({
      id: `booking-${booking.id}`,
      sourceId: booking.id,
      type: 'booking',
      vehicleId: booking.vehicleId,
      title: getVehicleLabel(booking.vehicleId, vehicles),
      subtitle: `${booking.fullName} • ${booking.status}`,
      start: booking.pickupAt,
      end: booking.returnAt,
      status: booking.status,
    }));

    const blockEvents: CalendarEvent[] = blocks.map((block) => ({
      id: `block-${block.id}`,
      sourceId: block.id,
      type: 'block',
      vehicleId: block.vehicleId,
      title: getVehicleLabel(block.vehicleId, vehicles),
      subtitle: block.reason?.trim() ? block.reason : 'Manual block',
      start: block.start,
      end: block.end,
    }));

    return [...bookingEvents, ...blockEvents].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );
  }, [bookings, blocks, vehicles]);

  const filteredEvents = useMemo(() => {
    return allEvents.filter((event) => {
      if (eventFilter === 'bookings' && event.type !== 'booking') {
        return false;
      }

      if (eventFilter === 'blocks' && event.type !== 'block') {
        return false;
      }

      if (vehicleFilter !== 'all' && String(event.vehicleId) !== vehicleFilter) {
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
            View bookings and manual vehicle blocks on a monthly calendar to spot
            conflicts and gaps more quickly.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
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
              Select a day to inspect bookings and blocks.
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
            Manual block
          </span>
        </div>

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
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => setSelectedDate(startOfDay(day))}
                    className={[
                      'min-h-36 border-b border-r border-gray-200 p-2 text-left align-top transition dark:border-gray-800',
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
                        <div
                          key={`${event.id}-${day.toISOString()}`}
                          className={`truncate rounded-lg border px-2 py-1 text-[11px] font-medium ${getEventPillClasses(
                            event
                          )}`}
                        >
                          {event.type === 'block' ? 'Block' : event.status}{' '}
                          • {getVehicleLabel(event.vehicleId, vehicles)}
                        </div>
                      ))}

                      {hiddenCount > 0 ? (
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">
                          +{hiddenCount} more
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">{formatDayLabel(selectedDate)}</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Events on the selected day.
              </p>
            </div>
            <button
              onClick={refreshData}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
            >
              Refresh
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
                        ? 'Manual Block'
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
                        Vehicle:
                      </span>{' '}
                      {getVehicleLabel(event.vehicleId, vehicles)}
                    </p>
                  </div>

                  <div className="mt-4">
                    <a
                      href={
                        event.type === 'booking'
                          ? '/admin/bookings'
                          : '/admin/blocks'
                      }
                      className="inline-flex rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                    >
                      Open {event.type === 'booking' ? 'Bookings' : 'Vehicle Blocks'}
                    </a>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <h3 className="text-lg font-semibold">Upcoming events</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Next 10 bookings and blocks based on the current filters.
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
                        ? 'Manual Block'
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
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}