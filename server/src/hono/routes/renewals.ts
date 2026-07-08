import { Hono } from 'hono';
import { honoAuth } from '../middleware/auth';
import { db, schema } from '../../db';
import { eq, desc } from 'drizzle-orm';

const renewals = new Hono();

// Get renewal history for a subscription
renewals.get('/:id', honoAuth, async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const logs = await db.select().from(schema.renewalLogs)
      .where(eq(schema.renewalLogs.subscriptionId, id))
      .orderBy(desc(schema.renewalLogs.renewedAt));
    return c.json(logs);
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

export { renewals as renewalRoutes };
