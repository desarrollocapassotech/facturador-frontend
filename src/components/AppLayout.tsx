import { useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/auth/auth-context';

const NAV = [
  { a: '/comprobantes', texto: 'Comprobantes' },
  { a: '/importaciones', texto: 'Importaciones' },
  { a: '/recibos', texto: 'Recibos' },
  { a: '/clientes', texto: 'Clientes' },
  { a: '/configuracion', texto: 'Configuración' },
];

export function AppLayout() {
  const { usuario, tenant, logout } = useAuth();
  const queryClient = useQueryClient();

  function salir() {
    queryClient.clear(); // no dejar datos de la empresa en memoria para la próxima sesión
    logout();
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold tracking-tight">Facturador</span>
              {tenant && <span className="text-sm text-slate-500">· {tenant.nombre}</span>}
              {tenant?.ambienteArca === 'HOMOLOGACION' && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  Ambiente de pruebas
                </span>
              )}
            </div>
            <nav className="flex gap-1 text-sm">
              {NAV.map((n) => (
                <NavLink
                  key={n.a}
                  to={n.a}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 ${isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`
                  }
                >
                  {n.texto}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-600 sm:inline">{usuario?.nombre ?? usuario?.email}</span>
            <button type="button" onClick={salir} className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-100">
              Salir
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
