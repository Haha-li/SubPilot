import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import { sendNotification } from '../services/notification';
import { resolveSharedCost } from '../utils/sharedCost';
import { normalizeAvatarFields } from '../utils/avatar';
import { executeStatementsAtomically } from '../utils/dbAtomic';
import {
  addDateOnlyPeriod,
  compareDateOnly,
  isDatePeriodUnit,
  normalizeDateOnly,
  type DatePeriodUnit,
} from '../utils/dateOnly';

function normalizePositiveInteger(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function validateDateRange(startDate: string | null, expiryDate: string): string | null {
  if (startDate && compareDateOnly(startDate, expiryDate) > 0) {
    return '开始日期不能晚于到期日期';
  }
  return null;
}

function validateRenewalRange(
  expiryDate: string,
  periodValue: number,
  periodUnit: DatePeriodUnit,
): string | null {
  try {
    addDateOnlyPeriod(expiryDate, periodValue, periodUnit);
    return null;
  } catch {
    return '订阅周期导致续费日期超出支持范围';
  }
}

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
    const { name, customType, category, startDate, expiryDate, periodValue, periodUnit, reminderValue, reminderUnit, isActive, autoRenew, useLunar, notes, iconUrl, iconBackgroundColor, price, priceUnit, currency, nonSelfPaid, nonSelfPaidCurrency, nonSelfPaidUnit, trialValue, trialUnit } = body;

    if (!name || !expiryDate) {
      return { status: 400, body: { success: false, message: '订阅名称和到期日期为必填项' } };
    }

    const normalizedExpiryDate = normalizeDateOnly(expiryDate);
    if (!normalizedExpiryDate) {
      return { status: 400, body: { success: false, message: '到期日期必须是有效的 YYYY-MM-DD 日期' } };
    }
    const normalizedStartDate = startDate ? normalizeDateOnly(startDate) : null;
    if (startDate && !normalizedStartDate) {
      return { status: 400, body: { success: false, message: '开始日期必须是有效的 YYYY-MM-DD 日期' } };
    }
    const normalizedPeriodValue = periodValue === undefined || periodValue === null
      ? 1
      : normalizePositiveInteger(periodValue);
    if (!normalizedPeriodValue) {
      return { status: 400, body: { success: false, message: '订阅周期必须是正整数' } };
    }
    const normalizedPeriodUnit = periodUnit || 'month';
    if (!isDatePeriodUnit(normalizedPeriodUnit)) {
      return { status: 400, body: { success: false, message: '订阅周期单位无效' } };
    }
    const dateRangeError = validateDateRange(normalizedStartDate, normalizedExpiryDate);
    if (dateRangeError) {
      return { status: 400, body: { success: false, message: dateRangeError } };
    }
    const renewalRangeError = validateRenewalRange(
      normalizedExpiryDate,
      normalizedPeriodValue,
      normalizedPeriodUnit,
    );
    if (renewalRangeError) {
      return { status: 400, body: { success: false, message: renewalRangeError } };
    }

    const avatar = normalizeAvatarFields({ iconUrl, backgroundColor: iconBackgroundColor });
    if (!avatar.success) {
      return { status: 400, body: { success: false, message: avatar.message } };
    }

    const now = new Date().toISOString();
    const subscriptionCategory = typeof category === 'string' ? category : '';
    const sharedCost = resolveSharedCost({
      category: subscriptionCategory,
      nonSelfPaid,
      nonSelfPaidCurrency,
      nonSelfPaidUnit,
      fallbackCurrency: currency,
      fallbackUnit: priceUnit,
    });
    await db.insert(schema.subscriptions).values({
      name,
      customType: customType || '',
      category: subscriptionCategory,
      startDate: normalizedStartDate,
      expiryDate: normalizedExpiryDate,
      periodValue: normalizedPeriodValue,
      periodUnit: normalizedPeriodUnit,
      reminderValue: reminderValue ?? 7,
      reminderUnit: reminderUnit || 'day',
      isActive: isActive !== false ? 1 : 0,
      autoRenew: autoRenew !== false ? 1 : 0,
      useLunar: useLunar ? 1 : 0,
      notes: notes || '',
      iconUrl: avatar.value.iconUrl,
      iconBackgroundColor: avatar.value.backgroundColor,
      price: price ?? 0,
      priceUnit: priceUnit || 'month',
      currency: currency || 'CNY',
      nonSelfPaid: sharedCost.nonSelfPaid,
      nonSelfPaidCurrency: sharedCost.nonSelfPaidCurrency,
      nonSelfPaidUnit: sharedCost.nonSelfPaidUnit,
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
    const { name, customType, category, startDate, expiryDate, periodValue, periodUnit, reminderValue, reminderUnit, isActive, autoRenew, useLunar, notes, iconUrl, iconBackgroundColor, price, priceUnit, currency, nonSelfPaid, nonSelfPaidCurrency, nonSelfPaidUnit, isPinned, trialValue, trialUnit } = body;

    const [existing] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.id, id)).limit(1);
    if (!existing) {
      return { status: 404, body: { success: false, message: '订阅不存在' } };
    }

    let normalizedStartDate: string | null | undefined;
    if (startDate !== undefined) {
      normalizedStartDate = startDate ? normalizeDateOnly(startDate) : null;
      if (startDate && !normalizedStartDate) {
        return { status: 400, body: { success: false, message: '开始日期必须是有效的 YYYY-MM-DD 日期' } };
      }
    }
    let normalizedExpiryDate: string | undefined;
    if (expiryDate !== undefined) {
      normalizedExpiryDate = normalizeDateOnly(expiryDate) || undefined;
      if (!normalizedExpiryDate) {
        return { status: 400, body: { success: false, message: '到期日期必须是有效的 YYYY-MM-DD 日期' } };
      }
    }
    let normalizedPeriodValue: number | undefined;
    if (periodValue !== undefined) {
      normalizedPeriodValue = normalizePositiveInteger(periodValue) || undefined;
      if (!normalizedPeriodValue) {
        return { status: 400, body: { success: false, message: '订阅周期必须是正整数' } };
      }
    }
    let normalizedPeriodUnit: 'day' | 'month' | 'year' | undefined;
    if (periodUnit !== undefined) {
      if (!isDatePeriodUnit(periodUnit)) {
        return { status: 400, body: { success: false, message: '订阅周期单位无效' } };
      }
      normalizedPeriodUnit = periodUnit;
    }
    const finalStartDate = normalizedStartDate !== undefined
      ? normalizedStartDate
      : normalizeDateOnly(existing.startDate);
    const finalExpiryDate = normalizedExpiryDate || normalizeDateOnly(existing.expiryDate);
    if (finalExpiryDate) {
      const dateRangeError = validateDateRange(finalStartDate, finalExpiryDate);
      if (dateRangeError) {
        return { status: 400, body: { success: false, message: dateRangeError } };
      }
      const finalPeriodValue = normalizedPeriodValue
        ?? normalizePositiveInteger(existing.periodValue)
        ?? 1;
      const finalPeriodUnit = normalizedPeriodUnit
        ?? (isDatePeriodUnit(existing.periodUnit) ? existing.periodUnit : 'month');
      const renewalRangeError = validateRenewalRange(
        finalExpiryDate,
        finalPeriodValue,
        finalPeriodUnit,
      );
      if (renewalRangeError) {
        return { status: 400, body: { success: false, message: renewalRangeError } };
      }
    }

    const avatar = normalizeAvatarFields(
      { iconUrl, backgroundColor: iconBackgroundColor },
      {
        iconUrl: existing.iconUrl || '',
        backgroundColor: existing.iconBackgroundColor || '',
      },
    );
    if (!avatar.success) {
      return { status: 400, body: { success: false, message: avatar.message } };
    }

    const now = new Date().toISOString();
    const finalCategory = category ?? existing.category ?? '';
    const finalPriceUnit = priceUnit ?? existing.priceUnit ?? 'month';
    const sharedCost = resolveSharedCost({
      category: finalCategory,
      nonSelfPaid: nonSelfPaid !== undefined ? nonSelfPaid : existing.nonSelfPaid,
      nonSelfPaidCurrency: nonSelfPaidCurrency !== undefined
        ? nonSelfPaidCurrency
        : existing.nonSelfPaidCurrency,
      nonSelfPaidUnit: nonSelfPaidUnit !== undefined
        ? nonSelfPaidUnit
        : existing.nonSelfPaidUnit,
      fallbackCurrency: currency ?? existing.currency,
      fallbackUnit: finalPriceUnit,
    });

    // 续费历史记录：价格变动 或 expiryDate 延后视为续费，记一笔
    const oldPrice = existing.price || 0;
    const newPrice = price !== undefined ? price : oldPrice;
    const priceChanged = Math.abs(newPrice - oldPrice) > 0.01;
    const existingExpiryDate = normalizeDateOnly(existing.expiryDate);
    const expiryChanged = Boolean(
      normalizedExpiryDate
      && existingExpiryDate
      && normalizedExpiryDate !== existingExpiryDate
      && compareDateOnly(normalizedExpiryDate, existingExpiryDate) > 0,
    );

    const subscriptionUpdate = {
      name: name ?? existing.name,
      customType: customType ?? existing.customType,
      category: finalCategory,
      startDate: normalizedStartDate !== undefined ? normalizedStartDate : existing.startDate,
      expiryDate: normalizedExpiryDate ?? existing.expiryDate,
      periodValue: normalizedPeriodValue ?? existing.periodValue,
      periodUnit: normalizedPeriodUnit ?? existing.periodUnit,
      reminderValue: reminderValue ?? existing.reminderValue,
      reminderUnit: reminderUnit ?? existing.reminderUnit,
      isActive: isActive !== undefined ? (isActive ? 1 : 0) : existing.isActive,
      autoRenew: autoRenew !== undefined ? (autoRenew ? 1 : 0) : existing.autoRenew,
      useLunar: useLunar !== undefined ? (useLunar ? 1 : 0) : existing.useLunar,
      notes: notes ?? existing.notes,
      iconUrl: avatar.value.iconUrl,
      iconBackgroundColor: avatar.value.backgroundColor,
      price: price ?? existing.price,
      priceUnit: finalPriceUnit,
      currency: currency ?? existing.currency,
      nonSelfPaid: sharedCost.nonSelfPaid,
      nonSelfPaidCurrency: sharedCost.nonSelfPaidCurrency,
      nonSelfPaidUnit: sharedCost.nonSelfPaidUnit,
      isPinned: isPinned !== undefined ? (isPinned ? 1 : 0) : existing.isPinned,
      trialValue: trialValue !== undefined ? trialValue : existing.trialValue,
      trialUnit: trialUnit !== undefined ? trialUnit : existing.trialUnit,
      updatedAt: now,
    };

    await executeStatementsAtomically((executor) => {
      const statements: any[] = [];
      if (priceChanged || expiryChanged) {
        statements.push(executor.insert(schema.renewalLogs).values({
          subscriptionId: id,
          renewedAt: now,
          price: newPrice,
          currency: currency ?? existing.currency,
          periodValue: normalizedPeriodValue ?? existing.periodValue,
          periodUnit: normalizedPeriodUnit ?? existing.periodUnit,
          notes: notes ?? existing.notes,
          source: 'manual',
          previousExpiryDate: existingExpiryDate,
          newExpiryDate: normalizedExpiryDate ?? existingExpiryDate,
          periodsAdvanced: 1,
        }));
      }
      statements.push(
        executor.update(schema.subscriptions)
          .set(subscriptionUpdate)
          .where(eq(schema.subscriptions.id, id)),
      );
      return statements;
    });

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
