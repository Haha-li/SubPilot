export type SchedulerRunSource = 'cron' | 'manual';
export type SchedulerRunOutcome = 'success' | 'skipped' | 'failed';

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
  skipReason?: string;
  message: string;
}

export interface SchedulerStatusSnapshot {
  cronExpression: string;
  timezone: string;
  nextRunAt: string | null;
  lastTriggerAt: string | null;
  lastExecution: SchedulerRunResult | null;
}

export interface RunSchedulerResponse {
  success: boolean;
  message: string;
  result: SchedulerRunResult;
  status: SchedulerStatusSnapshot;
}
