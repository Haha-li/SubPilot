import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import { solar2lunar } from '../utils/lunar';
import { sendTelegram } from './notifiers/telegram';
import { sendWechat } from './notifiers/wechat';
import { sendBark } from './notifiers/bark';
import { sendWebhook } from './notifiers/webhook';
import { sendEmail } from './notifiers/email';
import { sendNotifyX } from './notifiers/notifyx';
import { sendPushPlus } from './notifiers/pushplus';
import { getCurrencySymbol } from '../utils/currency';
import {
  addDateOnlyPeriod,
  differenceInCalendarDays,
  getDateOnlyInTimeZone,
  isValidTimeZone,
  normalizeDateOnly,
  parseDateOnly,
} from '../utils/dateOnly';

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
  price: number | null;
  priceUnit: string | null;
  currency: string | null;
}

async function getConfigMap(): Promise<Record<string, string>> {
  const configs = await db.select().from(schema.config);
  const map: Record<string, string> = {};
  configs.forEach((c: any) => { map[c.key] = c.value; });
  return map;
}

export function formatNotifyMessage(
  subscription: Subscription,
  config: Record<string, string>,
  now = new Date(),
): string {
  const timezone = isValidTimeZone(config.timezone) ? config.timezone : 'Asia/Shanghai';
  const expiryDate = normalizeDateOnly(subscription.expiryDate);
  const expiryParts = parseDateOnly(expiryDate);
  const today = getDateOnlyInTimeZone(now, timezone);
  const diffDays = expiryDate === null
    ? null
    : differenceInCalendarDays(today, expiryDate);

  const lunarDate = expiryParts
    ? solar2lunar(expiryParts.year, expiryParts.month, expiryParts.day)
    : null;
  const lunar = lunarDate?.fullStr || '';

  const status = diffDays === null ? '到期日期无效' :
                 diffDays < 0 ? `已过期 ${Math.abs(diffDays)} 天` :
                 diffDays === 0 ? '今天到期' :
                 `还有 ${diffDays} 天到期`;

  const template = config.notify_template || '📋 订阅提醒\n━━━━━━━━━━━━━━\n名称: {{name}}\n类型: {{type}}\n到期: {{expiryDate}}\n状态: {{status}}\n剩余: {{daysLeft}} 天\n费用: {{price}}\n周期: {{period}}\n续费: {{autoRenew}}\n提醒: {{reminder}}\n农历: {{lunar}}\n备注: {{notes}}\n时间: {{time}}\n时区: {{timezone}}';

  const unitMap: Record<string, string> = { day: '/天', month: '/月', year: '/年' };
  const periodUnitMap: Record<string, string> = { day: '天', month: '月', year: '年' };
  const sym = getCurrencySymbol(subscription.currency);
  const price = subscription.price && subscription.price > 0
    ? `${sym}${subscription.price.toFixed(2)}${unitMap[subscription.priceUnit || 'month'] || '/月'}`
    : '免费';
  const period = `${subscription.periodValue || 1}${periodUnitMap[subscription.periodUnit || 'month'] || '月'}`;
  const reminderValue = subscription.reminderValue ?? 7;
  const reminderUnit = subscription.reminderUnit || 'day';
  const reminder = reminderUnit === 'hour' ? `${reminderValue}小时前` : `${reminderValue}天前`;
  const autoRenew = subscription.autoRenew ? '自动续费' : '不续费';

  return template
    .replace(/\{\{name\}\}/g, subscription.name)
    .replace(/\{\{type\}\}/g, subscription.customType || '其他')
    .replace(/\{\{expiryDate\}\}/g, subscription.expiryDate)
    .replace(/\{\{status\}\}/g, status)
    .replace(/\{\{daysLeft\}\}/g, diffDays === null ? '—' : String(diffDays))
    .replace(/\{\{lunar\}\}/g, lunar)
    .replace(/\{\{notes\}\}/g, subscription.notes || '')
    .replace(/\{\{price\}\}/g, price)
    .replace(/\{\{period\}\}/g, period)
    .replace(/\{\{autoRenew\}\}/g, autoRenew)
    .replace(/\{\{reminder\}\}/g, reminder)
    .replace(/\{\{time\}\}/g, now.toLocaleString('zh-CN', { timeZone: timezone }))
    .replace(/\{\{timezone\}\}/g, timezone);
}

export async function sendNotification(
  subscription: Subscription,
  isTest = false,
  now = new Date(),
): Promise<boolean> {
  const config = await getConfigMap();
  const channels = (config.notify_channels || '').split(',').filter(Boolean);

  if (channels.length === 0 && !isTest) {
    return false;
  }

  const message = isTest
    ? `🔔 测试通知\n━━━━━━━━━━━━━━\n名称: ${subscription.name}\n这是一条测试通知，说明通知渠道配置正确。`
    : formatNotifyMessage(subscription, config, now);

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
        case 'pushplus':
          result = await sendPushPlus(config.pushplus_token, message, subscription.name, config.pushplus_topic);
          break;
      }

      // Log notification
      await db.insert(schema.notifyLogs).values({
        subscriptionId: subscription.id,
        channel,
        status: result ? 'success' : 'failed',
        message: result ? '发送成功' : '发送失败',
        content: message,
        createdAt: new Date().toISOString(),
      });

      if (result) success = true;
    } catch (error: any) {
      await db.insert(schema.notifyLogs).values({
        subscriptionId: subscription.id,
        channel,
        status: 'failed',
        message: error.message,
        content: message,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return success;
}

export async function testNotificationChannel(channel: string, formConfig?: Record<string, string>): Promise<boolean> {
  const config = formConfig || await getConfigMap();
  const timezone = isValidTimeZone(config.timezone) ? config.timezone : 'Asia/Shanghai';
  const testMessage = `🔔 通知测试\n━━━━━━━━━━━━━━\n这是一条来自 SubPilot 的测试通知。\n时间: ${new Date().toLocaleString('zh-CN', { timeZone: timezone })}`;

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
      case 'pushplus':
        return await sendPushPlus(config.pushplus_token, testMessage, 'SubPilot 测试', config.pushplus_topic);
      default:
        return false;
    }
  } catch {
    return false;
  }
}

export async function testTemplateNotification(channel: string, formConfig?: Record<string, string>): Promise<boolean> {
  const config = formConfig || await getConfigMap();

  const now = new Date();
  const timezone = isValidTimeZone(config.timezone) ? config.timezone : 'Asia/Shanghai';
  const expiryDate = addDateOnlyPeriod(getDateOnlyInTimeZone(now, timezone), 10, 'day');

  const mockSub: Subscription = {
    id: 0,
    name: '示例订阅',
    customType: '视频会员',
    category: null,
    startDate: null,
    expiryDate,
    periodValue: 1,
    periodUnit: 'month',
    reminderValue: 7,
    reminderUnit: 'day',
    isActive: 1,
    autoRenew: 1,
    useLunar: 1,
    notes: '这是一条示例备注',
    price: 29,
    priceUnit: 'month',
    currency: 'CNY',
  };

  const message = formatNotifyMessage(mockSub, config, now);

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
      case 'pushplus':
        return await sendPushPlus(config.pushplus_token, message, mockSub.name, config.pushplus_topic);
      default:
        return false;
    }
  } catch {
    return false;
  }
}
