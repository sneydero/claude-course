import type Database from 'better-sqlite3';

export interface TotalsRow {
  totalUrls: number;
  totalClicks: number;
  urlsWithClicks: number;
}

export interface DayRow {
  day: string;
  clicks: number;
}

export interface ComparisonRow {
  current: number;
  previous: number;
}

/** Todas las queries filtran por `u.user_id`: un usuario nunca ve datos ajenos. */
export function createDashboardRepository(db: Database.Database) {
  const totals = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM urls WHERE user_id = :uid) AS totalUrls,
      COUNT(c.id)              AS totalClicks,
      COUNT(DISTINCT c.url_id) AS urlsWithClicks
    FROM clicks c JOIN urls u ON u.id = c.url_id
    WHERE u.user_id = :uid
  `);

  const byDay = db.prepare(`
    SELECT date(c.clicked_at) AS day, COUNT(*) AS clicks
    FROM clicks c JOIN urls u ON u.id = c.url_id
    WHERE u.user_id = :uid AND c.clicked_at >= :since
    GROUP BY day ORDER BY day
  `);

  const comparison = db.prepare(`
    SELECT
      COALESCE(SUM(c.clicked_at >= :cur), 0)                           AS current,
      COALESCE(SUM(c.clicked_at <  :cur AND c.clicked_at >= :prev), 0) AS previous
    FROM clicks c JOIN urls u ON u.id = c.url_id
    WHERE u.user_id = :uid AND c.clicked_at >= :prev
  `);

  return {
    totals: (uid: number) => totals.get({ uid }) as TotalsRow,
    clicksByDay: (uid: number, since: string) => byDay.all({ uid, since }) as DayRow[],
    comparison: (uid: number, cur: string, prev: string) =>
      comparison.get({ uid, cur, prev }) as ComparisonRow,
  };
}

export type DashboardRepository = ReturnType<typeof createDashboardRepository>;
