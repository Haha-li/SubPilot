import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import {
  normalizeBillingUnit,
  normalizeCurrency,
  resolveSharedCost,
} from '../utils/sharedCost';
import { normalizeSubscriptionMethodInput } from './subscriptionMethod';
import { normalizeAvatarFields } from '../utils/avatar';
import {
  addDateOnlyPeriod,
  getDateOnlyInTimeZone,
  isDatePeriodUnit,
  isValidTimeZone,
  normalizeDateOnly,
} from '../utils/dateOnly';

const BACKUP_VERSION = 5;
const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
const MAX_IMPORT_ROWS = 10000;
const MAX_REPORTED_ERRORS = 100;
const BOOLEAN_TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const BOOLEAN_FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);
const REMINDER_UNITS = new Set(['day', 'hour']);
const RENEWAL_SOURCES = new Set(['manual', 'automatic']);
const METHOD_LOG_TYPES = new Set(['initial', 'manual_adjustment', 'manual_renewal', 'automatic_renewal']);

const SUBSCRIPTION_FIELDS = [
  'name', 'customType', 'category', 'startDate', 'expiryDate',
  'periodValue', 'periodUnit', 'reminderValue', 'reminderUnit',
  'isActive', 'autoRenew', 'useLunar', 'notes', 'iconUrl',
  'iconBackgroundColor', 'price', 'priceUnit', 'currency',
  'nonSelfPaid', 'nonSelfPaidCurrency', 'nonSelfPaidUnit',
  'isPinned', 'trialValue', 'trialUnit', 'createdAt', 'updatedAt',
] as const;

const FINGERPRINT_FIELDS = SUBSCRIPTION_FIELDS.filter(
  (field) => field !== 'createdAt' && field !== 'updatedAt',
);

type SubscriptionField = typeof SUBSCRIPTION_FIELDS[number];
type ImportRecord = Record<string, unknown>;

interface NormalizedSubscription {
  backupId: string | null;
  methodName: string | null;
  methodPayload: Record<string, any> | null;
  values: Record<SubscriptionField, any>;
  fingerprint: string;
}

interface ParsedImportData {
  subscriptions: unknown[];
  renewalLogs: unknown[];
  subscriptionMethods: unknown[];
  subscriptionMethodLogs: unknown[];
  version: number;
}

class ImportValidationError extends Error {}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function formatExportDate(now: Date, timezone: string): string {
  return getDateOnlyInTimeZone(now, timezone);
}

function neutralizeSpreadsheetFormula(value: string): string {
  return /^\s*[=+\-@]/.test(value) || /^[\t\r]/.test(value) ? `'${value}` : value;
}

function restoreSpreadsheetFormulaValue(value: string): string {
  return /^'(?:\s*[=+\-@]|[\t\r])/.test(value) ? value.slice(1) : value;
}

function escapeCSVValue(value: unknown): string {
  const safeValue = neutralizeSpreadsheetFormula(String(value ?? ''));
  return /[",\r\n]|^\s|\s$/.test(safeValue)
    ? `"${safeValue.replace(/"/g, '""')}"`
    : safeValue;
}

const CSV_FIELDS = [...SUBSCRIPTION_FIELDS, 'subscriptionMethodName'] as const;

function toCSV(items: ImportRecord[]): string {
  const header = CSV_FIELDS.join(',');
  const rows = items.map((item) => CSV_FIELDS
    .map((field) => escapeCSVValue(item[field]))
    .join(','));
  return [header, ...rows].join('\r\n');
}

function parseCSVRecords(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let quotedField = false;

  const pushField = () => {
    const value = quotedField ? field : field.trim();
    row.push(restoreSpreadsheetFormulaValue(value));
    field = '';
    quotedField = false;
  };
  const pushRow = () => {
    pushField();
    if (row.some((value) => value !== '')) records.push(row);
    row = [];
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (inQuotes) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      if (field.trim()) throw new ImportValidationError('CSV 引号位置无效');
      inQuotes = true;
      quotedField = true;
    } else if (character === ',') {
      pushField();
    } else if (character === '\n') {
      pushRow();
    } else if (character === '\r') {
      if (source[index + 1] === '\n') index += 1;
      pushRow();
    } else {
      field += character;
    }
  }

  if (inQuotes) throw new ImportValidationError('CSV 存在未闭合的引号');
  if (field || row.length > 0) pushRow();
  return records;
}

