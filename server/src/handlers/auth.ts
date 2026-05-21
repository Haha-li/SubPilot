import bcrypt from 'bcryptjs';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import { generateToken } from '../utils/auth';

export async function loginHandler(body: any, adminPassword?: string) {
  try {
    const { password } = body;

    if (!password) {
      return { status: 400, body: { success: false, message: '请输入密码' } };
    }

    // Try D1 stored password first
    let valid = false;
    try {
      const [row] = await db.select().from(schema.config).where(eq(schema.config.key, 'admin_password_hash')).limit(1);
      if (row?.value) {
        valid = bcrypt.compareSync(password, row.value);
      }
    } catch {}

    // Fallback to env var
    if (!valid) {
      const expected = adminPassword || process.env.ADMIN_PASSWORD || 'password';
      valid = password === expected;
    }

    if (!valid) {
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

export async function changePasswordHandler(_userId: number, body: any, adminPassword?: string) {
  try {
    const { oldPassword, newPassword } = body;

    if (!oldPassword || !newPassword) {
      return { status: 400, body: { success: false, message: '请输入旧密码和新密码' } };
    }

    if (newPassword.length < 6) {
      return { status: 400, body: { success: false, message: '新密码至少6位' } };
    }

    // Verify old password (same logic as login)
    let valid = false;
    try {
      const [row] = await db.select().from(schema.config).where(eq(schema.config.key, 'admin_password_hash')).limit(1);
      if (row?.value) {
        valid = bcrypt.compareSync(oldPassword, row.value);
      }
    } catch {}

    if (!valid) {
      const expected = adminPassword || process.env.ADMIN_PASSWORD || 'password';
      valid = oldPassword === expected;
    }

    if (!valid) {
      return { status: 401, body: { success: false, message: '旧密码错误' } };
    }

    // Save new password hash to D1
    const hash = bcrypt.hashSync(newPassword, 10);
    try {
      const [existing] = await db.select().from(schema.config).where(eq(schema.config.key, 'admin_password_hash')).limit(1);
      if (existing) {
        await db.update(schema.config).set({ value: hash }).where(eq(schema.config.key, 'admin_password_hash'));
      } else {
        await db.insert(schema.config).values({ key: 'admin_password_hash', value: hash });
      }
    } catch (error: any) {
      return { status: 500, body: { success: false, message: '密码保存失败: ' + error.message } };
    }

    return { status: 200, body: { success: true, message: '密码修改成功' } };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}
