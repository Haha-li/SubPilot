import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getDateOnlyInTimeZone as getClientDate,
  getDaysUntilDate,
} from '../../client/src/utils/dateOnly';
import { getDateOnlyInTimeZone as getServerDate } from '../src/utils/dateOnly';

test('前后端使用相同系统时区得到一致的日历日期', () => {
  const now = new Date('2026-07-09T16:30:00.000Z');
  for (const timezone of ['Asia/Shanghai', 'America/Los_Angeles', 'Europe/London']) {
    assert.equal(getClientDate(now, timezone), getServerDate(now, timezone));
  }
  assert.equal(getDaysUntilDate('2026-07-10', now, 'Asia/Shanghai'), 0);
  assert.equal(getDaysUntilDate('2026-07-10', now, 'America/Los_Angeles'), 1);
});
