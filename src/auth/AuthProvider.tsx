import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, registrarOnNoAutorizado } from '@/lib/api';
import { borrar, guardar, leer } from '@/lib/storage';
import { AuthContext, type AuthState, type OpcionTenant, type TenantSesion, type Usuario } from './auth-context';

const CLAVE_TOKEN = 'facturador.sesion';

interface SesionResponse {
  accessToken: string;
  usuario: Usuario;
  tenant: TenantSesion;
}

interface PerfilResponse {
  usuario: Usuario;
  tenant: TenantSesion;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const tokenRef = useRef<string | null>(leer(CLAVE_TOKEN));
  const [estado, setEstado] = useState<AuthState['estado']>(tokenRef.current ? 'cargando' : 'anonimo');
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [tenant, setTenant] = useState<TenantSesion | null>(null);

  const logout = useCallback(() => {
    tokenRef.current = null;
    borrar(CLAVE_TOKEN);
    setUsuario(null);
    setTenant(null);
    setEstado('anonimo');
  }, []);

  // Sesión vencida o revocada en cualquier request → volver al login.
  useEffect(() => {
    registrarOnNoAutorizado(logout);
    return () => registrarOnNoAutorizado(null);
  }, [logout]);

  // Al abrir la app con un token guardado, confirmar que sigue siendo válido.
  useEffect(() => {
    const token = tokenRef.current;
    if (!token) return;
    const controller = new AbortController();
    api<PerfilResponse>('/auth/me', { token, signal: controller.signal })
      .then((perfil) => {
        setUsuario(perfil.usuario);
        setTenant(perfil.tenant);
        setEstado('autenticado');
      })
      .catch((err: unknown) => {
        if ((err as Error).name === 'AbortError') return;
        logout();
      });
    return () => controller.abort();
  }, [logout]);

  const login = useCallback<AuthState['login']>(async (email, password, tenantSlug) => {
    try {
      const sesion = await api<SesionResponse>('/auth/login', {
        method: 'POST',
        body: { email, password, ...(tenantSlug ? { tenantSlug } : {}) },
      });
      tokenRef.current = sesion.accessToken;
      guardar(CLAVE_TOKEN, sesion.accessToken);
      const perfil = await api<PerfilResponse>('/auth/me', { token: sesion.accessToken });
      setUsuario(perfil.usuario);
      setTenant(perfil.tenant);
      setEstado('autenticado');
      return { ok: true };
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const tenants = (err.body as { tenants?: OpcionTenant[] } | null)?.tenants ?? [];
        return { ok: false, elegirTenant: tenants };
      }
      throw err;
    }
  }, []);

  const valor = useMemo<AuthState>(
    () => ({ estado, usuario, tenant, getToken: () => tokenRef.current, login, logout }),
    [estado, usuario, tenant, login, logout],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}
