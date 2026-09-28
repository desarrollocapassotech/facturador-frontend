import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertaError, Aviso, Boton, Campo, Cargando, Entrada, Etiqueta, Modal, Tarjeta } from '@/components/ui';
import { ApiError } from '@/lib/api';
import {
  CONCEPTOS,
  CONDICIONES_IVA,
  dinero,
  esFactura,
  ESTADOS,
  fecha,
  letraDe,
  numeroComprobante,
  tipoLargo,
  UNIDADES,
} from '@/lib/formato';
import type { Comprobante } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';
import { EditorComprobante } from './EditorComprobante';

const EDITABLES = ['BORRADOR', 'RECHAZADO'];

export function ComprobanteDetallePage() {
  const { id = '' } = useParams();
  const { pedir } = useApi();
  const queryClient = useQueryClient();

  const { data: c, error } = useQuery({
    queryKey: ['comprobante', id],
    queryFn: () => pedir<Comprobante>(`/comprobantes/${id}`),
    // Mientras ARCA no contestó, refrescar solo: el cron del backend termina lo que quedó colgado.
    refetchInterval: (q) => (q.state.data?.estado === 'EMITIENDO' ? 3_000 : q.state.data?.estado === 'PENDIENTE_VERIFICACION' ? 20_000 : false),
  });

  function actualizar(nuevo: Comprobante) {
    queryClient.setQueryData(['comprobante', nuevo.id], nuevo);
    void queryClient.invalidateQueries({ queryKey: ['comprobantes'] });
  }

  if (error) return <AlertaError error={error} />;
  if (!c) return <Cargando />;

  const editable = EDITABLES.includes(c.estado);

  return (
    <div className="space-y-4">
      <div>
        <Link to="/comprobantes" className="text-sm text-slate-500 hover:underline">
          ← Comprobantes
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{tipoLargo(c.tipo)}</h1>
          <span className="font-mono text-sm text-slate-500">{numeroComprobante(c.puntoVenta.numero, c.numero)}</span>
          <Etiqueta className={ESTADOS[c.estado].clase}>{ESTADOS[c.estado].texto}</Etiqueta>
        </div>
        {c.asociado && (
          <p className="mt-1 text-sm text-slate-600">
            Asociada a{' '}
            <Link to={`/comprobantes/${c.asociado.id}`} className="underline">
              {tipoLargo(c.asociado.tipo)} {numeroComprobante(c.asociado.puntoVenta.numero, c.asociado.numero)}
            </Link>
          </p>
        )}
      </div>

      {c.ambiente === 'HOMOLOGACION' && (
        <Aviso>Ambiente de pruebas: este comprobante no tiene validez fiscal.</Aviso>
      )}
      {c.estado === 'RECHAZADO' && (
        <AlertaError
          mensaje={`ARCA rechazó el comprobante: ${c.errorMensaje ?? 'sin detalle'}. Corregilo y volvé a emitir.`}
          detalle={c.errorDetalle}
        />
      )}
      {c.estado === 'EMITIENDO' && <Aviso tono="azul">Pidiendo la autorización a ARCA…</Aviso>}
      {c.estado === 'PENDIENTE_VERIFICACION' && <PendienteVerificacion comprobante={c} onActualizado={actualizar} />}

      {editable ? (
        <EditorComprobante
          key={`${c.id}:${c.version}`}
          comprobante={c}
          onGuardado={actualizar}
          acciones={({ sucio }) => (
            <>
              <EliminarBorrador comprobante={c} />
              <EmitirBoton comprobante={c} deshabilitado={sucio} onActualizado={actualizar} />
            </>
          )}
        />
      ) : (
        <VistaComprobante comprobante={c} />
      )}
    </div>
  );
}

function PendienteVerificacion({ comprobante: c, onActualizado }: { comprobante: Comprobante; onActualizado: (c: Comprobante) => void }) {
  const { pedir } = useApi();
  const verificar = useMutation({
    mutationFn: () => pedir<Comprobante>(`/comprobantes/${c.id}/verificar`, 'POST'),
    onSuccess: onActualizado,
  });
  return (
    <div className="space-y-2">
      <Aviso>
        <p>
          No sabemos todavía si ARCA autorizó el comprobante (número reservado {c.numeroReservado ?? '—'}). No lo vuelvas a
          emitir: el sistema lo consulta solo cada minuto, o podés verificarlo ahora.
        </p>
        {c.errorMensaje && <p className="mt-1 text-xs">Último error: {c.errorMensaje}</p>}
        <Boton variante="secundario" className="mt-2" cargando={verificar.isPending} onClick={() => verificar.mutate()}>
          Verificar ahora
        </Boton>
      </Aviso>
      <AlertaError error={verificar.error} />
    </div>
  );
}