function parseCSV(text: string): ImportRecord[] {
  const records = parseCSVRecords(text);
  if (records.length < 2) return [];
  const headers = records[0].map((header) => header.trim());
  if (headers.some((header) => !header)) {
    throw new ImportValidationError('CSV 表头不能为空');
  }
  if (new Set(headers).size !== headers.length) {
    throw new ImportValidationError('CSV 表头包含重复字段');
  }
  if (!headers.includes('name') || !headers.includes('expiryDate')) {
    throw new ImportValidationError('CSV 必须包含 name 和 expiryDate 字段');
  }

  return records.slice(1).map((values) => {
    const row: ImportRecord = {};
    headers.forEach((header, index) => { row[header] = values[index] ?? ''; });
    return row;
  });
}

function parseJSON(text: string): ParsedImportData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw new ImportValidationError('JSON 内容无法解析');
  }

  if (Array.isArray(parsed)) {
    return { subscriptions: parsed, renewalLogs: [], subscriptionMethods: [], subscriptionMethodLogs: [], version: 1 };
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new ImportValidationError('JSON 格式必须是订阅数组或备份对象');
  }

  const backup = parsed as Record<string, unknown>;
  if (backup.format !== undefined && backup.format !== 'subpilot-backup') {
    throw new ImportValidationError('不是有效的 SubPilot 备份文件');
  }
  const version = Number(backup.version ?? 1);
  if (!Number.isInteger(version) || version < 1 || version > BACKUP_VERSION) {
    throw new ImportValidationError(`不支持的备份版本: ${String(backup.version)}`);
  }
  if (!Array.isArray(backup.subscriptions)) {
    throw new ImportValidationError('备份对象缺少 subscriptions 数组');
  }
  if (backup.renewalLogs !== undefined && !Array.isArray(backup.renewalLogs)) {
    throw new ImportValidationError('renewalLogs 必须是数组');
  }
  if (backup.subscriptionMethods !== undefined && !Array.isArray(backup.subscriptionMethods)) {
    throw new ImportValidationError('subscriptionMethods 必须是数组');
  }
  if (backup.subscriptionMethodLogs !== undefined && !Array.isArray(backup.subscriptionMethodLogs)) {
    throw new ImportValidationError('subscriptionMethodLogs 必须是数组');
  }
  return {
    subscriptions: backup.subscriptions,
    renewalLogs: (backup.renewalLogs as unknown[] | undefined) || [],
    subscriptionMethods: (backup.subscriptionMethods as unknown[] | undefined) || [],
    subscriptionMethodLogs: (backup.subscriptionMethodLogs as unknown[] | undefined) || [],
    version,
  };
}

function normalizeString(
  value: unknown,
  field: string,
  options: { required?: boolean; maxLength?: number; fallback?: string; trim?: boolean } = {},
): string {
  const fallback = options.fallback ?? '';
  const raw = value === undefined || value === null ? fallback : String(value);
  const result = options.trim === false ? raw : raw.trim();
  if (options.required && !result) throw new ImportValidationError(`${field} 不能为空`);
  if (options.maxLength && result.length > options.maxLength) {
    throw new ImportValidationError(`${field} 不能超过 ${options.maxLength} 个字符`);
  }
  return result;
}

function normalizeBoolean(value: unknown, fallback: boolean, field: string): number {
  if (value === undefined || value === null || value === '') return fallback ? 1 : 0;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number' && (value === 0 || value === 1)) return value;
  const normalized = String(value).trim().toLowerCase();
  if (BOOLEAN_TRUE_VALUES.has(normalized)) return 1;
  if (BOOLEAN_FALSE_VALUES.has(normalized)) return 0;
  throw new ImportValidationError(`${field} 必须是 true/false 或 1/0`);
}

function normalizeInteger(
  value: unknown,
  field: string,
  fallback: number,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
): number {
  if (value === undefined || value === null || value === '') return fallback;
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new ImportValidationError(`${field} 必须是 ${min}-${max} 范围内的整数`);
  }
  return number;
}

function normalizeAmount(value: unknown, field: string, fallback = 0): number {
  if (value === undefined || value === null || value === '') return fallback;
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new ImportValidationError(`${field} 必须是非负数`);
  }
  return number;
}

