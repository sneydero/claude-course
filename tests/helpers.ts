import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../src/app.js';
import { migrate } from '../src/db/schema.js';

export const TEST_SECRET = 'test-secret';

export function createTestApp() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return { app: createApp(db, { jwtSecret: TEST_SECRET }), db };
}

/** Registra un usuario vía HTTP y devuelve su token y datos. */
export async function registerUser(
  app: ReturnType<typeof createTestApp>['app'],
  email = 'user@example.com',
): Promise<{ token: string; user: { id: number; email: string } }> {
  const res = await request(app)
    .post('/auth/register')
    .send({ email, password: 'password-seguro-123', name: 'Test' });
  return res.body;
}

export const bearer = (token: string): [string, string] => ['Authorization', `Bearer ${token}`];
