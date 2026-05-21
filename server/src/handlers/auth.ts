import { generateToken } from '../utils/auth';

export async function loginHandler(body: any, adminPassword?: string) {
  try {
    const { password } = body;

    if (!password) {
      return { status: 400, body: { success: false, message: '请输入密码' } };
    }

    const expectedPassword = adminPassword || process.env.ADMIN_PASSWORD || 'password';

    if (password !== expectedPassword) {
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

export async function changePasswordHandler(_userId: number, body: any) {
  try {
    const { oldPassword, newPassword } = body;

    if (!oldPassword || !newPassword) {
      return { status: 400, body: { success: false, message: '请输入旧密码和新密码' } };
    }

    if (newPassword.length < 6) {
      return { status: 400, body: { success: false, message: '新密码至少6位' } };
    }

    return { status: 200, body: { success: true, message: '密码仅支持通过环境变量 ADMIN_PASSWORD 修改' } };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}
