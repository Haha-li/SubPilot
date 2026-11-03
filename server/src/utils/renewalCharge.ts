import { db, schema } from '../db';

const MONTHS_PER_YEAR = 12;
const DAYS_PER_MONTH = 30;

interface ChargeSubscription {
  id?: number | null;
  name?: string | null;
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

export interface BalanceLogValue {
  subscriptionMethodId: number;
  subscriptionId: number | null;
  type: 'manual_renewal' | 'automatic_renewal';
  amount: number;
  beforeBalance: number;
  afterBalance: number;
  note: string;
  createdAt: string;
}

export interface BalanceChanges {
  updates: BalanceUpdate[];
  logs: BalanceLogValue[];
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

export async function collectBalanceChanges(
  items: { subscription: ChargeSubscription; periods: number }[],
  type: BalanceLogValue['type'],
  createdAt: string,
): Promise<BalanceChanges> {
  const needed = items.filter((item) => item.subscription.subscriptionMethodId);
  if (needed.length === 0) return { updates: [], logs: [] };
  const rows = await db.select().from(schema.subscriptionMethods);
  // ponytail: 币种不一致不折算，服务端没有汇率；同一次续费按顺序累计余额
  const methods = Array.isArray(rows) ? rows : [];
  const methodsById = new Map<number, any>(methods.map((item: any) => [item.id, item]));
  const balances = new Map<number, number>();
  const logs: BalanceLogValue[] = [];
  for (const item of needed) {
    const methodId = item.subscription.subscriptionMethodId as number;
    const method = methodsById.get(methodId);
    if (!method || typeof method.balance !== 'number' || !Number.isFinite(method.balance)) continue;
    const methodCurrency = String(method.balanceCurrency || 'CNY').toUpperCase();
    const subscriptionCurrency = String(item.subscription.currency || 'CNY').toUpperCase();
    if (methodCurrency !== subscriptionCurrency) continue;
    const charge = getRenewalCharge(item.subscription, item.periods);
    if (charge <= 0) continue;
    const beforeBalance = balances.get(methodId) ?? method.balance;
    const afterBalance = roundMoney(beforeBalance - charge);
    balances.set(methodId, afterBalance);
    logs.push({
      subscriptionMethodId: methodId,
      subscriptionId: item.subscription.id || null,
      type,
      amount: -charge,
      beforeBalance,
      afterBalance,
      note: item.subscription.name ? `${item.subscription.name} 续费` : '订阅续费',
      createdAt,
    });
  }
  return {
    updates: [...balances].map(([id, balance]) => ({ id, balance })),
    logs,
  };
}
