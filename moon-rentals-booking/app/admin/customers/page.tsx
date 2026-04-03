import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type AdminCustomersPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
  }>;
};

function getStatusClasses(status: string) {
  switch (status) {
    case 'approved':
      return 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300';
    case 'rejected':
      return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300';
    case 'pending':
      return 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-300';
    case 'unverified':
      return 'border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300';
    default:
      return 'border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300';
  }
}

function getMetricCardClasses(
  tone: 'neutral' | 'approved' | 'pending' | 'rejected' | 'unverified'
) {
  switch (tone) {
    case 'approved':
      return 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30';
    case 'pending':
      return 'border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/30';
    case 'rejected':
      return 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30';
    case 'unverified':
      return 'border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900';
    default:
      return 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950';
  }
}

function formatDate(value: Date | string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleDateString([], {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
}

export default async function AdminCustomersPage({
  searchParams,
}: AdminCustomersPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const query = (resolvedSearchParams.q ?? '').trim();
  const status = (resolvedSearchParams.status ?? '').trim().toLowerCase();

  const customers = await prisma.customer.findMany({
    where: {
      AND: [
        query
          ? {
              OR: [
                { fullName: { contains: query } },
                { email: { contains: query } },
                { phone: { contains: query } },
              ],
            }
          : {},
        status && status !== 'all'
          ? {
              verificationStatus: status,
            }
          : {},
      ],
    },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { bookings: true },
      },
    },
  });

  const allCustomers = await prisma.customer.findMany({
    select: {
      verificationStatus: true,
    },
  });

  const total = allCustomers.length;
  const approved = allCustomers.filter(
    (customer) => customer.verificationStatus === 'approved'
  ).length;
  const pending = allCustomers.filter(
    (customer) => customer.verificationStatus === 'pending'
  ).length;
  const rejected = allCustomers.filter(
    (customer) => customer.verificationStatus === 'rejected'
  ).length;
  const unverified = allCustomers.filter(
    (customer) => customer.verificationStatus === 'unverified'
  ).length;

  return (
    <section className="mt-8 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Customers</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Manage customers, documents, and verification.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Total" value={total} tone="neutral" />
        <MetricCard label="Approved" value={approved} tone="approved" />
        <MetricCard label="Pending" value={pending} tone="pending" />
        <MetricCard label="Rejected" value={rejected} tone="rejected" />
        <MetricCard label="Unverified" value={unverified} tone="unverified" />
      </div>

      <form
        method="GET"
        className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950"
      >
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_140px]">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search by customer name, email, or phone..."
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-black dark:border-gray-700 dark:bg-gray-900 dark:focus:border-white"
          />

          <select
            name="status"
            defaultValue={status || 'all'}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-black dark:border-gray-700 dark:bg-gray-900 dark:focus:border-white"
          >
            <option value="all">All statuses</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
            <option value="unverified">Unverified</option>
          </select>

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 rounded-xl border border-black bg-black px-4 py-3 text-sm font-medium text-white transition hover:opacity-90 dark:border-white dark:bg-white dark:text-black"
            >
              Search
            </button>

            <Link
              href="/admin/customers"
              className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
            >
              Reset
            </Link>
          </div>
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-900/60">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Email
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Phone
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Bookings
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Created
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {customers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-gray-500 dark:text-gray-400"
                  >
                    No customers matched your search.
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="transition hover:bg-gray-50 dark:hover:bg-gray-900/40"
                  >
                    <td className="px-4 py-4 font-medium">
                      <Link
                        href={`/admin/customers/${customer.id}`}
                        className="text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
                      >
                        {customer.fullName}
                      </Link>
                    </td>
                    <td className="px-4 py-4">{customer.email}</td>
                    <td className="px-4 py-4">{customer.phone}</td>
                    <td className="px-4 py-4">{customer._count.bookings}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium capitalize ${getStatusClasses(
                          customer.verificationStatus
                        )}`}
                      >
                        {customer.verificationStatus}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {formatDate(customer.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'approved' | 'pending' | 'rejected' | 'unverified';
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${getMetricCardClasses(tone)}`}
    >
      <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}