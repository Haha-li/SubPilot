import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import { sendNotification } from '../services/notification';

export async function listSubscriptionsHandler(query: any) {
  try {
    const { search, category } = query;

    const results = await db.select().from(schema.subscriptions).orderBy(schema.subscriptions.expiryDate);

    let filtered = results;

    if (category && typeof category === 'string' && category.trim()) {
      filtered = filtered.filter((sub: any) => {
        const tokens = (sub.category || '').split(/[/,，\s]+/).filter(Boolean);
        return tokens.some((t: string) => t.toLowerCase() === category.toLowerCase());
      });
    }

    if (search && typeof search === 'string' && search.trim()) {
      const keyword = search.toLowerCase();
      filtered = filtered.filter((sub: any) => {
        const haystack = [sub.name, sub.customType, sub.notes, sub.category].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(keyword);
      });
    }

    return { status: 200, body: filtered };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}

export async function createSubscriptionHandler(body: any) {
  try {
    const { name, customType, category, startDate, expiryDate, periodValue, periodUnit, reminderValue, reminderUnit, isActive, autoRenew, useLunar, notes, price, priceUnit, currency, trialValue, trialUnit } = body;

    if (!name || !expiryDate) {
      return { status: 400, body: { success: false, message: '订阅名称和到期日期为必填项' } };
    }

    const now = new Date().toISOString();
    await db.insert(schema.subscriptions).values({
      name,
      customType: customType || '',
      category: category || '',
      startDate: startDate || null,
      expiryDate,
      periodValue: periodValue || 1,
      periodUnit: periodUnit || 'month',
      reminderValue: reminderValue ?? 7,
      reminderUnit: reminderUnit || 'day',
      isActive: isActive !== false ? 1 : 0,
      autoRenew: autoRenew !== false ? 1 : 0,
      useLunar: useLunar ? 1 : 0,
      notes: notes || '',
      price: price ?? 0,
      priceUnit: priceUnit || 'month',
      currency: currency || 'CNY',
      trialValue: trialValue || null,
      trialUnit: trialUnit || null,
      createdAt: now,
      updatedAt: now,
    });

    // D1 doesn't support .returning(), so query back the last inserted row
    const rows = await db.select().from(schema.subscriptions).orderBy(schema.subscriptions.id, 'desc').limit(1);

    return { status: 200, body: { success: true, subscription: rows[0] } };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}

export async function updateSubscriptionHandler(id: number, body: any) {
  try {
    const { name, customType, category, startDate, expiryDate, periodValue, periodUnit, reminderValue, reminderUnit, isActive, autoRenew, useLunar, notes, price, priceUnit, currency, isPinned, trialValue, trialUnit } = body;

    const [existing] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.id, id)).limit(1);
    if (!existing) {
      return { status: 404, body: { success: false, message: '订阅不存在' } };
    }

    const now = new Date().toISOString();

    // 续费历史记录：价格变动 或 expiryDate 延后视为续费，记一笔
    const oldPrice = existing.price || 0;
    const newPrice = price !== undefined ? price : oldPrice;
    const priceChanged = Math.abs(newPrice - oldPrice) > 0.01;
    const expiryChanged = expiryDate && expiryDate !== existing.expiryDate && new Date(expiryDate).getTime() > new Date(existing.expiryDate).getTime();

    if (priceChanged || expiryChanged) {
      await db.insert(schema.renewalLogs).values({
        subscriptionId: id,
        renewedAt: now,
        price: newPrice,
        currency: currency ?? existing.currency,
        periodValue: periodValue ?? existing.periodValue,
        periodUnit: periodUnit ?? existing.periodUnit,
        notes: notes ?? existing.notes,
      });
    }

    await db.update(schema.subscriptions).set({
      name: name ?? existing.name,
      customType: customType ?? existing.customType,
      category: category ?? existing.category,
      startDate: startDate !== undefined ? startDate : existing.startDate,
      expiryDate: expiryDate ?? existing.expiryDate,
      periodValue: periodValue ?? existing.periodValue,
      periodUnit: periodUnit ?? existing.periodUnit,
      reminderValue: reminderValue ?? existing.reminderValue,
      reminderUnit: reminderUnit ?? existing.reminderUnit,
      isActive: isActive !== undefined ? (isActive ? 1 : 0) : existing.isActive,
      autoRenew: autoRenew !== undefined ? (autoRenew ? 1 : 0) : existing.autoRenew,
      useLunar: useLunar !== undefined ? (useLunar ? 1 : 0) : existing.useLunar,
      notes: notes ?? existing.notes,
      price: price ?? existing.price,
      priceUnit: priceUnit ?? existing.priceUnit,
      currency: currency ?? existing.currency,
      isPinned: isPinned !== undefined ? (isPinned ? 1 : 0) : existing.isPinned,
      trialValue: trialValue !== undefined ? trialValue : existing.trialValue,
      trialUnit: trialUnit !== undefined ? trialUnit : existing.trialUnit,
      updatedAt: now,
    }).where(eq(schema.subscriptions.id, id));

    const [updated] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.id, id)).limit(1);

    return { status: 200, body: { success: true, subscription: updated } };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}

export async function deleteSubscriptionHandler(id: number) {
  try {
    const [existing] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.id, id)).limit(1);
    if (!existing) {
      return { status: 404, body: { success: false, message: '订阅不存在' } };
    }

    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, id));

    return { status: 200, body: { success: true, message: '删除成功' } };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}

export async function toggleSubscriptionHandler(id: number, body: any) {
  try {
    const { isActive } = body;

    const [existing] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.id, id)).limit(1);
    if (!existing) {
      return { status: 404, body: { success: false, message: '订阅不存在' } };
    }

    await db.update(schema.subscriptions).set({
      isActive: isActive ? 1 : 0,
      updatedAt: new Date().toISOString(),
    }).where(eq(schema.subscriptions.id, id));

    return { status: 200, body: { success: true, message: isActive ? '已启用' : '已停用' } };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}

export async function testNotifySubscriptionHandler(id: number) {
  try {
    const [subscription] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.id, id)).limit(1);
    if (!subscription) {
      return { status: 404, body: { success: false, message: '订阅不存在' } };
    }

    const result = await sendNotification(subscription, true);
    return { status: 200, body: { success: true, message: result ? '测试通知已发送' : '通知发送失败，请检查通知配置' } };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}
