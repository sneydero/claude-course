import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

/** Rutas que exigen sesión. */
export function RequireAuth() {
  const { token } = useAuth();
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}

/** Login/registro: si ya hay sesión, va directo al dashboard. */
export function GuestOnly() {
  const { token } = useAuth();
  return token ? <Navigate to="/dashboard" replace /> : <Outlet />;
}
