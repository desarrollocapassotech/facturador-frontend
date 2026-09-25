import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth-context';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { estado } = useAuth();
  const location = useLocation();

  if (estado === 'cargando') {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Cargando…
      </div>
    );
  }

  if (estado === 'anonimo') {
    return <Navigate to="/login" replace state={{ desde: location.pathname + location.search }} />;
  }

  return <>{children}</>;
}
