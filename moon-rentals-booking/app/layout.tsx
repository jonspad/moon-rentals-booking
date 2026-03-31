import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Moon Rentals",
  description: "Vehicle booking system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-black dark:bg-black dark:text-white">

        {/* 🔥 GLOBAL NAVBAR */}
        <nav className="border-b border-gray-300 px-6 py-4 dark:border-gray-800">
          <div className="mx-auto flex max-w-6xl items-center justify-between">

            <Link href="/" className="text-xl font-bold">
              Moon Rentals
            </Link>

            <div className="flex gap-3">
              <Link
                href="/"
                className="rounded-xl border border-gray-300 px-4 py-2 dark:border-gray-700"
              >
                Home
              </Link>

              <Link
                href="/vehicles"
                className="rounded-xl border border-gray-300 px-4 py-2 dark:border-gray-700"
              >
                Fleet
              </Link>

              <Link
                href="/book"
                className="rounded-xl border border-gray-300 px-4 py-2 dark:border-gray-700"
              >
                Book
              </Link>

              <Link
                href="/admin/bookings"
                className="rounded-xl border border-gray-300 px-4 py-2 dark:border-gray-700"
              >
                Admin
              </Link>
            </div>
          </div>
        </nav>

        {/* PAGE CONTENT */}
        <main className="flex-1">{children}</main>

      </body>
    </html>
  );
}