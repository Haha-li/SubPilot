import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSubscriptionMethodForecast } from '../../client/src/utils/subscriptionMethodForecast';

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: '月付订阅',
    customType: '',
    category: '',
    startDate: null,
    expiryDate: '2026-02-15',
    periodValue: 1,
    periodUnit: 'month',
    reminderValue: 7,
    reminderUnit: 'day',
    isActive: 1,
    autoRenew: 1,
    useLunar: 0,
    notes: '',
    iconUrl: '',
    iconBackgroundColor: '',
    price: 100,
    priceUnit: 'month',
    currency: 'CNY',
    nonSelfPaid: 0,
    nonSelfPaidCurrency: 'CNY',
    nonSelfPaidUnit: 'month',
    subscriptionMethodId: 1,
    isPinned: 0,
    trialValue: null,
    trialUnit: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as any;
}

const method = {
  id: 1,
  name: '余额账户',
  channel: '官网直订',
  paymentMethod: '平台余额',
  account: '',
  balance: 250,
  balanceCurrency: 'CNY',
  paymentReference: '',
  createdAt: '',
  updatedAt: '',
};

test('订阅方式预测按真实续费日期逐笔扣减', () => {
  const forecast = buildSubscriptionMethodForecast(method, [subscription()], '2026-01-20');
  assert.equal(forecast.nextChargeDate, '2026-02-15');
  assert.equal(forecast.nextChargeAmount, 100);
  assert.equal(forecast.exhaustionDate, '2026-04-15');
  assert.equal(forecast.status, 'warning');
  const stopped = buildSubscriptionMethodForecast(
    method,
    [subscription({ autoRenew: 0 })],
    '2026-01-20',
  );
  assert.equal(stopped.events.length, 0);
  assert.equal(stopped.monthlyFee, 0);
  assert.equal(stopped.status, 'idle');
});

test('余额不足和币种不一致会被识别', () => {
  const forecast = buildSubscriptionMethodForecast(
    { ...method, balance: 50 },
    [subscription(), subscription({ id: 2, currency: 'USD' })],
    '2026-01-01',
  );
  assert.equal(forecast.status, 'insufficient');
  assert.equal(forecast.mismatchCount, 1);
  assert.equal(forecast.monthlyFee, 100 + 100 * 7.25);
  assert.equal(forecast.nextChargeAmount, 100 + 100 * 7.25);
});
