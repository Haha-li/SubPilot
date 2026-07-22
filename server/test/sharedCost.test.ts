import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import {
  hasSharedCostCategory as hasSharedCostCategoryOnServer,
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
});

test('移除合租分类后服务端清零非自己付费', () => {
  expectEqual(
    { nonSelfPaid: 0, nonSelfPaidCurrency: 'EUR' },
    resolveSharedCost('视频', 20, 'eur', 'CNY'),
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
    createSubscription({ nonSelfPaid: undefined, nonSelfPaidCurrency: undefined }),
    'CNY',
    convertWithFixedRates,
  );
  expectEqual(100, actual);
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
    }),
    'CNY',
    convertWithFixedRates,
  );
  assert.ok(Math.abs(actual - (85 / 12)) < 0.000001);
});

test('D1 迁移新增分摊金额与独立币种并提供旧数据默认值', () => {
  const database = new DatabaseSync(':memory:');
  database.exec('CREATE TABLE subscriptions (id INTEGER PRIMARY KEY AUTOINCREMENT)');
  database.exec(readFileSync(resolve(process.cwd(), 'migrations/0011_add_non_self_paid.sql'), 'utf8'));
  database.exec('INSERT INTO subscriptions DEFAULT VALUES');

  const row = database.prepare(
    'SELECT non_self_paid, non_self_paid_currency FROM subscriptions LIMIT 1',
  ).get() as { non_self_paid: number; non_self_paid_currency: string };

  expectEqual(0, row.non_self_paid);
  expectEqual('CNY', row.non_self_paid_currency);
  database.close();
});
