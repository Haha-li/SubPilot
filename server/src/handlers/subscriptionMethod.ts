import { desc, eq } from 'drizzle-orm';
import { db, schema } from '../db';
import { executeStatementsAtomically } from '../utils/dbAtomic';

const MAX_NAME_LENGTH = 100;
const MAX_ADJUSTMENT_NOTE_LENGTH = 500;

export interface SubscriptionMethodValue {
  name: string;
  channel: string;
  paymentMethod: string;
  account: string;
  balance: number | null;
  balanceCurrency: string;
  paymentReference: string;
}

type NormalizeResult =
  | { success: true; value: SubscriptionMethodValue }
  | { success: false; message: string };

function normalizeText(value: unknown, label: string, maxLength: number): string | { error: string } {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return { error: `${label}格式无效` };
  const normalized = value.trim();
  if (normalized.length > maxLength) return { error: `${label}不能超过 ${maxLength} 个字符` };
  return normalized;
}

export function normalizeSubscriptionMethodInput(input: any): NormalizeResult {
  const nameResult = normalizeText(input?.name, '名称', MAX_NAME_LENGTH);
  if (typeof nameResult !== 'string') return { success: false, message: nameResult.error };
  if (!nameResult) return { success: false, message: '名称为必填项' };

  const channel = normalizeText(input?.channel, '订阅渠道', 100);
  if (typeof channel !== 'string') return { success: false, message: channel.error };
  const paymentMethod = normalizeText(input?.paymentMethod, '支付方式', 100);
  if (typeof paymentMethod !== 'string') return { success: false, message: paymentMethod.error };
  const account = normalizeText(input?.account, '订阅账号', 320);
  if (typeof account !== 'string') return { success: false, message: account.error };
  const paymentReference = normalizeText(input?.paymentReference, '付款标识', 200);
  if (typeof paymentReference !== 'string') return { success: false, message: paymentReference.error };

  const rawBalance = input?.balance;
  let balance: number | null = null;
  if (!(rawBalance === undefined || rawBalance === null || (typeof rawBalance === 'string' && !rawBalance.trim()))) {
    if (typeof rawBalance !== 'number' && typeof rawBalance !== 'string') {
      return { success: false, message: '账户余额必须是数字' };
    }
    const parsed = typeof rawBalance === 'number' ? rawBalance : Number(rawBalance);
    if (!Number.isFinite(parsed)) {
      return { success: false, message: '账户余额必须是数字' };
    }
    balance = parsed;
  }

  const rawCurrency = input?.balanceCurrency;
  const balanceCurrency = rawCurrency === undefined || rawCurrency === null || rawCurrency === ''
    ? 'CNY'
    : String(rawCurrency).trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(balanceCurrency)) {
    return { success: false, message: '余额币种必须是 3 位币种代码' };
  }

  return {
    success: true,
    value: { name: nameResult, channel, paymentMethod, account, balance, balanceCurrency, paymentReference },
  };
}

function duplicateName(rows: any[], name: string, currentId?: number) {
  const normalized = name.toLocaleLowerCase();
  return rows.some((item) => item.id !== currentId && String(item.name).trim().toLocaleLowerCase() === normalized);
}

