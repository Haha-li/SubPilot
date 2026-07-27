import assert from 'node:assert/strict';
import test from 'node:test';
import { schema, setDb } from '../src/db';
import {
  batchRenewalsHandler,
  listRenewalHistoryHandler,
  renewSubscriptionHandler,
} from '../src/handlers/renewals';
import { advanceDateOnlyByPeriods } from '../src/utils/dateOnly';

interface MockState {
  subscriptions: any[];
  logs: any[];
}

function createMockDatabase(state: MockState) {
  return {
    select: () => ({
      from: (table: unknown) => {
        const rows = table === schema.subscriptions ? state.subscriptions : state.logs;
        const query: any = {
          where: () => query,
          limit: () => query,
          orderBy: () => query,
          then: (resolve: (value: any[]) => void) => resolve([...rows]),
        };
        return query;
      },
    }),
    update: () => ({
      set: (values: any) => ({
        where: async () => {
          const target = state.subscriptions.find((subscription) => subscription.id === values.id)
            || state.subscriptions.find((subscription) => (
              values.expiryDate !== undefined || values.autoRenew !== undefined
            ));
          if (target) Object.assign(target, values);
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: async (values: any) => {
        if (table === schema.renewalLogs) {
          state.logs.push({ id: state.logs.length + 1, ...values });
        }
      },
    }),
  };
}

function createSubscription(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `订阅 ${id}`,
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
  };
}

test('按多个周期续费会保持逐周期的月底规则', () => {
  assert.equal(advanceDateOnlyByPeriods('2026-01-31', 1, 'month', 2), '2026-03-28');
  assert.equal(advanceDateOnlyByPeriods('2024-02-29', 1, 'year', 2), '2026-02-28');
});

test('快速续费原子更新到期日并写入手动续费历史', async () => {
  const state = { subscriptions: [createSubscription(1)], logs: [] as any[] };
  setDb(createMockDatabase(state));

  const result = await renewSubscriptionHandler(1, { periods: 2, notes: '应用商店续费' });

  assert.equal(result.status, 200);
  assert.equal(state.subscriptions[0].expiryDate, '2026-03-28');
  assert.equal(state.logs.length, 1);
  assert.deepEqual(
    {
      source: state.logs[0].source,
      previousExpiryDate: state.logs[0].previousExpiryDate,
      newExpiryDate: state.logs[0].newExpiryDate,
      periodsAdvanced: state.logs[0].periodsAdvanced,
      notes: state.logs[0].notes,
    },
    {
      source: 'manual',
      previousExpiryDate: '2026-01-31',
      newExpiryDate: '2026-03-28',
      periodsAdvanced: 2,
      notes: '应用商店续费',
    },
  );
});

test('快速续费拒绝非法周期数且不写入数据', async () => {
  const state = { subscriptions: [createSubscription(1)], logs: [] as any[] };
  setDb(createMockDatabase(state));

  const result = await renewSubscriptionHandler(1, { periods: 0 });

  assert.equal(result.status, 400);
  assert.equal(state.subscriptions[0].expiryDate, '2026-01-31');
  assert.equal(state.logs.length, 0);
});

test('批量续费支持每个订阅使用不同的补续周期数', async () => {
  const state = {
    subscriptions: [
      createSubscription(1, { expiryDate: '2026-01-31' }),
      createSubscription(2, { expiryDate: '2025-12-15', periodValue: 1, periodUnit: 'year' }),
    ],
    logs: [] as any[],
  };
  let updateIndex = 0;
  const database: any = createMockDatabase(state);
  database.update = () => ({
    set: (values: any) => ({
      where: async () => {
        Object.assign(state.subscriptions[updateIndex], values);
        updateIndex += 1;
      },
    }),
  });
  setDb(database);

  const result = await batchRenewalsHandler({
    action: 'renew',
    items: [
      { id: 1, periods: 2 },
      { id: 2, periods: 1 },
    ],
    notes: '批量处理',
  });

  assert.equal(result.status, 200);
  assert.equal((result.body as any).updated, 2);
  assert.equal(state.logs.length, 2);
  assert.deepEqual(
    state.logs.map((log) => [log.subscriptionId, log.newExpiryDate, log.periodsAdvanced]),
    [
      [1, '2026-03-28', 2],
      [2, '2026-12-15', 1],
    ],
  );
});

test('批量续费存在缺失订阅时不会留下部分写入', async () => {
  const state = { subscriptions: [createSubscription(1)], logs: [] as any[] };
  setDb(createMockDatabase(state));

  const result = await batchRenewalsHandler({
    action: 'renew',
    items: [
      { id: 1, periods: 1 },
      { id: 999, periods: 1 },
    ],
  });

  assert.equal(result.status, 404);
  assert.equal(state.subscriptions[0].expiryDate, '2026-01-31');
  assert.equal(state.logs.length, 0);
});

test('批量自动续费会校验全部订阅后统一更新', async () => {
  const state = {
    subscriptions: [createSubscription(1), createSubscription(2)],
    logs: [] as any[],
  };
  let updateIndex = 0;
  const database: any = createMockDatabase(state);
  database.update = () => ({
    set: (values: any) => ({
      where: async () => {
        Object.assign(state.subscriptions[updateIndex], values);
        updateIndex += 1;
      },
    }),
  });
  setDb(database);

  const result = await batchRenewalsHandler({ action: 'auto-renew', ids: [1, 2], enabled: true });

  assert.equal(result.status, 200);
  assert.deepEqual(state.subscriptions.map((subscription) => subscription.autoRenew), [1, 1]);
});

test('批量操作拒绝重复订阅和超出限制的周期数', async () => {
  const state = { subscriptions: [createSubscription(1)], logs: [] as any[] };
  setDb(createMockDatabase(state));

  const duplicate = await batchRenewalsHandler({
    action: 'renew',
    items: [{ id: 1, periods: 1 }, { id: 1, periods: 1 }],
  });
  const tooManyPeriods = await batchRenewalsHandler({
    action: 'renew',
    items: [{ id: 1, periods: 10001 }],
  });

  assert.equal(duplicate.status, 400);
  assert.equal(tooManyPeriods.status, 400);
  assert.equal(state.logs.length, 0);
});

test('全局续费历史支持来源、搜索和分页筛选', async () => {
  const state = {
    subscriptions: [
      createSubscription(1, { name: '视频服务', category: '娱乐' }),
      createSubscription(2, { name: '云盘服务', category: '工具' }),
    ],
    logs: [
      {
        id: 3, subscriptionId: 1, renewedAt: '2026-03-03T00:00:00.000Z', source: 'manual',
        notes: '年度续费', price: 20, currency: 'CNY', periodValue: 1, periodUnit: 'month',
        previousExpiryDate: '2026-02-01', newExpiryDate: '2026-03-01', periodsAdvanced: 1,
      },
      {
        id: 2, subscriptionId: 2, renewedAt: '2026-03-02T00:00:00.000Z', source: 'automatic',
        notes: '', price: 30, currency: 'CNY', periodValue: 1, periodUnit: 'year',
        previousExpiryDate: '2025-03-01', newExpiryDate: '2026-03-01', periodsAdvanced: 1,
      },
      {
        id: 1, subscriptionId: 1, renewedAt: '2026-03-01T00:00:00.000Z', source: 'automatic',
        notes: '', price: 20, currency: 'CNY', periodValue: 1, periodUnit: 'month',
        previousExpiryDate: '2026-01-01', newExpiryDate: '2026-02-01', periodsAdvanced: 1,
      },
    ],
  };
  setDb(createMockDatabase(state));

  const result = await listRenewalHistoryHandler({
    source: 'automatic',
    search: '服务',
    page: 1,
    pageSize: 1,
  });

  assert.equal(result.status, 200);
  assert.equal((result.body as any).total, 2);
  assert.equal((result.body as any).items.length, 1);
  assert.equal((result.body as any).items[0].subscriptionName, '云盘服务');
});
