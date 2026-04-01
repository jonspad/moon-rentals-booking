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
  const navClass =
    "rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-900";

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-neutral-100 text-black dark:bg-black dark:text-white">
        <header className="border-b border-gray-300 bg-white dark:border-gray-800 dark:bg-gray-950">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
            <Link href="/" className="text-2xl font-bold tracking-tight">
              Moon Rentals
            </Link>

            <nav className="flex items-center gap-3">
              <Link href="/" className={navClass}>
                Home
              </Link>
              <Link href="/vehicles" className={navClass}>
                Fleet
              </Link>
              <Link href="/book" className={navClass}>
                Book
              </Link>
              <Link href="/admin" className={navClass}>
                Admin
              </Link>
            </nav>
          </div>
        </header>

        <main>{children}</main>
      </body>
    </html>
  );
}