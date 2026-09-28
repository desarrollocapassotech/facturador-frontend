import { createContext, useContext } from 'react';

export interface Usuario {
  id: string;
  email: string;
  nombre: string | null;
}

export interface TenantSesion {
  id: string;
  slug: string;
  nombre: string;
  ambienteArca?: 'HOMOLOGACION' | 'PRODUCCION';
}

export interface OpcionTenant {
  slug: string;
  nombre: string;
}

export type ResultadoLogin = { ok: true } | { ok: false; elegirTenant: OpcionTenant[] };

/**
 * Misma forma que expone Clerk (`useAuth().getToken()`), para poder reemplazar
 * el login propio sin tocar las pantallas.
 */
export interface AuthState {
  estado: 'cargando' | 'anonimo' | 'autenticado';
  usuario: Usuario | null;
  tenant: TenantSesion | null;
  getToken: () => string | null;
  login: (email: string, password: string, tenantSlug?: string) => Promise<ResultadoLogin>;
  /** Canjea un token de acceso de un solo uso (ver /acceso). Devuelve a dónde ir. */
  canjearAcceso: (token: string) => Promise<{ destino: string | null }>;
  logout: () => void;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth tiene que usarse dentro de <AuthProvider>.');
  return ctx;
}
