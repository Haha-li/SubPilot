import jwt from 'jsonwebtoken';

const TOKEN_ISSUER = 'subpilot';
const TOKEN_AUDIENCE = 'subpilot-admin';

export interface AuthTokenPayload {
  userId: number;
  username: string;
}

export function generateToken(
  userId: number,
  username: string,
  secret: string,
): string {
  return jwt.sign(
    { userId, username },
    secret,
    {
      algorithm: 'HS256',
      expiresIn: '7d',
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    },
  );
}

export function verifyToken(token: string, secret: string): AuthTokenPayload | null {
  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    });
    if (
      typeof decoded !== 'object'
      || typeof decoded.userId !== 'number'
      || typeof decoded.username !== 'string'
    ) {
      return null;
    }
    return { userId: decoded.userId, username: decoded.username };
  } catch {
    return null;
  }
}
