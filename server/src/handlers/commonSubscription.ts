import { desc, eq } from 'drizzle-orm';
import { db, schema } from '../db';
import {
  findDuplicateCommonSubscription,
  normalizeCommonSubscriptionInput,
} from '../utils/commonSubscription';

function duplicateMessage(field: 'name' | 'website'): string {
  return field === 'name' ? '该名称已存在' : '该网站已存在';
}

export async function listCommonSubscriptionsHandler(query: any) {
  try {
    const rows = await db.select().from(schema.commonSubscriptions).orderBy(schema.commonSubscriptions.name);
    const search = typeof query?.search === 'string' ? query.search.trim().toLocaleLowerCase() : '';
    const body = search
      ? rows.filter((item: any) => `${item.name} ${item.website}`.toLocaleLowerCase().includes(search))
      : rows;
    return { status: 200, body };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}

export async function createCommonSubscriptionHandler(body: any) {
  try {
    const normalized = normalizeCommonSubscriptionInput(body);
    if (!normalized.success) {
      return { status: 400, body: { success: false, message: normalized.message } };
    }

    const rows = await db.select().from(schema.commonSubscriptions);
    const duplicate = findDuplicateCommonSubscription(rows, normalized.value);
    if (duplicate) {
      return { status: 409, body: { success: false, message: duplicateMessage(duplicate.field) } };
    }

    const now = new Date().toISOString();
    await db.insert(schema.commonSubscriptions).values({
      ...normalized.value,
      createdAt: now,
      updatedAt: now,
    });
    const [created] = await db.select().from(schema.commonSubscriptions)
      .orderBy(desc(schema.commonSubscriptions.id)).limit(1);
    return { status: 201, body: { success: true, commonSubscription: created } };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}

export async function updateCommonSubscriptionHandler(id: number, body: any) {
  try {
    const [existing] = await db.select().from(schema.commonSubscriptions)
      .where(eq(schema.commonSubscriptions.id, id)).limit(1);
    if (!existing) {
      return { status: 404, body: { success: false, message: '常用订阅不存在' } };
    }

    const normalized = normalizeCommonSubscriptionInput(body, existing);
    if (!normalized.success) {
      return { status: 400, body: { success: false, message: normalized.message } };
    }

    const rows = await db.select().from(schema.commonSubscriptions);
    const duplicate = findDuplicateCommonSubscription(rows, normalized.value, id);
    if (duplicate) {
      return { status: 409, body: { success: false, message: duplicateMessage(duplicate.field) } };
    }

    await db.update(schema.commonSubscriptions).set({
      ...normalized.value,
      updatedAt: new Date().toISOString(),
    }).where(eq(schema.commonSubscriptions.id, id));
    const [updated] = await db.select().from(schema.commonSubscriptions)
      .where(eq(schema.commonSubscriptions.id, id)).limit(1);
    return { status: 200, body: { success: true, commonSubscription: updated } };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}

export async function deleteCommonSubscriptionHandler(id: number) {
  try {
    const [existing] = await db.select().from(schema.commonSubscriptions)
      .where(eq(schema.commonSubscriptions.id, id)).limit(1);
    if (!existing) {
      return { status: 404, body: { success: false, message: '常用订阅不存在' } };
    }
    await db.delete(schema.commonSubscriptions).where(eq(schema.commonSubscriptions.id, id));
    return { status: 200, body: { success: true, message: '删除成功' } };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}
