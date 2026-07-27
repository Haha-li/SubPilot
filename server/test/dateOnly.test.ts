import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addDateOnlyPeriod,
  advanceDateOnlyToAtLeast,
  differenceInCalendarDays,
  getCalendarHoursUntilDateEnd,
  getDateOnlyInTimeZone,
  getDateOnlyStartInTimeZone,
  isValidTimeZone,
  normalizeDateOnly,
} from '../src/utils/dateOnly';

test('日期只接受真实存在的 YYYY-MM-DD 日历日期', () => {
  assert.equal(normalizeDateOnly('2024-02-29'), '2024-02-29');
  assert.equal(normalizeDateOnly('2025-02-29'), null);
  assert.equal(normalizeDateOnly('2026-02-31'), null);
  assert.equal(normalizeDateOnly('2026-2-01'), null);
});

test('按月和按年续费会钳制月底而不是跳到下个月', () => {
  assert.equal(addDateOnlyPeriod('2025-01-31', 1, 'month'), '2025-02-28');
  assert.equal(addDateOnlyPeriod('2024-01-31', 1, 'month'), '2024-02-29');
  assert.equal(addDateOnlyPeriod('2024-02-29', 1, 'year'), '2025-02-28');
});

test('长期过期订阅一次追赶到当前日期而不是每次只续一个周期', () => {
  assert.deepStrictEqual(
    advanceDateOnlyToAtLeast('2026-01-31', '2026-04-15', 1, 'month'),
    { expiryDate: '2026-04-28', periodsAdvanced: 3 },
  );
  assert.deepStrictEqual(
    advanceDateOnlyToAtLeast('2026-04-01', '2026-04-15', 7, 'day'),
    { expiryDate: '2026-04-15', periodsAdvanced: 2 },
  );
});

test('到期判断使用配置时区的日历日期', () => {
  const now = new Date('2026-07-09T16:30:00.000Z');
  assert.equal(getDateOnlyInTimeZone(now, 'Asia/Shanghai'), '2026-07-10');
  assert.equal(getDateOnlyInTimeZone(now, 'America/Los_Angeles'), '2026-07-09');
  assert.equal(differenceInCalendarDays('2026-07-09', '2026-07-10'), 1);
  assert.equal(isValidTimeZone('Asia/Shanghai'), true);
  assert.equal(isValidTimeZone('Not/A_Timezone'), false);
});

test('日历日期筛选边界能转换为配置时区对应的 UTC 时间', () => {
  assert.equal(
    getDateOnlyStartInTimeZone('2026-07-10', 'Asia/Shanghai').toISOString(),
    '2026-07-09T16:00:00.000Z',
  );
  assert.equal(
    getDateOnlyStartInTimeZone('2026-07-10', 'America/New_York').toISOString(),
    '2026-07-10T04:00:00.000Z',
  );
});

test('小时提醒以到期日期当天结束为边界', () => {
  const now = new Date('2026-07-10T08:00:00.000Z');
  assert.equal(getCalendarHoursUntilDateEnd('2026-07-10', now, 'Asia/Shanghai'), 8);
  assert.equal(getCalendarHoursUntilDateEnd('2026-07-11', now, 'Asia/Shanghai'), 32);
});
