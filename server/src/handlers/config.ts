import { db, schema } from '../db';
import { testNotificationChannel } from '../services/notification';

export async function getConfigHandler() {
  try {
    const configs = await db.select().from(schema.config);
    const configMap: Record<string, string> = {};
    configs.forEach((c: any) => {
      configMap[c.key] = c.value;
    });
    return { status: 200, body: configMap };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}

export async function updateConfigHandler(body: any) {
  try {
    const updates = body;

    if (!updates || typeof updates !== 'object') {
      return { status: 400, body: { success: false, message: '无效的配置数据' } };
    }

    for (const [key, value] of Object.entries(updates)) {
      await db.insert(schema.config)
        .values({ key, value: String(value) })
        .onConflictDoUpdate({ target: schema.config.key, set: { value: String(value) } });
    }

    return { status: 200, body: { success: true, message: '配置已保存' } };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}

export async function testNotifyConfigHandler(body: any) {
  try {
    const { channel, config: formConfig } = body;
    const result = await testNotificationChannel(channel, formConfig);
    return { status: 200, body: { success: result, message: result ? '测试通知已发送' : '发送失败，请检查配置' } };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}
