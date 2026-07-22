const CATEGORY_SEPARATOR = /[/,，\s]+/;
const DEFAULT_CURRENCY = 'CNY';

export function hasSharedCostCategory(category: unknown): boolean {
  const categories = Array.isArray(category)
    ? category
    : typeof category === 'string'
      ? category.split(CATEGORY_SEPARATOR)
      : [];

  return categories.some((value) => typeof value === 'string' && value.trim() === '合租');
}

export function normalizeNonNegativeAmount(value: unknown): number {
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

export function normalizeCurrency(value: unknown, fallback: unknown = DEFAULT_CURRENCY): string {
  const fallbackCode = typeof fallback === 'string' && /^[a-z]{3}$/i.test(fallback.trim())
    ? fallback.trim().toUpperCase()
    : DEFAULT_CURRENCY;
  return typeof value === 'string' && /^[a-z]{3}$/i.test(value.trim())
    ? value.trim().toUpperCase()
    : fallbackCode;
}

export function resolveSharedCost(
  category: unknown,
  nonSelfPaid: unknown,
  nonSelfPaidCurrency: unknown,
  fallbackCurrency: unknown = DEFAULT_CURRENCY,
) {
  return {
    nonSelfPaid: hasSharedCostCategory(category) ? normalizeNonNegativeAmount(nonSelfPaid) : 0,
    nonSelfPaidCurrency: normalizeCurrency(nonSelfPaidCurrency, fallbackCurrency),
  };
}
