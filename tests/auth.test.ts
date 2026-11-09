import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it } from 'vitest';
import { createAuthRepository } from '../src/auth/auth.repository.js';
import { createAuthService, type AuthService } from '../src/auth/auth.service.js';
import { migrate } from '../src/db/schema.js';
import { ConflictError, UnauthorizedError } from '../src/shared/errors.js';

const SECRET = 'test-secret';
const PASSWORD = 'password-seguro-123';

let db: Database.Database;
let auth: AuthService;

beforeEach(() => {
  db = new Database(':memory:');
  migrate(db);
  auth = createAuthService(createAuthRepository(db), { jwtSecret: SECRET });
});

describe('register', () => {
  it('registra un usuario, guarda el password hasheado y devuelve un JWT que expira en 24h', async () => {
    const { token } = await auth.register('Ana@Example.com', PASSWORD, 'Ana');

    const row = db.prepare('SELECT * FROM users').get() as {
      id: number;
      email: string;
      password_hash: string;
      name: string;
    };
    expect(row.email).toBe('ana@example.com');
    expect(row.name).toBe('Ana');
    expect(row.password_hash).not.toBe(PASSWORD);
    expect(row.password_hash).toMatch(/^\$2[aby]\$/);

    const payload = jwt.verify(token, SECRET) as jwt.JwtPayload;
    expect(payload.sub).toBe(String(row.id));
    expect(payload.exp! - payload.iat!).toBe(24 * 60 * 60);
  });

  it('falla con email duplicado, incluso con distinta capitalización', async () => {
    await auth.register('ana@example.com', PASSWORD, 'Ana');
    await expect(auth.register('ana@example.com', PASSWORD, 'Otra')).rejects.toBeInstanceOf(ConflictError);
    await expect(auth.register('ANA@EXAMPLE.COM', PASSWORD, 'Otra')).rejects.toBeInstanceOf(ConflictError);
    expect(db.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({ n: 1 });
  });
});

describe('login', () => {
  beforeEach(async () => {
    await auth.register('ana@example.com', PASSWORD, 'Ana');
  });

  it('devuelve un JWT válido con credenciales correctas', async () => {
    const { token } = await auth.login('ana@example.com', PASSWORD);
    const payload = jwt.verify(token, SECRET) as jwt.JwtPayload;
    const row = db.prepare('SELECT id FROM users').get() as { id: number };
    expect(payload.sub).toBe(String(row.id));
  });

  it('falla con password incorrecto', async () => {
    await expect(auth.login('ana@example.com', 'otro-password')).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('falla con email inexistente', async () => {
    await expect(auth.login('nadie@example.com', PASSWORD)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('funciona con el email en mayúsculas', async () => {
    await expect(auth.login('ANA@EXAMPLE.COM', PASSWORD)).resolves.toHaveProperty('token', expect.any(String));
  });
});

describe('migrate', () => {
  it('añade user_id a una tabla urls antigua sin perder datos y es idempotente', () => {
    const old = new Database(':memory:');
    old.exec(`CREATE TABLE urls (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE,
      long_url TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT 'x');
      INSERT INTO urls (code, long_url) VALUES ('abc', 'https://a.com/');`);
    migrate(old);
    migrate(old);
    expect(old.prepare('SELECT code, user_id FROM urls').get()).toEqual({ code: 'abc', user_id: null });
  });
});
