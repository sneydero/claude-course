import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { generateCode } from '../src/urls/urls.service.js';
import { bearer, createTestApp, registerUser } from './helpers.js';

async function setup() {
  const { app, db } = createTestApp();
  const alice = await registerUser(app, 'alice@example.com');
  return { app, db, alice };
}

describe('generateCode', () => {
  it('genera códigos de 7 caracteres alfanuméricos', () => {
    expect(generateCode()).toMatch(/^[A-Za-z0-9]{7}$/);
  });
});

describe('POST /api/urls', () => {
  it('crea una URL corta asociada al usuario autenticado', async () => {
    const { app, db, alice } = await setup();
    const res = await request(app)
      .post('/api/urls')
      .set(...bearer(alice.token))
      .send({ url: 'https://example.com/a/b?x=1' });
    expect(res.status).toBe(201);
    expect(res.body.code).toMatch(/^[A-Za-z0-9]{7}$/);
    expect(res.body.longUrl).toBe('https://example.com/a/b?x=1');
    expect(res.body.userId).toBe(alice.user.id);
    expect(res.body.shortUrl).toContain(`/${res.body.code}`);
    const row = db.prepare('SELECT long_url, user_id FROM urls WHERE code = ?').get(res.body.code);
    expect(row).toEqual({ long_url: 'https://example.com/a/b?x=1', user_id: alice.user.id });
  });

  it('responde 401 sin token y no crea nada', async () => {
    const { app, db } = await setup();
    const res = await request(app).post('/api/urls').send({ url: 'https://example.com/' });
    expect(res.status).toBe(401);
    expect(db.prepare('SELECT COUNT(*) AS n FROM urls').get()).toEqual({ n: 0 });
  });

  it('responde 401 con token inválido', async () => {
    const { app } = await setup();
    const res = await request(app)
      .post('/api/urls')
      .set(...bearer('token-falso'))
      .send({ url: 'https://example.com/' });
    expect(res.status).toBe(401);
  });

  it.each([[undefined], [123], ['no-es-url'], ['javascript:alert(1)'], ['ftp://example.com']])(
    'rechaza url inválida (%s) con 400',
    async (url) => {
      const { app, alice } = await setup();
      const res = await request(app)
        .post('/api/urls')
        .set(...bearer(alice.token))
        .send({ url });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('bad_request');
    },
  );

  it('responde 400 sin body', async () => {
    const { app, alice } = await setup();
    const res = await request(app)
      .post('/api/urls')
      .set(...bearer(alice.token));
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/urls/:code', () => {
  async function createUrl(app: Parameters<typeof request>[0], token: string, url = 'https://example.com/') {
    const res = await request(app).post('/api/urls').set(...bearer(token)).send({ url });
    return res.body.code as string;
  }

  it('el dueño borra su URL (204) y deja de resolver', async () => {
    const { app, alice } = await setup();
    const code = await createUrl(app, alice.token);
    const res = await request(app).delete(`/api/urls/${code}`).set(...bearer(alice.token));
    expect(res.status).toBe(204);
    expect((await request(app).get(`/${code}`)).status).toBe(404);
  });

  it('responde 403 si la URL es de otro usuario y no la borra', async () => {
    const { app, alice } = await setup();
    const bob = await registerUser(app, 'bob@example.com');
    const code = await createUrl(app, alice.token);
    const res = await request(app).delete(`/api/urls/${code}`).set(...bearer(bob.token));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden');
    expect((await request(app).get(`/${code}`)).status).toBe(302);
  });

  it('responde 404 si el código no existe', async () => {
    const { app, alice } = await setup();
    const res = await request(app).delete('/api/urls/noexiste').set(...bearer(alice.token));
    expect(res.status).toBe(404);
  });

  it('responde 401 sin token y no borra', async () => {
    const { app, alice } = await setup();
    const code = await createUrl(app, alice.token);
    const res = await request(app).delete(`/api/urls/${code}`);
    expect(res.status).toBe(401);
    expect((await request(app).get(`/${code}`)).status).toBe(302);
  });

  it('responde 403 en URLs sin dueño (creadas antes de la autenticación)', async () => {
    const { app, db, alice } = await setup();
    db.prepare("INSERT INTO urls (code, long_url) VALUES ('legacy1', 'https://old.com/')").run();
    const res = await request(app).delete('/api/urls/legacy1').set(...bearer(alice.token));
    expect(res.status).toBe(403);
  });
});

describe('GET /:code (público)', () => {
  it('redirige 302 a la URL original sin autenticación', async () => {
    const { app, alice } = await setup();
    const created = await request(app)
      .post('/api/urls')
      .set(...bearer(alice.token))
      .send({ url: 'https://example.com/' });
    const res = await request(app).get(`/${created.body.code}`).redirects(0);
    expect(res.status).toBe(302);
    expect(res.headers['location']).toBe('https://example.com/');
  });

  it('responde 404 si el código no existe', async () => {
    const res = await request(createTestApp().app).get('/noexiste');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });

  it('no interfiere con /health', async () => {
    const res = await request(createTestApp().app).get('/health');
    expect(res.status).toBe(200);
  });
});

describe('GET /api/urls (autenticado)', () => {
  it('responde 401 sin token', async () => {
    const res = await request(createTestApp().app).get('/api/urls');
    expect(res.status).toBe(401);
  });

  it('lista vacía para un usuario sin URLs', async () => {
    const { app, alice } = await setup();
    const res = await request(app).get('/api/urls').set(...bearer(alice.token));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('lista solo las URLs del usuario, la más reciente primero, con shortUrl', async () => {
    const { app, alice } = await setup();
    const bob = await registerUser(app, 'bob@example.com');
    for (const url of ['https://a.com/', 'https://b.com/']) {
      await request(app).post('/api/urls').set(...bearer(alice.token)).send({ url });
    }
    await request(app).post('/api/urls').set(...bearer(bob.token)).send({ url: 'https://de-bob.com/' });

    const res = await request(app).get('/api/urls').set(...bearer(alice.token));
    expect(res.body.map((u: { longUrl: string }) => u.longUrl)).toEqual(['https://b.com/', 'https://a.com/']);
    expect(res.body[0].shortUrl).toContain(`/${res.body[0].code}`);
  });

  it('incluye el número de clicks de cada URL', async () => {
    const { app, alice } = await setup();
    const a = await request(app).post('/api/urls').set(...bearer(alice.token)).send({ url: 'https://a.com/' });
    await request(app).post('/api/urls').set(...bearer(alice.token)).send({ url: 'https://b.com/' });
    await request(app).get(`/${a.body.code}`).expect(302);
    await request(app).get(`/${a.body.code}`).expect(302);

    const res = await request(app).get('/api/urls').set(...bearer(alice.token));
    const byUrl = Object.fromEntries(res.body.map((u: { longUrl: string; clicks: number }) => [u.longUrl, u.clicks]));
    expect(byUrl).toEqual({ 'https://a.com/': 2, 'https://b.com/': 0 });
  });
});

describe('POST /api/urls con alias', () => {
  const create = (app: Parameters<typeof request>[0], token: string, body: object) =>
    request(app).post('/api/urls').set(...bearer(token)).send(body);

  it('usa el alias como código y resuelve el redirect', async () => {
    const { app, alice } = await setup();
    const res = await create(app, alice.token, { url: 'https://example.com/', alias: 'mi-enlace_1' });
    expect(res.status).toBe(201);
    expect(res.body.code).toBe('mi-enlace_1');
    expect(res.body.shortUrl).toContain('/mi-enlace_1');
    expect((await request(app).get('/mi-enlace_1')).status).toBe(302);
  });

  it('sin alias (o null) genera un código aleatorio', async () => {
    const { app, alice } = await setup();
    const res = await create(app, alice.token, { url: 'https://example.com/', alias: null });
    expect(res.body.code).toMatch(/^[A-Za-z0-9]{7}$/);
  });

  it('responde 409 si el alias ya existe, también de otro usuario', async () => {
    const { app, alice } = await setup();
    const bob = await registerUser(app, 'bob@example.com');
    await create(app, alice.token, { url: 'https://a.com/', alias: 'promo' }).expect(201);
    const res = await create(app, bob.token, { url: 'https://b.com/', alias: 'promo' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('conflict');
  });

  it.each([[''], ['ab'], ['a'.repeat(33)], ['con espacio'], ['ñandú'], ['a/b'], [123], ['api'], ['APP'], ['health'], ['auth']])(
    'rechaza el alias %j con 400',
    async (alias) => {
      const { app, db, alice } = await setup();
      const res = await create(app, alice.token, { url: 'https://example.com/', alias });
      expect(res.status).toBe(400);
      expect(db.prepare('SELECT COUNT(*) AS n FROM urls').get()).toEqual({ n: 0 });
    },
  );
});

describe('GET /:code — registro de clicks', () => {
  it('registra un click con el user-agent y no registra nada si el código no existe', async () => {
    const { app, db, alice } = await setup();
    const created = await request(app)
      .post('/api/urls')
      .set(...bearer(alice.token))
      .send({ url: 'https://example.com/' });
    const code = created.body.code as string;

    await request(app).get(`/${code}`).set('User-Agent', 'ua-test').expect(302);
    await request(app).get('/noexiste').expect(404);

    const rows = db.prepare('SELECT url_id, user_agent FROM clicks').all();
    expect(rows).toEqual([{ url_id: created.body.id, user_agent: 'ua-test' }]);
  });
});
