import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import { sendNotification } from './notification';
import { matchesCronExpression, resolveNotifyCron } from './cronSchedule';
import {
  recordSchedulerExecution,
  recordSchedulerTrigger,
  SchedulerRunResult,
  SchedulerRunSource,
  SchedulerSkipReason,
} from './schedulerStatus';
import {
  advanceDateOnlyToAtLeast,
  compareDateOnly,
  differenceInCalendarDays,
  getCalendarHoursUntilDateEnd,
  getDateOnlyInTimeZone,
  isDatePeriodUnit,
  normalizeDateOnly,
} from '../utils/dateOnly';

type NotificationSubscription = Parameters<typeof sendNotification>[0];

interface SchedulerOptions {
  now?: Date;
  force?: boolean;
  source?: SchedulerRunSource;
}

interface SchedulerDependencies {
  sendNotification: (subscription: NotificationSubscription, now: Date) => Promise<boolean>;
}

interface ScheduledTask {
  stop(): void;
}

interface ResultCounts {
  checkedCount: number;
  matchedCount: number;
  sentCount: number;
  failedCount: number;
}

interface ProcessInput {
  subscriptions: NotificationSubscription[];
  now: Date;
  timezone: string;
  canSend: boolean;
  dependencies: SchedulerDependencies;
}

interface RenewalResult {
  subscription: NotificationSubscription;
  expiryDate: string | null;
}

interface ResultInput extends ResultCounts {
  source: SchedulerRunSource;
  now: Date;
  timezone: string;
  cronExpression: string;
  outcome: SchedulerRunResult['outcome'];
  message: string;
  skipReason?: SchedulerSkipReason;
}

const DEFAULT_DEPENDENCIES: SchedulerDependencies = {
  sendNotification: (subscription, now) => sendNotification(subscription, false, now),
};
let scheduledTask: ScheduledTask | null = null;

async function loadConfigMap(): Promise<Record<string, string>> {
  const configs = await db.select().from(schema.config);
  const configMap: Record<string, string> = {};
  configs.forEach((item: { key: string; value: string }) => { configMap[item.key] = item.value; });
  return configMap;
}

async function persistSafely(action: () => Promise<void>, context: string) {
  try {
    await action();
  } catch (error) {
    console.error(JSON.stringify({
      message: 'scheduler status persistence failed',
      context,
      error: error instanceof Error ? error.message : String(error),
    }));
  }
}

async function renewSubscriptionIfNeeded(
  subscription: NotificationSubscription,
  now: Date,
  today: string,
): Promise<RenewalResult> {
  const expiryDate = normalizeDateOnly(subscription.expiryDate);
  if (!expiryDate) {
    console.error(JSON.stringify({
      message: 'subscription has invalid expiry date',
      subscriptionId: subscription.id,
      expiryDate: subscription.expiryDate,
    }));
    return { subscription, expiryDate: null };
  }
  if (subscription.autoRenew !== 1 || compareDateOnly(expiryDate, today) >= 0) {
    return { subscription, expiryDate };
  }

  const periodValue = Number.isSafeInteger(subscription.periodValue)
    && Number(subscription.periodValue) > 0
    ? Number(subscription.periodValue)
    : 1;
  const periodUnit = isDatePeriodUnit(subscription.periodUnit)
    ? subscription.periodUnit
    : 'month';
  const renewed = advanceDateOnlyToAtLeast(expiryDate, today, periodValue, periodUnit);
  await db.update(schema.subscriptions).set({
    expiryDate: renewed.expiryDate,
    updatedAt: now.toISOString(),
  }).where(eq(schema.subscriptions.id, subscription.id));
  return {
    subscription: { ...subscription, expiryDate: renewed.expiryDate },
    expiryDate: renewed.expiryDate,
  };
}

function isWithinReminderWindow(
  subscription: NotificationSubscription,
  expiryDate: string | null,
  now: Date,
  timezone: string,
  today: string,
): boolean {
  if (!expiryDate) return false;
  const reminderValue = Number.isFinite(subscription.reminderValue)
    && Number(subscription.reminderValue) >= 0
    ? Number(subscription.reminderValue)
    : 7;
  if (subscription.reminderUnit === 'hour') {
    const diffHours = getCalendarHoursUntilDateEnd(expiryDate, now, timezone);
    return diffHours >= 0 && diffHours <= reminderValue;
  }
  const diffDays = differenceInCalendarDays(today, expiryDate);
  return diffDays >= 0 && diffDays <= reminderValue;
}

