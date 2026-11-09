import type Database from 'better-sqlite3';
import express from 'express';
import { createAuthModule } from './auth/index.js';
import { createDashboardModule } from './dashboard/index.js';
import { healthRouter } from './health/health.routes.js';
import { errorHandler, notFoundHandler } from './shared/error-handler.js';
import { createUrlsModule } from './urls/index.js';

export interface AppOptions {
  jwtSecret: string;
}

export function createApp(db: Database.Database, options: AppOptions): express.Express {
  const app = express();
  app.use(express.json());
  app.use(healthRouter);
  app.use(createAuthModule(db, { jwtSecret: options.jwtSecret }));
  app.use(createDashboardModule(db, { jwtSecret: options.jwtSecret }));
  // Ruta comodín /:code: debe montarse al final de los routers.
  app.use(createUrlsModule(db, { jwtSecret: options.jwtSecret }));
  app.use(notFoundHandler, errorHandler);
  return app;
}
