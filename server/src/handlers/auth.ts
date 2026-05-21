import { generateToken } from '../utils/auth';

export async function loginHandler(body: any, adminPassword?: string) {
  try {
    const { password } = body;

    if (!password) {
      return { status: 400, body: { success: false, message: '请输入密码' } };
    }

    const expected = adminPassword || process.env.ADMIN_PASSWORD || 'password';

    if (password !== expected) {
      return { status: 401, body: { success: false, message: '密码错误' } };
    }

    const token = generateToken(1, 'admin');
    return { status: 200, body: { success: true, token, username: 'admin' } };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}

export async function getMeHandler(_userId: number) {
  return { status: 200, body: { success: true, user: { id: 1, username: 'admin' } } };
}
