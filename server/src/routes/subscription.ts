import { Router, Response } from 'express';
import { db, schema } from '../db';
import { eq, like, or, desc } from 'drizzle-orm';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendNotification } from '../services/notification';

const router = Router();

// Get all subscriptions
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { search, category } = req.query;

    let query = db.select().from(schema.subscriptions);

    const results = await query.orderBy(schema.subscriptions.expiryDate);

    let filtered = results;

    if (category && typeof category === 'string' && category.trim()) {
      filtered = filtered.filter((sub) => {
        const tokens = (sub.category || '').split(/[/,，\s]+/).filter(Boolean);
        return tokens.some((t) => t.toLowerCase() === category.toLowerCase());
      });
    }

    if (search && typeof search === 'string' && search.trim()) {
      const keyword = search.toLowerCase();
      filtered = filtered.filter((sub) => {
        const haystack = [sub.name, sub.customType, sub.notes, sub.category].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(keyword);
      });
    }

    res.json(filtered);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create subscription
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, customType, category, startDate, expiryDate, periodValue, periodUnit, reminderValue, reminderUnit, isActive, autoRenew, useLunar, notes } = req.body;

    if (!name || !expiryDate) {
      return res.status(400).json({ success: false, message: '订阅名称和到期日期为必填项' });
    }

    const now = new Date().toISOString();
    const [result] = await db.insert(schema.subscriptions).values({
      name,
      customType: customType || '',
      category: category || '',
      startDate: startDate || null,
      expiryDate,
      periodValue: periodValue || 1,
      periodUnit: periodUnit || 'month',
      reminderValue: reminderValue ?? 7,
      reminderUnit: reminderUnit || 'day',
      isActive: isActive !== false ? 1 : 0,
      autoRenew: autoRenew !== false ? 1 : 0,
      useLunar: useLunar ? 1 : 0,
      notes: notes || '',
      createdAt: now,
      updatedAt: now,
    }).returning();

    res.json({ success: true, subscription: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update subscription
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, customType, category, startDate, expiryDate, periodValue, periodUnit, reminderValue, reminderUnit, isActive, autoRenew, useLunar, notes } = req.body;

    const [existing] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.id, Number(id))).limit(1);
    if (!existing) {
      return res.status(404).json({ success: false, message: '订阅不存在' });
    }

    const now = new Date().toISOString();
    await db.update(schema.subscriptions).set({
      name: name ?? existing.name,
      customType: customType ?? existing.customType,
      category: category ?? existing.category,
      startDate: startDate !== undefined ? startDate : existing.startDate,
      expiryDate: expiryDate ?? existing.expiryDate,
      periodValue: periodValue ?? existing.periodValue,
      periodUnit: periodUnit ?? existing.periodUnit,
      reminderValue: reminderValue ?? existing.reminderValue,
      reminderUnit: reminderUnit ?? existing.reminderUnit,
      isActive: isActive !== undefined ? (isActive ? 1 : 0) : existing.isActive,
      autoRenew: autoRenew !== undefined ? (autoRenew ? 1 : 0) : existing.autoRenew,
      useLunar: useLunar !== undefined ? (useLunar ? 1 : 0) : existing.useLunar,
      notes: notes ?? existing.notes,
      updatedAt: now,
    }).where(eq(schema.subscriptions.id, Number(id)));

    const [updated] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.id, Number(id))).limit(1);

    res.json({ success: true, subscription: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete subscription
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const [existing] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.id, Number(id))).limit(1);
    if (!existing) {
      return res.status(404).json({ success: false, message: '订阅不存在' });
    }

    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, Number(id)));

    res.json({ success: true, message: '删除成功' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Toggle subscription status
router.post('/:id/toggle', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const [existing] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.id, Number(id))).limit(1);
    if (!existing) {
      return res.status(404).json({ success: false, message: '订阅不存在' });
    }

    await db.update(schema.subscriptions).set({
      isActive: isActive ? 1 : 0,
      updatedAt: new Date().toISOString(),
    }).where(eq(schema.subscriptions.id, Number(id)));

    res.json({ success: true, message: isActive ? '已启用' : '已停用' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Test notification for a subscription
router.post('/:id/test-notify', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const [subscription] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.id, Number(id))).limit(1);
    if (!subscription) {
      return res.status(404).json({ success: false, message: '订阅不存在' });
    }

    const result = await sendNotification(subscription, true);

    res.json({ success: true, message: result ? '测试通知已发送' : '通知发送失败，请检查通知配置' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
