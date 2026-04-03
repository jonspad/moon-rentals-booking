'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type CustomerProfileFormProps = {
  customerId: number;
  initialFullName: string;
  initialEmail: string;
  initialPhone: string;
};

export default function CustomerProfileForm({
  customerId,
  initialFullName,
  initialEmail,
  initialPhone,
}: CustomerProfileFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialFullName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/customers/${customerId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName,
          email,
          phone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.error || 'Failed to save customer details.');
        return;
      }

      setMessage('Customer details saved.');
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error('Failed to save customer details:', err);
      setError('Failed to save customer details.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Full Name
        </label>
        <input
          type="text"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-black dark:border-gray-700 dark:bg-gray-950 dark:focus:border-white"
        />
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-black dark:border-gray-700 dark:bg-gray-950 dark:focus:border-white"
        />
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Phone
        </label>
        <input
          type="text"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-black dark:border-gray-700 dark:bg-gray-950 dark:focus:border-white"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl border border-black bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white dark:bg-white dark:text-black"
        >
          {isPending ? 'Saving...' : 'Save Customer'}
        </button>

        {message ? (
          <p className="text-sm text-green-600 dark:text-green-400">{message}</p>
        ) : null}

        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}
      </div>
    </form>
  );
}