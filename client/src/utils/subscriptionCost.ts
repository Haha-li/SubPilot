import { convert } from './currency';

const CATEGORY_SEPARATOR = /[/,，\s]+/;
const MONTHS_PER_YEAR = 12;
const DAYS_PER_MONTH = 30;

export interface SubscriptionCostInput {
  category?: string | null;
  price?: number | null;
  priceUnit?: string | null;
  currency?: string | null;
  nonSelfPaid?: number | null;
  nonSelfPaidCurrency?: string | null;
  nonSelfPaidUnit?: string | null;
}

export type CurrencyConverter = (amount: number, from: string, to: string) => number;

export function getCategoryTokens(category: string | string[] | null | undefined): string[] {
  const values = Array.isArray(category) ? category : (category || '').split(CATEGORY_SEPARATOR);
  return values.map((value) => value.trim()).filter(Boolean);
}

export function hasSharedCostCategory(category: string | string[] | null | undefined): boolean {
  return getCategoryTokens(category).some((value) => value === '合租');
}

function normalizeAmount(value: unknown): number {
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function getMonthlyAmount(amount: number, unit: string | null | undefined): number {
  if (unit === 'year') return amount / MONTHS_PER_YEAR;
  if (unit === 'day') return amount * DAYS_PER_MONTH;
  return amount;
}

export function getPersonalMonthlyCostInCurrency(
  subscription: SubscriptionCostInput,
  targetCurrency: string,
  converter: CurrencyConverter = convert,
): number {
  const price = normalizeAmount(subscription.price);
  if (price === 0) return 0;

  const priceUnit = subscription.priceUnit || 'month';
  const grossCost = converter(
    getMonthlyAmount(price, priceUnit),
    subscription.currency || 'CNY',
    targetCurrency,
  );
  if (!Number.isFinite(grossCost)) return Number.NaN;

  const nonSelfPaid = hasSharedCostCategory(subscription.category)
    ? normalizeAmount(subscription.nonSelfPaid)
    : 0;
  if (nonSelfPaid === 0) return Math.max(grossCost, 0);

  const sharedCost = converter(
    getMonthlyAmount(nonSelfPaid, subscription.nonSelfPaidUnit || priceUnit),
    subscription.nonSelfPaidCurrency || subscription.currency || 'CNY',
    targetCurrency,
  );
  if (!Number.isFinite(sharedCost)) return Number.NaN;

  return Math.max(grossCost - sharedCost, 0);
}

export function getPersonalMonthlyCostOrZero(
  subscription: SubscriptionCostInput,
  targetCurrency: string,
  converter: CurrencyConverter = convert,
): number {
  const value = getPersonalMonthlyCostInCurrency(subscription, targetCurrency, converter);
  return Number.isFinite(value) ? value : 0;
}
