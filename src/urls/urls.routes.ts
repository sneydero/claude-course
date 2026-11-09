import { Router, type Request, type RequestHandler } from 'express';
import { NotFoundError } from '../shared/errors.js';
import type { UrlsService } from './urls.service.js';

const shortUrlFor = (req: Request, code: string): string => `${req.protocol}://${req.get('host')}/${code}`;

export function createUrlsRouter(service: UrlsService, requireAuth: RequestHandler): Router {
  const router = Router();

  router.post('/api/urls', requireAuth, (req, res) => {
    const body = (req.body ?? {}) as { url?: unknown; alias?: unknown };
    const record = service.shorten(body.url, req.user!.id, body.alias);
    res.status(201).json({ ...record, shortUrl: shortUrlFor(req, record.code) });
  });

  router.get('/api/urls', requireAuth, (req, res) => {
    res.json(service.listByUser(req.user!.id).map((u) => ({ ...u, shortUrl: shortUrlFor(req, u.code) })));
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
