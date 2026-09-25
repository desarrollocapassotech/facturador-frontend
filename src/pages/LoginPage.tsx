import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, type OpcionTenant } from '@/auth/auth-context';
import { ApiError } from '@/lib/api';

/** Solo se vuelve a rutas internas (evita redirecciones abiertas). */
function destinoSeguro(desde: unknown): string {
  return typeof desde === 'string' && desde.startsWith('/') && !desde.startsWith('//') ? desde : '/';
}

export function LoginPage() {
  const { estado, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const destino = destinoSeguro((location.state as { desde?: unknown } | null)?.desde);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenants, setTenants] = useState<OpcionTenant[] | null>(null);
  const [tenantSlug, setTenantSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (estado === 'autenticado') return <Navigate to={destino} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const res = await login(email, password, tenants ? tenantSlug : undefined);
      if (res.ok) {
        navigate(destino, { replace: true });
      } else {
        setTenants(res.elegirTenant);
        setTenantSlug(res.elegirTenant[0]?.slug ?? '');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setEnviando(false);
    }
  }

  function cambiarCredenciales() {
    setTenants(null);
    setTenantSlug('');
  }

  const inputClase =
    'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-100';

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">Facturador</h1>
        <p className="mb-6 text-sm text-slate-500">Ingresá con tu email y contraseña.</p>

        <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              disabled={tenants !== null}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClase}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              disabled={tenants !== null}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClase}
            />
          </div>

          {tenants && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">¿Con qué empresa querés ingresar?</legend>
              {tenants.map((t) => (
                <label key={t.slug} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="tenant"
                    value={t.slug}
                    checked={tenantSlug === t.slug}
                    onChange={() => setTenantSlug(t.slug)}
                  />
                  {t.nombre}
                </label>
              ))}
              <button type="button" onClick={cambiarCredenciales} className="text-xs text-slate-500 underline">
                Usar otro email
              </button>
            </fieldset>
          )}

          {error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </main>
  );
}
