import { db, schema } from '../db';
import { getNextCronRun, resolveNotifyCron } from './cronSchedule';

export type SchedulerRunSource = 'cron' | 'manual';
export type SchedulerRunOutcome = 'success' | 'skipped' | 'failed';
export type SchedulerSkipReason =
  | 'cron_not_matched'
  | 'no_active_subscriptions'
  | 'no_matching_subscriptions'
  | 'no_channels_enabled'
  | 'delivery_failed';

export interface SchedulerRunResult {
  source: SchedulerRunSource;
  outcome: SchedulerRunOutcome;
  triggeredAt: string;
  completedAt: string;
  timezone: string;
  cronExpression: string;
  checkedCount: number;
  matchedCount: number;
  sentCount: number;
  failedCount: number;
  skipReason?: SchedulerSkipReason;
  message: string;
}

export interface SchedulerStatusSnapshot {
  cronExpression: string;
  timezone: string;
  nextRunAt: string | null;
  lastTriggerAt: string | null;
  lastExecution: SchedulerRunResult | null;
}

const LAST_TRIGGER_KEY = 'scheduler_last_trigger_at';
const LAST_EXECUTION_KEY = 'scheduler_last_execution';

async function saveConfigValue(key: string, value: string) {
  await db.insert(schema.config)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.config.key, set: { value } });
}

function isSchedulerRunResult(value: unknown): value is SchedulerRunResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Record<string, unknown>;
  const validSource = result.source === 'cron' || result.source === 'manual';
  const validOutcome = result.outcome === 'success' || result.outcome === 'skipped' || result.outcome === 'failed';
  return validSource
    && validOutcome
    && typeof result.triggeredAt === 'string'
    && typeof result.completedAt === 'string'
    && typeof result.timezone === 'string'
    && typeof result.cronExpression === 'string'
    && typeof result.checkedCount === 'number'
    && typeof result.matchedCount === 'number'
    && typeof result.sentCount === 'number'
    && typeof result.failedCount === 'number'
    && typeof result.message === 'string';
}

function parseExecution(raw: string | undefined): SchedulerRunResult | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isSchedulerRunResult(value) ? value : null;
  } catch {
    return null;
  }
}

export async function recordSchedulerTrigger(now: Date) {
  await saveConfigValue(LAST_TRIGGER_KEY, now.toISOString());
}

export async function recordSchedulerExecution(result: SchedulerRunResult) {
  await saveConfigValue(LAST_EXECUTION_KEY, JSON.stringify(result));
}

export async function getSchedulerStatus(now = new Date()): Promise<SchedulerStatusSnapshot> {
  const rows = await db.select().from(schema.config);
  const configMap: Record<string, string> = {};
  rows.forEach((row: { key: string; value: string }) => { configMap[row.key] = row.value; });
  const timezone = configMap.timezone || 'Asia/Shanghai';
  const cronExpression = resolveNotifyCron(configMap);
  return {
    cronExpression,
    timezone,
    nextRunAt: getNextCronRun(cronExpression, timezone, now)?.toISOString() || null,
    lastTriggerAt: configMap[LAST_TRIGGER_KEY] || null,
    lastExecution: parseExecution(configMap[LAST_EXECUTION_KEY]),
  };
}
