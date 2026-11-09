export interface PublicUser {
  id: number;
  email: string;
  name: string;
  createdAt: string;
}

export interface AuthResult {
  user: PublicUser;
  token: string;
}

export interface UrlItem {
  id: number;
  code: string;
  longUrl: string;
  userId: number | null;
  createdAt: string;
  clicks: number;
  shortUrl: string;
}

export type CreatedUrl = Omit<UrlItem, 'clicks'>;

export interface DashboardSummary {
  period: { days: number; from: string; to: string; timezone: string };
  totals: { urls: number; clicks: number; avgClicksPerUrl: number; urlsWithoutClicks: number };
  trends: {
    clicksByDay: { date: string; clicks: number }[];
    comparison: { current: number; previous: number; changePct: number | null };
  };
}