function normalizeOptionalAmount(value: unknown, field: string): number | null {
  if (value === undefined || value === null || typeof value === 'string' && !value.trim()) return null;
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new ImportValidationError(`${field} 必须是非负数`);
  }
  return normalizeAmount(value, field);
}

function normalizeFiniteAmount(value: unknown, field: string): number {
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new ImportValidationError(`${field} 必须是数字`);
  }
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) throw new ImportValidationError(`${field} 必须是数字`);
  return number;
}

function normalizeTimestamp(value: unknown, fallback: string, field: string): string {
  if (value === undefined || value === null || value === '') return fallback;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new ImportValidationError(`${field} 不是有效时间`);
  return date.toISOString();
}

function normalizeOptionalDate(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  const date = normalizeDateOnly(value);
  if (!date) throw new ImportValidationError(`${field} 必须是有效的 YYYY-MM-DD 日期`);
  return date;
}

function normalizeRequiredDate(value: unknown, field: string): string {
  const date = normalizeDateOnly(value);
  if (!date) throw new ImportValidationError(`${field} 必须是有效的 YYYY-MM-DD 日期`);
  return date;
}

function normalizeCurrencyStrict(value: unknown, fallback: string, field: string): string {
  if (value === undefined || value === null || value === '') return normalizeCurrency(fallback);
  const currency = String(value).trim();
  if (!/^[a-z]{3}$/i.test(currency)) throw new ImportValidationError(`${field} 必须是 3 位币种代码`);
  return currency.toUpperCase();
}

function normalizeBillingUnitStrict(value: unknown, fallback: string, field: string): string {
  if (value === undefined || value === null || value === '') return normalizeBillingUnit(fallback);
  const unit = String(value).trim().toLowerCase();
  if (!isDatePeriodUnit(unit)) throw new ImportValidationError(`${field} 必须是 day、month 或 year`);
  return unit;
}

