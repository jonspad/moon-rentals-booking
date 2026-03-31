import Link from 'next/link';

export default function AdminPage() {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div className="rounded-2xl border border-gray-300 bg-white p-5 dark:border-gray-700 dark:bg-gray-950">
        <h2 className="text-xl font-semibold">Bookings</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Review customer reservations and update status.
        </p>
        <Link
          href="/admin/bookings"
          className="mt-4 inline-block rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium dark:border-gray-700"
        >
          Open Bookings
        </Link>
      </div>

      <div className="rounded-2xl border border-gray-300 bg-white p-5 dark:border-gray-700 dark:bg-gray-950">
        <h2 className="text-xl font-semibold">Blocked Dates</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Add or remove manual blockouts for maintenance, holdbacks, or downtime.
        </p>
        <Link
          href="/admin/blockouts"
          className="mt-4 inline-block rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium dark:border-gray-700"
        >
          Manage Blockouts
        </Link>
      </div>

      <div className="rounded-2xl border border-gray-300 bg-white p-5 dark:border-gray-700 dark:bg-gray-950">
        <h2 className="text-xl font-semibold">System Status</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Admin auth is active and customer-facing admin links have been removed.
        </p>
      </div>
    </section>
  );
}