import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { initD1Db } from '../db/d1';
import { authRoutes } from './routes/auth';
import { subscriptionRoutes } from './routes/subscription';
import { configRoutes } from './routes/config';
import { checkAndNotify } from '../services/scheduler';

interface Env {
  Bindings: {
    DB: any; // D1Database
    JWT_SECRET: string;
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

export default {
  fetch: app.fetch,
  async scheduled(event: any, env: any) {
    initD1Db(env.DB);
    await checkAndNotify();
  },
};
