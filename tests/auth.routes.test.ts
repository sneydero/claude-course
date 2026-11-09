import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createTestApp } from './helpers.js';

const valid = { email: 'ana@example.com', password: 'password-seguro-123', name: 'Ana' };

describe('POST /auth/register', () => {
  it('crea el usuario y devuelve 201 con usuario y token, sin exponer el hash', async () => {
    const { app } = createTestApp();
    const res = await request(app).post('/auth/register').send(valid);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'ana@example.com', name: 'Ana' });
    expect(res.body.user.id).toEqual(expect.any(Number));
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.user).not.toHaveProperty('password_hash');
    const payload = jwt.verify(res.body.token, 'test-secret') as jwt.JwtPayload;
    expect(payload.sub).toBe(String(res.body.user.id));
  });

  it('normaliza el email a minúsculas', async () => {
    const res = await request(createTestApp().app)
      .post('/auth/register')
      .send({ ...valid, email: 'ANA@Example.COM' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('ana@example.com');
  });

  it.each([
    ['sin email', { ...valid, email: undefined }],
    ['email sin @', { ...valid, email: 'no-es-email' }],
    ['email sin dominio', { ...valid, email: 'ana@' }],
    ['email no string', { ...valid, email: 123 }],
    ['password corto', { ...valid, password: 'corto' }],
    ['sin password', { ...valid, password: undefined }],
    ['password > 72 bytes', { ...valid, password: 'a'.repeat(73) }],
    ['sin nombre', { ...valid, name: undefined }],
    ['nombre vacío', { ...valid, name: '   ' }],
  ])('responde 400 %s', async (_label, body) => {
    const { app, db } = createTestApp();
    const res = await request(app).post('/auth/register').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
    expect(db.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({ n: 0 });
  });

  it('responde 400 sin body', async () => {
    const res = await request(createTestApp().app).post('/auth/register');
    expect(res.status).toBe(400);
  });

  it('responde 400 con JSON malformado', async () => {
    const res = await request(createTestApp().app)
      .post('/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(res.status).toBe(400);
  });

  it('responde 409 con email duplicado (incluso con otra capitalización)', async () => {
    const { app } = createTestApp();
    await request(app).post('/auth/register').send(valid);
    const res = await request(app)
      .post('/auth/register')
      .send({ ...valid, email: 'ANA@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('conflict');
  });
});

describe('POST /auth/login', () => {
  it('devuelve 200 con usuario y token válidos', async () => {
    const { app } = createTestApp();
    const reg = await request(app).post('/auth/register').send(valid);
    const res = await request(app)
      .post('/auth/login')
      .send({ email: valid.email, password: valid.password });

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(reg.body.user);
    const payload = jwt.verify(res.body.token, 'test-secret') as jwt.JwtPayload;
    expect(payload.sub).toBe(String(reg.body.user.id));
    expect(payload.exp! - payload.iat!).toBe(24 * 60 * 60);
  });

  it('acepta el email en mayúsculas', async () => {
    const { app } = createTestApp();
    await request(app).post('/auth/register').send(valid);
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'ANA@EXAMPLE.COM', password: valid.password });
    expect(res.status).toBe(200);
  });

  it('responde 401 con password incorrecto', async () => {
    const { app } = createTestApp();
    await request(app).post('/auth/register').send(valid);
    const res = await request(app)
      .post('/auth/login')
      .send({ email: valid.email, password: 'incorrecto-123' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  it('responde 401 con email inexistente, con el mismo mensaje que password incorrecto', async () => {
    const { app } = createTestApp();
    await request(app).post('/auth/register').send(valid);
    const wrongPwd = await request(app)
      .post('/auth/login')
      .send({ email: valid.email, password: 'incorrecto-123' });
    const noUser = await request(app)
      .post('/auth/login')
      .send({ email: 'nadie@example.com', password: valid.password });
    expect(noUser.status).toBe(401);
    expect(noUser.body).toEqual(wrongPwd.body);
  });

  it.each([
    ['sin email', { password: 'x' }],
    ['sin password', { email: 'ana@example.com' }],
    ['password no string', { email: 'ana@example.com', password: 123 }],
  ])('responde 400 %s', async (_label, body) => {
    const res = await request(createTestApp().app).post('/auth/login').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
  });

  it('responde 400 sin body', async () => {
    const res = await request(createTestApp().app).post('/auth/login');
    expect(res.status).toBe(400);
  });
});
