export type DatePeriodUnit = 'day' | 'month' | 'year';

export interface DateOnlyParts {
  year: number;
  month: number;
  day: number;
}

export interface ZonedDateTimeParts extends DateOnlyParts {
  hour: number;
  minute: number;
  second: number;
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatParts(parts: DateOnlyParts): string {
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function requireDateOnly(value: string): DateOnlyParts {
  const parsed = parseDateOnly(value);
  if (!parsed) throw new Error(`无效日期: ${value}`);
  return parsed;
}

function assertSupportedYear(year: number): void {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new Error('日期超出支持范围');
  }
}

function getFormatter(timezone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timezone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  formatter.format(new Date(0));
  formatterCache.set(timezone, formatter);
  return formatter;
}

export function parseDateOnly(value: unknown): DateOnlyParts | null {
  if (typeof value !== 'string') return null;
  const match = DATE_ONLY_PATTERN.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1000 || year > 9999 || month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function normalizeDateOnly(value: unknown): string | null {
  const parsed = parseDateOnly(value);
  return parsed ? formatParts(parsed) : null;
}

export function getLocalDateOnly(now = new Date()): string {
  return formatParts({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  });
}

export function isValidTimeZone(timezone: unknown): timezone is string {
  if (typeof timezone !== 'string' || !timezone.trim()) return false;
  try {
    getFormatter(timezone.trim());
    return true;
  } catch {
    return false;
  }
}

export function getZonedDateTimeParts(now: Date, timezone: string): ZonedDateTimeParts {
  const parts = getFormatter(timezone).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

export function getDateOnlyInTimeZone(now = new Date(), timezone?: string): string {
  return timezone && isValidTimeZone(timezone)
    ? formatParts(getZonedDateTimeParts(now, timezone))
    : getLocalDateOnly(now);
}

export function compareDateOnly(left: string, right: string): number {
  const leftValue = formatParts(requireDateOnly(left));
  const rightValue = formatParts(requireDateOnly(right));
  if (leftValue === rightValue) return 0;
  return leftValue < rightValue ? -1 : 1;
}

export function differenceInCalendarDays(from: string, to: string): number {
  const start = requireDateOnly(from);
  const end = requireDateOnly(to);
  return Math.round((
    Date.UTC(end.year, end.month - 1, end.day)
    - Date.UTC(start.year, start.month - 1, start.day)
  ) / DAY_MS);
}

export function getDaysUntilDate(date: string, now = new Date(), timezone?: string): number {
  try {
    return differenceInCalendarDays(getDateOnlyInTimeZone(now, timezone), date);
  } catch {
    return Number.NaN;
  }
}

export function getHoursUntilDateEnd(date: string, now = new Date(), timezone?: string): number {
  const dayDifference = getDaysUntilDate(date, now, timezone);
  if (!Number.isFinite(dayDifference)) return Number.NaN;
  const localNow = timezone && isValidTimeZone(timezone)
    ? getZonedDateTimeParts(now, timezone)
    : {
        hour: now.getHours(),
        minute: now.getMinutes(),
        second: now.getSeconds(),
      };
  const elapsedHours = localNow.hour + localNow.minute / 60 + localNow.second / 3600;
  return dayDifference * 24 + (24 - elapsedHours);
}

export function addDateOnlyPeriod(
  date: string,
  amount: number,
  unit: DatePeriodUnit,
): string {
  const source = requireDateOnly(date);
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('日期周期必须是非负整数');
  if (amount === 0) return formatParts(source);

  if (unit === 'day') {
    const result = new Date(Date.UTC(source.year, source.month - 1, source.day + amount));
    const year = result.getUTCFullYear();
    assertSupportedYear(year);
    return formatParts({
      year,
      month: result.getUTCMonth() + 1,
      day: result.getUTCDate(),
    });
  }

  if (unit === 'month') {
    const targetIndex = source.year * 12 + source.month - 1 + amount;
    const year = Math.floor(targetIndex / 12);
    const month = (targetIndex % 12) + 1;
    assertSupportedYear(year);
    return formatParts({
      year,
      month,
      day: Math.min(source.day, daysInMonth(year, month)),
    });
  }

  const year = source.year + amount;
  assertSupportedYear(year);
  return formatParts({
    year,
    month: source.month,
    day: Math.min(source.day, daysInMonth(year, source.month)),
  });
}

export function advanceDateOnlyByPeriods(
  expiryDate: string,
  periodValue: number,
  periodUnit: DatePeriodUnit,
  periods: number,
): string {
  requireDateOnly(expiryDate);
  if (!Number.isSafeInteger(periodValue) || periodValue <= 0) {
    throw new Error('续费周期必须是正整数');
  }
  if (!Number.isSafeInteger(periods) || periods < 0) {
    throw new Error('续费次数必须是非负整数');
  }
  if (periods === 0) return expiryDate;
  if (periodUnit === 'day') {
    const amount = periodValue * periods;
    if (!Number.isSafeInteger(amount)) throw new Error('续费日期计算超出安全范围');
    return addDateOnlyPeriod(expiryDate, amount, periodUnit);
  }

  let nextExpiryDate = expiryDate;
  for (let index = 0; index < periods; index += 1) {
    nextExpiryDate = addDateOnlyPeriod(nextExpiryDate, periodValue, periodUnit);
  }
  return nextExpiryDate;
}
