import type { Subscription } from '../stores/subscription';
import {
  advanceDateOnlyByPeriods,
  compareDateOnly,
  differenceInCalendarDays,
  normalizeDateOnly,
  type DatePeriodUnit,
} from './dateOnly';
import { getPersonalMonthlyCostOrZero } from './subscriptionCost';

const MAX_PROJECTED_EVENTS = 10000;

export interface RenewalForecastEvent {
  subscriptionId: number;
  subscriptionName: string;
  date: string;
  amount: number;
}

export interface RenewalForecastMonth {
  key: string;
  label: string;
  amount: number;
  count: number;
}

export interface RenewalForecast {
  months: RenewalForecastMonth[];
  events: RenewalForecastEvent[];
}

function getPeriod(subscription: Subscription): { value: number; unit: DatePeriodUnit } | null {
  const value = Number(subscription.periodValue);
  const unit = subscription.periodUnit;
  if (!Number.isSafeInteger(value) || value <= 0) return null;
  if (unit !== 'day' && unit !== 'month' && unit !== 'year') return null;
  return { value, unit };
}

function monthKey(date: string): string {
  return date.slice(0, 7);
}

function buildMonthKeys(today: string, count: number): RenewalForecastMonth[] {
  const [year, month] = today.split('-').map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 + index, 1));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    return {
      key,
      label: `${date.getUTCMonth() + 1}月`,
      amount: 0,
      count: 0,
    };
  });
}

export function getSuggestedRenewalPeriods(subscription: Subscription, today: string): number {
  const expiryDate = normalizeDateOnly(subscription.expiryDate);
  const normalizedToday = normalizeDateOnly(today);
  const period = getPeriod(subscription);
  if (!expiryDate || !normalizedToday || !period) return 1;
  if (compareDateOnly(expiryDate, normalizedToday) >= 0) return 1;

  if (period.unit === 'day') {
    return Math.max(1, Math.ceil(differenceInCalendarDays(expiryDate, normalizedToday) / period.value));
  }

  let projectedDate = expiryDate;
  let periods = 0;
  while (compareDateOnly(projectedDate, normalizedToday) < 0 && periods < MAX_PROJECTED_EVENTS) {
    projectedDate = advanceDateOnlyByPeriods(projectedDate, period.value, period.unit, 1);
    periods += 1;
  }
  return Math.max(1, periods);
}

export function getRenewedExpiryDate(subscription: Subscription, periods: number): string | null {
  const expiryDate = normalizeDateOnly(subscription.expiryDate);
  const period = getPeriod(subscription);
  if (!expiryDate || !period || !Number.isSafeInteger(periods) || periods <= 0) return null;
  try {
    return advanceDateOnlyByPeriods(expiryDate, period.value, period.unit, periods);
  } catch {
    return null;
  }
}

export function getEstimatedRenewalCostCny(subscription: Subscription): number {
  const period = getPeriod(subscription);
  if (!period) return 0;
  const monthlyCost = getPersonalMonthlyCostOrZero(subscription, 'CNY');
  const cycleMonths = period.unit === 'year'
    ? period.value * 12
    : period.unit === 'month'
      ? period.value
      : period.value / 30;
  return Math.max(0, monthlyCost * cycleMonths);
}

export function buildRenewalForecast(
  subscriptions: Subscription[],
  today: string,
  monthCount = 6,
): RenewalForecast {
  const normalizedToday = normalizeDateOnly(today);
  const safeMonthCount = Number.isSafeInteger(monthCount) && monthCount > 0
    ? Math.min(monthCount, 24)
    : 6;
  const months = normalizedToday ? buildMonthKeys(normalizedToday, safeMonthCount) : [];
  if (!normalizedToday || months.length === 0) return { months, events: [] };

  const monthsByKey = new Map(months.map((month) => [month.key, month]));
  const lastMonthKey = months[months.length - 1].key;
  const events: RenewalForecastEvent[] = [];

  subscriptions.forEach((subscription) => {
    if (!subscription.isActive) return;
    const expiryDate = normalizeDateOnly(subscription.expiryDate);
    const period = getPeriod(subscription);
    if (!expiryDate || !period) return;

    let projectedDate = expiryDate;
    if (compareDateOnly(projectedDate, normalizedToday) < 0) {
      const catchUpPeriods = getSuggestedRenewalPeriods(subscription, normalizedToday);
      const caughtUpDate = getRenewedExpiryDate(subscription, catchUpPeriods);
      if (!caughtUpDate) return;
      projectedDate = caughtUpDate;
    }

    const amount = getEstimatedRenewalCostCny(subscription);
    let eventCount = 0;
    while (monthKey(projectedDate) <= lastMonthKey && eventCount < MAX_PROJECTED_EVENTS) {
      if (compareDateOnly(projectedDate, normalizedToday) >= 0) {
        const month = monthsByKey.get(monthKey(projectedDate));
        if (month) {
          month.amount += amount;
          month.count += 1;
          events.push({
            subscriptionId: subscription.id,
            subscriptionName: subscription.name,
            date: projectedDate,
            amount,
          });
        }
      }
      projectedDate = advanceDateOnlyByPeriods(projectedDate, period.value, period.unit, 1);
      eventCount += 1;
    }
  });

  events.sort((left, right) => left.date.localeCompare(right.date) || left.subscriptionName.localeCompare(right.subscriptionName, 'zh-CN'));
  return { months, events };
}
