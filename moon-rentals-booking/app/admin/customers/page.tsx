import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export default async function AdminCustomersPage() {
  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { bookings: true },
      },
      bookings: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          createdAt: true,
          pickupAt: true,
          returnAt: true,
          status: true,
        },
      },
    },
  });

  return (
    <section className="mt-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Customers</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Track repeat renters and view booking history.
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 px-4 py-2 text-sm dark:border-gray-800">
          {customers.length} total
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
        <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-900/60">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Customer</th>
              <th className="px-4 py-3 text-left font-medium">Contact</th>
              <th className="px-4 py-3 text-left font-medium">Bookings</th>
              <th className="px-4 py-3 text-left font-medium">Last Booking</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {customers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                  No customers yet.
                </td>
              </tr>
            ) : (
              customers.map((customer) => {
                const latestBooking = customer.bookings[0];

                return (
                  <tr key={customer.id} className="bg-white dark:bg-gray-950">
                    <td className="px-4 py-4">
                      <Link
                        href={`/admin/customers/${customer.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {customer.fullName}
                      </Link>
                    </td>
                    <td className="px-4 py-4">
                      <div>{customer.email}</div>
                      <div className="text-gray-500">{customer.phone}</div>
                    </td>
                    <td className="px-4 py-4">{customer._count.bookings}</td>
                    <td className="px-4 py-4">
                      {latestBooking
                        ? new Date(latestBooking.createdAt).toLocaleString()
                        : '—'}
                    </td>
                    <td className="px-4 py-4">
                      {new Date(customer.createdAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}