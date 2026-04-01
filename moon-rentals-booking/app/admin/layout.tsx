'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useState } from 'react';

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const isLoginPage = pathname === '/admin/login';

  async function handleLogout() {
    try {
      setLoggingOut(true);
      await fetch('/api/admin/logout', {
        method: 'POST',
      });
      router.push('/admin/login');
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setLoggingOut(false);
    }
  }

  function navClass(href: string) {
    const active = pathname === href;

    return [
      'rounded-xl border px-4 py-2 text-sm font-medium transition',
      active
        ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
        : 'border-gray-300 bg-white text-black dark:border-gray-700 dark:bg-gray-900 dark:text-white',
    ].join(' ');
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-black dark:bg-black dark:text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold">Admin</h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                Manage vehicles, bookings, and manual vehicle blocks.
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-900"
            >
              {loggingOut ? 'Logging out...' : 'Logout'}
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/admin" className={navClass('/admin')}>
              Dashboard
            </Link>
            <Link href="/admin/vehicles" className={navClass('/admin/vehicles')}>
              Vehicles
            </Link>
            <Link href="/admin/bookings" className={navClass('/admin/bookings')}>
              Bookings
            </Link>
            <Link href="/admin/blocks" className={navClass('/admin/blocks')}>
              Vehicle Blocks
            </Link>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}