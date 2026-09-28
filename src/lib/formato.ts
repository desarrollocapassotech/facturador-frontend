import type {
  Ambiente,
  CondicionIva,
  Concepto,
  EstadoComprobante,
  EstadoImportacion,
  EstadoItem,
  Moneda,
  OrigenItem,
  Scope,
  TipoComprobante,
  TipoDocumento,
  Unidad,
} from './tipos';

export const CONDICIONES_IVA: Record<CondicionIva, string> = {
  RESPONSABLE_INSCRIPTO: 'Responsable Inscripto',
  MONOTRIBUTO: 'Monotributo',
  EXENTO: 'Exento',
  CONSUMIDOR_FINAL: 'Consumidor final',
  NO_CATEGORIZADO: 'No categorizado',
  PROVEEDOR_EXTERIOR: 'Proveedor del exterior',
  CLIENTE_EXTERIOR: 'Cliente del exterior',
  IVA_LIBERADO: 'IVA liberado (Ley 19.640)',
  MONOTRIBUTO_SOCIAL: 'Monotributo social',
  NO_ALCANZADO: 'IVA no alcanzado',
  MONOTRIBUTO_TIP: 'Monotributo trabajador independiente promovido',
};

export const TIPOS_DOCUMENTO: Record<TipoDocumento, string> = {
  CUIT: 'CUIT',
  CUIL: 'CUIL',
  DNI: 'DNI',
  PASAPORTE: 'Pasaporte',
  CONSUMIDOR_FINAL: 'Sin identificar (consumidor final)',
};

export const CONCEPTOS: Record<Concepto, string> = {
  PRODUCTOS: 'Productos',
  SERVICIOS: 'Servicios',
  PRODUCTOS_Y_SERVICIOS: 'Productos y servicios',
};

export const UNIDADES: Record<Unidad, string> = { HORA: 'Horas', UNIDAD: 'Unidades', SERVICIO: 'Servicio', MES: 'Mes' };

export const ALICUOTAS = ['21', '10.5', '27', '5', '2.5', '0'];

export const ORIGENES: Record<OrigenItem, string> = { TRACKER: 'Time tracker', API: 'API', EXCEL: 'Excel / CSV', MANUAL: 'Carga manual' };

export const SCOPES: Record<Scope, string> = {
  'acceso:emitir': 'Entrar al Facturador sin contraseña (botón "Ir al facturador")',
  'items:write': 'Cargar ítems a facturar',
  'comprobantes:write': 'Crear y emitir comprobantes',
  'comprobantes:read': 'Consultar comprobantes',
};

export const ESTADOS_ITEM: Record<EstadoItem, { texto: string; clase: string }> = {
  VALIDO: { texto: 'Listo', clase: 'bg-emerald-100 text-emerald-800' },
  CON_ERRORES: { texto: 'Con errores', clase: 'bg-red-100 text-red-800' },
  DUPLICADO: { texto: 'Duplicado', clase: 'bg-slate-100 text-slate-600' },
  EN_BORRADOR: { texto: 'En borrador', clase: 'bg-blue-100 text-blue-800' },
  FACTURADO: { texto: 'Facturado', clase: 'bg-slate-200 text-slate-700' },
  DESCARTADO: { texto: 'Descartado', clase: 'bg-slate-100 text-slate-500 line-through' },
};

export const ESTADOS_IMPORTACION: Record<EstadoImportacion, { texto: string; clase: string }> = {
  EN_STAGING: { texto: 'En revisión', clase: 'bg-amber-100 text-amber-800' },
  CONFIRMADA: { texto: 'Confirmada', clase: 'bg-emerald-100 text-emerald-800' },
  DESCARTADA: { texto: 'Descartada', clase: 'bg-slate-100 text-slate-500' },
  FALLIDA: { texto: 'Fallida', clase: 'bg-red-100 text-red-800' },
};

/** "2026-09-28T13:04:00Z" → "28/09/2026 10:04" (hora de Argentina). */
export function fechaHora(v: string | null | undefined): string {
  if (!v) return '—';
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(v));
}

/** "10.5000" → "10,5" */
export function cantidad(v: string | number): string {
  return Number(v).toLocaleString('es-AR', { maximumFractionDigits: 4 });
}

