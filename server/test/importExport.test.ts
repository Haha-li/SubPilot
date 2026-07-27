import assert from 'node:assert/strict';
import test from 'node:test';
import { schema, setDb } from '../src/db';
import {
  exportSubscriptionsHandler,
  importSubscriptionsHandler,
} from '../src/handlers/importExport';

function createMemoryDb(options: { failSubscriptionInsertAt?: number } = {}) {
  const subscriptions: any[] = [];
  const renewalLogs: any[] = [];
  let nextSubscriptionId = 1;
  let nextRenewalId = 1;
  let subscriptionInsertCount = 0;

  function createSelectQuery(table: unknown) {
    let descending = false;
    let maxRows = Number.POSITIVE_INFINITY;
    const query: any = {
      orderBy: (_field: unknown, direction?: string) => {
        descending = direction === 'desc';
        return query;
      },
      limit: (value: number) => {
        maxRows = value;
        return query;
      },
      then: (resolveResult: (value: any[]) => void, rejectResult: (reason: unknown) => void) => {
        const source = table === schema.renewalLogs ? renewalLogs : subscriptions;
        const values = descending ? [...source].reverse() : [...source];
        Promise.resolve(values.slice(0, maxRows)).then(resolveResult, rejectResult);
      },
    };
    return query;
  }

  const instance = {
    select: () => ({ from: (table: unknown) => createSelectQuery(table) }),
    insert: (table: unknown) => ({
      values: async (value: any) => {
        if (table === schema.renewalLogs) {
          renewalLogs.push({ id: nextRenewalId++, ...value });
          return;
        }
        subscriptionInsertCount += 1;
        if (subscriptionInsertCount === options.failSubscriptionInsertAt) {
          throw new Error('模拟数据库写入失败');
        }
        subscriptions.push({ id: nextSubscriptionId++, ...value });
      },
    }),
    delete: (table: unknown) => ({
      where: async () => {
        if (table === schema.subscriptions) subscriptions.pop();
      },
    }),
  };

  return { instance, subscriptions, renewalLogs };
}