function normalizeSubscriptionRecord(
  value: unknown,
  fallbackNow: string,
): NormalizedSubscription {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ImportValidationError('订阅记录必须是对象');
  }
  const row = value as ImportRecord;
  const name = normalizeString(row.name, 'name', { required: true, maxLength: 200 });
  const startDate = normalizeOptionalDate(row.startDate, 'startDate');
  const expiryDate = normalizeRequiredDate(row.expiryDate, 'expiryDate');
  if (startDate && startDate > expiryDate) {
    throw new ImportValidationError('startDate 不能晚于 expiryDate');
  }
  const periodValue = normalizeInteger(row.periodValue, 'periodValue', 1, 1, 100000);
  const periodUnit = normalizeBillingUnitStrict(row.periodUnit, 'month', 'periodUnit');
  try {
    addDateOnlyPeriod(expiryDate, periodValue, periodUnit as 'day' | 'month' | 'year');
  } catch {
    throw new ImportValidationError('订阅周期导致续费日期超出支持范围');
  }
  const reminderValue = normalizeInteger(row.reminderValue, 'reminderValue', 7, 0, 100000);
  const reminderUnit = normalizeString(row.reminderUnit, 'reminderUnit', { fallback: 'day' }).toLowerCase();
  if (!REMINDER_UNITS.has(reminderUnit)) {
    throw new ImportValidationError('reminderUnit 必须是 day 或 hour');
  }

  const category = normalizeString(row.category, 'category', { maxLength: 500 });
  const priceUnit = normalizeBillingUnitStrict(row.priceUnit, 'month', 'priceUnit');
  const currency = normalizeCurrencyStrict(row.currency, 'CNY', 'currency');
  const nonSelfPaidCurrency = normalizeCurrencyStrict(
    row.nonSelfPaidCurrency,
    currency,
    'nonSelfPaidCurrency',
  );
  const nonSelfPaidUnit = normalizeBillingUnitStrict(
    row.nonSelfPaidUnit,
    priceUnit,
    'nonSelfPaidUnit',
  );
  const sharedCost = resolveSharedCost({
    category,
    nonSelfPaid: normalizeAmount(row.nonSelfPaid, 'nonSelfPaid'),
    nonSelfPaidCurrency,
    nonSelfPaidUnit,
    fallbackCurrency: currency,
    fallbackUnit: priceUnit,
  });
  const avatar = normalizeAvatarFields({
    iconUrl: row.iconUrl,
    backgroundColor: row.iconBackgroundColor,
  });
  if (!avatar.success) throw new ImportValidationError(avatar.message);

  const hasTrialValue = row.trialValue !== undefined && row.trialValue !== null && row.trialValue !== '';
  const hasTrialUnit = row.trialUnit !== undefined && row.trialUnit !== null && row.trialUnit !== '';
  if (hasTrialValue !== hasTrialUnit) {
    throw new ImportValidationError('trialValue 和 trialUnit 必须同时提供');
  }
  const trialValue = hasTrialValue
    ? normalizeInteger(row.trialValue, 'trialValue', 1, 1, 100000)
    : null;
  const trialUnit = hasTrialUnit
    ? normalizeBillingUnitStrict(row.trialUnit, 'day', 'trialUnit')
    : null;

  const createdAt = normalizeTimestamp(row.createdAt, fallbackNow, 'createdAt');
  const updatedAt = normalizeTimestamp(row.updatedAt, createdAt, 'updatedAt');
  const values: Record<SubscriptionField, any> = {
    name,
    customType: normalizeString(row.customType, 'customType', { maxLength: 100 }),
    category,
    startDate,
    expiryDate,
    periodValue,
    periodUnit,
    reminderValue,
    reminderUnit,
    isActive: normalizeBoolean(row.isActive, true, 'isActive'),
    autoRenew: normalizeBoolean(row.autoRenew, true, 'autoRenew'),
    useLunar: normalizeBoolean(row.useLunar, false, 'useLunar'),
    notes: normalizeString(row.notes, 'notes', { maxLength: 10000, trim: false }),
    iconUrl: avatar.value.iconUrl,
    iconBackgroundColor: avatar.value.backgroundColor,
    price: normalizeAmount(row.price, 'price'),
    priceUnit,
    currency,
    nonSelfPaid: sharedCost.nonSelfPaid,
    nonSelfPaidCurrency: sharedCost.nonSelfPaidCurrency,
    nonSelfPaidUnit: sharedCost.nonSelfPaidUnit,
    isPinned: normalizeBoolean(row.isPinned, false, 'isPinned'),
    trialValue,
    trialUnit,
    createdAt,
    updatedAt,
  };
  const backupIdValue = row.backupId ?? row.id;
  const backupId = backupIdValue === undefined || backupIdValue === null || backupIdValue === ''
    ? null
    : String(backupIdValue);
  const explicitMethodName = normalizeString(row.subscriptionMethodName, 'subscriptionMethodName', { maxLength: 100 });
  const legacyChannel = normalizeString(row.subscriptionChannel, 'subscriptionChannel', { maxLength: 100 });
  const legacyPayment = normalizeString(row.paymentMethod, 'paymentMethod', { maxLength: 100 });
  const legacyAccount = normalizeString(row.subscriptionAccount, 'subscriptionAccount', { maxLength: 320 });
  const legacyReference = normalizeString(row.paymentReference, 'paymentReference', { maxLength: 200 });
  const legacyBalance = normalizeOptionalAmount(row.accountBalance, 'accountBalance');
  let methodName = explicitMethodName || null;
  let methodPayload: Record<string, any> | null = null;
  if (!explicitMethodName && (legacyChannel || legacyPayment || legacyAccount || legacyReference || legacyBalance !== null)) {
    const legacyMethod = normalizeSubscriptionMethodInput({
      name: legacyReference || legacyAccount || legacyChannel || legacyPayment,
      channel: legacyChannel,
      paymentMethod: legacyPayment,
      account: legacyAccount,
      balance: legacyBalance,
      balanceCurrency: row.balanceCurrency || currency,
      paymentReference: legacyReference,
    });
    if (!legacyMethod.success) throw new ImportValidationError(legacyMethod.message);
    methodName = legacyMethod.value.name;
    methodPayload = legacyMethod.value;
  }
  return {
    backupId,
    methodName,
    methodPayload,
    values,
    fingerprint: JSON.stringify([
      ...FINGERPRINT_FIELDS.map((field) => values[field] ?? null),
      methodName,
    ]),
  };
}

