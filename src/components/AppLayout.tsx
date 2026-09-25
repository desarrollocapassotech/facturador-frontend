import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/auth/auth-context';

export function AppLayout() {
  const { usuario, tenant, logout } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <NavLink to="/" className="font-semibold tracking-tight">
              Facturador
            </NavLink>
            {tenant && <span className="text-sm text-slate-500">{tenant.nombre}</span>}
            {tenant?.ambienteArca === 'HOMOLOGACION' && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                Ambiente de pruebas
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-600">{usuario?.nombre ?? usuario?.email}</span>
            <button
              type="button"
              onClick={logout}
              className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-100"
            >
              Salir
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
