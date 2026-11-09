import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { bearer, createTestApp, registerUser } from './helpers.js';

const DAY_MS = 86_400_000;

/** Mediodía UTC de hace `n` días, en el mismo formato ISO que usa la columna. */
const noonDaysAgo = (n: number) => {
  const d = new Date(Date.now() - n * DAY_MS);
  d.setUTCHours(12, 0, 0, 0);
  return d.toISOString();
};

async function setup() {
  const { app, db } = createTestApp();
  const alice = await registerUser(app, 'alice@example.com');
  const bob = await registerUser(app, 'bob@example.com');
  const addUrl = (userId: number, code: string) =>
    Number(
      db.prepare('INSERT INTO urls (code, long_url, user_id) VALUES (?, ?, ?)').run(code, `https://example.com/${code}`, userId)
        .lastInsertRowid,
    );
  const addClick = (urlId: number, at: string) =>
    db.prepare('INSERT INTO clicks (url_id, clicked_at) VALUES (?, ?)').run(urlId, at);
  return { app, db, alice, bob, addUrl, addClick };
}

describe('GET /api/dashboard — autenticación', () => {
  it('responde 401 sin token', async () => {
    const { app } = await setup();
    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(401);
  });

  it('responde 401 con token inválido', async () => {
    const { app } = await setup();
    const res = await request(app).get('/api/dashboard').set(...bearer('token-falso'));
    expect(res.status).toBe(401);
  });
});

describe('GET /api/dashboard — usuario sin URLs', () => {
  it('devuelve todo a cero y una serie completa de días vacíos', async () => {
    const { app, alice } = await setup();
    const res = await request(app).get('/api/dashboard').set(...bearer(alice.token));
    expect(res.status).toBe(200);
    expect(res.body.period).toMatchObject({ days: 30, timezone: 'UTC' });
    expect(res.body.totals).toEqual({ urls: 0, clicks: 0, avgClicksPerUrl: 0, urlsWithoutClicks: 0 });
    expect(res.body.trends.clicksByDay).toHaveLength(30);
    expect(res.body.trends.clicksByDay.every((d: { clicks: number }) => d.clicks === 0)).toBe(true);
    expect(res.body.trends.comparison).toEqual({ current: 0, previous: 0, changePct: null });
  });
});

describe('GET /api/dashboard — usuario con URLs y clicks', () => {
  it('calcula totales, serie diaria y comparación correctamente', async () => {
    const { app, alice, addUrl, addClick } = await setup();
    const a = addUrl(alice.user.id, 'aaaaaaa');
    const b = addUrl(alice.user.id, 'bbbbbbb');
    addUrl(alice.user.id, 'ccccccc'); // sin clicks

    addClick(a, new Date().toISOString()); // hoy
    addClick(a, noonDaysAgo(3));
    addClick(a, noonDaysAgo(3));
    addClick(b, noonDaysAgo(3));
    addClick(b, noonDaysAgo(40)); // periodo anterior (días 30–59)
    addClick(b, noonDaysAgo(45)); // periodo anterior
    addClick(a, noonDaysAgo(200)); // fuera de ambos periodos, cuenta en totales

    const res = await request(app).get('/api/dashboard').set(...bearer(alice.token));
    expect(res.status).toBe(200);

    expect(res.body.totals).toEqual({
      urls: 3,
      clicks: 7,
      avgClicksPerUrl: 2.33,
      urlsWithoutClicks: 1,
    });

    const series: { date: string; clicks: number }[] = res.body.trends.clicksByDay;
    expect(series).toHaveLength(30);
    expect(series.map((d) => d.date)).toEqual([...series.map((d) => d.date)].sort());
    expect(series[series.length - 1]!.date).toBe(res.body.period.to);
    expect(series[series.length - 1]!.clicks).toBe(1); // hoy
    expect(series.find((d) => d.date === noonDaysAgo(3).slice(0, 10))!.clicks).toBe(3);
    expect(series.reduce((s, d) => s + d.clicks, 0)).toBe(4);

    expect(res.body.trends.comparison).toEqual({ current: 4, previous: 2, changePct: 100 });
  });

  it('no mezcla datos de otros usuarios', async () => {
    const { app, alice, bob, addUrl, addClick } = await setup();
    const a = addUrl(alice.user.id, 'aaaaaaa');
    const b = addUrl(bob.user.id, 'bbbbbbb');
    addClick(a, noonDaysAgo(1));
    for (let i = 0; i < 5; i++) addClick(b, noonDaysAgo(1));

    const res = await request(app).get('/api/dashboard').set(...bearer(alice.token));
    expect(res.body.totals).toMatchObject({ urls: 1, clicks: 1 });
    expect(res.body.trends.comparison.current).toBe(1);
  });

  it('respeta ?days y valida su rango', async () => {
    const { app, alice } = await setup();
    const ok = await request(app).get('/api/dashboard?days=7').set(...bearer(alice.token));
    expect(ok.status).toBe(200);
    expect(ok.body.trends.clicksByDay).toHaveLength(7);

    for (const bad of ['0', '91', 'abc', '-3', '1.5']) {
      const res = await request(app).get(`/api/dashboard?days=${bad}`).set(...bearer(alice.token));
      expect(res.status, `days=${bad}`).toBe(400);
    }
  });

  it('el redirect registra clicks que luego aparecen en el dashboard', async () => {
    const { app, alice, addUrl } = await setup();
    addUrl(alice.user.id, 'aaaaaaa');
    await request(app).get('/aaaaaaa').set('User-Agent', 'test-agent').expect(302);
    await request(app).get('/aaaaaaa').expect(302);

    const res = await request(app).get('/api/dashboard').set(...bearer(alice.token));
    expect(res.body.totals).toMatchObject({ urls: 1, clicks: 2, urlsWithoutClicks: 0 });
    expect(res.body.trends.clicksByDay.at(-1).clicks).toBe(2);
  });

  it('borrar una URL con clicks funciona y desaparece del dashboard (cascade)', async () => {
    const { app, db, alice, addUrl, addClick } = await setup();
    const a = addUrl(alice.user.id, 'aaaaaaa');
    addClick(a, noonDaysAgo(1));

    await request(app).delete('/api/urls/aaaaaaa').set(...bearer(alice.token)).expect(204);
    expect(db.prepare('SELECT COUNT(*) AS n FROM clicks').get()).toEqual({ n: 0 });

    const res = await request(app).get('/api/dashboard').set(...bearer(alice.token));
    expect(res.body.totals).toEqual({ urls: 0, clicks: 0, avgClicksPerUrl: 0, urlsWithoutClicks: 0 });
  });
});
