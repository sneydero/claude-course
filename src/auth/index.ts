import type Database from 'better-sqlite3';
import type { Router } from 'express';
import { createAuthRepository } from './auth.repository.js';
import { createAuthRouter } from './auth.routes.js';
import { createAuthService, type AuthOptions } from './auth.service.js';

export function createAuthModule(db: Database.Database, options: AuthOptions): Router {
  return createAuthRouter(createAuthService(createAuthRepository(db), options));
}
