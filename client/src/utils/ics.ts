import type { Subscription } from '../stores/subscription';
import { getSymbol } from './currency';

// ICS 文本转义：反斜杠/分号/逗号/换行
function escapeICS(text: string): string {
  return (text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// YYYY-MM-DD -> YYYYMMDD（全天事件）
function formatDate(dateStr: string): string {
  return (dateStr || '').replace(/-/g, '').slice(0, 8);
}

// 当前时间戳 -> YYYYMMDDTHHMMSSZ
function formatStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/**
 * 基于订阅列表生成 ICS 日历文本，每个订阅到期日作为一个全天事件
 */
export function generateICS(subscriptions: Subscription[]): string {
  const stamp = formatStamp(new Date());

  const events = subscriptions
    .filter((s) => s.expiryDate)
    .map((s) => {
      const uid = `subpilot-sub-${s.id}-${formatDate(s.expiryDate)}@subpilot`;
      const summary = `${s.name} 到期`;
      const price = s.price && s.price > 0
        ? `${getSymbol(s.currency || 'CNY')}${s.price.toFixed(2)}`
        : '免费';
      const descParts = [
        s.customType ? `类型: ${s.customType}` : '',
        s.price && s.price > 0 ? `费用: ${price}` : '',
        s.notes ? `备注: ${s.notes}` : '',
      ].filter(Boolean);
      const desc = descParts.map(escapeICS).join('\\n');

      return [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${formatDate(s.expiryDate)}`,
        `SUMMARY:${escapeICS(summary)}`,
        `DESCRIPTION:${desc}`,
        'END:VEVENT',
      ].join('\r\n');
    });

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SubPilot//订阅管理系统//CN',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}
