// Tipos de la API del backend (Fase 2).

export type Ambiente = 'HOMOLOGACION' | 'PRODUCCION';
export type CondicionIva =
  | 'RESPONSABLE_INSCRIPTO'
  | 'EXENTO'
  | 'CONSUMIDOR_FINAL'
  | 'MONOTRIBUTO'
  | 'NO_CATEGORIZADO'
  | 'PROVEEDOR_EXTERIOR'
  | 'CLIENTE_EXTERIOR'
  | 'IVA_LIBERADO'
  | 'MONOTRIBUTO_SOCIAL'
  | 'NO_ALCANZADO'
  | 'MONOTRIBUTO_TIP';
export type TipoDocumento = 'CUIT' | 'CUIL' | 'DNI' | 'PASAPORTE' | 'CONSUMIDOR_FINAL';
export type TipoComprobante =
  | 'FACTURA_A'
  | 'NOTA_DEBITO_A'
  | 'NOTA_CREDITO_A'
  | 'FACTURA_B'
  | 'NOTA_DEBITO_B'
  | 'NOTA_CREDITO_B'
  | 'FACTURA_C'
  | 'NOTA_DEBITO_C'
  | 'NOTA_CREDITO_C';
export type Concepto = 'PRODUCTOS' | 'SERVICIOS' | 'PRODUCTOS_Y_SERVICIOS';
export type Moneda = 'ARS' | 'USD';
export type Unidad = 'HORA' | 'UNIDAD' | 'SERVICIO' | 'MES';
export type EstadoComprobante =
  | 'BORRADOR'
  | 'EMITIENDO'
  | 'PENDIENTE_VERIFICACION'
  | 'EMITIDO'
  | 'RECHAZADO'
  | 'ANULADO';

export interface Emisor {
  id: string;
  slug: string;
  nombreFantasia: string;
  razonSocial: string;
  cuit: string;
  condicionIva: CondicionIva;
  domicilioFiscal: string;
  ingresosBrutos: string | null;
  inicioActividades: string | null;
  ambienteArca: Ambiente;
}

export interface EstadoArca {
  ambiente: Ambiente;
  afipSdkConfigurado: boolean;
  usaCuitPrueba: boolean;
  cuitEmision: string;
  certificado: Certificado | null;
}

export interface PuntoVenta {
  id: string;
  numero: number;
  ambiente: Ambiente;
  descripcion: string | null;
  activo: boolean;
}

export interface Certificado {
  id: string;
  ambiente: Ambiente;
  alias: string | null;
  huellaSha256: string;
  venceEl: string;
  createdAt: string;
}

export interface PlantillaPdf {
  colorPrimario: string;
  colorSecundario: string;
  textoPie: string | null;
  mostrarDuplicado: boolean;
  tieneLogo: boolean;
  logoMime: string | null;
}

export interface Cliente {
  id: string;
  razonSocial: string;
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  condicionIva: CondicionIva;
  domicilio: string | null;
  email: string | null;
  pais: string;
  monedaPreferida: Moneda;
  diasVencimiento: number | null;
  activo: boolean;
}

export interface Linea {
  descripcion: string;
  cantidad: string;
  unidad: Unidad;
  precioUnitario: string;
  bonificacionPct: string;
  alicuotaIva: string;
}

export interface LineaGuardada extends Linea {
  id: string;
  orden: number;
  importeNeto: string;
  importeIva: string;
  importeTotal: string;
}

export interface ComprobanteResumen {
  id: string;
  tipo: TipoComprobante;
  estado: EstadoComprobante;
  ambiente: Ambiente;
  numero: number | null;
  fechaEmision: string;
  moneda: Moneda;
  importeTotal: string;
  cae: string | null;
  errorMensaje: string | null;
  createdAt: string;
  cliente: { id: string; razonSocial: string };
  puntoVenta: { numero: number };
}

export interface Comprobante {
  id: string;
  tipo: TipoComprobante;
  estado: EstadoComprobante;
  ambiente: Ambiente;
  version: number;
  clienteId: string;
  puntoVentaId: string;
  numero: number | null;
  numeroReservado: number | null;
  fechaEmision: string;
  concepto: Concepto;
  fechaServicioDesde: string | null;
  fechaServicioHasta: string | null;
  fechaVtoPago: string | null;
  moneda: Moneda;
  cotizacion: string;
  cancelaMismaMoneda: boolean;
  importeNetoGravado: string;
  importeIva: string;
  importeTributos: string;
  importeTotal: string;
  observaciones: string | null;
  motivo: string | null;
  cae: string | null;
  caeVencimiento: string | null;
  errorMensaje: string | null;
  errorDetalle: string | null;
  emitidoEn: string | null;
  lineas: LineaGuardada[];
  alicuotas: Array<{ arcaId: number; baseImponible: string; importe: string }>;
  cliente: Cliente;
  puntoVenta: PuntoVenta;
  asociado: { id: string; tipo: TipoComprobante; numero: number | null; puntoVenta: { numero: number } } | null;
  asociadosDesde: Array<{ id: string; tipo: TipoComprobante; numero: number | null; estado: EstadoComprobante; importeTotal: string }>;
  letraSugerida: 'A' | 'B' | 'C';
  advertenciaLetra: string | null;
}

