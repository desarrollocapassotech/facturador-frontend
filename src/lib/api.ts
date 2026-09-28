export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Opciones = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

let onNoAutorizado: (() => void) | null = null;

/** El AuthProvider registra acá qué hacer cuando el backend responde 401 a una request con sesión. */
export function registrarOnNoAutorizado(handler: (() => void) | null) {
  onNoAutorizado = handler;
}

function mensajeDeError(status: number, body: unknown): string {
  if (status === 429) return 'Demasiados intentos. Esperá un minuto y volvé a probar.';
  const msg = (body as { message?: unknown } | null)?.message;
  if (Array.isArray(msg)) return msg.join(' ');
  if (typeof msg === 'string' && msg.trim()) return msg;
  if (status >= 500) return 'Error del servidor. Probá de nuevo en unos minutos.';
  return `Error ${status}`;
}

export async function api<T>(ruta: string, { method = 'GET', body, token, signal, headers }: Opciones = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${ruta}`, {
      method,
      signal,
      headers: {
        ...headers,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'No se pudo conectar con el servidor.', null);
  }

  const texto = await res.text();
  let data: unknown = null;
  try {
    data = texto ? JSON.parse(texto) : null;
  } catch {
    data = texto;
  }

  if (!res.ok) {
    if (res.status === 401 && token) onNoAutorizado?.();
    throw new ApiError(res.status, mensajeDeError(res.status, data), data);
  }
  return data as T;
}
