import { desc, eq } from 'drizzle-orm';
import { db, schema } from '../db';

const MAX_NAME_LENGTH = 100;

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
      return { success: false, message: '账户余额必须是非负数' };
    }
    const parsed = typeof rawBalance === 'number' ? rawBalance : Number(rawBalance);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { success: false, message: '账户余额必须是非负数' };
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
    const normalized = normalizeSubscriptionMethodInput({ ...existing, ...body, name: body?.name ?? existing.name });
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
    await db.delete(schema.subscriptionMethods).where(eq(schema.subscriptionMethods.id, id));
    return { status: 200, body: { success: true, message: '删除成功' } };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}
