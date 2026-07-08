import { Router } from 'express';
import { auth } from '../middleware/auth';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';

const router = Router();

// Get renewal history for a subscription
router.get('/:id', auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const logs = await db.select().from(schema.renewalLogs)
      .where(eq(schema.renewalLogs.subscriptionId, id))
      .orderBy(desc(schema.renewalLogs.renewedAt));
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
