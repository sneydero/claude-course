import { loadSession } from '../auth/storage';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let onUnauthorized: (() => void) | null = null;

/** El AuthProvider registra aquí cómo cerrar la sesión cuando una ruta protegida devuelve 401. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

interface Options {
  body?: unknown;
  /** Adjunta el Bearer de la sesión y cierra la sesión ante un 401. */
  auth?: boolean;
}

async function request<T>(method: string, path: string, { body, auth = false }: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = loadSession()?.token;
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network_error', 'No se pudo conectar con el servidor. Inténtalo de nuevo.');
  }

  const data: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    if (auth && res.status === 401) onUnauthorized?.();
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error;
    const fallback =
      res.status >= 500
        ? 'El servidor no está disponible. Inténtalo de nuevo en unos minutos.'
        : `Error inesperado (${res.status})`;
    throw new ApiError(res.status, err?.code ?? 'error', err?.message ?? fallback);
  }
  return data as T;
}

export const postJson = <T>(path: string, body: unknown, auth = false) => request<T>('POST', path, { body, auth });
export const getJson = <T>(path: string) => request<T>('GET', path, { auth: true });
