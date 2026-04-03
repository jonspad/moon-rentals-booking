import { redirect } from 'next/navigation';

type LegacyBookingConfirmationPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toSingleValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
}

export default async function LegacyBookingConfirmationPage({
  searchParams,
}: LegacyBookingConfirmationPageProps) {
  const resolved = await searchParams;
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(resolved)) {
    const normalized = toSingleValue(value);

    if (normalized) {
      params.set(key, normalized);
    }
  }

  const suffix = params.toString();
  redirect(`/booking/confirmation${suffix ? `?${suffix}` : ''}`);
}
