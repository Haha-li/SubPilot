import { db, schema } from '../db';

const MONTHS_PER_YEAR = 12;
const DAYS_PER_MONTH = 30;

interface ChargeSubscription {
  price?: number | null;
  priceUnit?: string | null;
  currency?: string | null;
  periodValue?: number | null;
  periodUnit?: string | null;
  subscriptionMethodId?: number | null;
}

export interface BalanceUpdate {
  id: number;
  balance: number;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function billingUnit(value: string | null | undefined): 'day' | 'month' | 'year' {
  return value === 'day' || value === 'year' ? value : 'month';
}

function cycleCharge(
  amount: number,
  amountUnit: string | null | undefined,
  periodValue: number,
  periodUnit: 'day' | 'month' | 'year',
  periods: number,
): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const unit = billingUnit(amountUnit);
  const monthly = unit === 'year'
    ? amount / MONTHS_PER_YEAR
    : unit === 'day'
      ? amount * DAYS_PER_MONTH
      : amount;
  const cycleMonths = periodUnit === 'year'
    ? periodValue * MONTHS_PER_YEAR
    : periodUnit === 'month'
      ? periodValue
      : periodValue / DAYS_PER_MONTH;
  return monthly * cycleMonths * periods;
}

export function getRenewalCharge(subscription: ChargeSubscription, periods: number): number {
  const price = Number(subscription.price);
  if (!Number.isFinite(price) || price <= 0 || !Number.isSafeInteger(periods) || periods <= 0) return 0;
  const periodValue = Number.isSafeInteger(Number(subscription.periodValue)) && Number(subscription.periodValue) > 0
    ? Number(subscription.periodValue)
    : 1;
  const periodUnit = billingUnit(subscription.periodUnit);
  return roundMoney(cycleCharge(price, subscription.priceUnit, periodValue, periodUnit, periods));
}

export async function collectBalanceUpdates(
  items: { subscription: ChargeSubscription; periods: number }[],
): Promise<BalanceUpdate[]> {
  const needed = items.filter((item) => item.subscription.subscriptionMethodId);
  if (needed.length === 0) return [];
  const rows = await db.select().from(schema.subscriptionMethods);
  // ponytail: 币种不一致不折算，服务端没有汇率；同一次续费先汇总再写余额
  const methods = Array.isArray(rows) ? rows : [];
  const methodsById = new Map<number, any>(methods.map((item: any) => [item.id, item]));
  const charges = new Map<number, number>();
  for (const item of needed) {
    const method = methodsById.get(item.subscription.subscriptionMethodId as number);
    if (!method || typeof method.balance !== 'number' || !Number.isFinite(method.balance)) continue;
    const methodCurrency = String(method.balanceCurrency || 'CNY').toUpperCase();
    const subscriptionCurrency = String(item.subscription.currency || 'CNY').toUpperCase();
    if (methodCurrency !== subscriptionCurrency) continue;
    const charge = getRenewalCharge(item.subscription, item.periods);
    if (charge <= 0) continue;
    charges.set(method.id, roundMoney((charges.get(method.id) || 0) + charge));
  }
  return [...charges].map(([id, charge]) => ({
    id,
    balance: roundMoney(methodsById.get(id).balance - charge),
  }));
}
