import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { listNotifyLogsHandler, clearNotifyLogsHandler } from '../handlers/notifyLogs';

const router = Router();

// Get notify logs with filters and pagination
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const result = await listNotifyLogsHandler(req.query);
  res.status(result.status).json(result.body);
});

// Clear all notify logs
router.delete('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const result = await clearNotifyLogsHandler();
  res.status(result.status).json(result.body);
});

export default router;
