import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { initD1Db } from '../db/d1';
import { authRoutes } from './routes/auth';
import { subscriptionRoutes } from './routes/subscription';
import { configRoutes } from './routes/config';
import { notifyLogsRoutes } from './routes/notifyLogs';
import { renewalRoutes } from './routes/renewals';
import { commonSubscriptionRoutes } from './routes/commonSubscription';
import { checkAndNotify } from '../services/scheduler';

interface Env {
  Bindings: {
    DB: any; // D1Database
    JWT_SECRET: string;
    ADMIN_PASSWORD: string;
  };
}

const app = new Hono<Env>();

app.use('*', cors({ origin: '*', credentials: true }));

// Initialize D1 database on each request
app.use('*', async (c, next) => {
  initD1Db(c.env.DB);
  await next();
});

// API Routes
app.route('/api/auth', authRoutes);
app.route('/api/subscriptions', subscriptionRoutes);
app.route('/api/config', configRoutes);
app.route('/api/notify-logs', notifyLogsRoutes);
app.route('/api/renewals', renewalRoutes);
app.route('/api/common-subscriptions', commonSubscriptionRoutes);

export default {
  fetch: app.fetch,
  async scheduled(event: any, env: any) {
    initD1Db(env.DB);
    await checkAndNotify({ now: new Date(event.scheduledTime), source: 'cron' });
  },
};
