import type Database from 'better-sqlite3';
import type { Router } from 'express';
import { createAuthMiddleware } from '../auth/auth.middleware.js';
import { createDashboardRepository } from './dashboard.repository.js';
import { createDashboardRouter } from './dashboard.routes.js';
import { createDashboardService } from './dashboard.service.js';

export function createDashboardModule(
  db: Database.Database,
  options: { jwtSecret: string; now?: () => Date },
): Router {
  return createDashboardRouter(
    createDashboardService(createDashboardRepository(db), options.now),
    createAuthMiddleware({ jwtSecret: options.jwtSecret }),
  );
}
