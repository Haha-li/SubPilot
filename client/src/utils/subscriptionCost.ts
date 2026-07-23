import { convert } from './currency';

const CATEGORY_SEPARATOR = /[/,，\s]+/;
const MONTHS_PER_YEAR = 12;
const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;

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

export interface CostStatistics {
  sharedMonthlyIncome: number;
  personalMonthlyCost: number;
  personalYearlyEstimatedCost: number;
  personalDailyCost: number;
}

type PeriodAmountResolver = (amount: number, unit: string | null | undefined) => number;

interface PersonalCostCalculation {
  subscription: SubscriptionCostInput;
  targetCurrency: string;
  converter: CurrencyConverter;
  resolvePeriodAmount: PeriodAmountResolver;
}

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

function getYearlyEstimatedAmount(amount: number, unit: string | null | undefined): number {
  if (unit === 'month') return amount * MONTHS_PER_YEAR;
  if (unit === 'day') return amount * DAYS_PER_YEAR;
  return amount;
}

function calculatePersonalCostInCurrency(input: PersonalCostCalculation): number {
  const { subscription, targetCurrency, converter, resolvePeriodAmount } = input;
  const price = normalizeAmount(subscription.price);
  const priceUnit = subscription.priceUnit || 'month';
  const grossCost = price === 0 ? 0 : converter(
    resolvePeriodAmount(price, priceUnit),
    subscription.currency || 'CNY',
    targetCurrency,
  );

  const nonSelfPaid = hasSharedCostCategory(subscription.category)
    ? normalizeAmount(subscription.nonSelfPaid)
    : 0;
  const sharedContribution = nonSelfPaid === 0 ? 0 : converter(
    resolvePeriodAmount(nonSelfPaid, subscription.nonSelfPaidUnit || priceUnit),
    subscription.nonSelfPaidCurrency || subscription.currency || 'CNY',
    targetCurrency,
  );

  return Number.isFinite(grossCost) && Number.isFinite(sharedContribution)
    ? grossCost - sharedContribution
    : Number.NaN;
}

export function getPersonalMonthlyCostInCurrency(
  subscription: SubscriptionCostInput,
  targetCurrency: string,
  converter: CurrencyConverter = convert,
): number {
  return calculatePersonalCostInCurrency({
    subscription,
    targetCurrency,
    converter,
    resolvePeriodAmount: getMonthlyAmount,
  });
}

export function getPersonalYearlyEstimatedCostInCurrency(
  subscription: SubscriptionCostInput,
  targetCurrency: string,
  converter: CurrencyConverter = convert,
): number {
  return calculatePersonalCostInCurrency({
    subscription,
    targetCurrency,
    converter,
    resolvePeriodAmount: getYearlyEstimatedAmount,
  });
}

export function getSharedMonthlyIncomeInCurrency(
  subscription: SubscriptionCostInput,
  targetCurrency: string,
  converter: CurrencyConverter = convert,
): number {
  const personalMonthlyCost = getPersonalMonthlyCostInCurrency(
    subscription,
    targetCurrency,
    converter,
  );
  return Number.isFinite(personalMonthlyCost)
    ? Math.max(-personalMonthlyCost, 0)
    : Number.NaN;
}

export function getPersonalMonthlyCostOrZero(
  subscription: SubscriptionCostInput,
  targetCurrency: string,
  converter: CurrencyConverter = convert,
): number {
  const value = getPersonalMonthlyCostInCurrency(subscription, targetCurrency, converter);
  return Number.isFinite(value) ? value : 0;
}

export function getCostStatisticsInCurrency(
  subscriptions: SubscriptionCostInput[],
  targetCurrency: string,
  converter: CurrencyConverter = convert,
): CostStatistics {
  let sharedMonthlyIncome = 0;
  let personalMonthlyCost = 0;
  let personalYearlyEstimatedCost = 0;
  let monthlyCostUnavailable = false;
  let yearlyCostUnavailable = false;

  subscriptions.forEach((subscription) => {
    const monthlyCost = getPersonalMonthlyCostInCurrency(subscription, targetCurrency, converter);
    const yearlyCost = getPersonalYearlyEstimatedCostInCurrency(
      subscription,
      targetCurrency,
      converter,
    );
    if (Number.isFinite(monthlyCost)) {
      personalMonthlyCost += monthlyCost;
      sharedMonthlyIncome += Math.max(-monthlyCost, 0);
    } else {
      monthlyCostUnavailable = true;
    }
    if (Number.isFinite(yearlyCost)) {
      personalYearlyEstimatedCost += yearlyCost;
    } else {
      yearlyCostUnavailable = true;
    }
  });

  return {
    sharedMonthlyIncome: monthlyCostUnavailable ? Number.NaN : sharedMonthlyIncome,
    personalMonthlyCost: monthlyCostUnavailable ? Number.NaN : personalMonthlyCost,
    personalYearlyEstimatedCost: yearlyCostUnavailable
      ? Number.NaN
      : personalYearlyEstimatedCost,
    personalDailyCost: yearlyCostUnavailable
      ? Number.NaN
      : personalYearlyEstimatedCost / DAYS_PER_YEAR,
  };
}
