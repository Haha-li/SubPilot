import { Router, Response } from 'express';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { testNotificationChannel } from '../services/notification';

const router = Router();

// Get all config
router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const configs = await db.select().from(schema.config);
    const configMap: Record<string, string> = {};
    configs.forEach((c) => {
      configMap[c.key] = c.value;
    });
    res.json(configMap);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update config
router.put('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const updates = req.body;

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ success: false, message: '无效的配置数据' });
    }

    for (const [key, value] of Object.entries(updates)) {
      await db.insert(schema.config)
        .values({ key, value: String(value) })
        .onConflictDoUpdate({ target: schema.config.key, set: { value: String(value) } });
    }

    res.json({ success: true, message: '配置已保存' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Test notification channel
router.post('/test-notify', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { channel } = req.body;
    const result = await testNotificationChannel(channel);
    res.json({ success: result, message: result ? '测试通知已发送' : '发送失败，请检查配置' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
