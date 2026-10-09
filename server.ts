import express from 'express';
import path from 'path';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { getDb } from './src/server/db/database.js';
import { seedInitialData } from './src/server/db/seed.js';
import { BackgroundWorker } from './src/server/services/backgroundWorker.js';

import authRoutes from './src/server/routes/authRoutes.js';
import companyRoutes from './src/server/routes/companyRoutes.js';
import orderRoutes from './src/server/routes/orderRoutes.js';
import customerRoutes from './src/server/routes/customerRoutes.js';
import productRoutes from './src/server/routes/productRoutes.js';
import conversationRoutes from './src/server/routes/conversationRoutes.js';
import whatsappRoutes from './src/server/routes/whatsappRoutes.js';
import integrationRoutes from './src/server/routes/integrationRoutes.js';
import automationRoutes from './src/server/routes/automationRoutes.js';
import campaignRoutes from './src/server/routes/campaignRoutes.js';
import taskRoutes from './src/server/routes/taskRoutes.js';
import reportRoutes from './src/server/routes/reportRoutes.js';
import billingRoutes from './src/server/routes/billingRoutes.js';
import superadminRoutes from './src/server/routes/superadminRoutes.js';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  const isDev = process.env.NODE_ENV !== 'production';

  // Security & Middlewares
  app.use(cors());
  app.use(
    express.json({
      limit: '15mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // Initialize Persistent Database & Seeds
  console.log('Initializing Opervia Database...');
  await getDb();
  await seedInitialData();

  // Start background job queue runner
  BackgroundWorker.start(10000);

  // Health-check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'healthy',
      product: 'Opervia CRM',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    });
  });

  // API Route Mounts
  app.use('/api/auth', authRoutes);
  app.use('/api/companies', companyRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/customers', customerRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/conversations', conversationRoutes);
  app.use('/api/whatsapp', whatsappRoutes);
  app.use('/api/integrations', integrationRoutes);
  app.use('/api/automations', automationRoutes);
  app.use('/api/campaigns', campaignRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/billing', billingRoutes);
  app.use('/api/superadmin', superadminRoutes);

  // Frontend Serving
  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` Opervia Multi-Tenant E-Commerce CRM is LIVE on port ${PORT}`);
    console.log(`====================================================`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server boot error:', err);
  process.exit(1);
});
