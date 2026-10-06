import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertaError, Aviso, Boton, Campo, Cargando, Entrada, Selector, Tarjeta, claseInput } from '@/components/ui';
import { ALICUOTAS, CONCEPTOS, conLetra, dinero, hoy, soloFecha, sugerirLetra, UNIDADES } from '@/lib/formato';
import type { Cliente, Comprobante, Concepto, Emisor, Linea, Moneda, PuntoVenta, Unidad } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';

type Letra = 'A' | 'B' | 'C';

const NUMERO = /^\d{1,11}(\.\d{1,4})?$/;
const BONIF = /^\d{1,2}(\.\d{1,2})?$/;

function lineaVacia(concepto: Concepto): Linea {
  return {
    descripcion: '',
    cantidad: '1',
    unidad: concepto === 'PRODUCTOS' ? 'UNIDAD' : 'SERVICIO',
    precioUnitario: '',
    bonificacionPct: '0',
    alicuotaIva: '21',
  };
}

/** "1.234,5" o "1234,5" → "1234.5". Deja el resto como está para que la validación lo marque. */
function normalizarNumero(v: string): string {
  const t = v.trim().replace(/\s/g, '');
  return t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
}

/** Quita ceros de más que devuelve el backend ("1.0000" → "1", "21.00" → "21"). */
function limpiarDecimal(v: string): string {
  return v.includes('.') ? v.replace(/\.?0+$/, '') : v;
}

