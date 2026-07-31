import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRenewalForecast,
  getEstimatedRenewalCostCny,
  getEstimatedRenewalCostInCurrency,
  getRenewedExpiryDate,
  getSuggestedRenewalPeriods,
} from '../../client/src/utils/renewalCenter';

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: '测试订阅',
    customType: '',
    category: '',
    startDate: null,
    expiryDate: '2026-01-31',
    periodValue: 1,
    periodUnit: 'month',
    reminderValue: 7,
    reminderUnit: 'day',
    isActive: 1,
    autoRenew: 0,
    useLunar: 0,
    notes: '',
    iconUrl: '',
    iconBackgroundColor: '',
    price: 20,
    priceUnit: 'month',
    currency: 'CNY',
    nonSelfPaid: 0,
    nonSelfPaidCurrency: 'CNY',
    nonSelfPaidUnit: 'month',
    isPinned: 0,
    trialValue: null,
    trialUnit: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as any;
}

test('续费中心为过期订阅建议补齐到当前日期所需的周期数', () => {
  const item = subscription();
  assert.equal(getSuggestedRenewalPeriods(item, '2026-03-15'), 2);
  assert.equal(getRenewedExpiryDate(item, 2), '2026-03-28');
  assert.equal(getSuggestedRenewalPeriods(item, '2026-01-15'), 1);
});

test('续费中心金额均使用订阅原价且不扣除合租分摊', () => {
  const item = subscription({
    category: '合租',
    expiryDate: '2026-01-15',
    price: 100,
    nonSelfPaid: 60,
    nonSelfPaidCurrency: 'USD',
  });
  const forecast = buildRenewalForecast([item], '2026-01-01', 1);

  assert.equal(getEstimatedRenewalCostCny(item), 100);
  assert.equal(forecast.months[0].amount, 100);
  assert.equal(forecast.events[0].amount, 100);
});

test('续费事件保留原支付币种和金额', () => {
  const item = subscription({
    expiryDate: '2026-01-15',
    price: 10,
    currency: 'USD',
  });
  const forecast = buildRenewalForecast([item], '2026-01-01', 1);

  assert.equal(getEstimatedRenewalCostInCurrency(item, 'USD'), 10);
  assert.deepEqual(
    forecast.events.map((event) => [event.originalAmount, event.currency]),
    [[10, 'USD']],
  );
});

test('六个月预测按逐周期日期和续费金额汇总', () => {
  const forecast = buildRenewalForecast([
    subscription(),
    subscription({
      id: 2,
      name: '年度订阅',
      expiryDate: '2026-02-15',
      periodUnit: 'year',
      price: 120,
      priceUnit: 'year',
    }),
    subscription({ id: 3, isActive: 0, price: 999 }),
  ], '2026-01-01', 3);

  assert.deepEqual(forecast.months.map((month) => [month.key, month.count, Math.round(month.amount)]), [
    ['2026-01', 1, 20],
    ['2026-02', 2, 140],
    ['2026-03', 1, 20],
  ]);
  assert.deepEqual(forecast.events.map((event) => event.date), [
    '2026-01-31',
    '2026-02-15',
    '2026-02-28',
    '2026-03-28',
  ]);
});
