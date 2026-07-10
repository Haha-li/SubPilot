import assert from 'node:assert/strict';
import test from 'node:test';
import { setDb } from '../src/db';
import { getConfigHandler, updateConfigHandler } from '../src/handlers/config';

interface ConfigWrite {
  key: string;
  value: string;
}

function expectEqual<T>(expected: T, actual: T) {
  assert.deepStrictEqual(actual, expected);
}

test('配置接口隐藏并保护调度器内部状态键', async () => {
  const writes: ConfigWrite[] = [];
  setDb({
    select: () => ({
      from: async () => [
        { key: 'timezone', value: 'Asia/Shanghai' },
        { key: 'cron_expression', value: '0 8 * * *' },
        { key: 'scheduler_last_trigger_at', value: '2026-07-10T03:00:00.000Z' },
      ],
    }),
    insert: () => ({
      values: (value: ConfigWrite) => ({
        onConflictDoUpdate: async () => { writes.push(value); },
      }),
    }),
  });

  const getResult = await getConfigHandler();
  expectEqual(undefined, getResult.body.scheduler_last_trigger_at);

  await updateConfigHandler({
    timezone: 'UTC',
    scheduler_last_trigger_at: 'tampered',
  });
  expectEqual([{ key: 'timezone', value: 'UTC' }], writes);
});