function sumarDias(ymd: string, dias: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function inicioDeMes(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

function finDeMes(ymd: string): string {
  const [a, m] = ymd.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

/** Estimación en pantalla; los importes que valen son los que calcula el backend al guardar. */
function importeEstimado(l: Linea, letra: Letra): number {
  const neto = Number(normalizarNumero(l.cantidad)) * Number(normalizarNumero(l.precioUnitario)) * (1 - Number(normalizarNumero(l.bonificacionPct) || 0) / 100);
  if (!Number.isFinite(neto)) return 0;
  const netoR = Math.round(neto * 100) / 100;
  return letra === 'C' ? netoR : netoR + Math.round(netoR * Number(l.alicuotaIva)) / 100;
}

interface Form {
  clienteId: string;
  puntoVentaId: string;
  letra: Letra | null; // null = la sugerida
  fechaEmision: string;
  concepto: Concepto;
  fechaServicioDesde: string;
  fechaServicioHasta: string;
  fechaVtoPago: string;
  moneda: Moneda;
  cancelaMismaMoneda: boolean;
  observaciones: string;
  motivo: string;
  lineas: Linea[];
}

function formInicial(c?: Comprobante): Form {
  if (!c) {
    return {
      clienteId: '',
      puntoVentaId: '',
      letra: null,
      fechaEmision: hoy(),
      concepto: 'SERVICIOS',
      fechaServicioDesde: '',
      fechaServicioHasta: '',
      fechaVtoPago: '',
      moneda: 'ARS',
      cancelaMismaMoneda: false,
      observaciones: '',
      motivo: '',
      lineas: [lineaVacia('SERVICIOS')],
    };
  }
  return {
    clienteId: c.clienteId,
    puntoVentaId: c.puntoVentaId,
    letra: c.tipo.slice(-1) as Letra,
    fechaEmision: soloFecha(c.fechaEmision),
    concepto: c.concepto,
    fechaServicioDesde: soloFecha(c.fechaServicioDesde),
    fechaServicioHasta: soloFecha(c.fechaServicioHasta),
    fechaVtoPago: soloFecha(c.fechaVtoPago),
    moneda: c.moneda,
    cancelaMismaMoneda: c.cancelaMismaMoneda,
    observaciones: c.observaciones ?? '',
    motivo: c.motivo ?? '',
    lineas: c.lineas.map((l) => ({
      descripcion: l.descripcion,
      cantidad: limpiarDecimal(l.cantidad),
      unidad: l.unidad,
      precioUnitario: limpiarDecimal(l.precioUnitario),
      bonificacionPct: limpiarDecimal(l.bonificacionPct),
      alicuotaIva: limpiarDecimal(l.alicuotaIva),
    })),
  };
}

function validar(f: Form): string | null {
  if (!f.clienteId) return 'Elegí un cliente.';
  if (!f.puntoVentaId) return 'Elegí un punto de venta.';
  if (f.concepto !== 'PRODUCTOS' && f.fechaServicioDesde && f.fechaServicioHasta && f.fechaServicioDesde > f.fechaServicioHasta) {
    return 'La fecha “desde” del período no puede ser posterior a “hasta”.';
  }
  for (const [i, l] of f.lineas.entries()) {
    const n = i + 1;
    if (!l.descripcion.trim()) return `Línea ${n}: falta la descripción.`;
    if (!NUMERO.test(normalizarNumero(l.cantidad)) || Number(normalizarNumero(l.cantidad)) <= 0) {
      return `Línea ${n}: la cantidad tiene que ser un número mayor a 0 (hasta 4 decimales).`;
    }
    if (!NUMERO.test(normalizarNumero(l.precioUnitario))) return `Línea ${n}: el precio tiene que ser un número (hasta 4 decimales).`;
    if (!BONIF.test(normalizarNumero(l.bonificacionPct || '0'))) return `Línea ${n}: la bonificación tiene que estar entre 0 y 99,99.`;
  }
  return null;
}

/**
 * Formulario de borrador (alta o edición). Guarda con POST o PATCH (con `version`) y devuelve el
 * comprobante del servidor. Montarlo con `key={comprobante.version}` para que arranque de nuevo tras guardar.
 */
export function EditorComprobante({
  comprobante,
  onGuardado,
  acciones,
}: {
  comprobante?: Comprobante;
  onGuardado: (c: Comprobante) => void;
  /** Botones extra al pie (Emitir, Eliminar). `sucio` = hay cambios sin guardar. */
  acciones?: (estado: { sucio: boolean }) => ReactNode;
}) {
  const { pedir } = useApi();
  const inicial = useMemo(() => formInicial(comprobante), [comprobante]);
  const [form, setForm] = useState<Form>(inicial);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const sucio = useMemo(() => JSON.stringify(form) !== JSON.stringify(inicial), [form, inicial]);

  const emisor = useQuery({ queryKey: ['emisor'], queryFn: () => pedir<Emisor>('/configuracion/emisor') });
  const clientes = useQuery({ queryKey: ['clientes', { q: '', inactivos: false }], queryFn: () => pedir<Cliente[]>('/clientes?') });
  const puntos = useQuery({ queryKey: ['puntos-venta'], queryFn: () => pedir<PuntoVenta[]>('/configuracion/puntos-venta') });

  const esNota = Boolean(comprobante?.asociado);
  const ambiente = emisor.data?.ambienteArca;
  const puntosDisponibles = useMemo(
    () => (puntos.data ?? []).filter((p) => p.ambiente === ambiente && (p.activo || p.id === comprobante?.puntoVentaId)),
    [puntos.data, ambiente, comprobante?.puntoVentaId],
  );
  // El cliente del comprobante puede estar inactivo: igual tiene que aparecer en la lista.
  const listaClientes = useMemo(() => {
    const lista = clientes.data ?? [];
    return comprobante && !lista.some((c) => c.id === comprobante.clienteId) ? [comprobante.cliente, ...lista] : lista;
  }, [clientes.data, comprobante]);

  const cliente = listaClientes.find((c) => c.id === form.clienteId) ?? null;
  const puntoVentaId = form.puntoVentaId || puntosDisponibles[0]?.id || '';
  const letraSugerida = emisor.data && cliente ? sugerirLetra(emisor.data.condicionIva, cliente.condicionIva) : null;
  // Sin cliente todavía: la del emisor (un Responsable Inscripto no emite C).
  const letraPorEmisor: Letra = emisor.data?.condicionIva === 'RESPONSABLE_INSCRIPTO' ? 'A' : 'C';
  const letra: Letra = form.letra ?? letraSugerida ?? letraPorEmisor;
  const servicios = form.concepto !== 'PRODUCTOS';

  const guardar = useMutation({
    mutationFn: () => {
      const body = {
        puntoVentaId,
        fechaEmision: form.fechaEmision,
        concepto: form.concepto,
        fechaServicioDesde: servicios ? form.fechaServicioDesde || null : null,
        fechaServicioHasta: servicios ? form.fechaServicioHasta || null : null,
        fechaVtoPago: servicios ? form.fechaVtoPago || null : null,
        moneda: form.moneda,
        cancelaMismaMoneda: form.moneda === 'USD' ? form.cancelaMismaMoneda : false,
        observaciones: form.observaciones.trim() || null,
        lineas: form.lineas.map((l) => ({
          descripcion: l.descripcion.trim(),
          cantidad: normalizarNumero(l.cantidad),
          unidad: l.unidad,
          precioUnitario: normalizarNumero(l.precioUnitario),
          bonificacionPct: normalizarNumero(l.bonificacionPct || '0'),
          alicuotaIva: l.alicuotaIva,
        })),
      };
      if (!comprobante) {
        return pedir<Comprobante>('/comprobantes', 'POST', { ...body, clienteId: form.clienteId, tipo: conLetra('FACTURA_A', letra) });
      }
      return pedir<Comprobante>(`/comprobantes/${comprobante.id}`, 'PATCH', {
        ...body,
        version: comprobante.version,
        // Las notas heredan letra y cliente de la factura; en ellas solo se edita el motivo.
        ...(esNota
          ? { motivo: form.motivo.trim() || null }
          : { clienteId: form.clienteId, tipo: conLetra(comprobante.tipo, letra) }),
      });
    },
    onSuccess: onGuardado,
  });

  function cambiar<K extends keyof Form>(campo: K, valor: Form[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErrorLocal(null);
  }

  function elegirCliente(id: string) {
    const c = listaClientes.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      clienteId: id,
      // En un alta, la moneda y el vencimiento siguen al cliente mientras el usuario no los toque.
      ...(!comprobante && c
        ? {
            moneda: c.monedaPreferida,
            fechaVtoPago: f.concepto !== 'PRODUCTOS' && c.diasVencimiento != null ? sumarDias(f.fechaEmision, c.diasVencimiento) : f.fechaVtoPago,
          }
        : {}),
    }));
    setErrorLocal(null);
  }

  function elegirConcepto(concepto: Concepto) {
    setForm((f) => {
      const conFechas = concepto !== 'PRODUCTOS';
      return {
        ...f,
        concepto,
        fechaServicioDesde: conFechas && !f.fechaServicioDesde ? inicioDeMes(f.fechaEmision) : f.fechaServicioDesde,
        fechaServicioHasta: conFechas && !f.fechaServicioHasta ? finDeMes(f.fechaEmision) : f.fechaServicioHasta,
        fechaVtoPago: conFechas && !f.fechaVtoPago ? sumarDias(f.fechaEmision, cliente?.diasVencimiento ?? 10) : f.fechaVtoPago,
      };
    });
    setErrorLocal(null);
  }

  function cambiarLinea(i: number, campo: keyof Linea, valor: string) {
    setForm((f) => ({ ...f, lineas: f.lineas.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)) }));
    setErrorLocal(null);
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    const error = validar({ ...form, puntoVentaId });
    if (error) {
      setErrorLocal(error);
      return;
    }
    guardar.mutate();
  }

  if (emisor.error || clientes.error || puntos.error) return <AlertaError error={emisor.error ?? clientes.error ?? puntos.error} />;
  if (!emisor.data || !clientes.data || !puntos.data) return <Cargando />;

  const total = form.lineas.reduce((s, l) => s + importeEstimado(l, letra), 0);
  const advertenciaLetra =
    !esNota && letraSugerida && letra !== letraSugerida
      ? `Para este emisor y este cliente lo habitual es Factura ${letraSugerida}. Si ARCA no acepta la letra elegida, va a rechazar el comprobante.`
      : null;

  return (
    <form onSubmit={enviar} className="space-y-4">
      {puntosDisponibles.length === 0 && (
        <Aviso>
          No hay puntos de venta activos para este ambiente. <Link to="/configuracion" className="underline">Cargá uno en Configuración</Link>{' '}
          antes de facturar.
        </Aviso>
      )}
      {listaClientes.length === 0 && (
        <Aviso>
          Todavía no hay clientes. <Link to="/clientes" className="underline">Cargá uno</Link> para poder facturarle.
        </Aviso>
      )}

      <Tarjeta titulo="Datos del comprobante">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Campo etiqueta="Cliente" className="sm:col-span-2">
            <Selector value={form.clienteId} onChange={(e) => elegirCliente(e.target.value)} disabled={esNota} required>
              <option value="">Elegí un cliente…</option>
              {listaClientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.razonSocial}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Punto de venta">
            <Selector value={puntoVentaId} onChange={(e) => cambiar('puntoVentaId', e.target.value)} disabled={esNota}>
              {puntosDisponibles.map((p) => (
                <option key={p.id} value={p.id}>
                  {String(p.numero).padStart(5, '0')}
                  {p.descripcion ? ` · ${p.descripcion}` : ''}
                </option>
              ))}
            </Selector>
          </Campo>

          <Campo
            etiqueta="Letra"
            ayuda={esNota ? 'La define la factura asociada.' : letraSugerida ? `Sugerida: ${letraSugerida}` : 'Elegí el cliente para ver la sugerencia.'}
          >
            <div className="flex gap-1" role="radiogroup" aria-label="Letra">
              {(['A', 'B', 'C'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={letra === l}
                  disabled={esNota}
                  onClick={() => cambiar('letra', l)}
                  className={`h-9 w-12 rounded-md border text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
                    letra === l ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white hover:bg-slate-50'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </Campo>
          <Campo etiqueta="Fecha de emisión">
            <Entrada type="date" value={form.fechaEmision} onChange={(e) => cambiar('fechaEmision', e.target.value)} required />
          </Campo>
          <Campo etiqueta="Concepto">
            <Selector value={form.concepto} onChange={(e) => elegirConcepto(e.target.value as Concepto)}>
              {Object.entries(CONCEPTOS).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </Selector>
          </Campo>

          {servicios && (
            <>
              <Campo etiqueta="Período desde">
                <Entrada type="date" value={form.fechaServicioDesde} onChange={(e) => cambiar('fechaServicioDesde', e.target.value)} />
              </Campo>
              <Campo etiqueta="Período hasta">
                <Entrada type="date" value={form.fechaServicioHasta} onChange={(e) => cambiar('fechaServicioHasta', e.target.value)} />
              </Campo>
              <Campo etiqueta="Vencimiento de pago">
                <Entrada type="date" value={form.fechaVtoPago} onChange={(e) => cambiar('fechaVtoPago', e.target.value)} />
              </Campo>
            </>
          )}

          <Campo etiqueta="Moneda">
            <Selector value={form.moneda} onChange={(e) => cambiar('moneda', e.target.value as Moneda)}>
              <option value="ARS">Pesos</option>
              <option value="USD">Dólares</option>
            </Selector>
          </Campo>
          {form.moneda === 'USD' && (
            <Campo etiqueta="Cotización" ayuda="Se toma la del BNA que informa ARCA al emitir." className="lg:col-span-2">
              <label className="flex items-center gap-2 pt-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.cancelaMismaMoneda}
                  onChange={(e) => cambiar('cancelaMismaMoneda', e.target.checked)}
                />
                Se cancela en dólares
              </label>
            </Campo>
          )}
        </div>
        {servicios && (!form.fechaServicioDesde || !form.fechaServicioHasta || !form.fechaVtoPago) && (
          <p className="mt-3 text-xs text-amber-700">Para emitir servicios, ARCA exige el período facturado y el vencimiento de pago.</p>
        )}
        {advertenciaLetra && (
          <div className="mt-4">
            <Aviso>{advertenciaLetra}</Aviso>
          </div>
        )}
      </Tarjeta>

      <Tarjeta
        titulo="Detalle"
        acciones={
          <Boton variante="secundario" onClick={() => cambiar('lineas', [...form.lineas, lineaVacia(form.concepto)])} disabled={form.lineas.length >= 200}>
            Agregar línea
          </Boton>
        }
      >
        <div className="space-y-3">
          {form.lineas.map((l, i) => (
            <div key={i} className="grid gap-2 rounded-md border border-slate-100 p-3 sm:grid-cols-12 sm:items-end">
              <Campo etiqueta="Descripción" className="sm:col-span-12 lg:col-span-3">
                <Entrada value={l.descripcion} onChange={(e) => cambiarLinea(i, 'descripcion', e.target.value)} maxLength={500} />
              </Campo>
              <Campo etiqueta="Cantidad" className="sm:col-span-2 lg:col-span-1">
                <Entrada inputMode="decimal" value={l.cantidad} onChange={(e) => cambiarLinea(i, 'cantidad', e.target.value)} />
              </Campo>
              <Campo etiqueta="Unidad" className="sm:col-span-2 lg:col-span-2">
                <Selector value={l.unidad} onChange={(e) => cambiarLinea(i, 'unidad', e.target.value as Unidad)} className="px-2">
                  {Object.entries(UNIDADES).map(([v, t]) => (
                    <option key={v} value={v}>
                      {t}
                    </option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta={letra === 'C' ? 'Precio unitario' : 'Precio unit. (sin IVA)'} className="sm:col-span-3 lg:col-span-2">
                <Entrada inputMode="decimal" value={l.precioUnitario} onChange={(e) => cambiarLinea(i, 'precioUnitario', e.target.value)} />
              </Campo>
              <Campo etiqueta="Bonif. %" className="sm:col-span-2 lg:col-span-1">
                <Entrada inputMode="decimal" value={l.bonificacionPct} onChange={(e) => cambiarLinea(i, 'bonificacionPct', e.target.value)} />
              </Campo>
              {letra !== 'C' && (
                <Campo etiqueta="IVA %" className="sm:col-span-2 lg:col-span-1">
                  <Selector value={l.alicuotaIva} onChange={(e) => cambiarLinea(i, 'alicuotaIva', e.target.value)} className="px-2">
                    {ALICUOTAS.map((a) => (
                      <option key={a} value={a}>
                        {a.replace('.', ',')}
                      </option>
                    ))}
                  </Selector>
                </Campo>
              )}
              <div className={`flex items-center justify-between gap-2 sm:col-span-12 ${letra === 'C' ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
                <span className="text-sm tabular-nums text-slate-700">{dinero(importeEstimado(l, letra), form.moneda)}</span>
                <Boton
                  variante="fantasma"
                  onClick={() => cambiar('lineas', form.lineas.filter((_, j) => j !== i))}
                  disabled={form.lineas.length === 1}
                  aria-label={`Quitar línea ${i + 1}`}
                >
                  Quitar
                </Boton>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-col items-end gap-1 text-sm">
          <p>
            Total estimado: <span className="text-base font-semibold tabular-nums">{dinero(total, form.moneda)}</span>
          </p>
          <p className="text-xs text-slate-500">
            {letra === 'C' ? 'La Factura C no discrimina IVA.' : 'Incluye IVA.'} El importe definitivo se calcula al guardar.
          </p>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Observaciones">
        <div className="space-y-4">
          {esNota && (
            <Campo etiqueta="Motivo de la nota">
              <Entrada value={form.motivo} onChange={(e) => cambiar('motivo', e.target.value)} maxLength={500} />
            </Campo>
          )}
          <Campo etiqueta="Observaciones" ayuda="Opcional. Se imprimen en el PDF.">
            <textarea
              className={`${claseInput} h-20`}
              value={form.observaciones}
              onChange={(e) => cambiar('observaciones', e.target.value)}
              maxLength={1000}
            />
          </Campo>
        </div>
      </Tarjeta>

      <AlertaError mensaje={errorLocal} />
      <AlertaError error={guardar.error} />
      <div className="flex flex-wrap items-center justify-end gap-2">
        {sucio && comprobante && <span className="text-xs text-amber-700">Hay cambios sin guardar.</span>}
        {acciones?.({ sucio })}
        <Boton type="submit" variante={comprobante ? 'secundario' : 'primario'} cargando={guardar.isPending} disabled={comprobante && !sucio}>
          {comprobante ? 'Guardar cambios' : 'Guardar borrador'}
        </Boton>
      </div>
    </form>
  );
}
