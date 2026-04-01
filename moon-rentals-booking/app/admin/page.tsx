import Link from 'next/link';

function AdminCard({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
        {description}
      </p>
      <div className="mt-5">
        <Link
          href={href}
          className="inline-flex rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-900"
        >
          {action}
        </Link>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <h2 className="text-2xl font-bold">Admin Dashboard</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Manage inventory, reservations, and manual availability controls from one place.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <AdminCard
          title="Vehicles"
          description="Add, edit, activate, deactivate, or remove vehicles in inventory."
          href="/admin/vehicles"
          action="Manage Vehicles"
        />

        <AdminCard
          title="Bookings"
          description="Review reservations and update booking status."
          href="/admin/bookings"
          action="Open Bookings"
        />

        <AdminCard
          title="Vehicle Blocks"
          description="Add or remove manual blockouts that prevent bookings."
          href="/admin/blocks"
          action="Manage Blocks"
        />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
        System status: admin auth is enabled, vehicles are stored in Prisma, and
        customer availability checks will stay in sync with inventory once the API
        routes above are updated.
      </div>
    </div>
  );
}