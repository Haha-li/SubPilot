import { db, schema } from '../db';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

export async function listNotifyLogsHandler(query: any) {
  try {
    const { subscriptionId, channel, status, startDate, endDate, page = '1', pageSize = '20' } = query;

    const filters: any[] = [];
    if (subscriptionId) filters.push(eq(schema.notifyLogs.subscriptionId, Number(subscriptionId)));
    if (channel) filters.push(eq(schema.notifyLogs.channel, channel));
    if (status) filters.push(eq(schema.notifyLogs.status, status));
    if (startDate) filters.push(gte(schema.notifyLogs.createdAt, startDate));
    if (endDate) filters.push(lte(schema.notifyLogs.createdAt, endDate + 'T23:59:59'));

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSizeNum = Math.max(1, Math.min(100, parseInt(pageSize) || 20));
    const offset = (pageNum - 1) * pageSizeNum;

    // Get total count
    const allRows = whereClause
      ? await db.select().from(schema.notifyLogs).where(whereClause)
      : await db.select().from(schema.notifyLogs);
    const total = allRows.length;

    // Get paginated rows with subscription name
    const items = whereClause
      ? await db.select().from(schema.notifyLogs).where(whereClause).orderBy(desc(schema.notifyLogs.createdAt)).limit(pageSizeNum).offset(offset)
      : await db.select().from(schema.notifyLogs).orderBy(desc(schema.notifyLogs.createdAt)).limit(pageSizeNum).offset(offset);

    // Attach subscription name
    const subs = await db.select().from(schema.subscriptions);
    const subMap: Record<number, string> = {};
    subs.forEach((s: any) => { subMap[s.id] = s.name; });

    const enriched = items.map((item: any) => ({
      ...item,
      subscriptionName: item.subscriptionId ? (subMap[item.subscriptionId] || '已删除') : '系统测试',
    }));

    return { status: 200, body: { items: enriched, total, page: pageNum, pageSize: pageSizeNum } };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}

export async function clearNotifyLogsHandler() {
  try {
    await db.delete(schema.notifyLogs);
    return { status: 200, body: { success: true, message: '日志已清空' } };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}
