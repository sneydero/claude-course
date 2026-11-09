import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as authApi from '../api/auth';
import { setUnauthorizedHandler } from '../api/client';
import type { AuthResult, PublicUser } from '../api/types';
import { loadSession, saveSession } from './storage';

interface AuthState {
  user: PublicUser | null;
  token: string | null;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string, name: string): Promise<void>;
  logout(): void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthResult | null>(loadSession);

  const start = useCallback((s: AuthResult) => {
    saveSession(s);
    setSession(s);
  }, []);

  // Token caducado o inválido en una ruta protegida: se limpia la sesión y los guards redirigen a /login.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      saveSession(null);
      setSession(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      login: async (email, password) => start(await authApi.login(email, password)),
      register: async (email, password, name) => start(await authApi.register(email, password, name)),
      logout: () => {
        saveSession(null);
        setSession(null);
      },
    }),
    [session, start],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
