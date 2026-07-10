import { db, schema } from '../db';
import { testNotificationChannel, testTemplateNotification } from '../services/notification';
import { resolveNotifyCron, validateCronExpression } from '../services/cronSchedule';
import { checkAndNotify } from '../services/scheduler';
import { getSchedulerStatus } from '../services/schedulerStatus';

function isInternalConfigKey(key: string): boolean {
  return key.startsWith('scheduler_');
}

export async function getConfigHandler() {
  try {
    const configs = await db.select().from(schema.config);
    const configMap: Record<string, string> = {};
    configs.forEach((c: any) => {
      if (!isInternalConfigKey(c.key)) configMap[c.key] = c.value;
    });
    configMap.cron_expression = resolveNotifyCron(configMap);
    return { status: 200, body: configMap };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}

export async function updateConfigHandler(body: any) {
  try {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { status: 400, body: { success: false, message: '无效的配置数据' } };
    }
    const updates = Object.fromEntries(
      Object.entries(body).filter(([key]) => !isInternalConfigKey(key)),
    );

    if ('cron_expression' in updates) {
      const cronExpression = String(updates.cron_expression).trim();
      const cronError = validateCronExpression(cronExpression);
      if (cronError) {
        return { status: 400, body: { success: false, message: cronError } };
      }
      updates.cron_expression = cronExpression;
      updates.notify_hours = '';
      updates.notify_schedule_version = '2';
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

export async function getSchedulerStatusHandler() {
  try {
    return { status: 200, body: await getSchedulerStatus() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 500, body: { success: false, message } };
  }
}

export async function runSchedulerNowHandler() {
  try {
    const result = await checkAndNotify({ force: true, source: 'manual' });
    const status = await getSchedulerStatus();
    return {
      status: 200,
      body: {
        success: result.outcome !== 'failed',
        message: result.message,
        result,
        status,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 500, body: { success: false, message } };
  }
}

export async function testNotifyConfigHandler(body: any) {
  try {
    const { channel, config: formConfig, mode } = body;
    const result = mode === 'template'
      ? await testTemplateNotification(channel, formConfig)
      : await testNotificationChannel(channel, formConfig);
    return { status: 200, body: { success: result, message: result ? '测试通知已发送' : '发送失败，请检查配置' } };
  } catch (error: any) {
    return { status: 500, body: { success: false, message: error.message } };
  }
}