export const ESTADOS: Record<EstadoComprobante, { texto: string; clase: string }> = {
  BORRADOR: { texto: 'Borrador', clase: 'bg-slate-100 text-slate-700' },
  EMITIENDO: { texto: 'Emitiendo…', clase: 'bg-blue-100 text-blue-800' },
  PENDIENTE_VERIFICACION: { texto: 'Verificando con ARCA', clase: 'bg-amber-100 text-amber-800' },
  EMITIDO: { texto: 'Emitido', clase: 'bg-emerald-100 text-emerald-800' },
  RECHAZADO: { texto: 'Rechazado', clase: 'bg-red-100 text-red-800' },
  ANULADO: { texto: 'Anulado', clase: 'bg-slate-200 text-slate-600 line-through' },
};

const TIPOS: Record<TipoComprobante, { corto: string; largo: string; letra: 'A' | 'B' | 'C' }> = {
  FACTURA_A: { corto: 'FA', largo: 'Factura A', letra: 'A' },
  NOTA_DEBITO_A: { corto: 'NDA', largo: 'Nota de débito A', letra: 'A' },
  NOTA_CREDITO_A: { corto: 'NCA', largo: 'Nota de crédito A', letra: 'A' },
  FACTURA_B: { corto: 'FB', largo: 'Factura B', letra: 'B' },
  NOTA_DEBITO_B: { corto: 'NDB', largo: 'Nota de débito B', letra: 'B' },
  NOTA_CREDITO_B: { corto: 'NCB', largo: 'Nota de crédito B', letra: 'B' },
  FACTURA_C: { corto: 'FC', largo: 'Factura C', letra: 'C' },
  NOTA_DEBITO_C: { corto: 'NDC', largo: 'Nota de débito C', letra: 'C' },
  NOTA_CREDITO_C: { corto: 'NCC', largo: 'Nota de crédito C', letra: 'C' },
};

export function tipoLargo(t: TipoComprobante): string {
  return TIPOS[t].largo;
}

export function letraDe(t: TipoComprobante): 'A' | 'B' | 'C' {
  return TIPOS[t].letra;
}

export function esFactura(t: TipoComprobante): boolean {
  return t.startsWith('FACTURA');
}

/** Mismo tipo (factura / NC / ND) con otra letra. */
export function conLetra(t: TipoComprobante, letra: 'A' | 'B' | 'C'): TipoComprobante {
  return t.replace(/_[ABC]$/, `_${letra}`) as TipoComprobante;
}

/** Espejo de `sugerirLetra` del backend (domain/letra-sugerida.ts): solo sugiere, el usuario decide. */
export function sugerirLetra(emisor: CondicionIva, receptor: CondicionIva): 'A' | 'B' | 'C' {
  if (emisor !== 'RESPONSABLE_INSCRIPTO') return 'C';
  if (receptor === 'RESPONSABLE_INSCRIPTO' || receptor.startsWith('MONOTRIBUTO')) return 'A';
  return 'B';
}

export function ambienteTexto(a: Ambiente): string {
  return a === 'HOMOLOGACION' ? 'Homologación (pruebas)' : 'Producción';
}

export function dinero(v: string | number, moneda: Moneda = 'ARS'): string {
  const n = Number(v);
  return `${moneda === 'USD' ? 'US$' : '$'} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "2026-09-25T00:00:00.000Z" o "2026-09-25" → "25/09/2026" (las fechas de ARCA no tienen hora). */
export function fecha(v: string | null | undefined): string {
  if (!v) return '—';
  const [a, m, d] = v.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

export function soloFecha(v: string | null | undefined): string {
  return v ? v.slice(0, 10) : '';
}

export function numeroComprobante(pv: number, numero: number | null): string {
  if (numero === null) return 'Sin número';
  return `${String(pv).padStart(5, '0')}-${String(numero).padStart(8, '0')}`;
}

export function cuit(v: string): string {
  return /^\d{11}$/.test(v) ? `${v.slice(0, 2)}-${v.slice(2, 10)}-${v.slice(10)}` : v;
}

export function hoy(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
}
