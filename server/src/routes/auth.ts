import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import { generateToken, authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Login
router.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: '请输入用户名和密码' });
    }

    const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);

    if (!user) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    const isValid = bcrypt.compareSync(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    const token = generateToken(user.id, user.username);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({ success: true, token, username: user.username });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Logout
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ success: true });
});

// Get current user
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, req.userId!)).limit(1);

    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    res.json({ success: true, user: { id: user.id, username: user.username } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Change password
router.put('/password', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: '请输入旧密码和新密码' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: '新密码至少6位' });
    }

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, req.userId!)).limit(1);

    if (!user || !bcrypt.compareSync(oldPassword, user.passwordHash)) {
      return res.status(401).json({ success: false, message: '旧密码错误' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    await db.update(schema.users).set({ passwordHash: hash }).where(eq(schema.users.id, req.userId!));

    res.json({ success: true, message: '密码修改成功' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
