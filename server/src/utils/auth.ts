import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'subpilot-default-secret-change-me';

export function generateToken(userId: number, username: string): string {
  return jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): { userId: number; username: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: number; username: string };
  } catch {
    return null;
  }
}