function EmitirBoton({
  comprobante: c,
  deshabilitado,
  onActualizado,
}: {
  comprobante: Comprobante;
  deshabilitado: boolean;
  onActualizado: (c: Comprobante) => void;
}) {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  // Una clave por confirmación. Solo se reusa si la request no llegó a tener respuesta (corte de red):
  // así reintentar no puede emitir dos veces.
  const [clave, setClave] = useState('');

  const emitir = useMutation({
    mutationFn: () =>
      pedir<Comprobante>(`/comprobantes/${c.id}/emitir`, 'POST', { version: c.version }, { 'Idempotency-Key': clave }),
    onSuccess: (nuevo) => {
      setAbierto(false);
      onActualizado(nuevo);
    },
    onError: (err) => {
      const huboRespuesta = err instanceof ApiError && err.status !== 0;
      if (huboRespuesta) setClave(crypto.randomUUID());
      // Rechazo de ARCA (422): el comprobante ya tiene el error guardado y se muestra arriba.
      if (err instanceof ApiError && err.status === 422) setAbierto(false);
      void queryClient.invalidateQueries({ queryKey: ['comprobante', c.id] });
      void queryClient.invalidateQueries({ queryKey: ['comprobantes'] });
    },
  });

  function abrir() {
    setClave(crypto.randomUUID());
    emitir.reset();
    setAbierto(true);
  }

  const sinRespuesta = emitir.error instanceof ApiError && emitir.error.status === 0;

  return (
    <>
      <Boton onClick={abrir} disabled={deshabilitado} title={deshabilitado ? 'Guardá los cambios antes de emitir' : undefined}>
        {c.estado === 'RECHAZADO' ? 'Reintentar emisión' : 'Emitir'}
      </Boton>
      <Modal abierto={abierto} titulo={`Emitir ${tipoLargo(c.tipo)}`} onCerrar={() => !emitir.isPending && setAbierto(false)}>
        <div className="space-y-4 text-sm">
          <p>
            Vas a pedir el CAE a ARCA para una <strong>{tipoLargo(c.tipo)}</strong> a <strong>{c.cliente.razonSocial}</strong> por{' '}
            <strong>{dinero(c.importeTotal, c.moneda)}</strong>.
          </p>
          <p className="text-slate-600">
            Una vez autorizado no se puede modificar ni borrar: para corregirlo hay que hacer una nota de crédito.
          </p>
          {c.ambiente === 'HOMOLOGACION' && (
            <Aviso>Estás en el ambiente de pruebas: el comprobante no va a tener validez fiscal.</Aviso>
          )}
          {c.advertenciaLetra && <Aviso>{c.advertenciaLetra}</Aviso>}
          {sinRespuesta ? (
            <AlertaError mensaje="No hubo respuesta del servidor. Reintentá: si la primera vez llegó a emitirse, no se duplica." />
          ) : (
            <AlertaError error={emitir.error} />
          )}
          <div className="flex justify-end gap-2">
            <Boton variante="secundario" onClick={() => setAbierto(false)} disabled={emitir.isPending}>
              Cancelar
            </Boton>
            <Boton cargando={emitir.isPending} onClick={() => emitir.mutate()}>
              {sinRespuesta ? 'Reintentar' : 'Emitir'}
            </Boton>
          </div>
        </div>
      </Modal>
    </>
  );
}

