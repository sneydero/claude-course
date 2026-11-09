import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import type { CreatedUrl, DashboardSummary, UrlItem } from '../api/types';
import { getDashboard, listUrls } from '../api/urls';
import { useAuth } from '../auth/AuthContext';
import { LinksTable } from '../components/LinksTable';
import { ShortenForm } from '../components/ShortenForm';
import { StatCard } from '../components/StatCard';

const DAYS = 30;

function changeHint(c: DashboardSummary['trends']['comparison']): string {
  if (c.changePct === null) return `${c.current} clicks en ${DAYS} días (sin datos previos)`;
  const sign = c.changePct > 0 ? '+' : '';
  return `${sign}${c.changePct}% vs. los ${DAYS} días anteriores`;
}

export function DashboardPage() {
  const { user, logout } = useAuth();
  const [urls, setUrls] = useState<UrlItem[] | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedUrl | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [list, dash] = await Promise.all([listUrls(), getDashboard(DAYS)]);
      setUrls(list);
      setSummary(dash);
    } catch (err) {
      // Un 401 ya cierra la sesión y los guards redirigen a /login.
      if (err instanceof ApiError && err.status === 401) return;
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar tus datos.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = summary?.totals;

  return (
    <div className="dashboard">
      <header className="topbar">
        <h1 className="brand">Snap</h1>
        <div className="topbar-user">
          <span className="muted">{user?.name}</span>
          <button type="button" className="secondary small" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main>
        <h2>Dashboard</h2>

        <section className="stats" aria-label="Resumen">
          <StatCard label="Enlaces" value={totals?.urls ?? '–'} />
          <StatCard label="Clicks totales" value={totals?.clicks ?? '–'} hint={summary && changeHint(summary.trends.comparison)} />
          <StatCard label="Media por enlace" value={totals?.avgClicksPerUrl ?? '–'} />
          <StatCard label="Sin clicks" value={totals?.urlsWithoutClicks ?? '–'} />
        </section>

        <section className="panel">
          <h3>Nuevo enlace</h3>
          <ShortenForm
            onCreated={(c) => {
              setCreated(c);
              void load();
            }}
          />
          {created && (
            <p className="success" role="status">
              Enlace creado: <a href={created.shortUrl} target="_blank" rel="noreferrer">{created.shortUrl}</a>
            </p>
          )}
        </section>

        <section className="panel">
          <h3>Mis enlaces</h3>
          {error ? (
            <div role="alert" className="error">
              {error} <button type="button" className="link" onClick={() => void load()}>Reintentar</button>
            </div>
          ) : urls === null ? (
            <p className="muted">Cargando…</p>
          ) : (
            <LinksTable urls={urls} highlightCode={created?.code} />
          )}
        </section>
      </main>
    </div>
  );
}
