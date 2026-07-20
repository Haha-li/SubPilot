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

type NotificationSubscription = Parameters<typeof sendNotification>[0];

interface SchedulerOptions {
  now?: Date;
  force?: boolean;
  source?: SchedulerRunSource;
}

interface SchedulerDependencies {
  sendNotification: (subscription: NotificationSubscription) => Promise<boolean>;
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
  canSend: boolean;
  dependencies: SchedulerDependencies;
}

interface RenewalResult {
  subscription: NotificationSubscription;
  expiryDate: Date;
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

const DEFAULT_DEPENDENCIES: SchedulerDependencies = { sendNotification };
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
): Promise<RenewalResult> {
  const expiryDate = new Date(subscription.expiryDate);
  if (subscription.autoRenew !== 1 || expiryDate.getTime() >= now.getTime()) {
    return { subscription, expiryDate };
  }
  const newExpiry = new Date(expiryDate);
  const value = subscription.periodValue || 1;
  if (subscription.periodUnit === 'day') newExpiry.setDate(newExpiry.getDate() + value);
  else if (subscription.periodUnit === 'year') newExpiry.setFullYear(newExpiry.getFullYear() + value);
  else newExpiry.setMonth(newExpiry.getMonth() + value);
  const newDate = newExpiry.toISOString().split('T')[0];
  await db.update(schema.subscriptions).set({
    expiryDate: newDate,
    updatedAt: now.toISOString(),
  }).where(eq(schema.subscriptions.id, subscription.id));
  return {
    subscription: { ...subscription, expiryDate: newDate },
    expiryDate: newExpiry,
  };
}

function isWithinReminderWindow(subscription: NotificationSubscription, expiryDate: Date, now: Date): boolean {
  const diffMs = expiryDate.getTime() - now.getTime();
  const reminderValue = subscription.reminderValue ?? 7;
  if (subscription.reminderUnit === 'hour') {
    const diffHours = diffMs / (60 * 60 * 1000);
    return diffHours >= 0 && diffHours <= reminderValue;
  }
  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  return diffDays >= 0 && diffDays <= reminderValue;
}

async function processSubscriptions(input: ProcessInput): Promise<ResultCounts> {
  let matchedCount = 0;
  let sentCount = 0;
  let failedCount = 0;
  for (const subscription of input.subscriptions) {
    const renewed = await renewSubscriptionIfNeeded(subscription, input.now);
    if (!isWithinReminderWindow(renewed.subscription, renewed.expiryDate, input.now)) continue;
    matchedCount += 1;
    if (!input.canSend) continue;
    if (await input.dependencies.sendNotification(renewed.subscription)) sentCount += 1;
    else failedCount += 1;
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
    const counts = await processSubscriptions({ subscriptions, now, canSend, dependencies });
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
