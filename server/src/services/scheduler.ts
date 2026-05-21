import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import { sendNotification } from './notification';

let scheduledTask: any = null;

export async function checkAndNotify() {
  console.log(`[${new Date().toISOString()}] Running scheduled notification check...`);

  try {
    const configs = await db.select().from(schema.config);
    const configMap: Record<string, string> = {};
    configs.forEach((c: any) => { configMap[c.key] = c.value; });

    const timezone = configMap.timezone || 'Asia/Shanghai';
    const notifyHours = (configMap.notify_hours || '8').split(',').map(Number);
    const currentHour = new Date().toLocaleString('en-US', { timeZone: timezone, hour12: false, hour: '2-digit' });

    if (!notifyHours.includes(Number(currentHour))) {
      console.log(`Current hour ${currentHour} not in notify hours [${notifyHours}], skipping`);
      return;
    }

    const subscriptions = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.isActive, 1));
    const now = new Date();

    for (const sub of subscriptions) {
      const expiryDate = new Date(sub.expiryDate);
      const diffMs = expiryDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = diffMs / (1000 * 60 * 60);

      const reminderValue = sub.reminderValue ?? 7;
      const reminderUnit = sub.reminderUnit || 'day';

      let shouldNotify = false;

      if (reminderUnit === 'hour') {
        shouldNotify = diffHours >= 0 && diffHours <= reminderValue;
      } else {
        shouldNotify = diffDays >= 0 && diffDays <= reminderValue;
      }

      if (shouldNotify) {
        console.log(`Sending notification for: ${sub.name} (${diffDays} days left)`);
        await sendNotification(sub);
      }
    }

    console.log(`Scheduled check completed. Checked ${subscriptions.length} subscriptions.`);
  } catch (error: any) {
    console.error('Scheduled notification error:', error.message);
  }
}

export function startScheduler() {
  // node-cron is not available on Cloudflare Workers (uses Cron Triggers instead)
  try {
    const cron = require('node-cron');
    const cronExpression = '0 0 * * *';

    if (scheduledTask) {
      scheduledTask.stop();
    }

    scheduledTask = cron.schedule(cronExpression, checkAndNotify, {
      timezone: 'UTC',
    });

    console.log(`Scheduler started with cron: ${cronExpression}`);
  } catch {
    console.log('Scheduler skipped (node-cron not available, use Workers Cron Triggers)');
  }
}

export function stopScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('Scheduler stopped');
  }
}
