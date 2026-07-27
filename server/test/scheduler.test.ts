import assert from 'node:assert/strict';
import test from 'node:test';
import { schema, setDb } from '../src/db';
import { checkAndNotify } from '../src/services/scheduler';

interface ConfigWrite {
  key: string;
  value: string;
}

interface SubscriptionUpdate {
  expiryDate?: string;
  updatedAt?: string;
}

function expectEqual<T>(expected: T, actual: T) {
  assert.deepStrictEqual(actual, expected);
}

function createMockDb(cronExpression: string, subscriptions: object[], notifyChannels = 'pushplus') {
  const writes: ConfigWrite[] = [];
  const subscriptionUpdates: SubscriptionUpdate[] = [];
  const renewalLogs: any[] = [];
  const configs = [
    { key: 'timezone', value: 'Asia/Shanghai' },
    { key: 'cron_expression', value: cronExpression },
    { key: 'notify_schedule_version', value: '2' },
    { key: 'notify_channels', value: notifyChannels },
  ];
  const instance = {
    select: () => ({
      from: (table: unknown) => table === schema.config
        ? Promise.resolve(configs)
        : { where: async () => subscriptions },
    }),
    insert: (table: unknown) => ({
      values: (value: ConfigWrite) => table === schema.renewalLogs
        ? Promise.resolve().then(() => { renewalLogs.push(value); })
        : ({
            onConflictDoUpdate: async () => { writes.push(value); },
          }),
    }),
    update: () => ({
      set: (value: SubscriptionUpdate) => ({
        where: async () => { subscriptionUpdates.push(value); },
      }),
    }),
  };
  return { instance, writes, subscriptionUpdates, renewalLogs };
}

const matchingSubscription = {
  id: 1,
  name: '测试订阅',
  expiryDate: '2026-07-12',
  reminderValue: 7,
  reminderUnit: 'day',
  autoRenew: 0,
};

test('手动检查绕过 Cron 并记录实际推送结果', async () => {
  const { instance, writes } = createMockDb('0 8 * * *', [matchingSubscription]);
  setDb(instance);

  const result = await checkAndNotify(
    { now: new Date('2026-07-10T01:00:00.000Z'), force: true, source: 'manual' },
    { sendNotification: async () => true },
  );

  expectEqual('success', result.outcome);
  expectEqual(1, result.checkedCount);
  expectEqual(1, result.matchedCount);
  expectEqual(1, result.sentCount);
  const statusWrite = writes.find((item) => item.key === 'scheduler_last_execution');
  expectEqual('manual', JSON.parse(statusWrite?.value || '{}').source);
});

test('自动续费后使用新到期日发送通知', async () => {
  const subscription = {
    ...matchingSubscription,
    expiryDate: '2026-06-12',
    autoRenew: 1,
    periodValue: 1,
    periodUnit: 'month',
  };
  const { instance, renewalLogs } = createMockDb('0 8 * * *', [subscription]);
  setDb(instance);
  let notifiedExpiryDate = '';

  const result = await checkAndNotify(
    { now: new Date('2026-07-10T00:00:00.000Z'), force: true, source: 'manual' },
    {
      sendNotification: async (renewedSubscription) => {
        notifiedExpiryDate = renewedSubscription.expiryDate;
        return true;
      },
    },
  );

  expectEqual('success', result.outcome);
  expectEqual('2026-07-12', notifiedExpiryDate);
  expectEqual(1, renewalLogs.length);
  expectEqual('automatic', renewalLogs[0].source);
  expectEqual('2026-06-12', renewalLogs[0].previousExpiryDate);
  expectEqual('2026-07-12', renewalLogs[0].newExpiryDate);
  expectEqual(1, renewalLogs[0].periodsAdvanced);
});

test('到期日当天不会因运行时刻晚于 UTC 零点而提前续费', async () => {
  const subscription = {
    ...matchingSubscription,
    expiryDate: '2026-07-10',
    autoRenew: 1,
    periodValue: 1,
    periodUnit: 'month',
  };
  const { instance, subscriptionUpdates } = createMockDb('0 8 * * *', [subscription]);
  setDb(instance);

  const result = await checkAndNotify(
    { now: new Date('2026-07-10T15:00:00.000Z'), force: true, source: 'manual' },
    { sendNotification: async () => true },
  );

  expectEqual('success', result.outcome);
  expectEqual([], subscriptionUpdates);
});

test('长期过期订阅在一次检查中追赶全部周期', async () => {
  const subscription = {
    ...matchingSubscription,
    expiryDate: '2026-01-31',
    autoRenew: 1,
    periodValue: 1,
    periodUnit: 'month',
  };
  const { instance, subscriptionUpdates, renewalLogs } = createMockDb('0 8 * * *', [subscription]);
  setDb(instance);

  const result = await checkAndNotify(
    { now: new Date('2026-04-15T00:00:00.000Z'), force: true, source: 'manual' },
    { sendNotification: async () => true },
  );

  expectEqual('skipped', result.outcome);
  expectEqual('no_matching_subscriptions', result.skipReason);
  expectEqual(1, subscriptionUpdates.length);
  expectEqual('2026-04-28', subscriptionUpdates[0].expiryDate);
  expectEqual(3, renewalLogs[0].periodsAdvanced);
});

test('单个旧订阅日期异常不会阻断其他订阅提醒', async () => {
  const invalidSubscription = {
    ...matchingSubscription,
    id: 2,
    expiryDate: '1000-01-01',
    autoRenew: 1,
    periodValue: Number.MAX_SAFE_INTEGER,
    periodUnit: 'year',
  };
  const { instance } = createMockDb('0 8 * * *', [invalidSubscription, matchingSubscription]);
  setDb(instance);
  let sendCount = 0;

  const result = await checkAndNotify(
    { now: new Date('2026-07-10T00:00:00.000Z'), force: true, source: 'manual' },
    { sendNotification: async () => { sendCount += 1; return true; } },
  );

  expectEqual('success', result.outcome);
  expectEqual(1, result.matchedCount);
  expectEqual(1, sendCount);
});

test('定时触发未匹配 Cron 时记录触发时间但不执行推送', async () => {
  const { instance, writes } = createMockDb('0 8 * * *', [matchingSubscription]);
  setDb(instance);
  let sendCount = 0;

  const result = await checkAndNotify(
    { now: new Date('2026-07-10T01:00:00.000Z'), source: 'cron' },
    { sendNotification: async () => { sendCount += 1; return true; } },
  );

  expectEqual('skipped', result.outcome);
  expectEqual('cron_not_matched', result.skipReason);
  expectEqual(0, sendCount);
  expectEqual(true, writes.some((item) => item.key === 'scheduler_last_trigger_at'));
  expectEqual(false, writes.some((item) => item.key === 'scheduler_last_execution'));
});

test('没有通知渠道时跳过发送且不计为发送失败', async () => {
  const { instance } = createMockDb('0 8 * * *', [matchingSubscription], '');
  setDb(instance);

  const result = await checkAndNotify(
    { now: new Date('2026-07-10T00:00:00.000Z'), force: true, source: 'manual' },
    { sendNotification: async () => true },
  );

  expectEqual('skipped', result.outcome);
  expectEqual('no_channels_enabled', result.skipReason);
  expectEqual(1, result.matchedCount);
  expectEqual(0, result.failedCount);
});
