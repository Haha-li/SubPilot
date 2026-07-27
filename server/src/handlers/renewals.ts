import { desc, eq } from 'drizzle-orm';
import { db, schema } from '../db';
import { executeStatementsAtomically } from '../utils/dbAtomic';
import {
  advanceDateOnlyByPeriods,
  isDatePeriodUnit,
  normalizeDateOnly,
  type DatePeriodUnit,
} from '../utils/dateOnly';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_BATCH_SIZE = 100;
const MAX_RENEWAL_PERIODS = 10000;
const MAX_BATCH_TOTAL_PERIODS = 10000;
const MAX_NOTE_LENGTH = 1000;

type RenewalSource = 'manual' | 'automatic';

type SubscriptionRow = typeof schema.subscriptions.$inferSelect;

interface RenewalPlan {
  subscription: SubscriptionRow;
  previousExpiryDate: string;
  newExpiryDate: string;
  periods: number;
  periodValue: number;
  periodUnit: DatePeriodUnit;
  notes: string;
}

interface BatchRenewItem {
  id: number;
  periods: number;
}

function parsePositiveInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parsePage(value: unknown, fallback: number, max?: number): number | null {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = parsePositiveInteger(value);
  if (!parsed || (max !== undefined && parsed > max)) return null;
  return parsed;
}

function normalizeRenewalNote(value: unknown): string | null {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.length > MAX_NOTE_LENGTH) return null;
  return value.trim();
}

function normalizeRenewalSource(value: unknown): RenewalSource | '' | null {
  if (value === undefined || value === null || value === '') return '';
  return value === 'manual' || value === 'automatic' ? value : null;
}

function normalizeSubscriptionId(value: unknown): number | null {
  return parsePositiveInteger(value);
}

function createRenewalPlan(
  subscription: SubscriptionRow,
  periods: number,
  notes: string,
): RenewalPlan {
  const previousExpiryDate = normalizeDateOnly(subscription.expiryDate);
  if (!previousExpiryDate) throw new Error(`订阅「${subscription.name}」的到期日期无效`);

  const periodValue = parsePositiveInteger(subscription.periodValue) || 1;
  const periodUnit = isDatePeriodUnit(subscription.periodUnit)
    ? subscription.periodUnit
    : 'month';
  const newExpiryDate = advanceDateOnlyByPeriods(
    previousExpiryDate,
    periodValue,
    periodUnit,
    periods,
  );

  return {
    subscription,
    previousExpiryDate,
    newExpiryDate,
    periods,
    periodValue,
    periodUnit,
    notes,
  };
}

function buildRenewalStatements(executor: any, plans: RenewalPlan[], renewedAt: string): any[] {
  return plans.flatMap((plan) => [
    executor.update(schema.subscriptions).set({
      expiryDate: plan.newExpiryDate,
      updatedAt: renewedAt,
    }).where(eq(schema.subscriptions.id, plan.subscription.id)),
    executor.insert(schema.renewalLogs).values({
      subscriptionId: plan.subscription.id,
      renewedAt,
      price: plan.subscription.price ?? 0,
      currency: plan.subscription.currency || 'CNY',
      periodValue: plan.periodValue,
      periodUnit: plan.periodUnit,
      notes: plan.notes,
      source: 'manual',
      previousExpiryDate: plan.previousExpiryDate,
      newExpiryDate: plan.newExpiryDate,
      periodsAdvanced: plan.periods,
    }),
  ]);
}

async function loadSubscriptionsByIds(ids: number[]): Promise<SubscriptionRow[]> {
  const idSet = new Set(ids);
  const rows: SubscriptionRow[] = await db.select().from(schema.subscriptions);
  return rows.filter((subscription) => idSet.has(subscription.id));
}

function normalizeBatchRenewItems(value: unknown): BatchRenewItem[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_BATCH_SIZE) return null;
  const seen = new Set<number>();
  const items: BatchRenewItem[] = [];
  let totalPeriods = 0;
  for (const rawItem of value) {
    if (!rawItem || typeof rawItem !== 'object') return null;
    const id = normalizeSubscriptionId((rawItem as any).id);
    const periods = parsePositiveInteger((rawItem as any).periods);
    if (!id || !periods || periods > MAX_RENEWAL_PERIODS || seen.has(id)) return null;
    totalPeriods += periods;
    if (totalPeriods > MAX_BATCH_TOTAL_PERIODS) return null;
    seen.add(id);
    items.push({ id, periods });
  }
  return items;
}

