import { useCallback } from 'react';
import { useAuth } from '@/auth/auth-context';
import { api, ApiError, API_URL } from './api';

type Metodo = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

async function errorDeRespuesta(res: Response): Promise<ApiError> {
  const data = await res.json().catch(() => null);
  const msg = (data as { message?: unknown } | null)?.message;
  return new ApiError(res.status, typeof msg === 'string' ? msg : `Error ${res.status}`, data);
}

/** Cliente de la API con la sesión actual. */
export function useApi() {
  const { getToken, logout } = useAuth();

  const pedir = useCallback(
    <T>(ruta: string, method: Metodo = 'GET', body?: unknown, headers?: Record<string, string>) =>
      api<T>(ruta, { method, body, headers, token: getToken() }),
    [getToken],
  );

  const subir = useCallback(
    async <T>(ruta: string, campo: string, archivo: File): Promise<T> => {
      const form = new FormData();
      form.append(campo, archivo);
      const res = await fetch(`${API_URL}${ruta}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      });
      if (!res.ok) {
        if (res.status === 401) logout();
        throw await errorDeRespuesta(res);
      }
      return (await res.json()) as T;
    },
    [getToken, logout],
  );

  /** Descarga un archivo autenticado (PDF) y dispara la descarga en el navegador. */
  const descargar = useCallback(
    async (ruta: string, nombrePorDefecto: string) => {
      const res = await fetch(`${API_URL}${ruta}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) {
        if (res.status === 401) logout();
        throw await errorDeRespuesta(res);
      }
      const nombre = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? nombrePorDefecto;
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    },
    [getToken, logout],
  );

  /** Trae una imagen autenticada como object URL (para previsualizar el logo). */
  const imagen = useCallback(
    async (ruta: string): Promise<string | null> => {
      const res = await fetch(`${API_URL}${ruta}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) return null;
      return URL.createObjectURL(await res.blob());
    },
    [getToken],
  );

  return { pedir, subir, descargar, imagen };
}