function fingerprintSubscription(value: ImportRecord): string {
  return JSON.stringify(FINGERPRINT_FIELDS.map((field) => value[field] ?? null));
}

function normalizeRenewalLog(
  value: unknown,
  subscriptionId: number,
  fallbackNow: string,
): ImportRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ImportValidationError('续费记录必须是对象');
  }
  const row = value as ImportRecord;
  const source = normalizeString(row.source, 'source', { fallback: 'manual' }).toLowerCase();
  if (!RENEWAL_SOURCES.has(source)) throw new ImportValidationError('续费记录 source 无效');
  const periodValue = normalizeInteger(row.periodValue, 'periodValue', 1, 1, 100000);
  const periodUnit = normalizeBillingUnitStrict(row.periodUnit, 'month', 'periodUnit');
  const previousExpiryDate = normalizeOptionalDate(row.previousExpiryDate, 'previousExpiryDate');
  const newExpiryDate = normalizeOptionalDate(row.newExpiryDate, 'newExpiryDate');
  return {
    subscriptionId,
    renewedAt: normalizeTimestamp(row.renewedAt, fallbackNow, 'renewedAt'),
    price: normalizeAmount(row.price, 'price'),
    currency: normalizeCurrencyStrict(row.currency, 'CNY', 'currency'),
    periodValue,
    periodUnit,
    notes: normalizeString(row.notes, 'notes', { maxLength: 10000, trim: false }),
    source,
    previousExpiryDate,
    newExpiryDate,
    periodsAdvanced: normalizeInteger(row.periodsAdvanced, 'periodsAdvanced', 1, 1, 100000),
  };
}

function fingerprintRenewalLog(value: ImportRecord): string {
  return JSON.stringify([
    value.subscriptionId,
    value.renewedAt,
    value.price ?? 0,
    value.currency || 'CNY',
    value.periodValue ?? 1,
    value.periodUnit || 'month',
    value.notes || '',
    value.source || 'manual',
    value.previousExpiryDate || null,
    value.newExpiryDate || null,
    value.periodsAdvanced ?? 1,
  ]);
}

function normalizeMethodLog(
  value: unknown,
  subscriptionMethodId: number,
  subscriptionId: number | null,
  fallbackNow: string,
): ImportRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ImportValidationError('余额流水必须是对象');
  }
  const row = value as ImportRecord;
  const type = normalizeString(row.type, 'type', { required: true });
  if (!METHOD_LOG_TYPES.has(type)) throw new ImportValidationError('余额流水 type 无效');
  return {
    subscriptionMethodId,
    subscriptionId,
    type,
    amount: normalizeFiniteAmount(row.amount, 'amount'),
    beforeBalance: normalizeFiniteAmount(row.beforeBalance, 'beforeBalance'),
    afterBalance: normalizeFiniteAmount(row.afterBalance, 'afterBalance'),
    note: normalizeString(row.note, 'note', { maxLength: 500, trim: false }),
    createdAt: normalizeTimestamp(row.createdAt, fallbackNow, 'createdAt'),
  };
}

function fingerprintMethodLog(value: ImportRecord): string {
  return JSON.stringify([
    value.subscriptionMethodId,
    value.subscriptionId || null,
    value.type,
    value.amount,
    value.beforeBalance,
    value.afterBalance,
    value.note || '',
    value.createdAt,
  ]);
}

function createBackupSubscription(row: ImportRecord): ImportRecord {
  const item: ImportRecord = { backupId: row.id };
  for (const field of SUBSCRIPTION_FIELDS) item[field] = row[field] ?? null;
  return item;
}

function createBackupRenewalLog(row: ImportRecord): ImportRecord {
  return {
    subscriptionBackupId: row.subscriptionId,
    renewedAt: row.renewedAt,
    price: row.price ?? 0,
    currency: row.currency || 'CNY',
    periodValue: row.periodValue ?? 1,
    periodUnit: row.periodUnit || 'month',
    notes: row.notes || '',
    source: row.source || 'manual',
    previousExpiryDate: row.previousExpiryDate || null,
    newExpiryDate: row.newExpiryDate || null,
    periodsAdvanced: row.periodsAdvanced ?? 1,
  };
}

function addError(errors: string[], message: string): void {
  if (errors.length < MAX_REPORTED_ERRORS) errors.push(message);
}