function normalizeBatchIds(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_BATCH_SIZE) return null;
  const ids = value.map(normalizeSubscriptionId);
  if (ids.some((id) => !id)) return null;
  const uniqueIds = Array.from(new Set(ids as number[]));
  return uniqueIds.length === ids.length ? uniqueIds : null;
}

export async function listRenewalHistoryHandler(query: any) {
  try {
    const page = parsePage(query?.page, 1);
    const pageSize = parsePage(query?.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const source = normalizeRenewalSource(query?.source);
    if (!page || !pageSize) {
      return { status: 400, body: { success: false, message: '分页参数无效' } };
    }
    if (source === null) {
      return { status: 400, body: { success: false, message: '续费来源无效' } };
    }

    const subscriptionId = query?.subscriptionId === undefined || query?.subscriptionId === ''
      ? null
      : normalizeSubscriptionId(query.subscriptionId);
    if (query?.subscriptionId !== undefined && query?.subscriptionId !== '' && !subscriptionId) {
      return { status: 400, body: { success: false, message: '订阅 ID 无效' } };
    }
    const search = typeof query?.search === 'string' ? query.search.trim().toLocaleLowerCase() : '';
    if (search.length > 100) {
      return { status: 400, body: { success: false, message: '搜索关键词过长' } };
    }

    const [logs, subscriptions] = await Promise.all([
      db.select().from(schema.renewalLogs).orderBy(desc(schema.renewalLogs.renewedAt)),
      db.select().from(schema.subscriptions),
    ]);
    const subscriptionsById = new Map<number, SubscriptionRow>(
      subscriptions.map((subscription: SubscriptionRow) => [subscription.id, subscription]),
    );

    const filtered = logs
      .map((log: typeof schema.renewalLogs.$inferSelect) => {
        const subscription = subscriptionsById.get(log.subscriptionId);
        return {
          ...log,
          subscriptionName: subscription?.name || '已删除订阅',
          subscriptionCategory: subscription?.category || '',
          subscriptionIconUrl: subscription?.iconUrl || '',
          subscriptionIconBackgroundColor: subscription?.iconBackgroundColor || '',
        };
      })
      .filter((item: any) => !source || item.source === source)
      .filter((item: any) => !subscriptionId || item.subscriptionId === subscriptionId)
      .filter((item: any) => {
        if (!search) return true;
        return [item.subscriptionName, item.subscriptionCategory, item.notes]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase()
          .includes(search);
      });

    const start = (page - 1) * pageSize;
    return {
      status: 200,
      body: {
        items: filtered.slice(start, start + pageSize),
        total: filtered.length,
        page,
        pageSize,
      },
    };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}

export async function listSubscriptionRenewalsHandler(id: number) {
  try {
    if (!normalizeSubscriptionId(id)) {
      return { status: 400, body: { success: false, message: '订阅 ID 无效' } };
    }
    const logs = await db.select().from(schema.renewalLogs)
      .where(eq(schema.renewalLogs.subscriptionId, id))
      .orderBy(desc(schema.renewalLogs.renewedAt));
    return { status: 200, body: logs };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}

export async function renewSubscriptionHandler(id: number, body: any) {
  try {
    if (!normalizeSubscriptionId(id)) {
      return { status: 400, body: { success: false, message: '订阅 ID 无效' } };
    }
    const periods = body?.periods === undefined ? 1 : parsePositiveInteger(body.periods);
    if (!periods || periods > MAX_RENEWAL_PERIODS) {
      return { status: 400, body: { success: false, message: `续费周期数必须是 1-${MAX_RENEWAL_PERIODS} 的整数` } };
    }
    const notes = normalizeRenewalNote(body?.notes);
    if (notes === null) {
      return { status: 400, body: { success: false, message: `续费备注不能超过 ${MAX_NOTE_LENGTH} 个字符` } };
    }

    const [subscription] = await db.select().from(schema.subscriptions)
      .where(eq(schema.subscriptions.id, id))
      .limit(1);
    if (!subscription) {
      return { status: 404, body: { success: false, message: '订阅不存在' } };
    }

    let plan: RenewalPlan;
    try {
      plan = createRenewalPlan(subscription, periods, notes);
    } catch (error) {
      return {
        status: 400,
        body: { success: false, message: error instanceof Error ? error.message : '续费日期计算失败' },
      };
    }

    const renewedAt = new Date().toISOString();
    await executeStatementsAtomically((executor) => buildRenewalStatements(executor, [plan], renewedAt));
    const [updated] = await db.select().from(schema.subscriptions)
      .where(eq(schema.subscriptions.id, id))
      .limit(1);

    return {
      status: 200,
      body: {
        success: true,
        subscription: updated,
        renewal: {
          previousExpiryDate: plan.previousExpiryDate,
          newExpiryDate: plan.newExpiryDate,
          periodsAdvanced: plan.periods,
          renewedAt,
        },
      },
    };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}

export async function batchRenewalsHandler(body: any) {
  try {
    const action = body?.action;
    if (action === 'renew') {
      const items = normalizeBatchRenewItems(body?.items);
      if (!items) {
        return { status: 400, body: { success: false, message: '批量续费项目无效' } };
      }
      const notes = normalizeRenewalNote(body?.notes);
      if (notes === null) {
        return { status: 400, body: { success: false, message: `续费备注不能超过 ${MAX_NOTE_LENGTH} 个字符` } };
      }

      const subscriptions = await loadSubscriptionsByIds(items.map((item) => item.id));
      if (subscriptions.length !== items.length) {
        const foundIds = new Set(subscriptions.map((subscription) => subscription.id));
        const missingIds = items.filter((item) => !foundIds.has(item.id)).map((item) => item.id);
        return { status: 404, body: { success: false, message: `订阅不存在: ${missingIds.join(', ')}` } };
      }
      const subscriptionsById = new Map(subscriptions.map((subscription) => [subscription.id, subscription]));
      let plans: RenewalPlan[];
      try {
        plans = items.map((item) => createRenewalPlan(subscriptionsById.get(item.id)!, item.periods, notes));
      } catch (error) {
        return {
          status: 400,
          body: { success: false, message: error instanceof Error ? error.message : '续费日期计算失败' },
        };
      }

      const renewedAt = new Date().toISOString();
      await executeStatementsAtomically((executor) => buildRenewalStatements(executor, plans, renewedAt));
      return {
        status: 200,
        body: {
          success: true,
          updated: plans.length,
          results: plans.map((plan) => ({
            id: plan.subscription.id,
            name: plan.subscription.name,
            previousExpiryDate: plan.previousExpiryDate,
            newExpiryDate: plan.newExpiryDate,
            periodsAdvanced: plan.periods,
          })),
        },
      };
    }

    if (action === 'auto-renew') {
      const ids = normalizeBatchIds(body?.ids);
      if (!ids || typeof body?.enabled !== 'boolean') {
        return { status: 400, body: { success: false, message: '批量自动续费参数无效' } };
      }
      const subscriptions = await loadSubscriptionsByIds(ids);
      if (subscriptions.length !== ids.length) {
        const foundIds = new Set(subscriptions.map((subscription) => subscription.id));
        const missingIds = ids.filter((id) => !foundIds.has(id));
        return { status: 404, body: { success: false, message: `订阅不存在: ${missingIds.join(', ')}` } };
      }

      const updatedAt = new Date().toISOString();
      await executeStatementsAtomically((executor) => subscriptions.map((subscription) => (
        executor.update(schema.subscriptions).set({
          autoRenew: body.enabled ? 1 : 0,
          updatedAt,
        }).where(eq(schema.subscriptions.id, subscription.id))
      )));
      return {
        status: 200,
        body: {
          success: true,
          updated: subscriptions.length,
          autoRenew: body.enabled,
        },
      };
    }

    return { status: 400, body: { success: false, message: '批量操作类型无效' } };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}
