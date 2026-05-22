import { db, schema } from '../db';

function toCSV(items: any[]): string {
  if (items.length === 0) return '';
  const fields = ['name', 'customType', 'category', 'startDate', 'expiryDate', 'periodValue', 'periodUnit', 'reminderValue', 'reminderUnit', 'isActive', 'autoRenew', 'useLunar', 'notes', 'price', 'priceUnit', 'currency', 'isPinned', 'trialValue', 'trialUnit'];
  const header = fields.join(',');
  const rows = items.map(item =>
    fields.map(f => {
      const val = item[f] ?? '';
      const str = String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(',')
  );
  return [header, ...rows].join('\n');
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = parseCSVLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return obj;
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

export async function exportSubscriptionsHandler(query: any) {
  try {
    const format = (query.format || 'json').toLowerCase();
    const results = await db.select().from(schema.subscriptions);

    // Strip internal fields
    const items = results.map((r: any) => {
      const { id, createdAt, updatedAt, ...rest } = r;
      return rest;
    });

    if (format === 'csv') {
      return {
        status: 200,
        download: true,
        contentType: 'text/csv; charset=utf-8',
        filename: `subscriptions_${new Date().toISOString().slice(0, 10)}.csv`,
        body: '﻿' + toCSV(items),
      };
    }

    return {
      status: 200,
      download: true,
      contentType: 'application/json',
      filename: `subscriptions_${new Date().toISOString().slice(0, 10)}.json`,
      body: JSON.stringify(items, null, 2),
    };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}

export async function importSubscriptionsHandler(body: any) {
  try {
    const { format, data } = body;
    if (!data || typeof data !== 'string') {
      return { status: 400, body: { success: false, message: '请提供导入数据' } };
    }

    let rows: Record<string, string>[];
    if (format === 'csv') {
      rows = parseCSV(data);
    } else {
      rows = JSON.parse(data);
      if (!Array.isArray(rows)) {
        return { status: 400, body: { success: false, message: 'JSON 格式必须是数组' } };
      }
    }

    let imported = 0;
    const errors: string[] = [];

    for (const row of rows) {
      if (!row.name || !row.expiryDate) {
        errors.push(`跳过: ${row.name || '(无名称)'} - 缺少必填字段`);
        continue;
      }

      const now = new Date().toISOString();
      await db.insert(schema.subscriptions).values({
        name: row.name,
        customType: row.customType || '',
        category: row.category || '',
        startDate: row.startDate || null,
        expiryDate: row.expiryDate,
        periodValue: Number(row.periodValue) || 1,
        periodUnit: row.periodUnit || 'month',
        reminderValue: Number(row.reminderValue) || 7,
        reminderUnit: row.reminderUnit || 'day',
        isActive: row.isActive !== undefined ? Number(row.isActive) : 1,
        autoRenew: row.autoRenew !== undefined ? Number(row.autoRenew) : 1,
        useLunar: row.useLunar ? Number(row.useLunar) : 0,
        notes: row.notes || '',
        price: Number(row.price) || 0,
        priceUnit: row.priceUnit || 'month',
        currency: row.currency || 'CNY',
        createdAt: now,
        updatedAt: now,
      });
      imported++;
    }

    return {
      status: 200,
      body: { success: true, imported, total: rows.length, errors: errors.length > 0 ? errors : undefined },
    };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}
