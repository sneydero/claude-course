import { Router } from 'express';
import type { AuthService } from './auth.service.js';

export function createAuthRouter(service: AuthService): Router {
  const router = Router();

  router.post('/auth/register', async (req, res) => {
    const body = (req.body ?? {}) as { email?: unknown; password?: unknown; name?: unknown };
    const result = await service.register(body.email, body.password, body.name);
    res.status(201).json(result);
  });

  router.post('/auth/login', async (req, res) => {
    const body = (req.body ?? {}) as { email?: unknown; password?: unknown };
    const result = await service.login(body.email, body.password);
    res.status(200).json(result);
  });

  return router;
}
