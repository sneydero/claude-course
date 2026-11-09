import { Router, type RequestHandler } from 'express';
import { NotFoundError } from '../shared/errors.js';
import type { UrlsService } from './urls.service.js';

export function createUrlsRouter(service: UrlsService, requireAuth: RequestHandler): Router {
  const router = Router();

  router.post('/api/urls', requireAuth, (req, res) => {
    const record = service.shorten((req.body as { url?: unknown } | undefined)?.url, req.user!.id);
    res.status(201).json({ ...record, shortUrl: `${req.protocol}://${req.get('host')}/${record.code}` });
  });

  router.get('/api/urls', (_req, res) => {
    res.json(service.list());
  });

  router.delete('/api/urls/:code', requireAuth, (req, res) => {
    service.remove(req.params['code'] as string, req.user!.id);
    res.status(204).end();
  });

  router.get('/:code', (req, res) => {
    const record = service.resolve(req.params.code, req.get('user-agent'));
    if (!record) throw new NotFoundError('Código no encontrado');
    res.redirect(302, record.longUrl);
  });

  return router;
}
