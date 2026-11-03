import assert from 'node:assert/strict';
import test from 'node:test';
import { describeRenewalBalance, formatNotifyMessage } from '../src/services/notification';

const subscription = {
  id: 1,
  name: '测试订阅',
  customType: null,
  category: null,
  startDate: null,
  expiryDate: '2026-07-10',
  periodValue: 1,
  periodUnit: 'month',
  reminderValue: 7,
  reminderUnit: 'day',
  isActive: 1,
  autoRenew: 0,
  useLunar: 0,
  notes: null,
  price: 0,
  priceUnit: 'month',
  currency: 'CNY',
};

test('通知剩余天数按配置时区的日历日期计算', () => {
  const message = formatNotifyMessage(subscription, {
    notify_template: '{{status}} / {{daysLeft}}',
    timezone: 'Asia/Shanghai',
  }, new Date('2026-07-10T15:30:00.000Z'));

  assert.strictEqual('今天到期 / 0', message);
});

test('农历模板变量不依赖周期按农历设置', () => {
  const message = formatNotifyMessage(subscription, {
    notify_template: '农历: {{lunar}}',
    timezone: 'Asia/Shanghai',
  });

  assert.strictEqual('农历: 丙午年五月廿六', message);
});

test('到期提醒同时说明这笔续费扣得起扣不起', () => {
  const paid = { ...subscription, price: 30, currency: 'CNY', subscriptionMethodId: 1 };
  assert.equal(
    describeRenewalBalance(paid, { balance: 100, balanceCurrency: 'CNY' }),
    '充足 ¥100.00，本次扣 ¥30.00',
  );
  assert.equal(
    describeRenewalBalance(paid, { balance: 10, balanceCurrency: 'CNY' }),
    '不足 ¥10.00，本次扣 ¥30.00，差 ¥20.00',
  );
  assert.equal(describeRenewalBalance(paid, { balance: null, balanceCurrency: 'CNY' }), '未记录余额');
  assert.equal(
    describeRenewalBalance(paid, { balance: 100, balanceCurrency: 'USD' }),
    '币种不一致，不自动扣款',
  );
  assert.equal(describeRenewalBalance(subscription, null), '未关联订阅方式');

  const message = formatNotifyMessage(paid, {
    notify_template: '费用: {{price}}\n时间: {{time}}',
    timezone: 'Asia/Shanghai',
  }, new Date('2026-07-10T00:00:00.000Z'), '不足 ¥10.00，本次扣 ¥30.00，差 ¥20.00');
  assert.match(message, /余额: 不足 ¥10\.00，本次扣 ¥30\.00，差 ¥20\.00\n时间: /);
});
