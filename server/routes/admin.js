import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';

const sameToken = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

// Manual pipeline trigger. Disabled (404) unless ADMIN_TOKEN is configured.
export function adminRouter(refresher, adminToken) {
  const router = Router();
  router.use((req, res, next) => {
    if (!adminToken) return res.status(404).json({ error: 'Not found' });
    if (!sameToken(req.get('x-admin-token') || '', adminToken)) return res.status(401).json({ error: 'Unauthorized' });
    next();
  });
  router.get('/status', (_req, res) => res.json(refresher.status()));
  router.post('/refresh', (_req, res) => {
    const started = refresher.trigger('manual');
    res.status(started ? 202 : 409).json(refresher.status());
  });
  return router;
}
