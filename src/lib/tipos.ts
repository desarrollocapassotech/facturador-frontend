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

export interface Paginado<T> {
  total: number;
  pagina: number;
  porPagina: number;
  items: T[];
}
