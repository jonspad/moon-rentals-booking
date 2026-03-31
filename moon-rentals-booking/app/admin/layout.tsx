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

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 text-black dark:text-white">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Manage bookings and manual vehicle blocks.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          {loggingOut ? 'Logging out...' : 'Logout'}
        </button>
      </div>

      <div className="mb-8 flex flex-wrap gap-3">
        <Link href="/admin" className={navClass('/admin')}>
          Dashboard
        </Link>
        <Link href="/admin/bookings" className={navClass('/admin/bookings')}>
          Bookings
        </Link>
        <Link href="/admin/blocks" className={navClass('/admin/blocks')}>
          Vehicle Blocks
        </Link>
      </div>

      {children}
    </main>
  );
}