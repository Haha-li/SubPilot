import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { getConfigHandler, updateConfigHandler, testNotifyConfigHandler } from '../handlers/config';

const router = Router();

// Get all config
router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const result = await getConfigHandler();
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

export default router;