async function rollbackSubscriptions(ids: number[]): Promise<void> {
  for (const id of [...ids].reverse()) {
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, id));
  }
}

export async function exportSubscriptionsHandler(query: any) {
  try {
    const format = String(query?.format || 'json').toLowerCase();
    if (format !== 'json' && format !== 'csv') {
      return { status: 400, body: { success: false, message: '仅支持 json 或 csv 导出格式' } };
    }
    const subscriptions = await db.select().from(schema.subscriptions);
    const methods = await db.select().from(schema.subscriptionMethods);
    const methodNameById = new Map<number, string>(methods.map((item: any) => [item.id, item.name]));
    const exportSubscriptions = subscriptions.map((row: any) => ({
      ...row,
      subscriptionMethodName: methodNameById.get(row.subscriptionMethodId) || '',
    }));
    const configs = await db.select().from(schema.config);
    const configuredTimezone = configs.find((item: any) => item.key === 'timezone')?.value;
    const timezone = isValidTimeZone(configuredTimezone) ? configuredTimezone : 'Asia/Shanghai';
    const date = formatExportDate(new Date(), timezone);

    if (format === 'csv') {
      return {
        status: 200,
        download: true,
        contentType: 'text/csv; charset=utf-8',
        filename: `subscriptions_${date}.csv`,
        body: `\uFEFF${toCSV(exportSubscriptions)}`,
      };
    }

    const renewalLogs = await db.select().from(schema.renewalLogs);
    const methodLogs = await db.select().from(schema.subscriptionMethodLogs);
    const backup = {
      format: 'subpilot-backup',
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      subscriptionMethods: methods.map((row: any) => ({
        backupId: row.id,
        name: row.name,
        channel: row.channel || '',
        paymentMethod: row.paymentMethod || '',
        account: row.account || '',
        balance: row.balance ?? null,
        balanceCurrency: row.balanceCurrency || 'CNY',
        paymentReference: row.paymentReference || '',
      })),
      subscriptions: exportSubscriptions.map((row: any) => ({
        ...createBackupSubscription(row),
        subscriptionMethodName: row.subscriptionMethodName || null,
      })),
      renewalLogs: renewalLogs.map(createBackupRenewalLog),
      subscriptionMethodLogs: methodLogs.map((row: any) => ({
        subscriptionMethodName: methodNameById.get(row.subscriptionMethodId) || '',
        subscriptionBackupId: row.subscriptionId,
        type: row.type,
        amount: row.amount,
        beforeBalance: row.beforeBalance,
        afterBalance: row.afterBalance,
        note: row.note || '',
        createdAt: row.createdAt,
      })),
    };
    return {
      status: 200,
      download: true,
      contentType: 'application/json; charset=utf-8',
      filename: `subscriptions_${date}.json`,
      body: JSON.stringify(backup, null, 2),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 500, body: { success: false, message } };
  }
}

