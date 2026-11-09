import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createTestApp } from './helpers.js';
import { errorHandler, notFoundHandler } from '../src/shared/error-handler.js';
import { BadRequestError } from '../src/shared/errors.js';

describe('manejo de errores', () => {
  it('404 JSON para rutas desconocidas', async () => {
    const res = await request(createTestApp().app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });

  it('400 para JSON malformado', async () => {
    const res = await request(createTestApp().app)
      .post('/health')
      .set('Content-Type', 'application/json')
      .send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
  });

  it('respeta HttpError y oculta detalles de errores 500', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = express();
    app.get('/bad', () => {
      throw new BadRequestError('falta url');
    });
    app.get('/boom', () => {
      throw new Error('secreto interno');
    });
    app.use(notFoundHandler, errorHandler);

    const bad = await request(app).get('/bad');
    expect(bad.status).toBe(400);
    expect(bad.body.error.message).toBe('falta url');

    const boom = await request(app).get('/boom');
    expect(boom.status).toBe(500);
    expect(JSON.stringify(boom.body)).not.toContain('secreto');
    spy.mockRestore();
  });
});
