import { getJson, postJson } from './client';
import type { CreatedUrl, DashboardSummary, UrlItem } from './types';

export const listUrls = () => getJson<UrlItem[]>('/api/urls');

export const createUrl = (url: string, alias?: string) =>
  postJson<CreatedUrl>('/api/urls', alias ? { url, alias } : { url }, true);

export const getDashboard = (days = 30) => getJson<DashboardSummary>(`/api/dashboard?days=${days}`);
