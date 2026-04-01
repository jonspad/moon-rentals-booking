import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-black dark:bg-black dark:text-white">
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="mt-16 grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Los Angeles Vehicle Rentals
            </p>

            <h2 className="mt-4 text-5xl font-bold leading-tight">
              Book the right vehicle for your trip.
            </h2>

            <p className="mt-6 max-w-xl text-lg text-gray-600 dark:text-gray-300">
              Moon Rentals gives customers a simple way to check real
              availability, choose from grouped vehicle options, and request a
              booking with a clean, modern flow.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/book"
                className="rounded-xl border border-gray-300 bg-black px-6 py-3 font-medium text-white dark:border-gray-700 dark:bg-white dark:text-black"
              >
                Start Booking
              </Link>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-gray-300 p-4 dark:border-gray-700">
                <p className="text-2xl font-bold">SUVs</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  Family and travel-ready options
                </p>
              </div>

              <div className="rounded-2xl border border-gray-300 p-4 dark:border-gray-700">
                <p className="text-2xl font-bold">Sedans</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  Comfortable daily rental choices
                </p>
              </div>

              <div className="rounded-2xl border border-gray-300 p-4 dark:border-gray-700">
                <p className="text-2xl font-bold">Trucks</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  Utility and premium pickup options
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-300 p-8 dark:border-gray-700">
            <h3 className="text-2xl font-semibold">Why book with Moon Rentals?</h3>

            <div className="mt-6 space-y-5">
              <div>
                <p className="font-medium">Real availability</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Vehicles are filtered by active bookings and blockout dates.
                </p>
              </div>

              <div>
                <p className="font-medium">Grouped inventory</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Browse by vehicle type, then choose from available colors and
                  units in the pool.
                </p>
              </div>

              <div>
                <p className="font-medium">Simple request flow</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Customers can move from search to booking request in a clean,
                  direct flow.
                </p>
              </div>
            </div>

            <Link
              href="/book"
              className="mt-8 inline-block rounded-xl border border-gray-300 px-5 py-3 font-medium dark:border-gray-700"
            >
              Check Availability
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}