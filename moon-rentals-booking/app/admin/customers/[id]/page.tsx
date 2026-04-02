import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import CustomerNotesForm from './CustomerNotesForm';

type CustomerDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const { id } = await params;
  const customerId = Number(id);

  if (!Number.isInteger(customerId) || customerId <= 0) {
    notFound();
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      bookings: {
        orderBy: { createdAt: 'desc' },
        include: {
          vehicle: {
            select: {
              year: true,
              make: true,
              model: true,
              color: true,
              pricePerDay: true,
            },
          },
        },
      },
    },
  });

  if (!customer) {
    notFound();
  }

  return (
    <section className="mt-8 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Link
            href="/admin/customers"
            className="text-sm text-gray-500 underline-offset-4 hover:underline"
          >
            ← Back to customers
          </Link>
          <h2 className="mt-2 text-2xl font-semibold">{customer.fullName}</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Customer profile and booking history.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div>
            <span className="font-medium">Bookings:</span> {customer.bookings.length}
          </div>
          <div className="mt-1 text-gray-500">
            Created {new Date(customer.createdAt).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <h3 className="text-lg font-semibold">Contact Details</h3>
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <div className="text-gray-500">Full Name</div>
              <div className="font-medium">{customer.fullName}</div>
            </div>

            <div>
              <div className="text-gray-500">Email</div>
              <div className="font-medium">{customer.email}</div>
            </div>

            <div>
              <div className="text-gray-500">Phone</div>
              <div className="font-medium">{customer.phone}</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950 lg:col-span-2">
          <h3 className="text-lg font-semibold">Internal Notes</h3>
          <CustomerNotesForm
            customerId={customer.id}
            initialNotes={customer.notes ?? ''}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <h3 className="text-lg font-semibold">Booking History</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            All bookings associated with this customer.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-900/60">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Booking</th>
                <th className="px-4 py-3 text-left font-medium">Vehicle</th>
                <th className="px-4 py-3 text-left font-medium">Pickup</th>
                <th className="px-4 py-3 text-left font-medium">Return</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {customer.bookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                    No bookings found for this customer.
                  </td>
                </tr>
              ) : (
                customer.bookings.map((booking) => {
                  const vehicleName = booking.vehicle
                    ? `${booking.vehicle.year} ${booking.vehicle.make} ${booking.vehicle.model}${
                        booking.vehicle.color ? ` (${booking.vehicle.color})` : ''
                      }`
                    : `Vehicle ${booking.vehicleId}`;

                  return (
                    <tr key={booking.id}>
                      <td className="px-4 py-4 font-medium">#{booking.id}</td>
                      <td className="px-4 py-4">{vehicleName}</td>
                      <td className="px-4 py-4">
                        {new Date(booking.pickupAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-4">
                        {new Date(booking.returnAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-full border border-gray-300 px-2.5 py-1 text-xs font-medium capitalize dark:border-gray-700">
                          {booking.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {new Date(booking.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}