const completeSubscription = {
  id: 7,
  name: '完整备份订阅',
  customType: '视频会员',
  category: '娱乐, 合租',
  startDate: '2026-01-31',
  expiryDate: '2026-02-28',
  periodValue: 1,
  periodUnit: 'month',
  reminderValue: 0,
  reminderUnit: 'day',
  isActive: 0,
  autoRenew: 0,
  useLunar: 1,
  notes: '第一行\n第二行',
  iconUrl: 'https://cdn.simpleicons.org/netflix',
  iconBackgroundColor: '#111827',
  price: 29.9,
  priceUnit: 'month',
  currency: 'CNY',
  nonSelfPaid: 10,
  nonSelfPaidCurrency: 'USD',
  nonSelfPaidUnit: 'year',
  isPinned: 1,
  trialValue: 14,
  trialUnit: 'day',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

test('JSON 完整备份会恢复订阅字段和续费历史', async () => {
  const source = createMemoryDb();
  source.subscriptions.push({ ...completeSubscription });
  source.renewalLogs.push({
    id: 3,
    subscriptionId: 7,
    renewedAt: '2026-02-01T00:00:00.000Z',
    price: 29.9,
    currency: 'CNY',
    periodValue: 1,
    periodUnit: 'month',
    notes: '自动续费',
    source: 'automatic',
    previousExpiryDate: '2026-01-31',
    newExpiryDate: '2026-02-28',
    periodsAdvanced: 1,
  });
  setDb(source.instance);
  const exported = await exportSubscriptionsHandler({ format: 'json' }) as any;
  const backup = JSON.parse(exported.body);
  assert.equal(backup.version, 2);
  assert.equal(backup.subscriptions[0].backupId, 7);
  assert.equal(backup.renewalLogs.length, 1);

  const target = createMemoryDb();
  setDb(target.instance);
  const imported = await importSubscriptionsHandler({ format: 'json', data: exported.body });

  assert.equal(imported.status, 200);
  assert.equal((imported.body as any).imported, 1);
  assert.equal((imported.body as any).renewalLogsImported, 1);
  assert.equal(target.subscriptions[0].isPinned, 1);
  assert.equal(target.subscriptions[0].trialValue, 14);
  assert.equal(target.subscriptions[0].trialUnit, 'day');
  assert.equal(target.subscriptions[0].createdAt, completeSubscription.createdAt);
  assert.equal(target.subscriptions[0].updatedAt, completeSubscription.updatedAt);
  assert.equal(target.renewalLogs[0].source, 'automatic');
  assert.equal(target.renewalLogs[0].previousExpiryDate, '2026-01-31');
  assert.equal(target.renewalLogs[0].newExpiryDate, '2026-02-28');

  const repeated = await importSubscriptionsHandler({ format: 'json', data: exported.body });
  assert.equal((repeated.body as any).imported, 0);
  assert.equal((repeated.body as any).renewalLogsImported, 0);
  assert.equal((repeated.body as any).renewalLogsSkipped, 1);
  assert.equal(target.renewalLogs.length, 1);
});

test('CSV 往返支持多行、公式前缀和零值', async () => {
  const source = createMemoryDb();
  source.subscriptions.push({
    ...completeSubscription,
    id: 1,
    name: '=SUM(1,1)',
    notes: '包含逗号, 引号"和\n换行',
  });
  setDb(source.instance);
  const exported = await exportSubscriptionsHandler({ format: 'csv' }) as any;
  assert.match(exported.body, /'=SUM/);

  const target = createMemoryDb();
  setDb(target.instance);
  const imported = await importSubscriptionsHandler({ format: 'csv', data: exported.body });

  assert.equal(imported.status, 200);
  assert.equal(target.subscriptions[0].name, '=SUM(1,1)');
  assert.equal(target.subscriptions[0].notes, '包含逗号, 引号"和\n换行');
  assert.equal(target.subscriptions[0].reminderValue, 0);
  assert.equal(target.subscriptions[0].isActive, 0);
  assert.equal(target.subscriptions[0].autoRenew, 0);
});

test('导入会正确识别字符串形式的布尔值', async () => {
  const target = createMemoryDb();
  setDb(target.instance);
  const data = JSON.stringify([{
    name: '布尔值测试',
    expiryDate: '2026-08-01',
    isActive: 'false',
    autoRenew: '0',
    useLunar: 'true',
    isPinned: '1',
  }]);

  const result = await importSubscriptionsHandler({ format: 'json', data });
  assert.equal(result.status, 200);
  assert.equal(target.subscriptions[0].isActive, 0);
  assert.equal(target.subscriptions[0].autoRenew, 0);
  assert.equal(target.subscriptions[0].useLunar, 1);
  assert.equal(target.subscriptions[0].isPinned, 1);
});

test('重复导入同一备份会跳过完全相同的订阅', async () => {
  const target = createMemoryDb();
  setDb(target.instance);
  const data = JSON.stringify([{ ...completeSubscription, id: undefined }]);

  const first = await importSubscriptionsHandler({ format: 'json', data });
  const second = await importSubscriptionsHandler({ format: 'json', data });

  assert.equal((first.body as any).imported, 1);
  assert.equal((second.body as any).imported, 0);
  assert.equal((second.body as any).skipped, 1);
  assert.equal(target.subscriptions.length, 1);
});

test('无效 JSON 和无效日期返回 400 而不是留下部分数据', async () => {
  const target = createMemoryDb();
  setDb(target.instance);
  const invalidJson = await importSubscriptionsHandler({ format: 'json', data: '{bad' });
  assert.equal(invalidJson.status, 400);

  const invalidRows = await importSubscriptionsHandler({
    format: 'json',
    data: JSON.stringify([{ name: '坏日期', expiryDate: '2026-02-31' }]),
  });
  assert.equal(invalidRows.status, 400);
  assert.equal(target.subscriptions.length, 0);
});

test('超过 10 MB 的导入内容会在访问数据库前被拒绝', async () => {
  setDb(new Proxy({}, {
    get() {
      throw new Error('超限内容不应访问数据库');
    },
  }));
  const result = await importSubscriptionsHandler({
    format: 'json',
    data: 'x'.repeat(10 * 1024 * 1024 + 1),
  });
  assert.equal(result.status, 413);
  assert.equal((result.body as any).message, '导入文件不能超过 10 MB');
});

test('数据库中途写入失败会回滚本次已导入订阅', async () => {
  const target = createMemoryDb({ failSubscriptionInsertAt: 2 });
  setDb(target.instance);
  const data = JSON.stringify([
    { name: '第一条', expiryDate: '2026-08-01' },
    { name: '第二条', expiryDate: '2026-09-01' },
  ]);

  const result = await importSubscriptionsHandler({ format: 'json', data });
  assert.equal(result.status, 500);
  assert.equal(target.subscriptions.length, 0);
  assert.match((result.body as any).message, /已回滚/);
});
