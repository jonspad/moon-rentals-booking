'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type CustomerNotesFormProps = {
  customerId: number;
  initialNotes: string;
};

export default function CustomerNotesForm({
  customerId,
  initialNotes,
}: CustomerNotesFormProps) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
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
          notes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.error || 'Failed to save notes.');
        return;
      }

      setMessage('Notes saved.');
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error('Failed to save customer notes:', err);
      setError('Failed to save notes.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        rows={6}
        placeholder="Add internal notes about this customer..."
        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-black dark:border-gray-700 dark:bg-gray-950 dark:focus:border-white"
      />

      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl border border-black bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white dark:bg-white dark:text-black"
        >
          {isPending ? 'Saving...' : 'Save Notes'}
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