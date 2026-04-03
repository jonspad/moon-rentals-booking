import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type AdminCardProps = {
  title: string;
  value: string | number;
  description: string;
  href: string;
  action: string;
};

function formatDateTime(value: Date | string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function AdminCard({
  title,
  value,
  description,
  href,
  action,
}: AdminCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <div className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
        {title}
      </div>

      <div className="mb-2 text-3xl font-semibold text-gray-900 dark:text-white">
        {value}
      </div>

      <p className="mb-5 text-sm text-gray-600 dark:text-gray-300">
        {description}
      </p>

      <Link
        href={href}
        className="inline-flex rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-50 dark:border-gray-700 dark:text-white dark:hover:bg-gray-900"
      >
        {action}
      </Link>
    </div>
  );
}

export default async function AdminPage() {
  const now = new Date();

  const [vehicles, bookings, blocks] = await Promise.all([
    prisma.vehicle.findMany({
      orderBy: [{ make: 'asc' }, { model: 'asc' }],
    }),
    prisma.booking.findMany({
      orderBy: { createdAt: 'desc' },
    }),
    prisma.vehicleBlock.findMany({
      orderBy: { startAt: 'asc' },
    }),
  ]);

  const vehicleMap = new Map(
    vehicles.map((vehicle) => [
      vehicle.id,
      `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    ])
  );

  const activeVehicles = vehicles.filter((vehicle) => vehicle.isActive).length;
  const inactiveVehicles = vehicles.length - activeVehicles;

  const pendingBookings = bookings.filter(
    (booking) => booking.status === 'pending'
  ).length;

  const confirmedBookings = bookings.filter(
    (booking) => booking.status === 'confirmed'
  ).length;

  const cancelledBookings = bookings.filter(
    (booking) => booking.status === 'cancelled'
  ).length;

  const futureBlocks = blocks.filter((block) => new Date(block.endAt) >= now);
  const activeBlocks = futureBlocks.filter(
    (block) => new Date(block.startAt) <= now && new Date(block.endAt) >= now
  );

  const upcomingBlocks = futureBlocks.filter(
    (block) => new Date(block.startAt) > now
  );

  const recentBookings = bookings.slice(0, 6);
  const nextBlocks = futureBlocks.slice(0, 6);

  const avgDailyRate =
    vehicles.length > 0
      ? Math.round(
          vehicles.reduce((sum, vehicle) => sum + vehicle.pricePerDay, 0) /
            vehicles.length
        )
      : 0;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
              Admin Dashboard
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-gray-300">
              Manage vehicles, bookings, and manual availability controls from
              one place. This page now shows live operational data pulled
              directly from Prisma.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/bookings"
              className="inline-flex rounded-xl bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 dark:bg-white dark:text-black"
            >
              Open Bookings
            </Link>

            <Link
              href="/admin/blocks"
              className="inline-flex rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-50 dark:border-gray-700 dark:text-white dark:hover:bg-gray-900"
            >
              Manage Blocks
            </Link>

            <Link
              href="/admin/vehicles"
              className="inline-flex rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-50 dark:border-gray-700 dark:text-white dark:hover:bg-gray-900"
            >
              Manage Fleet
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminCard
          title="Active Vehicles"
          value={activeVehicles}
          description={`${inactiveVehicles} inactive vehicles currently hidden from booking.`}
          href="/admin/vehicles"
          action="Review fleet"
        />

        <AdminCard
          title="Pending Bookings"
          value={pendingBookings}
          description="New booking requests that still need review."
          href="/admin/bookings"
          action="Open bookings"
        />

        <AdminCard
          title="Confirmed Bookings"
          value={confirmedBookings}
          description={`${cancelledBookings} cancelled bookings currently stored in history.`}
          href="/admin/bookings"
          action="View reservations"
        />

        <AdminCard
          title="Current / Future Blocks"
          value={futureBlocks.length}
          description={`${activeBlocks.length} active now, ${upcomingBlocks.length} upcoming.`}
          href="/admin/blocks"
          action="Manage blockouts"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminCard
          title="Fleet Size"
          value={vehicles.length}
          description="Total vehicles in the database."
          href="/admin/vehicles"
          action="View all vehicles"
        />

        <AdminCard
          title="Average Daily Rate"
          value={formatMoney(avgDailyRate)}
          description="Average price per day across the current fleet."
          href="/admin/vehicles"
          action="Inspect pricing"
        />

        <AdminCard
          title="Bookings on File"
          value={bookings.length}
          description="All bookings currently stored in the system."
          href="/admin/bookings"
          action="See booking history"
        />

        <AdminCard
          title="Blocks on File"
          value={blocks.length}
          description="All manual vehicle block entries in the system."
          href="/admin/blocks"
          action="See all blocks"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Recent Bookings
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                The latest customer activity in the system.
              </p>
            </div>

            <Link
              href="/admin/bookings"
              className="text-sm font-medium text-gray-700 underline-offset-4 hover:underline dark:text-gray-200"
            >
              View all
            </Link>
          </div>

          {recentBookings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
              No bookings found yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    <th className="px-3 py-3 font-medium">Booking</th>
                    <th className="px-3 py-3 font-medium">Customer</th>
                    <th className="px-3 py-3 font-medium">Vehicle</th>
                    <th className="px-3 py-3 font-medium">Pickup</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBookings.map((booking) => {
                    const statusClasses =
                      booking.status === 'confirmed'
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : booking.status === 'cancelled'
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-yellow-200 bg-yellow-50 text-yellow-700';

                    return (
                      <tr
                        key={booking.id}
                        className="border-b border-gray-100 last:border-0 dark:border-gray-900"
                      >
                        <td className="px-3 py-4">
                          <Link
                            href="/admin/bookings"
                            className="block rounded-lg transition hover:bg-gray-50 hover:underline dark:hover:bg-gray-900/40"
                          >
                            <div className="font-medium text-gray-900 dark:text-white">
                              #{booking.id}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {formatDateTime(booking.createdAt)}
                            </div>
                          </Link>
                        </td>

                        <td className="px-3 py-4">
                          <Link
                            href={`/admin/customers?email=${encodeURIComponent(
                              booking.email
                            )}`}
                            className="block rounded-lg transition hover:bg-gray-50 hover:underline dark:hover:bg-gray-900/40"
                          >
                            <div className="font-medium text-gray-900 dark:text-white">
                              {booking.fullName}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {booking.email}
                            </div>
                          </Link>
                        </td>

                        <td className="px-3 py-4">
                          <Link
                            href="/admin/vehicles"
                            className="text-gray-700 transition hover:underline dark:text-gray-200"
                          >
                            {vehicleMap.get(booking.vehicleId) ??
                              `Vehicle ${booking.vehicleId}`}
                          </Link>
                        </td>

                        <td className="px-3 py-4 text-gray-700 dark:text-gray-200">
                          {formatDateTime(booking.pickupAt)}
                        </td>

                        <td className="px-3 py-4">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium capitalize ${statusClasses}`}
                          >
                            {booking.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Current & Upcoming Blocks
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  Vehicles currently unavailable or blocked soon.
                </p>
              </div>

              <Link
                href="/admin/blocks"
                className="text-sm font-medium text-gray-700 underline-offset-4 hover:underline dark:text-gray-200"
              >
                View all
              </Link>
            </div>

            {nextBlocks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
                No current or upcoming blocks.
              </div>
            ) : (
              <div className="space-y-4">
                {nextBlocks.map((block) => {
                  const isActive =
                    new Date(block.startAt) <= now &&
                    new Date(block.endAt) >= now;

                  return (
                    <div
                      key={block.id}
                      className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {vehicleMap.get(block.vehicleId) ??
                            `Vehicle ${block.vehicleId}`}
                        </div>

                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${
                            isActive
                              ? 'border-red-200 bg-red-50 text-red-700'
                              : 'border-blue-200 bg-blue-50 text-blue-700'
                          }`}
                        >
                          {isActive ? 'Active now' : 'Upcoming'}
                        </span>
                      </div>

                      <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                        <div>
                          <span className="font-medium text-gray-800 dark:text-gray-200">
                            Start:
                          </span>{' '}
                          {formatDateTime(block.startAt)}
                        </div>
                        <div>
                          <span className="font-medium text-gray-800 dark:text-gray-200">
                            End:
                          </span>{' '}
                          {formatDateTime(block.endAt)}
                        </div>
                        <div>
                          <span className="font-medium text-gray-800 dark:text-gray-200">
                            Reason:
                          </span>{' '}
                          {block.reason?.trim() ? block.reason : 'No reason provided'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Quick Actions
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Fast access to the areas you’ll use most often.
            </p>

            <div className="mt-5 grid gap-3">
              <Link
                href="/admin/bookings"
                className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-900 transition hover:bg-gray-50 dark:border-gray-700 dark:text-white dark:hover:bg-gray-900"
              >
                Review booking requests
              </Link>

              <Link
                href="/admin/blocks"
                className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-900 transition hover:bg-gray-50 dark:border-gray-700 dark:text-white dark:hover:bg-gray-900"
              >
                Add or remove vehicle blocks
              </Link>

              <Link
                href="/admin/vehicles"
                className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-900 transition hover:bg-gray-50 dark:border-gray-700 dark:text-white dark:hover:bg-gray-900"
              >
                Manage vehicle inventory
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}