// ── Fase 4: integraciones e importaciones ─────────────────────────────────

export type OrigenItem = 'TRACKER' | 'API' | 'EXCEL' | 'MANUAL';
export type Scope = 'items:write' | 'comprobantes:write' | 'comprobantes:read' | 'acceso:emitir';
export type EstadoItem = 'VALIDO' | 'CON_ERRORES' | 'DUPLICADO' | 'EN_BORRADOR' | 'FACTURADO' | 'DESCARTADO';
export type EstadoImportacion = 'EN_STAGING' | 'CONFIRMADA' | 'DESCARTADA' | 'FALLIDA';
export type BaseHoras = 'FACTURABLES' | 'TRABAJADAS';

export interface Integracion {
  id: string;
  nombre: string;
  origen: OrigenItem;
  keyPrefijo: string;
  scopes: Scope[];
  ultimoUsoEn: string | null;
  revocadaEn: string | null;
  createdAt: string;
}

export type ConexionTracker =
  | { configurada: false }
  | { configurada: true; baseUrl: string; apiKeyPista: string; ultimaPruebaEn: string | null; ultimoError: string | null };

export interface Tarifa {
  id: string;
  clienteId: string;
  cliente: { id: string; razonSocial: string };
  origen: OrigenItem | null;
  claveExterna: string | null;
  descripcion: string | null;
  unidad: Unidad;
  precioUnitario: string;
  moneda: Moneda;
  alicuotaIva: string;
  vigenteDesde: string;
  vigenteHasta: string | null;
}

export type CampoMapeo =
  | 'referenciaExterna'
  | 'descripcion'
  | 'cantidad'
  | 'unidad'
  | 'precioUnitario'
  | 'moneda'
  | 'alicuotaIva'
  | 'fecha'
  | 'periodo.desde'
  | 'periodo.hasta'
  | 'cliente.numeroDocumento'
  | 'cliente.tipoDocumento'
  | 'cliente.referenciaExterna'
  | 'cliente.razonSocial'
  | `metadatos.${string}`;

export interface ColumnaMapeo {
  campo: CampoMapeo;
  encabezado: string;
  alias?: string[];
  tipo: 'texto' | 'numero' | 'fecha' | 'decimal';
  formatoFecha?: string;
  separadorDecimal?: ',' | '.';
}

export interface PlantillaMapeoConfig {
  hoja?: string | number;
  filaEncabezado: number;
  delimitador?: ',' | ';' | '\t';
  encoding?: 'utf-8' | 'latin1';
  columnas: ColumnaMapeo[];
  valoresPorDefecto?: { unidad?: Unidad; alicuotaIva?: string; moneda?: Moneda };
  referencia?: { columnas: string[] };
}

export interface PlantillaMapeo {
  id: string;
  nombre: string;
  formato: 'xlsx' | 'csv';
  config: PlantillaMapeoConfig;
  activa: boolean;
}

export interface Advertencia {
  referencia?: string;
  mensaje: string;
}

export interface Importacion {
  id: string;
  origen: OrigenItem;
  estado: EstadoImportacion;
  descripcion: string | null;
  parametros: Record<string, unknown> | null;
  advertencias: Advertencia[] | null;
  totalItems: number;
  validos: number;
  conErrores: number;
  duplicados: number;
  actualizados: number;
  createdAt: string;
  confirmadaEn: string | null;
  estadosItems?: Partial<Record<EstadoItem, number>>;
}

export interface ItemFacturable {
  id: string;
  importacionId: string | null;
  origen: OrigenItem;
  referenciaExterna: string;
  clienteId: string | null;
  cliente: { id: string; razonSocial: string } | null;
  clienteTipoDocumento: TipoDocumento | null;
  clienteNumeroDocumento: string | null;
  clienteReferenciaExterna: string | null;
  clienteAlta: { razonSocial: string; condicionIva?: string; domicilio?: string; email?: string } | null;
  descripcion: string;
  cantidad: string;
  unidad: Unidad;
  precioUnitario: string;
  moneda: Moneda;
  alicuotaIva: string;
  fecha: string | null;
  periodoDesde: string | null;
  periodoHasta: string | null;
  metadatos: {
    precioDeTarifa?: boolean;
    tarifaId?: string | null;
    horasTrabajadas?: string;
    horasFacturables?: string;
    baseHoras?: BaseHoras;
    registros?: number;
    proyecto?: { id: string; nombre: string; billingType: string | null };
    valoresOriginales?: Record<string, string>;
    fila?: number;
    [clave: string]: unknown;
  } | null;
  estado: EstadoItem;
  errores: Array<{ campo: string; mensaje: string }> | null;
  comprobanteId: string | null;
}

export interface Paginado<T> {
  total: number;
  pagina: number;
  porPagina: number;
  items: T[];
}
