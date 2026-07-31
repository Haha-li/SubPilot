import assert from 'node:assert/strict';
import test from 'node:test';
import { isSubscriptionPresentInMonth } from '../../client/src/utils/statsOverview';

const january = { start: '2026-01-01', end: '2026-01-31' };

function subscription(startDate: string | null, expiryDate: string) {
  return { startDate, expiryDate };
}

test('当月类型费用仅统计当月有效订阅', () => {
  assert.equal(isSubscriptionPresentInMonth(subscription(null, '2026-02-15'), january), true);
  assert.equal(isSubscriptionPresentInMonth(subscription('2026-01-10', '2026-01-20'), january), true);
  assert.equal(isSubscriptionPresentInMonth(subscription(null, '2025-12-31'), january), false);
  assert.equal(isSubscriptionPresentInMonth(subscription('2026-02-01', '2026-03-01'), january), false);
});
