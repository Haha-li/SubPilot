import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import {
  hasSharedCostCategory as hasSharedCostCategoryOnServer,
  normalizeBillingUnit,
  normalizeCurrency,
  normalizeNonNegativeAmount,
  resolveSharedCost,
} from '../src/utils/sharedCost';
import {
  getPersonalMonthlyCostInCurrency,
  hasSharedCostCategory,
  type CurrencyConverter,
  type SubscriptionCostInput,
} from '../../client/src/utils/subscriptionCost';

const ratesToCny: Record<string, number> = {
  CNY: 1,
  USD: 7,
  EUR: 8,
};

const convertWithFixedRates: CurrencyConverter = (amount, from, to) => {
  const fromRate = ratesToCny[from.toUpperCase()];
  const toRate = ratesToCny[to.toUpperCase()];
  return fromRate && toRate ? amount * fromRate / toRate : Number.NaN;
};

function createSubscription(overrides: Partial<SubscriptionCostInput> = {}): SubscriptionCostInput {
  return {
    category: '合租',
    price: 100,
    priceUnit: 'month',
    currency: 'CNY',
    nonSelfPaid: 10,
    nonSelfPaidCurrency: 'USD',
    nonSelfPaidUnit: 'month',
    ...overrides,
  };
}

function expectEqual<T>(expected: T, actual: T) {
  assert.deepStrictEqual(actual, expected);
}

test('仅精确的合租分类启用费用分摊', () => {
  expectEqual(true, hasSharedCostCategory('视频, 合租'));
  expectEqual(true, hasSharedCostCategoryOnServer('视频/合租'));
  expectEqual(false, hasSharedCostCategory('合租会员'));
  expectEqual(false, hasSharedCostCategoryOnServer('家庭合租'));
});

test('服务端规范非自己付费金额与独立币种', () => {
  expectEqual(0, normalizeNonNegativeAmount(-10));
  expectEqual(0, normalizeNonNegativeAmount('invalid'));
  expectEqual(12.5, normalizeNonNegativeAmount('12.5'));
  expectEqual('USD', normalizeCurrency(' usd '));
  expectEqual('CNY', normalizeCurrency('USDT'));
  expectEqual('year', normalizeBillingUnit(' YEAR '));
  expectEqual('month', normalizeBillingUnit('week'));
});

test('移除合租分类后服务端清零非自己付费', () => {
  expectEqual(
    { nonSelfPaid: 0, nonSelfPaidCurrency: 'EUR', nonSelfPaidUnit: 'year' },
    resolveSharedCost({
      category: '视频',
      nonSelfPaid: 20,
      nonSelfPaidCurrency: 'eur',
      nonSelfPaidUnit: 'year',
      fallbackCurrency: 'CNY',
      fallbackUnit: 'month',
    }),
  );
});

test('不同币种分别换算后计算个人月费', () => {
  const actual = getPersonalMonthlyCostInCurrency(
    createSubscription(),
    'CNY',
    convertWithFixedRates,
  );
  expectEqual(30, actual);
});

test('非自己付费使用独立年付周期', () => {
  const actual = getPersonalMonthlyCostInCurrency(
    createSubscription({
      nonSelfPaid: 120,
      nonSelfPaidUnit: 'year',
    }),
    'CNY',
    convertWithFixedRates,
  );
  expectEqual(30, actual);
});

test('非自己付费使用独立日付周期', () => {
  const actual = getPersonalMonthlyCostInCurrency(
    createSubscription({
      nonSelfPaid: 1,
      nonSelfPaidCurrency: 'CNY',
      nonSelfPaidUnit: 'day',
    }),
    'CNY',
    convertWithFixedRates,
  );
  expectEqual(70, actual);
});

test('非合租订阅忽略非自己付费金额', () => {
  const actual = getPersonalMonthlyCostInCurrency(
    createSubscription({ category: '视频' }),
    'CNY',
    convertWithFixedRates,
  );
  expectEqual(100, actual);
});

test('旧数据未提供分摊字段时保持原费用', () => {
  const actual = getPersonalMonthlyCostInCurrency(
    createSubscription({
      nonSelfPaid: undefined,
      nonSelfPaidCurrency: undefined,
      nonSelfPaidUnit: undefined,
    }),
    'CNY',
    convertWithFixedRates,
  );
  expectEqual(100, actual);
});

test('旧数据未提供独立周期时沿用订阅费用周期', () => {
  const actual = getPersonalMonthlyCostInCurrency(
    createSubscription({
      price: 120,
      priceUnit: 'year',
      currency: 'CNY',
      nonSelfPaid: 12,
      nonSelfPaidCurrency: 'CNY',
      nonSelfPaidUnit: undefined,
    }),
    'CNY',
    convertWithFixedRates,
  );
  expectEqual(9, actual);
});

test('非自己付费超过订阅总费用时个人费用不小于零', () => {
  const actual = getPersonalMonthlyCostInCurrency(
    createSubscription({ nonSelfPaid: 20 }),
    'CNY',
    convertWithFixedRates,
  );
  expectEqual(0, actual);
});

test('年付费用沿用相同周期后再换算', () => {
  const actual = getPersonalMonthlyCostInCurrency(
    createSubscription({
      price: 120,
      priceUnit: 'year',
      nonSelfPaid: 5,
      nonSelfPaidUnit: 'year',
    }),
    'CNY',
    convertWithFixedRates,
  );
  assert.ok(Math.abs(actual - (85 / 12)) < 0.000001);
});

test('D1 迁移新增独立周期并按原费用周期回填旧数据', () => {
  const database = new DatabaseSync(':memory:');
  database.exec(
    "CREATE TABLE subscriptions (id INTEGER PRIMARY KEY AUTOINCREMENT, price_unit TEXT DEFAULT 'month')",
  );
  database.exec(readFileSync(resolve(process.cwd(), 'migrations/0011_add_non_self_paid.sql'), 'utf8'));
  database.exec("INSERT INTO subscriptions (price_unit) VALUES ('year')");
  database.exec(readFileSync(resolve(process.cwd(), 'migrations/0012_add_non_self_paid_unit.sql'), 'utf8'));

  const row = database.prepare(
    'SELECT non_self_paid, non_self_paid_currency, non_self_paid_unit FROM subscriptions LIMIT 1',
  ).get() as {
    non_self_paid: number;
    non_self_paid_currency: string;
    non_self_paid_unit: string;
  };

  expectEqual(0, row.non_self_paid);
  expectEqual('CNY', row.non_self_paid_currency);
  expectEqual('year', row.non_self_paid_unit);
  database.close();
});
