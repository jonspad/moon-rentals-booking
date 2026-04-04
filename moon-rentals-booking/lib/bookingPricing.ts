export type PricingLineItem = {
  label: string;
  amount: number;
};

export function formatMoney(value?: number | null) {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function parsePricingLineItems(value?: string | null): PricingLineItem[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => ({
        label: typeof item?.label === 'string' ? item.label.trim() : '',
        amount: Number(item?.amount),
      }))
      .filter((item) => item.label && Number.isFinite(item.amount) && item.amount > 0)
      .map((item) => ({
        label: item.label,
        amount: Math.round(item.amount),
      }));
  } catch {
    return [];
  }
}

export function serializePricingLineItems(items?: PricingLineItem[] | null) {
  const normalized = normalizePricingLineItems(items);
  return normalized.length ? JSON.stringify(normalized) : null;
}

export function normalizePricingLineItems(items?: PricingLineItem[] | null) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => ({
      label: typeof item?.label === 'string' ? item.label.trim() : '',
      amount: Number(item?.amount),
    }))
    .filter((item) => item.label && Number.isFinite(item.amount) && item.amount > 0)
    .map((item) => ({
      label: item.label,
      amount: Math.round(item.amount),
    }));
}

export function getLineItemsTotal(items?: PricingLineItem[] | null) {
  return normalizePricingLineItems(items).reduce((sum, item) => sum + item.amount, 0);
}

export function getPricingBreakdownText(options: {
  discountItems?: PricingLineItem[] | null;
  feeItems?: PricingLineItem[] | null;
  pricingNote?: string | null;
}) {
  const sections: string[] = [];
  const discountItems = normalizePricingLineItems(options.discountItems);
  const feeItems = normalizePricingLineItems(options.feeItems);

  if (discountItems.length) {
    sections.push(
      ['Discount breakdown:', ...discountItems.map((item) => `- ${item.label}: -${formatMoney(item.amount)}`)].join('\n')
    );
  }

  if (feeItems.length) {
    sections.push(
      ['Fee breakdown:', ...feeItems.map((item) => `- ${item.label}: ${formatMoney(item.amount)}`)].join('\n')
    );
  }

  if (options.pricingNote?.trim()) {
    sections.push(`Pricing note: ${options.pricingNote.trim()}`);
  }

  return sections.join('\n\n');
}
