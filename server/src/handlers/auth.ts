import bcrypt from 'bcryptjs';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import { generateToken } from '../utils/auth';

export async function loginHandler(body: any) {
  try {
    const { username, password } = body;

    if (!username || !password) {
      return { status: 400, body: { success: false, message: '请输入用户名和密码' } };
    }

    const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);

    if (!user) {
      return { status: 401, body: { success: false, message: '用户名或密码错误' } };
    }

    const isValid = bcrypt.compareSync(password, user.passwordHash);
    if (!isValid) {
      return { status: 401, body: { success: false, message: '用户名或密码错误' } };
    }

    const token = generateToken(user.id, user.username);
    return { status: 200, body: { success: true, token, username: user.username } };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}

export async function getMeHandler(userId: number) {
  try {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);

    if (!user) {
      return { status: 404, body: { success: false, message: '用户不存在' } };
    }

    return { status: 200, body: { success: true, user: { id: user.id, username: user.username } } };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}

export async function changePasswordHandler(userId: number, body: any) {
  try {
    const { oldPassword, newPassword } = body;

    if (!oldPassword || !newPassword) {
      return { status: 400, body: { success: false, message: '请输入旧密码和新密码' } };
    }

    if (newPassword.length < 6) {
      return { status: 400, body: { success: false, message: '新密码至少6位' } };
    }

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);

    if (!user || !bcrypt.compareSync(oldPassword, user.passwordHash)) {
      return { status: 401, body: { success: false, message: '旧密码错误' } };
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    await db.update(schema.users).set({ passwordHash: hash }).where(eq(schema.users.id, userId));

    return { status: 200, body: { success: true, message: '密码修改成功' } };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}
