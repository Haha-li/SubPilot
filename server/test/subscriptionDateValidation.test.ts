import assert from 'node:assert/strict';
import test from 'node:test';
import { setDb } from '../src/db';
import { createSubscriptionHandler } from '../src/handlers/subscription';

function rejectDatabaseAccess() {
  return new Proxy({}, {
    get() {
      throw new Error('无效输入不应访问数据库');
    },
  });
}

test('新增订阅拒绝不存在的日历日期', async () => {
  setDb(rejectDatabaseAccess());
  const result = await createSubscriptionHandler({
    name: '错误日期',
    expiryDate: '2026-02-31',
  });

  assert.equal(result.status, 400);
  assert.equal((result.body as any).message, '到期日期必须是有效的 YYYY-MM-DD 日期');
});

test('新增订阅拒绝开始日期晚于到期日期', async () => {
  setDb(rejectDatabaseAccess());
  const result = await createSubscriptionHandler({
    name: '日期倒置',
    startDate: '2026-08-01',
    expiryDate: '2026-07-31',
  });

  assert.equal(result.status, 400);
  assert.equal((result.body as any).message, '开始日期不能晚于到期日期');
});

test('新增订阅拒绝非正整数周期和未知周期单位', async () => {
  setDb(rejectDatabaseAccess());
  const invalidValue = await createSubscriptionHandler({
    name: '错误周期',
    expiryDate: '2026-07-31',
    periodValue: 0,
  });
  assert.equal(invalidValue.status, 400);
  assert.equal((invalidValue.body as any).message, '订阅周期必须是正整数');

  const invalidUnit = await createSubscriptionHandler({
    name: '错误单位',
    expiryDate: '2026-07-31',
    periodUnit: 'week',
  });
  assert.equal(invalidUnit.status, 400);
  assert.equal((invalidUnit.body as any).message, '订阅周期单位无效');

  const outOfRange = await createSubscriptionHandler({
    name: '超出范围',
    expiryDate: '9999-12-31',
    periodValue: 1,
    periodUnit: 'year',
  });
  assert.equal(outOfRange.status, 400);
  assert.equal((outOfRange.body as any).message, '订阅周期导致续费日期超出支持范围');
});
