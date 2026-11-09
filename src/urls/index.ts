import type Database from 'better-sqlite3';
import type { Router } from 'express';
import { createAuthMiddleware } from '../auth/auth.middleware.js';
import { createUrlsRepository } from './urls.repository.js';
import { createUrlsRouter } from './urls.routes.js';
import { createUrlsService } from './urls.service.js';

export function createUrlsModule(db: Database.Database, options: { jwtSecret: string }): Router {
  return createUrlsRouter(
    createUrlsService(createUrlsRepository(db)),
    createAuthMiddleware({ jwtSecret: options.jwtSecret }),
  );
}
