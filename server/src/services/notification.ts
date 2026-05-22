import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import { solar2lunar } from '../utils/lunar';
import { sendTelegram } from './notifiers/telegram';
import { sendWechat } from './notifiers/wechat';
import { sendBark } from './notifiers/bark';
import { sendWebhook } from './notifiers/webhook';
import { sendEmail } from './notifiers/email';
import { sendNotifyX } from './notifiers/notifyx';

interface Subscription {
  id: number;
  name: string;
  customType: string | null;
  category: string | null;
  startDate: string | null;
  expiryDate: string;
  periodValue: number | null;
  periodUnit: string | null;
  reminderValue: number | null;
  reminderUnit: string | null;
  isActive: number | null;
  autoRenew: number | null;
  useLunar: number | null;
  notes: string | null;
}

async function getConfigMap(): Promise<Record<string, string>> {
  const configs = await db.select().from(schema.config);
  const map: Record<string, string> = {};
  configs.forEach((c: any) => { map[c.key] = c.value; });
  return map;
}

function formatNotifyMessage(subscription: Subscription, config: Record<string, string>): string {
  const expiryDate = new Date(subscription.expiryDate);
  const now = new Date();
  const diffMs = expiryDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let lunar = '';
  if (subscription.useLunar) {
    const lunarDate = solar2lunar(expiryDate.getFullYear(), expiryDate.getMonth() + 1, expiryDate.getDate());
    if (lunarDate) {
      lunar = lunarDate.fullStr;
    }
  }

  const status = diffDays < 0 ? `已过期 ${Math.abs(diffDays)} 天` :
                 diffDays === 0 ? '今天到期' :
                 `还有 ${diffDays} 天到期`;

  const template = config.notify_template || '📋 订阅提醒\n━━━━━━━━━━━━━━\n名称: {{name}}\n类型: {{type}}\n到期: {{expiryDate}}\n状态: {{status}}\n剩余: {{daysLeft}} 天\n农历: {{lunar}}\n备注: {{notes}}';

  return template
    .replace(/\{\{name\}\}/g, subscription.name)
    .replace(/\{\{type\}\}/g, subscription.customType || '其他')
    .replace(/\{\{expiryDate\}\}/g, subscription.expiryDate)
    .replace(/\{\{status\}\}/g, status)
    .replace(/\{\{daysLeft\}\}/g, String(diffDays))
    .replace(/\{\{lunar\}\}/g, lunar)
    .replace(/\{\{notes\}\}/g, subscription.notes || '')
    .replace(/\{\{time\}\}/g, new Date().toLocaleString('zh-CN', { timeZone: config.timezone || 'Asia/Shanghai' }))
    .replace(/\{\{timezone\}\}/g, config.timezone || 'Asia/Shanghai');
}

export async function sendNotification(subscription: Subscription, isTest = false): Promise<boolean> {
  const config = await getConfigMap();
  const channels = (config.notify_channels || '').split(',').filter(Boolean);

  if (channels.length === 0 && !isTest) {
    return false;
  }

  const message = isTest
    ? `🔔 测试通知\n━━━━━━━━━━━━━━\n名称: ${subscription.name}\n这是一条测试通知，说明通知渠道配置正确。`
    : formatNotifyMessage(subscription, config);

  let success = false;

  const channelsToTest = isTest ? (channels.length > 0 ? channels : ['telegram']) : channels;

  for (const channel of channelsToTest) {
    try {
      let result = false;
      switch (channel) {
        case 'telegram':
          result = await sendTelegram(config.telegram_bot_token, config.telegram_chat_id, message);
          break;
        case 'wechat':
          result = await sendWechat(config.wechat_webhook, message);
          break;
        case 'bark':
          result = await sendBark(config.bark_url, config.bark_key, message, subscription.name);
          break;
        case 'webhook':
          result = await sendWebhook(config, message, subscription);
          break;
        case 'email':
          result = await sendEmail(config, message, subscription.name);
          break;
        case 'notifyx':
          result = await sendNotifyX(config.notifyx_api_key, message);
          break;
      }

      // Log notification
      await db.insert(schema.notifyLogs).values({
        subscriptionId: subscription.id,
        channel,
        status: result ? 'success' : 'failed',
        message: result ? '发送成功' : '发送失败',
        content: message,
      });

      if (result) success = true;
    } catch (error: any) {
      await db.insert(schema.notifyLogs).values({
        subscriptionId: subscription.id,
        channel,
        status: 'failed',
        message: error.message,
        content: message,
      });
    }
  }

  return success;
}

export async function testNotificationChannel(channel: string, formConfig?: Record<string, string>): Promise<boolean> {
  const config = formConfig || await getConfigMap();
  const testMessage = `🔔 通知测试\n━━━━━━━━━━━━━━\n这是一条来自 SubPilot 的测试通知。\n时间: ${new Date().toLocaleString('zh-CN')}`;

  try {
    switch (channel) {
      case 'telegram':
        return await sendTelegram(config.telegram_bot_token, config.telegram_chat_id, testMessage);
      case 'wechat':
        return await sendWechat(config.wechat_webhook, testMessage);
      case 'bark':
        return await sendBark(config.bark_url, config.bark_key, testMessage, 'SubPilot');
      case 'webhook':
        return await sendWebhook(config, testMessage, { name: 'SubPilot', customType: '测试', notes: '' } as any);
      case 'email':
        return await sendEmail(config, testMessage, 'SubPilot 测试');
      case 'notifyx':
        return await sendNotifyX(config.notifyx_api_key, testMessage);
      default:
        return false;
    }
  } catch {
    return false;
  }
}

export async function testTemplateNotification(channel: string, formConfig?: Record<string, string>): Promise<boolean> {
  const config = formConfig || await getConfigMap();

  const today = new Date();
  const expiryDate = new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000);
  const yyyy = expiryDate.getFullYear();
  const mm = String(expiryDate.getMonth() + 1).padStart(2, '0');
  const dd = String(expiryDate.getDate()).padStart(2, '0');

  const mockSub: Subscription = {
    id: 0,
    name: '示例订阅',
    customType: '视频会员',
    category: null,
    startDate: null,
    expiryDate: `${yyyy}-${mm}-${dd}`,
    periodValue: 1,
    periodUnit: 'month',
    reminderValue: 7,
    reminderUnit: 'day',
    isActive: 1,
    autoRenew: 1,
    useLunar: 1,
    notes: '这是一条示例备注',
  };

  const message = formatNotifyMessage(mockSub, config);

  try {
    switch (channel) {
      case 'telegram':
        return await sendTelegram(config.telegram_bot_token, config.telegram_chat_id, message);
      case 'wechat':
        return await sendWechat(config.wechat_webhook, message);
      case 'bark':
        return await sendBark(config.bark_url, config.bark_key, message, mockSub.name);
      case 'webhook':
        return await sendWebhook(config, message, mockSub);
      case 'email':
        return await sendEmail(config, message, mockSub.name);
      case 'notifyx':
        return await sendNotifyX(config.notifyx_api_key, message);
      default:
        return false;
    }
  } catch {
    return false;
  }
}