export async function importSubscriptionsHandler(body: any) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { status: 400, body: { success: false, message: '无效的导入请求' } };
  }
  const format = String(body.format || '').toLowerCase();
  const data = body.data;
  if (format !== 'json' && format !== 'csv') {
    return { status: 400, body: { success: false, message: '仅支持 json 或 csv 导入格式' } };
  }
  if (typeof data !== 'string' || !data.trim()) {
    return { status: 400, body: { success: false, message: '请提供导入数据' } };
  }
  if (utf8ByteLength(data) > MAX_IMPORT_BYTES) {
    return { status: 413, body: { success: false, message: '导入文件不能超过 10 MB' } };
  }

  let parsed: ParsedImportData;
  try {
    parsed = format === 'csv'
      ? { subscriptions: parseCSV(data), renewalLogs: [], subscriptionMethods: [], subscriptionMethodLogs: [], version: BACKUP_VERSION }
      : parseJSON(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 400, body: { success: false, message } };
  }
  if (parsed.subscriptions.length === 0) {
    return { status: 400, body: { success: false, message: '导入文件中没有订阅记录' } };
  }
  if (parsed.subscriptions.length > MAX_IMPORT_ROWS) {
    return { status: 413, body: { success: false, message: `单次最多导入 ${MAX_IMPORT_ROWS} 条订阅` } };
  }
  if (parsed.renewalLogs.length > MAX_IMPORT_ROWS * 10) {
    return { status: 413, body: { success: false, message: '续费历史记录数量过多' } };
  }
  if (parsed.subscriptionMethodLogs.length > MAX_IMPORT_ROWS * 20) {
    return { status: 413, body: { success: false, message: '余额流水记录数量过多' } };
  }

  const now = new Date().toISOString();
  const errors: string[] = [];
  const normalizedRows: NormalizedSubscription[] = [];
  parsed.subscriptions.forEach((row, index) => {
    try {
      normalizedRows.push(normalizeSubscriptionRecord(row, now));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addError(errors, `第 ${index + 1} 条: ${message}`);
    }
  });

  try {
    const findOrCreateMethod = async (payload: Record<string, any>) => {
      const methods = await db.select().from(schema.subscriptionMethods);
      const existing = methods.find((item: any) => (
        String(item.name).trim().toLocaleLowerCase() === payload.name.trim().toLocaleLowerCase()
      ));
      if (existing) return existing.id as number;
      await db.insert(schema.subscriptionMethods).values({
        ...payload,
        createdAt: now,
        updatedAt: now,
      });
      const [created] = await db.select().from(schema.subscriptionMethods)
        .orderBy(schema.subscriptionMethods.id, 'desc')
        .limit(1);
      if (!created?.id) throw new Error('无法确认订阅方式 ID');
      return created.id as number;
    };
    for (let index = 0; index < parsed.subscriptionMethods.length; index += 1) {
      const normalizedMethod = normalizeSubscriptionMethodInput(parsed.subscriptionMethods[index]);
      if (!normalizedMethod.success) {
        addError(errors, `订阅方式 ${index + 1}: ${normalizedMethod.message}`);
        continue;
      }
      await findOrCreateMethod(normalizedMethod.value);
    }
    const linkedMethods = await db.select().from(schema.subscriptionMethods);
    const methodNameById = new Map<number, string>(linkedMethods.map((item: any) => [item.id, item.name]));
    const existingRows = await db.select().from(schema.subscriptions);
  const existingByFingerprint = new Map<string, number>();
  for (const row of existingRows as ImportRecord[]) {
    try {
      existingByFingerprint.set(normalizeSubscriptionRecord({
        ...row,
        subscriptionMethodName: methodNameById.get(Number(row.subscriptionMethodId)) || '',
      }, now).fingerprint, Number(row.id));
    } catch {
      existingByFingerprint.set(fingerprintSubscription(row), Number(row.id));
    }
  }
  const rowsToInsert: NormalizedSubscription[] = [];
  const pendingFingerprints = new Set<string>();
  const backupIdMap = new Map<string, number>();
  let skipped = 0;
  for (const row of normalizedRows) {
    const existingId = existingByFingerprint.get(row.fingerprint);
    if (existingId) {
      skipped += 1;
      if (row.backupId) backupIdMap.set(row.backupId, existingId);
      continue;
    }
    if (pendingFingerprints.has(row.fingerprint)) {
      skipped += 1;
      continue;
    }
    pendingFingerprints.add(row.fingerprint);
    rowsToInsert.push(row);
  }

  const insertedIds: number[] = [];
  let renewalLogsImported = 0;
  let renewalLogsSkipped = 0;
  let methodLogsImported = 0;
  let methodLogsSkipped = 0;
  try {
    for (const row of rowsToInsert) {
      const subscriptionMethodId = row.methodPayload
        ? await findOrCreateMethod(row.methodPayload)
        : row.methodName
          ? await findOrCreateMethod({
            name: row.methodName,
            channel: '',
            paymentMethod: '',
            account: '',
            balance: null,
            balanceCurrency: 'CNY',
            paymentReference: '',
          })
          : null;
      await db.insert(schema.subscriptions).values({ ...row.values, subscriptionMethodId });
      const [created] = await db.select().from(schema.subscriptions)
        .orderBy(schema.subscriptions.id, 'desc')
        .limit(1);
      if (!created?.id) throw new Error('无法确认新导入订阅的 ID');
      insertedIds.push(created.id);
      if (row.backupId) backupIdMap.set(row.backupId, created.id);
    }

    const existingRenewalLogs = parsed.renewalLogs.length > 0
      ? await db.select().from(schema.renewalLogs)
      : [];
    const renewalFingerprints = new Set(
      (existingRenewalLogs as ImportRecord[]).map(fingerprintRenewalLog),
    );
    for (let index = 0; index < parsed.renewalLogs.length; index += 1) {
      const rawLog = parsed.renewalLogs[index];
      if (!rawLog || typeof rawLog !== 'object' || Array.isArray(rawLog)) {
        addError(errors, `续费记录 ${index + 1}: 记录必须是对象`);
        continue;
      }
      const backupIdValue = (rawLog as ImportRecord).subscriptionBackupId
        ?? (rawLog as ImportRecord).subscriptionId;
      const subscriptionId = backupIdMap.get(String(backupIdValue ?? ''));
      if (!subscriptionId) {
        renewalLogsSkipped += 1;
        continue;
      }
      try {
        const log = normalizeRenewalLog(rawLog, subscriptionId, now);
        const fingerprint = fingerprintRenewalLog(log);
        if (renewalFingerprints.has(fingerprint)) {
          renewalLogsSkipped += 1;
          continue;
        }
        await db.insert(schema.renewalLogs).values(log);
        renewalFingerprints.add(fingerprint);
        renewalLogsImported += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        addError(errors, `续费记录 ${index + 1}: ${message}`);
      }
    }

    const existingMethodLogs = parsed.subscriptionMethodLogs.length > 0
      ? await db.select().from(schema.subscriptionMethodLogs)
      : [];
    const methodLogFingerprints = new Set(
      (existingMethodLogs as ImportRecord[]).map(fingerprintMethodLog),
    );
    for (let index = 0; index < parsed.subscriptionMethodLogs.length; index += 1) {
      const rawLog = parsed.subscriptionMethodLogs[index];
      if (!rawLog || typeof rawLog !== 'object' || Array.isArray(rawLog)) {
        addError(errors, `余额流水 ${index + 1}: 记录必须是对象`);
        continue;
      }
      try {
        const methodName = normalizeString(
          (rawLog as ImportRecord).subscriptionMethodName,
          'subscriptionMethodName',
          { required: true, maxLength: 100 },
        );
        const subscriptionMethodId = await findOrCreateMethod({
          name: methodName,
          channel: '',
          paymentMethod: '',
          account: '',
          balance: null,
          balanceCurrency: 'CNY',
          paymentReference: '',
        });
        const backupIdValue = (rawLog as ImportRecord).subscriptionBackupId
          ?? (rawLog as ImportRecord).subscriptionId;
        const subscriptionId = backupIdValue === undefined || backupIdValue === null
          ? null
          : backupIdMap.get(String(backupIdValue)) || null;
        const log = normalizeMethodLog(rawLog, subscriptionMethodId, subscriptionId, now);
        const fingerprint = fingerprintMethodLog(log);
        if (methodLogFingerprints.has(fingerprint)) {
          methodLogsSkipped += 1;
          continue;
        }
        await db.insert(schema.subscriptionMethodLogs).values(log);
        methodLogFingerprints.add(fingerprint);
        methodLogsImported += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        addError(errors, `余额流水 ${index + 1}: ${message}`);
      }
    }
  } catch (error) {
    try {
      await rollbackSubscriptions(insertedIds);
    } catch (rollbackError) {
      console.error('Import rollback failed:', rollbackError);
    }
    const message = error instanceof Error ? error.message : String(error);
    return { status: 500, body: { success: false, message: `导入失败，已回滚: ${message}` } };
  }

  const imported = insertedIds.length;
  if (imported === 0 && errors.length > 0 && skipped === 0) {
    return {
      status: 400,
      body: {
        success: false,
        imported,
        skipped,
        total: parsed.subscriptions.length,
        errors,
        message: '没有可导入的有效订阅',
      },
    };
  }
    return {
      status: 200,
      body: {
        success: true,
        version: parsed.version,
        imported,
        skipped,
        renewalLogsImported,
        renewalLogsSkipped,
        methodLogsImported,
        methodLogsSkipped,
        total: parsed.subscriptions.length,
        errors: errors.length > 0 ? errors : undefined,
        errorsTruncated: errors.length >= MAX_REPORTED_ERRORS || undefined,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 500, body: { success: false, message: `导入失败: ${message}` } };
  }
}