async function processSubscriptions(input: ProcessInput): Promise<ResultCounts> {
  let matchedCount = 0;
  let sentCount = 0;
  let failedCount = 0;
  const today = getDateOnlyInTimeZone(input.now, input.timezone);
  for (const subscription of input.subscriptions) {
    try {
      const renewed = await renewSubscriptionIfNeeded(subscription, input.now, today);
      if (!isWithinReminderWindow(
        renewed.subscription,
        renewed.expiryDate,
        input.now,
        input.timezone,
        today,
      )) continue;
      matchedCount += 1;
      if (!input.canSend) continue;
      if (await input.dependencies.sendNotification(renewed.subscription, input.now)) sentCount += 1;
      else failedCount += 1;
    } catch (error) {
      console.error(JSON.stringify({
        message: 'subscription date processing failed',
        subscriptionId: subscription.id,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }
  return { checkedCount: input.subscriptions.length, matchedCount, sentCount, failedCount };
}

function getResultDetails(counts: ResultCounts, canSend: boolean) {
  if (counts.checkedCount === 0) {
    return { outcome: 'skipped' as const, reason: 'no_active_subscriptions' as const, message: '没有启用中的订阅' };
  }
  if (counts.matchedCount === 0) {
    return { outcome: 'skipped' as const, reason: 'no_matching_subscriptions' as const, message: '没有进入提醒范围的订阅' };
  }
  if (!canSend) {
    return { outcome: 'skipped' as const, reason: 'no_channels_enabled' as const, message: '没有启用通知渠道' };
  }
  if (counts.sentCount === 0) {
    return { outcome: 'failed' as const, reason: 'delivery_failed' as const, message: '匹配到订阅，但通知全部发送失败' };
  }
  const message = counts.failedCount > 0
    ? `成功推送 ${counts.sentCount} 个，失败 ${counts.failedCount} 个`
    : `成功推送 ${counts.sentCount} 个订阅`;
  return { outcome: 'success' as const, reason: undefined, message };
}

function createResult(input: ResultInput): SchedulerRunResult {
  return {
    source: input.source,
    outcome: input.outcome,
    triggeredAt: input.now.toISOString(),
    completedAt: new Date().toISOString(),
    timezone: input.timezone,
    cronExpression: input.cronExpression,
    checkedCount: input.checkedCount,
    matchedCount: input.matchedCount,
    sentCount: input.sentCount,
    failedCount: input.failedCount,
    skipReason: input.skipReason,
    message: input.message,
  };
}

export async function checkAndNotify(
  options: SchedulerOptions = {},
  dependencies: SchedulerDependencies = DEFAULT_DEPENDENCIES,
): Promise<SchedulerRunResult> {
  const now = options.now || new Date();
  const source = options.source || 'cron';
  const emptyCounts = { checkedCount: 0, matchedCount: 0, sentCount: 0, failedCount: 0 };
  let timezone = 'Asia/Shanghai';
  let cronExpression = '';
  console.log(`[${now.toISOString()}] Running scheduled notification check...`);
  if (source === 'cron') await persistSafely(() => recordSchedulerTrigger(now), 'trigger');
  try {
    const configMap = await loadConfigMap();
    timezone = configMap.timezone || timezone;
    cronExpression = resolveNotifyCron(configMap);
    if (!options.force && !matchesCronExpression(cronExpression, timezone, now)) {
      return createResult({
        source, now, timezone, cronExpression, ...emptyCounts,
        outcome: 'skipped', message: '当前时间未匹配推送计划', skipReason: 'cron_not_matched',
      });
    }
    const subscriptions: NotificationSubscription[] = await db.select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.isActive, 1));
    const canSend = Boolean(configMap.notify_channels?.split(',').filter(Boolean).length);
    const counts = await processSubscriptions({ subscriptions, now, timezone, canSend, dependencies });
    const details = getResultDetails(counts, canSend);
    const result = createResult({
      source, now, timezone, cronExpression, ...counts,
      outcome: details.outcome, message: details.message, skipReason: details.reason,
    });
    await persistSafely(() => recordSchedulerExecution(result), 'execution');
    console.log(JSON.stringify({ event: 'scheduler_check_completed', ...result }));
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const result = createResult({
      source, now, timezone, cronExpression, ...emptyCounts,
      outcome: 'failed', message,
    });
    await persistSafely(() => recordSchedulerExecution(result), 'failure');
    console.error(JSON.stringify({ message: 'scheduled notification error', error: message }));
    return result;
  }
}

export function startScheduler() {
  // node-cron is not available on Cloudflare Workers (uses Cron Triggers instead)
  try {
    const cron: typeof import('node-cron') = require('node-cron');
    const cronExpression = '* * * * *';

    if (scheduledTask) {
      scheduledTask.stop();
    }

    scheduledTask = cron.schedule(cronExpression, () => { void checkAndNotify(); }, {
      timezone: 'UTC',
    });

    console.log(`Scheduler started with cron: ${cronExpression}`);
  } catch {
    console.log('Scheduler skipped (node-cron not available, use Workers Cron Triggers)');
  }
}

export function stopScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('Scheduler stopped');
  }
}
