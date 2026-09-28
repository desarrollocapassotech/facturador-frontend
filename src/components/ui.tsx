import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { ApiError } from '@/lib/api';

export const claseInput =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-100 disabled:text-slate-500';

type Variante = 'primario' | 'secundario' | 'peligro' | 'fantasma';
const VARIANTES: Record<Variante, string> = {
  primario: 'bg-slate-900 text-white hover:bg-slate-800',
  secundario: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
  peligro: 'bg-red-600 text-white hover:bg-red-700',
  fantasma: 'text-slate-600 hover:bg-slate-100',
};

export function Boton({
  variante = 'primario',
  cargando,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; cargando?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || cargando}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTES[variante]} ${className}`}
    >
      {cargando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

export function Campo({ etiqueta, ayuda, children, className = '' }: { etiqueta: string; ayuda?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`block space-y-1 ${className}`}>
      <span className="text-sm font-medium text-slate-700">{etiqueta}</span>
      {children}
      {ayuda && <span className="block text-xs text-slate-500">{ayuda}</span>}
    </label>
  );
}

export function Entrada(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${claseInput} ${props.className ?? ''}`} />;
}

export function Selector(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${claseInput} ${props.className ?? ''}`} />;
}

export function Tarjeta({ titulo, acciones, children, className = '' }: { titulo?: ReactNode; acciones?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      {(titulo || acciones) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          {titulo && <h2 className="text-sm font-semibold text-slate-800">{titulo}</h2>}
          {acciones}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Etiqueta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>{children}</span>;
}

/** Error de la API: mensaje amigable + detalle técnico desplegable (patrón de Vialto). */
export function AlertaError({ error, mensaje, detalle }: { error?: unknown; mensaje?: string | null; detalle?: string | null }) {
  const [abierto, setAbierto] = useState(false);
  const texto = mensaje ?? (error instanceof ApiError || error instanceof Error ? error.message : error ? 'Ocurrió un error.' : null);
  const det = detalle ?? (error instanceof ApiError ? ((error.body as { detalle?: string } | null)?.detalle ?? null) : null);
  if (!texto) return null;
  return (
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      <p>{texto}</p>
      {det && (
        <div className="mt-1">
          <button type="button" className="text-xs underline" onClick={() => setAbierto((v) => !v)}>
            {abierto ? 'Ocultar detalle técnico' : 'Ver detalle técnico'}
          </button>
          {abierto && (
            <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-all rounded bg-white p-2 text-xs text-slate-700">{det}</pre>
          )}
        </div>
      )}
    </div>
  );
}

export function Aviso({ children, tono = 'ambar' }: { children: ReactNode; tono?: 'ambar' | 'azul' | 'verde' }) {
  const clases = {
    ambar: 'border-amber-200 bg-amber-50 text-amber-900',
    azul: 'border-blue-200 bg-blue-50 text-blue-900',
    verde: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  }[tono];
  return <div className={`rounded-md border px-3 py-2 text-sm ${clases}`}>{children}</div>;
}

export function Modal({ abierto, titulo, onCerrar, children }: { abierto: boolean; titulo: string; onCerrar: () => void; children: ReactNode }) {
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center" onMouseDown={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="w-full max-w-lg rounded-lg bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="font-semibold">{titulo}</h2>
          <button type="button" onClick={onCerrar} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Cerrar">
            ✕
          </button>
        </header>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return <p className="py-8 text-center text-sm text-slate-500">{texto}</p>;
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-slate-500">{children}</p>;
}
