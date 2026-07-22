const CATEGORY_SEPARATOR = /[/,，\s]+/;
const DEFAULT_CURRENCY = 'CNY';
const DEFAULT_BILLING_UNIT = 'month';
const BILLING_UNITS = new Set(['day', 'month', 'year']);

interface SharedCostInput {
  category: unknown;
  nonSelfPaid: unknown;
  nonSelfPaidCurrency: unknown;
  nonSelfPaidUnit: unknown;
  fallbackCurrency?: unknown;
  fallbackUnit?: unknown;
}

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

export function normalizeBillingUnit(value: unknown, fallback: unknown = DEFAULT_BILLING_UNIT): string {
  const fallbackUnit = typeof fallback === 'string' && BILLING_UNITS.has(fallback.trim().toLowerCase())
    ? fallback.trim().toLowerCase()
    : DEFAULT_BILLING_UNIT;
  return typeof value === 'string' && BILLING_UNITS.has(value.trim().toLowerCase())
    ? value.trim().toLowerCase()
    : fallbackUnit;
}

export function resolveSharedCost(input: SharedCostInput) {
  return {
    nonSelfPaid: hasSharedCostCategory(input.category)
      ? normalizeNonNegativeAmount(input.nonSelfPaid)
      : 0,
    nonSelfPaidCurrency: normalizeCurrency(input.nonSelfPaidCurrency, input.fallbackCurrency),
    nonSelfPaidUnit: normalizeBillingUnit(input.nonSelfPaidUnit, input.fallbackUnit),
  };
}
