import { BadRequestError } from '../shared/errors.js';
import type { DashboardRepository } from './dashboard.repository.js';

export const DEFAULT_DAYS = 30;
export const MAX_DAYS = 90;
const DAY_MS = 86_400_000;

export interface DashboardResponse {
  period: { days: number; from: string; to: string; timezone: 'UTC' };
  totals: { urls: number; clicks: number; avgClicksPerUrl: number; urlsWithoutClicks: number };
  trends: {
    clicksByDay: { date: string; clicks: number }[];
    comparison: { current: number; previous: number; changePct: number | null };
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export function parseDays(input: unknown): number {
  if (input === undefined) return DEFAULT_DAYS;
  if (typeof input !== 'string' || !/^\d+$/.test(input)) {
    throw new BadRequestError('days debe ser un entero');
  }
  const days = Number(input);
  if (days < 1 || days > MAX_DAYS) {
    throw new BadRequestError(`days debe estar entre 1 y ${MAX_DAYS}`);
  }
  return days;
}

export function createDashboardService(repo: DashboardRepository, now: () => Date = () => new Date()) {
  return {
    getDashboard(userId: number, days: number): DashboardResponse {
      const today = now();
      const todayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      // Los límites se calculan una sola vez para que serie y comparación sean coherentes.
      const start = new Date(todayStart.getTime() - (days - 1) * DAY_MS);
      const prevStart = new Date(start.getTime() - days * DAY_MS);

      const totals = repo.totals(userId);
      const rows = repo.clicksByDay(userId, start.toISOString());
      const counts = new Map(rows.map((r) => [r.day, r.clicks]));
      const clicksByDay = Array.from({ length: days }, (_, i) => {
        const date = isoDay(new Date(start.getTime() + i * DAY_MS));
        return { date, clicks: counts.get(date) ?? 0 };
      });

      const cmp = repo.comparison(userId, start.toISOString(), prevStart.toISOString());

      return {
        period: { days, from: isoDay(start), to: isoDay(todayStart), timezone: 'UTC' },
        totals: {
          urls: totals.totalUrls,
          clicks: totals.totalClicks,
          avgClicksPerUrl: totals.totalUrls ? round2(totals.totalClicks / totals.totalUrls) : 0,
          urlsWithoutClicks: totals.totalUrls - totals.urlsWithClicks,
        },
        trends: {
          clicksByDay,
          comparison: {
            current: cmp.current,
            previous: cmp.previous,
            changePct: cmp.previous ? round2(((cmp.current - cmp.previous) / cmp.previous) * 100) : null,
          },
        },
      };
    },
  };
}

export type DashboardService = ReturnType<typeof createDashboardService>;
