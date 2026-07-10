import assert from 'node:assert/strict';
import test from 'node:test';
import { formatNotifyMessage } from '../src/services/notification';

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

test('农历模板变量不依赖周期按农历设置', () => {
  const message = formatNotifyMessage(subscription, {
    notify_template: '农历: {{lunar}}',
    timezone: 'Asia/Shanghai',
  });

  assert.strictEqual('农历: 丙午年五月廿六', message);
});
