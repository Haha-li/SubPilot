import assert from 'node:assert/strict';
import test from 'node:test';
import { schema, setDb } from '../src/db';
import { checkAndNotify } from '../src/services/scheduler';

interface ConfigWrite {
  key: string;
  value: string;
}

function expectEqual<T>(expected: T, actual: T) {
  assert.deepStrictEqual(actual, expected);
}

function createMockDb(cronExpression: string, subscriptions: object[], notifyChannels = 'pushplus') {
  const writes: ConfigWrite[] = [];
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
    insert: () => ({
      values: (value: ConfigWrite) => ({
        onConflictDoUpdate: async () => { writes.push(value); },
      }),
    }),
    update: () => ({
      set: () => ({ where: async () => undefined }),
    }),
  };
  return { instance, writes };
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
