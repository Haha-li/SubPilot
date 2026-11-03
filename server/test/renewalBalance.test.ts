import assert from 'node:assert/strict';
import test from 'node:test';
import { schema, setDb } from '../src/db';
import { batchRenewalsHandler, renewSubscriptionHandler } from '../src/handlers/renewals';
import { getRenewalCharge } from '../src/utils/renewalCharge';

function createDb(subscriptions: any[], methods: any[]) {
  const balanceLogs: any[] = [];
  setDb({
    select: () => ({
      from: (table: unknown) => {
        const rows = table === schema.subscriptionMethods ? methods : subscriptions;
        const query: any = {
          where: () => query,
          limit: () => query,
          orderBy: () => query,
          then: (resolve: (value: any[]) => void) => resolve([...rows]),
        };
        return query;
      },
    }),
    update: (table: unknown) => ({
      set: (values: any) => ({
        where: async () => {
          if (table === schema.subscriptionMethods && values.balance !== undefined) {
            methods[0].balance = values.balance;
          }
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: async (value: any) => {
        if (table === schema.subscriptionMethodLogs) balanceLogs.push(value);
      },
    }),
  });
  return balanceLogs;
}

test('续费只按周期费用扣，不看非自己付费', () => {
  assert.equal(getRenewalCharge({ price: 100, priceUnit: 'month', periodValue: 1, periodUnit: 'month' }, 2), 200);
  assert.equal(getRenewalCharge({ price: 10, priceUnit: 'month', periodValue: 1, periodUnit: 'year' }, 1), 120);
  assert.equal(getRenewalCharge({ price: 0, priceUnit: 'month', periodValue: 1, periodUnit: 'month' }, 1), 0);
});

test('手动续费和批量续费扣除同币种余额', async () => {
  const methods = [{ id: 1, balance: 500, balanceCurrency: 'CNY' }];
  const subscriptions = [
    {
      id: 1, name: '甲', expiryDate: '2026-01-31', periodValue: 1, periodUnit: 'month',
      price: 100, priceUnit: 'month', currency: 'CNY', subscriptionMethodId: 1,
      category: '合租', nonSelfPaid: 40, nonSelfPaidCurrency: 'CNY', nonSelfPaidUnit: 'month',
    },
    {
      id: 2, name: '乙', expiryDate: '2026-01-31', periodValue: 1, periodUnit: 'year',
      price: 10, priceUnit: 'month', currency: 'CNY', subscriptionMethodId: 1,
    },
  ];
  const balanceLogs = createDb(subscriptions, methods);

  assert.equal((await renewSubscriptionHandler(1, { periods: 2 })).status, 200);
  assert.equal(methods[0].balance, 300);

  assert.equal((await batchRenewalsHandler({
    action: 'renew',
    items: [{ id: 2, periods: 1 }],
  })).status, 200);
  assert.equal(methods[0].balance, 180);
  assert.equal(balanceLogs.length, 2);
  assert.equal(balanceLogs[0].type, 'manual_renewal');
  assert.equal(balanceLogs[0].amount, -200);
});

test('币种不同或未记录余额时不扣除', async () => {
  const mismatch = [{ id: 2, balance: 500, balanceCurrency: 'USD' }];
  createDb([{
    id: 2, name: '不同币种', expiryDate: '2026-01-31', periodValue: 1, periodUnit: 'month',
    price: 100, priceUnit: 'month', currency: 'CNY', subscriptionMethodId: 2,
  }], mismatch);
  assert.equal((await renewSubscriptionHandler(2, { periods: 1 })).status, 200);
  assert.equal(mismatch[0].balance, 500);

  const unrecorded = [{ id: 3, balance: null, balanceCurrency: 'CNY' }];
  createDb([{
    id: 3, name: '未记录余额', expiryDate: '2026-01-31', periodValue: 1, periodUnit: 'month',
    price: 100, priceUnit: 'month', currency: 'CNY', subscriptionMethodId: 3,
  }], unrecorded);
  assert.equal((await renewSubscriptionHandler(3, { periods: 1 })).status, 200);
  assert.equal(unrecorded[0].balance, null);
});
