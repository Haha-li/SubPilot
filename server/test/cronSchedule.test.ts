import assert from 'node:assert/strict';
import test from 'node:test';
import {
  matchesCronExpression,
  resolveNotifyCron,
  validateCronExpression,
} from '../src/services/cronSchedule';

function expectEqual<T>(expected: T, actual: T) {
  assert.deepStrictEqual(actual, expected);
}

test('按配置时区匹配 5 段 Cron', () => {
  const now = new Date('2026-07-10T00:30:00.000Z');

  expectEqual(true, matchesCronExpression('30 8 * * *', 'Asia/Shanghai', now));
  expectEqual(false, matchesCronExpression('0 8 * * *', 'Asia/Shanghai', now));
});

test('支持列表、范围和步进语法', () => {
  const noon = new Date('2026-07-10T04:00:00.000Z');
  const workday = new Date('2026-07-10T01:30:00.000Z');
  const steppedFromStart = new Date('2026-07-10T01:20:00.000Z');
  const sunday = new Date('2026-07-12T00:00:00.000Z');

  expectEqual(true, matchesCronExpression('0 8,12,18 * * *', 'Asia/Shanghai', noon));
  expectEqual(true, matchesCronExpression('*/15 9-17 * * 2-6', 'Asia/Shanghai', workday));
  expectEqual(true, matchesCronExpression('5/15 9 * * *', 'Asia/Shanghai', steppedFromStart));
  expectEqual(true, matchesCronExpression('0 8 * * 1', 'Asia/Shanghai', sunday));
});

test('旧检查小时自动转换为 Cron 表达式', () => {
  expectEqual(
    '0 8,12,18 * * *',
    resolveNotifyCron({ notify_hours: '18, 8 12', cron_expression: '0 0 * * *' }),
  );
  expectEqual(
    '0 8 * * *',
    resolveNotifyCron({ notify_hours: '', cron_expression: '0 0 * * *' }),
  );
});

test('保存新版配置后允许用户显式设置午夜推送', () => {
  expectEqual(
    '0 0 * * *',
    resolveNotifyCron({
      notify_hours: '',
      cron_expression: '0 0 * * *',
      notify_schedule_version: '2',
    }),
  );
});

test('拒绝非法 Cron 表达式', () => {
  expectEqual(null, validateCronExpression('0 8 * * *'));
  expectEqual('Cron 表达式必须包含 5 段', validateCronExpression('0 8 * *'));
  expectEqual('小时必须在 0-23 之间', validateCronExpression('0 24 * * *'));
  expectEqual('分钟的步进值必须大于 0', validateCronExpression('*/0 8 * * *'));
});
