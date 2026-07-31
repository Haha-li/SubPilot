import type { Subscription } from '../stores/subscription';
import { normalizeDateOnly } from './dateOnly';

export interface CalendarMonthRange {
  start: string;
  end: string;
}

type SubscriptionPeriod = Pick<Subscription, 'startDate' | 'expiryDate'>;

export function isSubscriptionPresentInMonth(
  subscription: SubscriptionPeriod,
  range: CalendarMonthRange,
): boolean {
  const expiryDate = normalizeDateOnly(subscription.expiryDate);
  if (!expiryDate || expiryDate < range.start) return false;
  if (!subscription.startDate) return true;
  const startDate = normalizeDateOnly(subscription.startDate);
  return Boolean(startDate && startDate <= range.end);
}