function EliminarBorrador({ comprobante: c }: { comprobante: Comprobante }) {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const eliminar = useMutation({
    mutationFn: () => pedir<void>(`/comprobantes/${c.id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['comprobante', c.id] });
      void queryClient.invalidateQueries({ queryKey: ['comprobantes'] });
      navigate('/comprobantes', { replace: true });
    },
  });
  // Un comprobante que pasó por ARCA queda como registro; solo se borran los que nunca se intentaron emitir.
  if (c.numero !== null || c.numeroReservado !== null || c.estado !== 'BORRADOR') return null;

  return (
    <>
      {eliminar.error && <AlertaError error={eliminar.error} />}
      <Boton
        variante="fantasma"
        cargando={eliminar.isPending}
        onClick={() => {
          if (window.confirm('¿Eliminar este borrador? No se puede deshacer.')) eliminar.mutate();
        }}
      >
        Eliminar borrador
      </Boton>
    </>
  );
}

function VistaComprobante({ comprobante: c }: { comprobante: Comprobante }) {
  const { descargar } = useApi();
  const [errorPdf, setErrorPdf] = useState<unknown>(null);
  const [bajando, setBajando] = useState(false);
  const [nota, setNota] = useState<'NOTA_CREDITO' | 'NOTA_DEBITO' | null>(null);
  const discriminaIva = letraDe(c.tipo) !== 'C';
  const conCae = Boolean(c.cae) && (c.estado === 'EMITIDO' || c.estado === 'ANULADO');

  async function bajarPdf() {
    setErrorPdf(null);
    setBajando(true);
    try {
      await descargar(`/comprobantes/${c.id}/pdf`, `comprobante-${c.id}.pdf`);
    } catch (err) {
      setErrorPdf(err);
    } finally {
      setBajando(false);
    }
  }

  return (
    <div className="space-y-4">
      {conCae && (
        <Tarjeta
          titulo="Autorización de ARCA"
          acciones={
            <div className="flex flex-wrap gap-2">
              {esFactura(c.tipo) && c.estado === 'EMITIDO' && (
                <>
                  <Boton variante="secundario" onClick={() => setNota('NOTA_CREDITO')}>
                    Nota de crédito
                  </Boton>
                  <Boton variante="secundario" onClick={() => setNota('NOTA_DEBITO')}>
                    Nota de débito
                  </Boton>
                </>
              )}
              <Boton cargando={bajando} onClick={() => void bajarPdf()}>
                Descargar PDF
              </Boton>
            </div>
          }
        >
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Dato titulo="CAE" valor={<span className="font-mono">{c.cae}</span>} />
            <Dato titulo="Vencimiento del CAE" valor={fecha(c.caeVencimiento)} />
            <Dato titulo="Fecha del comprobante" valor={fecha(c.fechaEmision)} />
            <Dato titulo="Número" valor={<span className="font-mono">{numeroComprobante(c.puntoVenta.numero, c.numero)}</span>} />
          </dl>
          {c.estado === 'ANULADO' && <p className="mt-3 text-sm text-slate-600">Anulado por una nota de crédito por el total.</p>}
          <div className="mt-3">
            <AlertaError error={errorPdf} />
          </div>
        </Tarjeta>
      )}

      <Tarjeta titulo="Datos">
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Dato titulo="Cliente" valor={c.cliente.razonSocial} />
          <Dato titulo="Condición IVA" valor={CONDICIONES_IVA[c.cliente.condicionIva]} />
          <Dato titulo="Concepto" valor={CONCEPTOS[c.concepto]} />
          <Dato titulo="Moneda" valor={c.moneda === 'USD' ? `Dólares (cotización ${c.cotizacion})` : 'Pesos'} />
          {c.concepto !== 'PRODUCTOS' && (
            <>
              <Dato titulo="Período" valor={`${fecha(c.fechaServicioDesde)} al ${fecha(c.fechaServicioHasta)}`} />
              <Dato titulo="Vencimiento de pago" valor={fecha(c.fechaVtoPago)} />
            </>
          )}
          {c.motivo && <Dato titulo="Motivo" valor={c.motivo} />}
          {c.observaciones && <Dato titulo="Observaciones" valor={c.observaciones} />}
        </dl>
      </Tarjeta>

      <Tarjeta titulo="Detalle">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-2 pr-4 font-medium">Descripción</th>
                <th className="py-2 pr-4 text-right font-medium">Cantidad</th>
                <th className="py-2 pr-4 text-right font-medium">Precio unit.</th>
                <th className="py-2 pr-4 text-right font-medium">Bonif.</th>
                {discriminaIva && <th className="py-2 pr-4 text-right font-medium">IVA</th>}
                <th className="py-2 text-right font-medium">Importe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {c.lineas.map((l) => (
                <tr key={l.id}>
                  <td className="py-2 pr-4">{l.descripcion}</td>
                  <td className="py-2 pr-4 text-right tabular-nums whitespace-nowrap">
                    {Number(l.cantidad).toLocaleString('es-AR')} {UNIDADES[l.unidad].toLowerCase()}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums whitespace-nowrap">{dinero(l.precioUnitario, c.moneda)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{Number(l.bonificacionPct) ? `${Number(l.bonificacionPct)} %` : '—'}</td>
                  {discriminaIva && <td className="py-2 pr-4 text-right tabular-nums">{Number(l.alicuotaIva)} %</td>}
                  <td className="py-2 text-right tabular-nums whitespace-nowrap">
                    {dinero(discriminaIva ? l.importeNeto : l.importeTotal, c.moneda)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
          {discriminaIva && (
            <>
              <Fila titulo="Neto gravado" valor={dinero(c.importeNetoGravado, c.moneda)} />
              {c.alicuotas.map((a) => (
                <Fila key={a.arcaId} titulo={`IVA sobre ${dinero(a.baseImponible, c.moneda)}`} valor={dinero(a.importe, c.moneda)} />
              ))}
            </>
          )}
          <Fila titulo="Total" valor={dinero(c.importeTotal, c.moneda)} fuerte />
        </dl>
      </Tarjeta>

      {c.asociadosDesde.length > 0 && (
        <Tarjeta titulo="Notas asociadas">
          <ul className="divide-y divide-slate-100 text-sm">
            {c.asociadosDesde.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link to={`/comprobantes/${n.id}`} className="hover:underline">
                  {tipoLargo(n.tipo)} {n.numero !== null ? numeroComprobante(c.puntoVenta.numero, n.numero) : '(sin número)'}
                </Link>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums">{dinero(n.importeTotal, c.moneda)}</span>
                  <Etiqueta className={ESTADOS[n.estado].clase}>{ESTADOS[n.estado].texto}</Etiqueta>
                </span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      {nota && <NotaModal key={nota} factura={c} clase={nota} onCerrar={() => setNota(null)} />}
    </div>
  );
}

function NotaModal({
  factura,
  clase,
  onCerrar,
}: {
  factura: Comprobante;
  clase: 'NOTA_CREDITO' | 'NOTA_DEBITO';
  onCerrar: () => void;
}) {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [motivo, setMotivo] = useState('');
  const texto = clase === 'NOTA_CREDITO' ? 'nota de crédito' : 'nota de débito';

  const crear = useMutation({
    mutationFn: () => pedir<Comprobante>(`/comprobantes/${factura.id}/notas`, 'POST', { clase, motivo: motivo.trim() }),
    onSuccess: (n) => {
      queryClient.setQueryData(['comprobante', n.id], n);
      void queryClient.invalidateQueries({ queryKey: ['comprobante', factura.id] });
      void queryClient.invalidateQueries({ queryKey: ['comprobantes'] });
      navigate(`/comprobantes/${n.id}`);
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    crear.mutate();
  }

  return (
    <Modal abierto titulo={`Nueva ${texto}`} onCerrar={onCerrar}>
      <form onSubmit={enviar} className="space-y-4 text-sm">
        <p>
          Se crea un borrador de {texto} {letraDe(factura.tipo)} sobre {tipoLargo(factura.tipo)}{' '}
          {numeroComprobante(factura.puntoVenta.numero, factura.numero)}, con las mismas líneas. Podés ajustar los importes antes de
          emitirla.
        </p>
        {clase === 'NOTA_CREDITO' && (
          <p className="text-slate-600">Si la nota de crédito es por el total, la factura queda anulada al emitirla.</p>
        )}
        <Campo etiqueta="Motivo">
          <Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)} required maxLength={500} autoFocus />
        </Campo>
        <AlertaError error={crear.error} />
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={crear.isPending}>
            Crear borrador
          </Boton>
        </div>
      </form>
    </Modal>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: ReactNode }) {
  return (
    <div>
      <dt className="text-slate-500">{titulo}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}

function Fila({ titulo, valor, fuerte }: { titulo: string; valor: string; fuerte?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${fuerte ? 'border-t border-slate-200 pt-1 text-base font-semibold' : ''}`}>
      <dt className={fuerte ? '' : 'text-slate-500'}>{titulo}</dt>
      <dd className="tabular-nums">{valor}</dd>
    </div>
  );
}
