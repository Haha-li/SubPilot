const DEFAULT_NOTIFY_CRON = '0 8 * * *';
const LEGACY_UNUSED_CRON = '0 0 * * *';

interface CronFieldRule {
  name: string;
  min: number;
  max: number;
  normalize?: (value: number) => number;
}

interface ParsedCron {
  values: Set<number>[];
  dayOfMonthWildcard: boolean;
  dayOfWeekWildcard: boolean;
}

interface ZonedDateParts {
  minute: number;
  hour: number;
  day: number;
  month: number;
  weekday: number;
}

const FIELD_RULES: CronFieldRule[] = [
  { name: '分钟', min: 0, max: 59 },
  { name: '小时', min: 0, max: 23 },
  { name: '日期', min: 1, max: 31 },
  { name: '月份', min: 1, max: 12 },
  { name: '星期', min: 1, max: 7, normalize: (value) => value - 1 },
];

function parseNumber(raw: string, rule: CronFieldRule): number {
  if (!/^\d+$/.test(raw)) throw new Error(`${rule.name}包含无效值`);
  const value = Number(raw);
  if (value < rule.min || value > rule.max) {
    throw new Error(`${rule.name}必须在 ${rule.min}-${rule.max} 之间`);
  }
  return value;
}

function parseRange(raw: string, rule: CronFieldRule): [number, number] {
  if (raw === '*') return [rule.min, rule.max];
  if (!raw.includes('-')) {
    const value = parseNumber(raw, rule);
    return [value, value];
  }
  const parts = raw.split('-');
  if (parts.length !== 2) throw new Error(`${rule.name}范围格式无效`);
  const start = parseNumber(parts[0], rule);
  const end = parseNumber(parts[1], rule);
  if (start > end) throw new Error(`${rule.name}范围起始值不能大于结束值`);
  return [start, end];
}

function expandToken(token: string, rule: CronFieldRule): number[] {
  const stepParts = token.split('/');
  if (stepParts.length > 2) throw new Error(`${rule.name}步进格式无效`);
  const step = stepParts[1] === undefined ? 1 : Number(stepParts[1]);
  if (!Number.isInteger(step) || step <= 0) throw new Error(`${rule.name}的步进值必须大于 0`);
  const [start, parsedEnd] = parseRange(stepParts[0], rule);
  const hasOpenEndedStep = stepParts[1] !== undefined && !/[*-]/.test(stepParts[0]);
  const end = hasOpenEndedStep ? rule.max : parsedEnd;
  const values: number[] = [];
  for (let value = start; value <= end; value += step) {
    values.push(rule.normalize ? rule.normalize(value) : value);
  }
  return values;
}

function parseField(raw: string, rule: CronFieldRule): Set<number> {
  if (!raw) throw new Error(`${rule.name}不能为空`);
  const values = raw.split(',').flatMap((token) => expandToken(token, rule));
  return new Set(values);
}

function parseCronExpression(expression: string): ParsedCron {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) throw new Error('Cron 表达式必须包含 5 段');
  return {
    values: fields.map((field, index) => parseField(field, FIELD_RULES[index])),
    dayOfMonthWildcard: fields[2] === '*',
    dayOfWeekWildcard: fields[4] === '*',
  };
}

function getZonedDateParts(timezone: string, now: Date): ZonedDateParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  return {
    minute: Number(map.minute),
    hour: Number(map.hour),
    day,
    month,
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  };
}

function matchesDay(parsed: ParsedCron, parts: ZonedDateParts): boolean {
  const dayMatch = parsed.values[2].has(parts.day);
  const weekdayMatch = parsed.values[4].has(parts.weekday);
  if (parsed.dayOfMonthWildcard) return weekdayMatch;
  if (parsed.dayOfWeekWildcard) return dayMatch;
  return dayMatch || weekdayMatch;
}

export function validateCronExpression(expression: string): string | null {
  try {
    parseCronExpression(expression);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Cron 表达式无效';
  }
}

export function matchesCronExpression(expression: string, timezone: string, now = new Date()): boolean {
  try {
    const parsed = parseCronExpression(expression);
    const parts = getZonedDateParts(timezone, now);
    return parsed.values[0].has(parts.minute)
      && parsed.values[1].has(parts.hour)
      && parsed.values[3].has(parts.month)
      && matchesDay(parsed, parts);
  } catch {
    return false;
  }
}

function legacyHoursToCron(rawHours: string): string {
  const hours = rawHours.split(/[,\s]+/)
    .map(Number)
    .filter((hour) => Number.isInteger(hour) && hour >= 0 && hour <= 23);
  const uniqueHours = [...new Set(hours)].sort((a, b) => a - b);
  return uniqueHours.length > 0 ? `0 ${uniqueHours.join(',')} * * *` : DEFAULT_NOTIFY_CRON;
}

export function resolveNotifyCron(config: Record<string, string>): string {
  const configured = config.cron_expression?.trim();
  if (config.notify_schedule_version === '2') return configured || DEFAULT_NOTIFY_CRON;
  const legacyHours = config.notify_hours?.trim();
  if (legacyHours) return legacyHoursToCron(legacyHours);
  if (configured && configured !== LEGACY_UNUSED_CRON) return configured;
  return DEFAULT_NOTIFY_CRON;
}
