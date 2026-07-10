import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import {
  getConfigHandler,
  getSchedulerStatusHandler,
  runSchedulerNowHandler,
  testNotifyConfigHandler,
  updateConfigHandler,
} from '../handlers/config';

const router = Router();

// Get all config
router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const result = await getConfigHandler();
  res.status(result.status).json(result.body);
});

router.get('/scheduler-status', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const result = await getSchedulerStatusHandler();
  res.status(result.status).json(result.body);
});

// Update config
router.put('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const result = await updateConfigHandler(req.body);
  res.status(result.status).json(result.body);
});

// Test notification channel
router.post('/test-notify', authMiddleware, async (req: AuthRequest, res: Response) => {
  const result = await testNotifyConfigHandler(req.body);
  res.status(result.status).json(result.body);
});

router.post('/run-scheduler', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const result = await runSchedulerNowHandler();
  res.status(result.status).json(result.body);
});

export default router;
