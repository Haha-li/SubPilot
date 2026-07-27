import assert from 'node:assert/strict';
import test from 'node:test';
import { schema, setDb } from '../src/db';
import { listNotifyLogsHandler } from '../src/handlers/notifyLogs';

test('通知日志日期筛选拒绝无效日历日期', async () => {
  setDb({
    select: () => ({
      from: (table: unknown) => {
        if (table === schema.config) {
          return Promise.resolve([{ key: 'timezone', value: 'Asia/Shanghai' }]);
        }
        throw new Error('无效日期不应继续查询通知日志');
      },
    }),
  });

  const result = await listNotifyLogsHandler({ startDate: '2026-02-31' });
  assert.equal(result.status, 400);
  assert.equal((result.body as any).message, '开始日期无效');
});