export async function listSubscriptionMethodsHandler() {
  try {
    const rows = await db.select().from(schema.subscriptionMethods).orderBy(schema.subscriptionMethods.name);
    return { status: 200, body: rows };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}

export async function createSubscriptionMethodHandler(body: any) {
  try {
    const normalized = normalizeSubscriptionMethodInput(body);
    if (!normalized.success) return { status: 400, body: { success: false, message: normalized.message } };
    const rows = await db.select().from(schema.subscriptionMethods);
    if (duplicateName(rows, normalized.value.name)) {
      return { status: 409, body: { success: false, message: '该订阅方式已存在' } };
    }
    const now = new Date().toISOString();
    await db.insert(schema.subscriptionMethods).values({ ...normalized.value, createdAt: now, updatedAt: now });
    const [created] = await db.select().from(schema.subscriptionMethods)
      .orderBy(desc(schema.subscriptionMethods.id)).limit(1);
    if (created?.id && typeof created.balance === 'number') {
      await db.insert(schema.subscriptionMethodLogs).values({
        subscriptionMethodId: created.id,
        subscriptionId: null,
        type: 'initial',
        amount: created.balance,
        beforeBalance: 0,
        afterBalance: created.balance,
        note: '初始余额',
        createdAt: now,
      });
    }
    return { status: 201, body: { success: true, subscriptionMethod: created } };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}

export async function updateSubscriptionMethodHandler(id: number, body: any) {
  try {
    const rows = await db.select().from(schema.subscriptionMethods);
    const existing = rows.find((item: any) => item.id === id);
    if (!existing) return { status: 404, body: { success: false, message: '订阅方式不存在' } };
    const normalized = normalizeSubscriptionMethodInput({
      ...existing,
      ...body,
      name: body?.name ?? existing.name,
      balance: existing.balance,
      balanceCurrency: typeof existing.balance === 'number'
        ? existing.balanceCurrency
        : body?.balanceCurrency,
    });
    if (!normalized.success) return { status: 400, body: { success: false, message: normalized.message } };
    if (duplicateName(rows, normalized.value.name, id)) {
      return { status: 409, body: { success: false, message: '该订阅方式已存在' } };
    }
    await db.update(schema.subscriptionMethods).set({
      ...normalized.value,
      updatedAt: new Date().toISOString(),
    }).where(eq(schema.subscriptionMethods.id, id));
    const [updated] = await db.select().from(schema.subscriptionMethods)
      .where(eq(schema.subscriptionMethods.id, id)).limit(1);
    return { status: 200, body: { success: true, subscriptionMethod: updated } };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}

export async function setSubscriptionMethodSubscriptionsHandler(id: number, body: any) {
  try {
    const methodRows = await db.select().from(schema.subscriptionMethods);
    if (!methodRows.some((item: any) => item.id === id)) {
      return { status: 404, body: { success: false, message: '订阅方式不存在' } };
    }
    if (!Array.isArray(body?.subscriptionIds)) {
      return { status: 400, body: { success: false, message: 'subscriptionIds 必须是数组' } };
    }
    const ids = [...new Set<number>(body.subscriptionIds.map((value: unknown) => Number(value)))];
    if (ids.some((value) => !Number.isSafeInteger(value) || value <= 0)) {
      return { status: 400, body: { success: false, message: '订阅 ID 无效' } };
    }
    const subscriptions = await db.select().from(schema.subscriptions);
    const existingIds = new Set(subscriptions.map((item: any) => item.id));
    if (ids.some((value) => !existingIds.has(value))) {
      return { status: 400, body: { success: false, message: '包含不存在的订阅' } };
    }
    const selected = new Set(ids);
    const now = new Date().toISOString();
    const changed = subscriptions.filter((item: any) => (
      selected.has(item.id) ? item.subscriptionMethodId !== id : item.subscriptionMethodId === id
    ));
    await executeStatementsAtomically((executor) => changed.map((item: any) => (
      executor.update(schema.subscriptions).set({
        subscriptionMethodId: selected.has(item.id) ? id : null,
        updatedAt: now,
      }).where(eq(schema.subscriptions.id, item.id))
    )));
    return { status: 200, body: { success: true, linkedCount: ids.length } };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}

export async function listSubscriptionMethodLogsHandler(id: number) {
  try {
    const methods = await db.select().from(schema.subscriptionMethods);
    if (!methods.some((item: any) => item.id === id)) {
      return { status: 404, body: { success: false, message: '订阅方式不存在' } };
    }
    const logs = await db.select().from(schema.subscriptionMethodLogs)
      .where(eq(schema.subscriptionMethodLogs.subscriptionMethodId, id))
      .orderBy(desc(schema.subscriptionMethodLogs.createdAt))
      .limit(100);
    const subscriptions = await db.select().from(schema.subscriptions);
    const names = new Map<number, string>(subscriptions.map((item: any) => [item.id, item.name]));
    return {
      status: 200,
      body: logs.map((log: any) => ({
        ...log,
        subscriptionName: log.subscriptionId ? names.get(log.subscriptionId) || '已删除订阅' : '',
      })),
    };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}

export async function adjustSubscriptionMethodBalanceHandler(id: number, body: any) {
  try {
    const methods = await db.select().from(schema.subscriptionMethods);
    const method = methods.find((item: any) => item.id === id);
    if (!method) return { status: 404, body: { success: false, message: '订阅方式不存在' } };
    const rawAmount = typeof body?.amount === 'number' ? body.amount : Number(body?.amount);
    const amount = Math.round(rawAmount * 100) / 100;
    if (!Number.isFinite(rawAmount) || amount === 0) {
      return { status: 400, body: { success: false, message: '调整金额必须是非零数字且最多两位小数' } };
    }
    const note = body?.note === undefined || body?.note === null ? '' : String(body.note).trim();
    if (note.length > MAX_ADJUSTMENT_NOTE_LENGTH) {
      return { status: 400, body: { success: false, message: `调整备注不能超过 ${MAX_ADJUSTMENT_NOTE_LENGTH} 个字符` } };
    }
    const beforeBalance = typeof method.balance === 'number' && Number.isFinite(method.balance)
      ? method.balance
      : 0;
    const afterBalance = Math.round((beforeBalance + amount) * 100) / 100;
    const createdAt = new Date().toISOString();
    await executeStatementsAtomically((executor) => [
      executor.update(schema.subscriptionMethods).set({
        balance: afterBalance,
        updatedAt: createdAt,
      }).where(eq(schema.subscriptionMethods.id, id)),
      executor.insert(schema.subscriptionMethodLogs).values({
        subscriptionMethodId: id,
        subscriptionId: null,
        type: 'manual_adjustment',
        amount,
        beforeBalance,
        afterBalance,
        note,
        createdAt,
      }),
    ]);
    const [updated] = await db.select().from(schema.subscriptionMethods)
      .where(eq(schema.subscriptionMethods.id, id)).limit(1);
    return { status: 200, body: { success: true, subscriptionMethod: updated } };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}

export async function deleteSubscriptionMethodHandler(id: number) {
  try {
    const rows = await db.select().from(schema.subscriptionMethods);
    if (!rows.some((item: any) => item.id === id)) {
      return { status: 404, body: { success: false, message: '订阅方式不存在' } };
    }
    const subscriptions = await db.select().from(schema.subscriptions);
    const usedCount = subscriptions.filter((item: any) => item.subscriptionMethodId === id).length;
    if (usedCount > 0) {
      return { status: 409, body: { success: false, message: `仍有 ${usedCount} 个订阅使用该方式` } };
    }
    await executeStatementsAtomically((executor) => [
      executor.delete(schema.subscriptionMethodLogs)
        .where(eq(schema.subscriptionMethodLogs.subscriptionMethodId, id)),
      executor.delete(schema.subscriptionMethods).where(eq(schema.subscriptionMethods.id, id)),
    ]);
    return { status: 200, body: { success: true, message: '删除成功' } };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}
