import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { loginHandler, getMeHandler, changePasswordHandler } from '../handlers/auth';

const router = Router();

// Login
router.post('/login', async (req: AuthRequest, res: Response) => {
  const result = await loginHandler(req.body, process.env.ADMIN_PASSWORD);
  if (result.body.token) {
    res.cookie('token', result.body.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
  res.status(result.status).json(result.body);
});

// Logout
router.post('/logout', (_req: any, res: Response) => {
  res.clearCookie('token');
  res.json({ success: true });
});

// Get current user
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  const result = await getMeHandler(req.userId!);
  res.status(result.status).json(result.body);
});

// Change password
router.put('/password', authMiddleware, async (req: AuthRequest, res: Response) => {
  const result = await changePasswordHandler(req.userId!, req.body, process.env.ADMIN_PASSWORD);
  res.status(result.status).json(result.body);
});

export default router;
