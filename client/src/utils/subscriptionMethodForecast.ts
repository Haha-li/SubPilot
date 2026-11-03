import type { Subscription } from '../stores/subscription';
import type { SubscriptionMethod } from '../stores/subscriptionMethod';
import {
  addDateOnlyPeriod,
  advanceDateOnlyByPeriods,
  compareDateOnly,
  differenceInCalendarDays,
  normalizeDateOnly,
} from './dateOnly';
import {
  getEstimatedRenewalCostInCurrency,
  getRenewedExpiryDate,
  getSuggestedRenewalPeriods,
} from './renewalCenter';
import { getGrossMonthlyCostInCurrency } from './subscriptionCost';

export type BalanceStatus = 'unrecorded' | 'insufficient' | 'warning' | 'healthy' | 'idle';

export interface MethodRenewalEvent {
  subscriptionId: number;
  subscriptionName: string;
  date: string;
  amount: number;
}

export interface SubscriptionMethodForecast {
  monthlyFee: number;
  nextChargeDate: string | null;
  nextChargeAmount: number;
  exhaustionDate: string | null;
  monthsLeft: number | null;
  mismatchCount: number;
  status: BalanceStatus;
  events: MethodRenewalEvent[];
}

const MAX_EVENTS = 5000;
const FORECAST_YEARS = 20;

function period(subscription: Subscription) {
  const value = Number(subscription.periodValue);
  const unit = subscription.periodUnit;
  if (!Number.isSafeInteger(value) || value <= 0) return null;
  if (unit !== 'day' && unit !== 'month' && unit !== 'year') return null;
  return { value, unit } as const;
}

export function buildSubscriptionMethodForecast(
  method: SubscriptionMethod,
  subscriptions: Subscription[],
  today: string,
): SubscriptionMethodForecast {
  const currency = (method.balanceCurrency || 'CNY').toUpperCase();
  const normalizedToday = normalizeDateOnly(today);
  const active = subscriptions.filter((item) => item.isActive && item.subscriptionMethodId === method.id);
  const matching = active.filter((item) => (item.currency || 'CNY').toUpperCase() === currency);
  const mismatchCount = active.length - matching.length;
  let monthlyFee = 0;
  const events: MethodRenewalEvent[] = [];
  for (const subscription of matching) {
    const monthly = getGrossMonthlyCostInCurrency(subscription, currency);
    if (Number.isFinite(monthly) && monthly > 0) monthlyFee += monthly;
  }

  if (normalizedToday) {
    const limitDate = addDateOnlyPeriod(normalizedToday, FORECAST_YEARS, 'year');
    for (const subscription of matching) {
      const subscriptionPeriod = period(subscription);
      let projectedDate = normalizeDateOnly(subscription.expiryDate);
      if (!subscriptionPeriod || !projectedDate) continue;
      if (compareDateOnly(projectedDate, normalizedToday) < 0) {
        projectedDate = getRenewedExpiryDate(
          subscription,
          getSuggestedRenewalPeriods(subscription, normalizedToday),
        );
      }
      const amount = getEstimatedRenewalCostInCurrency(subscription, currency);
      if (!projectedDate || !Number.isFinite(amount) || amount <= 0) continue;
      while (compareDateOnly(projectedDate, limitDate) <= 0 && events.length < MAX_EVENTS) {
        events.push({
          subscriptionId: subscription.id,
          subscriptionName: subscription.name,
          date: projectedDate,
          amount,
        });
        projectedDate = advanceDateOnlyByPeriods(
          projectedDate,
          subscriptionPeriod.value,
          subscriptionPeriod.unit,
          1,
        );
      }
    }
  }

  events.sort((left, right) => left.date.localeCompare(right.date) || left.subscriptionName.localeCompare(right.subscriptionName, 'zh-CN'));
  const nextChargeDate = events[0]?.date || null;
  const nextChargeAmount = nextChargeDate
    ? events.filter((event) => event.date === nextChargeDate).reduce((sum, event) => sum + event.amount, 0)
    : 0;
  const balance = method.balance;
  if (balance === null || balance === undefined) {
    return { monthlyFee, nextChargeDate, nextChargeAmount, exhaustionDate: null, monthsLeft: null, mismatchCount, status: 'unrecorded', events };
  }
  if (monthlyFee <= 0 || events.length === 0) {
    return { monthlyFee, nextChargeDate, nextChargeAmount, exhaustionDate: null, monthsLeft: null, mismatchCount, status: 'idle', events };
  }

  let remaining = balance;
  let exhaustionDate: string | null = balance < 0 ? normalizedToday : null;
  if (!exhaustionDate) {
    for (const event of events) {
      remaining -= event.amount;
      if (remaining < 0) {
        exhaustionDate = event.date;
        break;
      }
    }
  }
  const monthsLeft = exhaustionDate && normalizedToday
    ? Math.max(0, differenceInCalendarDays(normalizedToday, exhaustionDate) / 30.44)
    : Math.max(0, balance / monthlyFee);
  const status: BalanceStatus = balance < 0 || nextChargeAmount > balance
    ? 'insufficient'
    : monthsLeft < 3
      ? 'warning'
      : 'healthy';
  return {
    monthlyFee,
    nextChargeDate,
    nextChargeAmount,
    exhaustionDate,
    monthsLeft,
    mismatchCount,
    status,
    events,
  };
}
