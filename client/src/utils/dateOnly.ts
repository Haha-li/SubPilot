export type DatePeriodUnit = 'day' | 'month' | 'year';

export interface DateOnlyParts {
  year: number;
  month: number;
  day: number;
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

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

export function differenceInCalendarDays(from: string, to: string): number {
  const start = requireDateOnly(from);
  const end = requireDateOnly(to);
  return Math.round((
    Date.UTC(end.year, end.month - 1, end.day)
    - Date.UTC(start.year, start.month - 1, start.day)
  ) / DAY_MS);
}

export function getDaysUntilDate(date: string, now = new Date()): number {
  try {
    return differenceInCalendarDays(getLocalDateOnly(now), date);
  } catch {
    return Number.NaN;
  }
}

export function getHoursUntilDateEnd(date: string, now = new Date()): number {
  const dayDifference = getDaysUntilDate(date, now);
  if (!Number.isFinite(dayDifference)) return Number.NaN;
  const elapsedHours = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
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
