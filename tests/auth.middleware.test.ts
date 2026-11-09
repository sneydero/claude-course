import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createAuthMiddleware } from '../src/auth/auth.middleware.js';
import { errorHandler } from '../src/shared/error-handler.js';

const SECRET = 'test-secret';

function buildApp() {
  const app = express();
  app.get('/protected', createAuthMiddleware({ jwtSecret: SECRET }), (req, res) => {
    res.json({ user: req.user });
  });
  app.use(errorHandler);
  return app;
}

const sign = (payload: object = { sub: '42' }, secret = SECRET, options: jwt.SignOptions = {}) =>
  jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: '1h', ...options });

const get = (token?: string, scheme = 'Bearer') => {
  const req = request(buildApp()).get('/protected');
  return token === undefined ? req : req.set('Authorization', `${scheme} ${token}`);
};

describe('middleware de autenticación', () => {
  it('deja pasar un token válido y adjunta el usuario a la request', async () => {
    const res = await get(sign({ sub: '42' }));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: { id: 42 } });
  });

  it('acepta el esquema Bearer sin distinguir mayúsculas', async () => {
    const res = await get(sign(), 'bearer');
    expect(res.status).toBe(200);
  });

  it('responde 401 sin header Authorization', async () => {
    const res = await get();
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  it('responde 401 con token expirado', async () => {
    const expired = sign({ sub: '42' }, SECRET, { expiresIn: -10 });
    const res = await get(expired);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  it.each([
    ['token malformado', 'esto-no-es-un-jwt'],
    ['firmado con otro secreto', sign({ sub: '42' }, 'otro-secreto')],
    ['sin firma (alg none)', `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from('{"sub":"42"}').toString('base64url')}.`],
    ['sin sub', sign({})],
    ['sub no numérico', sign({ sub: 'abc' })],
  ])('responde 401 con %s', async (_label, token) => {
    const res = await get(token);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  it('responde 401 con esquema distinto de Bearer', async () => {
    const res = await get(sign(), 'Basic');
    expect(res.status).toBe(401);
  });

  it('responde 401 con "Bearer" sin token', async () => {
    const res = await request(buildApp()).get('/protected').set('Authorization', 'Bearer');
    expect(res.status).toBe(401);
  });
});
