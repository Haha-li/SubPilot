import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { initNodeDb } from './db';
import authRoutes from './routes/auth';
import subscriptionRoutes from './routes/subscription';
import configRoutes from './routes/config';
import notifyLogsRoutes from './routes/notifyLogs';
import renewalsRoutes from './routes/renewals';
import commonSubscriptionRoutes from './routes/commonSubscription';
import { startScheduler } from './services/scheduler';
import { resolveAllowedCorsOrigin } from './utils/cors';
import { assertAuthConfiguration } from './utils/securityConfig';

assertAuthConfiguration({
  jwtSecret: process.env.JWT_SECRET,
  adminPassword: process.env.ADMIN_PASSWORD,
});

// Initialize database
initNodeDb();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Middleware
const developmentOrigins = ['http://localhost:5173', 'http://localhost:3000'];
app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }
    const allowedOrigin = resolveAllowedCorsOrigin(
      origin,
      process.env.FRONTEND_ORIGINS,
      process.env.NODE_ENV === 'production' ? [] : developmentOrigins,
    );
    callback(null, Boolean(allowedOrigin));
  },
  credentials: false,
  allowedHeaders: ['Authorization', 'Content-Type'],
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  maxAge: 86400,
}));
// Import files are embedded in JSON, so escaping can make the request body roughly twice the file size.
app.use(express.json({ limit: '22mb' }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/config', configRoutes);
app.use('/api/notify-logs', notifyLogsRoutes);
app.use('/api/renewals', renewalsRoutes);
app.use('/api/common-subscriptions', commonSubscriptionRoutes);

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`SubPilot server running on http://0.0.0.0:${PORT}`);
  startScheduler();
});

export default app;
