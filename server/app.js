import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { jobsRouter } from './routes/jobs.js';
import { metaRouter } from './routes/meta.js';
import { adminRouter } from './routes/admin.js';

export function createApp({ db, refresher, adminToken = process.env.ADMIN_TOKEN, corsOrigin = process.env.CORS_ORIGIN, staticDir }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '50kb' }));
  if (corsOrigin) app.use('/api', cors({ origin: corsOrigin.split(',') }));

  // Data changes daily; never let browsers/CDNs serve stale API responses.
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.get('/api/health', async (_req, res) => {
    await db.command({ ping: 1 });
    res.json({ ok: true });
  });
  app.use('/api/jobs', jobsRouter(db));
  app.use('/api', metaRouter(db));
  if (refresher) app.use('/api/admin', adminRouter(refresher, adminToken));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // In production the same process serves the built React app.
  if (staticDir && existsSync(staticDir)) {
    app.use(express.static(staticDir, { index: 'index.html', maxAge: '1h' }));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  }

  // Express 5 forwards rejected async handlers here.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
  });

  return app;
}
