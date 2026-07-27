import assert from 'node:assert/strict';
import test from 'node:test';
import { schema, setDb } from '../src/db';
import { updateSubscriptionHandler } from '../src/handlers/subscription';

test('手动延长到期日会记录续费来源和前后日期', async () => {
  const subscription: any = {
    id: 1,
    name: '手动续费测试',
    category: '',
    expiryDate: '2026-01-31',
    periodValue: 1,
    periodUnit: 'month',
    price: 20,
    priceUnit: 'month',
    currency: 'CNY',
    nonSelfPaid: 0,
    nonSelfPaidCurrency: 'CNY',
    nonSelfPaidUnit: 'month',
    iconUrl: '',
    iconBackgroundColor: '',
  };
  const renewalLogs: any[] = [];
  const instance = {
    select: () => ({
      from: () => {
        const query: any = {
          where: () => query,
          limit: () => query,
          then: (resolveResult: (value: any[]) => void) => resolveResult([subscription]),
        };
        return query;
      },
    }),
    insert: (table: unknown) => ({
      values: async (value: any) => {
        if (table === schema.renewalLogs) renewalLogs.push(value);
      },
    }),
    update: () => ({
      set: (value: any) => ({
        where: async () => Object.assign(subscription, value),
      }),
    }),
  };
  setDb(instance);

  const result = await updateSubscriptionHandler(1, { expiryDate: '2026-02-28' });
  assert.equal(result.status, 200);
  assert.equal(renewalLogs.length, 1);
  assert.equal(renewalLogs[0].source, 'manual');
  assert.equal(renewalLogs[0].previousExpiryDate, '2026-01-31');
  assert.equal(renewalLogs[0].newExpiryDate, '2026-02-28');
  assert.equal(renewalLogs[0].periodsAdvanced, 1);
});
