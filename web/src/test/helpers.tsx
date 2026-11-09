import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { App } from '../App';
import { AuthProvider } from '../auth/AuthContext';

export const USER = { id: 1, email: 'ana@test.com', name: 'Ana', createdAt: '2026-11-09T10:00:00.000Z' };
export const TOKEN = 'token-de-prueba';

export const jsonResponse = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
  });

export const apiError = (status: number, code: string, message: string) =>
  jsonResponse(status, { error: { code, message } });

export const SUMMARY = {
  period: { days: 30, from: '2026-10-11', to: '2026-11-09', timezone: 'UTC' },
  totals: { urls: 1, clicks: 5, avgClicksPerUrl: 5, urlsWithoutClicks: 0 },
  trends: { clicksByDay: [], comparison: { current: 5, previous: 0, changePct: null } },
};
export const URL_ITEM = {
  id: 1, code: 'wiki', longUrl: 'https://www.wikipedia.org/', userId: 1,
  createdAt: '2026-11-01T10:00:00.000Z', clicks: 5, shortUrl: 'http://localhost:3000/wiki',
};

export function signIn() {
  localStorage.setItem('snap.session', JSON.stringify({ user: USER, token: TOKEN }));
}

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

/** Sustituye fetch: cada petición se resuelve con el handler y queda registrada en `calls`. */
export function mockFetch(handler: Handler) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url, init });
      return handler(url, init);
    }),
  );
  return calls;
}

export function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

/** Backend feliz para el dashboard de un usuario con un enlace. */
export const dashboardOk: Handler = (url, init) => {
  if (url.startsWith('/api/dashboard')) return jsonResponse(200, SUMMARY);
  if (url === '/api/urls' && (init.method ?? 'GET') === 'GET') return jsonResponse(200, [URL_ITEM]);
  return jsonResponse(404, { error: { code: 'not_found', message: 'Ruta no encontrada' } });
};
