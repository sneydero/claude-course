import type { AuthResult } from '../api/types';

const KEY = 'snap.session';

export function loadSession(): AuthResult | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<AuthResult>;
    return s.token && s.user ? (s as AuthResult) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthResult | null): void {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch {
    /* almacenamiento no disponible: la sesión vive solo en memoria */
  }
}
