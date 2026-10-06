import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertaError, Aviso, Boton, Campo, Cargando, Entrada, Etiqueta, Modal, Selector, Tarjeta, Vacio } from '@/components/ui';
import { ALICUOTAS, cantidad, cuit, dinero, ESTADOS_IMPORTACION, ESTADOS_ITEM, fecha, fechaHora, hoy, ORIGENES, soloFecha, UNIDADES, unidadTexto } from '@/lib/formato';
import type { Cliente, CondicionIva, EstadoItem, Importacion, ItemFacturable, Moneda, Paginado, TipoComprobante, Unidad } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';
import { ClienteModal } from '../clientes/ClienteModal';
import { FormularioTarifa } from '../configuracion/TarifasSeccion';

const FILTROS: Array<{ id: EstadoItem | ''; texto: string }> = [
  { id: '', texto: 'Todos' },
  { id: 'CON_ERRORES', texto: 'Con errores' },
  { id: 'VALIDO', texto: 'Listos' },
  { id: 'EN_BORRADOR', texto: 'En borrador' },
  { id: 'FACTURADO', texto: 'Facturados' },
  { id: 'DESCARTADO', texto: 'Descartados' },
];

interface ResultadoGenerar {
  creados: number;
  items: number;
  comprobantes: Array<{ id: string; tipo: TipoComprobante; moneda: Moneda; importeTotal: string; cliente: { razonSocial: string }; _count: { lineas: number } }>;
}

function totalEstimado(i: ItemFacturable): number {
  return Number(i.cantidad) * Number(i.precioUnitario) * (1 + Number(i.alicuotaIva) / 100);
}

export function ImportacionDetallePage() {
  const { id = '' } = useParams();
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState<EstadoItem | ''>('');
  const [editando, setEditando] = useState<ItemFacturable | null>(null);
  const [asignando, setAsignando] = useState<ItemFacturable | null>(null);
  const [tarifaPara, setTarifaPara] = useState<ItemFacturable | null>(null);
  const [resultado, setResultado] = useState<ResultadoGenerar | null>(null);

  const imp = useQuery({ queryKey: ['importacion', id], queryFn: () => pedir<Importacion>(`/importaciones/${id}`) });
  const items = useQuery({
    queryKey: ['importacion-items', id, filtro],
    queryFn: () => pedir<Paginado<ItemFacturable>>(`/importaciones/items?importacionId=${id}&porPagina=500${filtro ? `&estado=${filtro}` : ''}`),
  });

  const refrescar = () => {
    void queryClient.invalidateQueries({ queryKey: ['importacion', id] });
    void queryClient.invalidateQueries({ queryKey: ['importacion-items', id] });
    void queryClient.invalidateQueries({ queryKey: ['importaciones'] });
  };

  const accionItem = useMutation({
    mutationFn: ({ item, accion }: { item: ItemFacturable; accion: 'descartar' | 'restaurar' }) =>
      pedir<ItemFacturable>(`/importaciones/items/${item.id}/${accion}`, 'POST'),
    onSuccess: refrescar,
  });
  const confirmar = useMutation({ mutationFn: () => pedir<Importacion>(`/importaciones/${id}/confirmar`, 'POST'), onSuccess: refrescar });
  const descartar = useMutation({ mutationFn: () => pedir<Importacion>(`/importaciones/${id}/descartar`, 'POST'), onSuccess: refrescar });

  /** Después de crear una tarifa, revalida los ítems con error del mismo cliente. */
  async function revalidarCliente(clienteId: string) {
    const conError = (items.data?.items ?? []).filter((i) => i.estado === 'CON_ERRORES' && i.clienteId === clienteId);
    for (const i of conError) await pedir(`/importaciones/items/${i.id}`, 'PATCH', {});
    refrescar();
  }

  if (imp.error) return <AlertaError error={imp.error} />;
  if (!imp.data) return <Cargando />;
  const i = imp.data;
  const n = (e: EstadoItem) => i.estadosItems?.[e] ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <Link to="/importaciones" className="text-sm text-slate-500 hover:underline">
          ← Importaciones
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{i.descripcion || ORIGENES[i.origen]}</h1>
          <Etiqueta className={ESTADOS_IMPORTACION[i.estado].clase}>{ESTADOS_IMPORTACION[i.estado].texto}</Etiqueta>
        </div>
        <p className="text-sm text-slate-500">
          {ORIGENES[i.origen]} · {fechaHora(i.createdAt)}
        </p>
      </div>

      <Tarjeta>
        <dl className="grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
          <Dato titulo="Leídos" valor={i.totalItems} />
          <Dato titulo="Listos" valor={n('VALIDO')} clase="text-emerald-700" />
          <Dato titulo="Con errores" valor={n('CON_ERRORES')} clase={n('CON_ERRORES') ? 'text-red-700' : ''} />
          <Dato titulo="Repetidos (sin cambios)" valor={i.duplicados} />
          <Dato titulo="Actualizados" valor={i.actualizados} />
          <Dato titulo="En borrador / facturados" valor={`${n('EN_BORRADOR')} / ${n('FACTURADO')}`} />
        </dl>
        {i.duplicados > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            Los repetidos ya estaban importados con los mismos datos: no se vuelven a cargar.
          </p>
        )}
      </Tarjeta>

      {i.advertencias && i.advertencias.length > 0 && (
        <Aviso>
          <p className="font-medium">Avisos de la importación</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {i.advertencias.slice(0, 30).map((a, k) => (
              <li key={k}>{a.mensaje}</li>
            ))}
          </ul>
          {i.advertencias.length > 30 && <p className="mt-1 text-xs">… y {i.advertencias.length - 30} más.</p>}
        </Aviso>
      )}

      <Acciones
        importacion={i}
        confirmar={confirmar}
        descartar={descartar}
        onGenerado={(r) => {
          setResultado(r);
          refrescar();
        }}
      />
      {resultado && <ResultadoBorradores resultado={resultado} />}

      <Tarjeta
        titulo="Ítems"
        acciones={
          <div className="flex flex-wrap gap-1">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltro(f.id)}
                className={`rounded-md px-2 py-1 text-xs ${filtro === f.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {f.texto}
              </button>
            ))}
          </div>
        }
      >
        <AlertaError error={items.error ?? accionItem.error} />
        {!items.data ? (
          <Cargando />
        ) : items.data.items.length === 0 ? (
          <Vacio>No hay ítems {filtro ? 'en este estado' : 'en esta importación'}.</Vacio>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.data.items.map((item) => (
              <FilaItem
                key={item.id}
                item={item}
                ocupado={accionItem.isPending && accionItem.variables?.item.id === item.id}
                onEditar={() => setEditando(item)}
                onAsignar={() => setAsignando(item)}
                onTarifa={() => setTarifaPara(item)}
                onDescartar={() => accionItem.mutate({ item, accion: 'descartar' })}
                onRestaurar={() => accionItem.mutate({ item, accion: 'restaurar' })}
              />
            ))}
          </ul>
        )}
      </Tarjeta>

      {editando && <EditarItemModal key={editando.id} item={editando} onCerrar={() => setEditando(null)} onGuardado={refrescar} />}
      {asignando && <AsignarClienteModal key={asignando.id} item={asignando} onCerrar={() => setAsignando(null)} onGuardado={refrescar} />}
      {tarifaPara && (
        <Modal abierto titulo="Nueva tarifa" onCerrar={() => setTarifaPara(null)}>
          <FormularioTarifa
            inicial={{
              clienteId: tarifaPara.clienteId ?? undefined,
              claveExterna: (tarifaPara.metadatos?.tarifa as { claveExterna?: string } | undefined)?.claveExterna,
              unidad: tarifaPara.unidad,
              vigenteDesde: `${(soloFecha(tarifaPara.periodoDesde ?? tarifaPara.fecha) || hoy()).slice(0, 7)}-01`,
            }}
            onCreada={(t) => {
              setTarifaPara(null);
              void revalidarCliente(t.clienteId);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function Dato({ titulo, valor, clase = '' }: { titulo: string; valor: string | number; clase?: string }) {
  return (
    <div>
      <dt className="text-slate-500">{titulo}</dt>
      <dd className={`text-lg font-semibold tabular-nums ${clase}`}>{valor}</dd>
    </div>
  );
}

function Acciones({
  importacion: i,
  confirmar,
  descartar,
  onGenerado,
}: {
  importacion: Importacion;
  confirmar: { mutate: () => void; isPending: boolean; error: unknown };
  descartar: { mutate: () => void; isPending: boolean; error: unknown };
  onGenerado: (r: ResultadoGenerar) => void;
}) {
  const { pedir } = useApi();
  const [agrupacion, setAgrupacion] = useState<'cliente' | 'cliente-periodo'>('cliente');
  const [fechaEmision, setFechaEmision] = useState(hoy());
  const listos = i.estadosItems?.VALIDO ?? 0;

  const generar = useMutation({
    mutationFn: () => pedir<ResultadoGenerar>('/comprobantes/generar', 'POST', { importacionId: i.id, agrupacion, fechaEmision }),
    onSuccess: onGenerado,
  });

  if (i.estado === 'DESCARTADA') return <Aviso tono="azul">Esta importación fue descartada.</Aviso>;

  function enviar(e: FormEvent) {
    e.preventDefault();
    generar.mutate();
  }

  return (
    <Tarjeta titulo={i.estado === 'EN_STAGING' ? 'Revisión' : 'Facturar'}>
      {i.estado === 'EN_STAGING' ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            Corregí los ítems con errores (o descartalos) y confirmá. Los que queden con error no se facturan.
          </p>
          <div className="flex gap-2">
            <Boton
              variante="fantasma"
              cargando={descartar.isPending}
              onClick={() => {
                if (window.confirm('¿Descartar toda la importación? Sus ítems no se van a facturar.')) descartar.mutate();
              }}
            >
              Descartar lote
            </Boton>
            <Boton cargando={confirmar.isPending} onClick={() => confirmar.mutate()} disabled={listos === 0}>
              Confirmar {listos} ítem{listos === 1 ? '' : 's'}
            </Boton>
          </div>
        </div>
      ) : (
        <form onSubmit={enviar} className="flex flex-wrap items-end gap-3">
          <Campo etiqueta="Un borrador por">
            <Selector value={agrupacion} onChange={(e) => setAgrupacion(e.target.value as 'cliente' | 'cliente-periodo')}>
              <option value="cliente">Cliente (y moneda)</option>
              <option value="cliente-periodo">Cliente y mes</option>
            </Selector>
          </Campo>
          <Campo etiqueta="Fecha de los comprobantes">
            <Entrada type="date" value={fechaEmision} onChange={(e) => setFechaEmision(e.target.value)} required />
          </Campo>
          <Boton type="submit" cargando={generar.isPending} disabled={listos === 0}>
            Generar borradores ({listos} ítem{listos === 1 ? '' : 's'})
          </Boton>
          {listos === 0 && <p className="w-full text-sm text-slate-500">No quedan ítems listos para facturar en esta importación.</p>}
        </form>
      )}
      <div className="mt-3">
        <AlertaError error={confirmar.error ?? descartar.error ?? generar.error} />
      </div>
    </Tarjeta>
  );
}

function ResultadoBorradores({ resultado }: { resultado: ResultadoGenerar }) {
  return (
    <Aviso tono="verde">
      <p className="font-medium">
        Se generaron {resultado.creados} borrador{resultado.creados === 1 ? '' : 'es'} con {resultado.items} ítem{resultado.items === 1 ? '' : 's'}.
        Revisalos y emitilos desde Comprobantes.
      </p>
      <ul className="mt-2 space-y-1">
        {resultado.comprobantes.map((c) => (
          <li key={c.id}>
            <Link to={`/comprobantes/${c.id}`} className="underline">
              {c.cliente.razonSocial}
            </Link>{' '}
            — {c._count.lineas} línea{c._count.lineas === 1 ? '' : 's'}, {dinero(c.importeTotal, c.moneda)}
          </li>
        ))}
      </ul>
    </Aviso>
  );
}

function FilaItem({
  item,
  ocupado,
  onEditar,
  onAsignar,
  onTarifa,
  onDescartar,
  onRestaurar,
}: {
  item: ItemFacturable;
  ocupado: boolean;
  onEditar: () => void;
  onAsignar: () => void;
  onTarifa: () => void;
  onDescartar: () => void;
  onRestaurar: () => void;
}) {
  const m = item.metadatos ?? {};
  const editable = item.estado === 'VALIDO' || item.estado === 'CON_ERRORES';
  const errorTarifa = item.errores?.some((e) => e.campo === 'precioUnitario' && /tarifa/i.test(e.mensaje));
  const periodo = item.periodoDesde ? `${fecha(item.periodoDesde)} al ${fecha(item.periodoHasta)}` : item.fecha ? fecha(item.fecha) : null;
  const doc = item.clienteNumeroDocumento
    ? `${item.clienteTipoDocumento ?? ''} ${item.clienteTipoDocumento === 'CUIT' ? cuit(item.clienteNumeroDocumento.replace(/\D/g, '')) : item.clienteNumeroDocumento}`
    : null;

  return (
    <li className="grid gap-3 py-3 text-sm lg:grid-cols-12">
      <div className="lg:col-span-5">
        <p className="font-medium">{item.descripcion}</p>
        <p className="text-xs text-slate-500">
          {periodo}
          {m.fila !== undefined && <> · fila {String(m.fila)}</>}
        </p>
        <p className="mt-1">
          {item.cliente ? (
            <span className="text-slate-700">{item.cliente.razonSocial}</span>
          ) : (
            <span className="text-red-700">
              Sin cliente
              {item.clienteAlta?.razonSocial && <> — “{item.clienteAlta.razonSocial}”</>}
              {doc && <> ({doc})</>}
            </span>
          )}
          {editable && (
            <button type="button" onClick={onAsignar} className="ml-2 text-xs text-slate-600 underline">
              {item.cliente ? 'Cambiar' : 'Asignar cliente'}
            </button>
          )}
        </p>
      </div>

      <div className="lg:col-span-3">
        <p className="tabular-nums">
          {cantidad(item.cantidad)} {unidadTexto(item.unidad, item.cantidad)} × {dinero(item.precioUnitario, item.moneda)}
          {m.precioDeTarifa && m.tarifaId && <span className="ml-1 text-xs text-slate-500">(tarifa)</span>}
        </p>
        <p className="text-xs text-slate-500 tabular-nums">
          ≈ {dinero(totalEstimado(item), item.moneda)} con IVA {Number(item.alicuotaIva)} %
        </p>
      </div>

      <div className="lg:col-span-2">
        <Etiqueta className={ESTADOS_ITEM[item.estado].clase}>{ESTADOS_ITEM[item.estado].texto}</Etiqueta>
        {item.estado === 'CON_ERRORES' && item.errores && (
          <ul className="mt-1 space-y-0.5 text-xs text-red-700">
            {item.errores.map((e, k) => (
              <li key={k}>{e.mensaje}</li>
            ))}
          </ul>
        )}
        {item.comprobanteId && (
          <Link to={`/comprobantes/${item.comprobanteId}`} className="mt-1 block text-xs underline">
            Ver comprobante
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-start justify-end gap-1 lg:col-span-2">
        {errorTarifa && item.clienteId && (
          <Boton variante="secundario" onClick={onTarifa} disabled={ocupado}>
            Crear tarifa
          </Boton>
        )}
        {editable && (
          <>
            <Boton variante="fantasma" onClick={onEditar} disabled={ocupado}>
              Editar
            </Boton>
            <Boton variante="fantasma" onClick={onDescartar} cargando={ocupado}>
              Descartar
            </Boton>
          </>
        )}
        {item.estado === 'DESCARTADO' && (
          <Boton variante="fantasma" onClick={onRestaurar} cargando={ocupado}>
            Restaurar
          </Boton>
        )}
      </div>
    </li>
  );
}

function EditarItemModal({ item, onCerrar, onGuardado }: { item: ItemFacturable; onCerrar: () => void; onGuardado: () => void }) {
  const { pedir } = useApi();
  const m = item.metadatos ?? {};
  const originales = m.valoresOriginales ?? {};
  const [form, setForm] = useState({
    descripcion: item.descripcion,
    cantidad: originales.cantidad ?? String(Number(item.cantidad)),
    unidad: item.unidad,
    usarTarifa: Boolean(m.precioDeTarifa),
    precioUnitario: originales.precioUnitario ?? String(Number(item.precioUnitario)),
    moneda: item.moneda,
    alicuotaIva: String(Number(item.alicuotaIva)),
    fecha: soloFecha(item.fecha) || originales.fecha || '',
    periodoDesde: soloFecha(item.periodoDesde),
    periodoHasta: soloFecha(item.periodoHasta),
  });

  function cambiar<K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  const guardar = useMutation({
    mutationFn: () =>
      pedir<ItemFacturable>(`/importaciones/items/${item.id}`, 'PATCH', {
        descripcion: form.descripcion.trim(),
        cantidad: form.cantidad.trim().replace(',', '.'),
        unidad: form.unidad,
        ...(form.usarTarifa
          ? { precioUnitario: null }
          : { precioUnitario: form.precioUnitario.trim().replace(',', '.'), moneda: form.moneda, alicuotaIva: form.alicuotaIva }),
        ...(form.fecha ? { fecha: form.fecha } : {}),
        ...(form.periodoDesde && form.periodoHasta ? { periodoDesde: form.periodoDesde, periodoHasta: form.periodoHasta } : {}),
      }),
    onSuccess: () => {
      onGuardado();
      onCerrar();
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    guardar.mutate();
  }

  return (
    <Modal abierto titulo="Editar ítem" onCerrar={onCerrar}>
      <form onSubmit={enviar} className="space-y-4">
        <Campo etiqueta="Descripción">
          <Entrada value={form.descripcion} onChange={(e) => cambiar('descripcion', e.target.value)} required maxLength={500} />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Cantidad">
            <Entrada inputMode="decimal" value={form.cantidad} onChange={(e) => cambiar('cantidad', e.target.value)} required />
          </Campo>
          <Campo etiqueta="Unidad">
            <Selector value={form.unidad} onChange={(e) => cambiar('unidad', e.target.value as Unidad)}>
              {Object.entries(UNIDADES).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </Selector>
          </Campo>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.usarTarifa} onChange={(e) => cambiar('usarTarifa', e.target.checked)} />
          Tomar el precio de la tarifa del cliente
        </label>
        {!form.usarTarifa && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo etiqueta="Precio (sin IVA)">
              <Entrada inputMode="decimal" value={form.precioUnitario} onChange={(e) => cambiar('precioUnitario', e.target.value)} required />
            </Campo>
            <Campo etiqueta="Moneda">
              <Selector value={form.moneda} onChange={(e) => cambiar('moneda', e.target.value as Moneda)}>
                <option value="ARS">Pesos</option>
                <option value="USD">Dólares</option>
              </Selector>
            </Campo>
            <Campo etiqueta="IVA %">
              <Selector value={form.alicuotaIva} onChange={(e) => cambiar('alicuotaIva', e.target.value)}>
                {ALICUOTAS.map((a) => (
                  <option key={a} value={a}>
                    {a.replace('.', ',')}
                  </option>
                ))}
              </Selector>
            </Campo>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo etiqueta="Fecha">
            <Entrada type="date" value={form.fecha} onChange={(e) => cambiar('fecha', e.target.value)} />
          </Campo>
          <Campo etiqueta="Período desde">
            <Entrada type="date" value={form.periodoDesde} onChange={(e) => cambiar('periodoDesde', e.target.value)} />
          </Campo>
          <Campo etiqueta="Período hasta">
            <Entrada type="date" value={form.periodoHasta} onChange={(e) => cambiar('periodoHasta', e.target.value)} />
          </Campo>
        </div>
        <AlertaError error={guardar.error} />
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={guardar.isPending}>
            Guardar
          </Boton>
        </div>
      </form>
    </Modal>
  );
}

const CONDICIONES: CondicionIva[] = [
  'RESPONSABLE_INSCRIPTO',
  'EXENTO',
  'CONSUMIDOR_FINAL',
  'MONOTRIBUTO',
  'NO_CATEGORIZADO',
  'PROVEEDOR_EXTERIOR',
  'CLIENTE_EXTERIOR',
  'IVA_LIBERADO',
  'MONOTRIBUTO_SOCIAL',
  'NO_ALCANZADO',
  'MONOTRIBUTO_TIP',
];

function AsignarClienteModal({ item, onCerrar, onGuardado }: { item: ItemFacturable; onCerrar: () => void; onGuardado: () => void }) {
  const { pedir } = useApi();
  const [clienteId, setClienteId] = useState(item.clienteId ?? '');
  const [creando, setCreando] = useState(false);
  const clientes = useQuery({ queryKey: ['clientes', { q: '', inactivos: false }], queryFn: () => pedir<Cliente[]>('/clientes?') });

  const asignar = useMutation({
    mutationFn: (id: string) => pedir<ItemFacturable & { actualizadosConElMismoCliente?: number }>(`/importaciones/items/${item.id}`, 'PATCH', { clienteId: id }),
    onSuccess: () => {
      onGuardado();
      onCerrar();
    },
  });

  const alta = item.clienteAlta;
  const condicion = CONDICIONES.includes(alta?.condicionIva as CondicionIva) ? (alta?.condicionIva as CondicionIva) : undefined;
  const numero = item.clienteNumeroDocumento?.replace(/\D/g, '') ?? '';

  if (creando) {
    return (
      <ClienteModal
        abierto
        valoresIniciales={{
          razonSocial: alta?.razonSocial,
          condicionIva: condicion,
          domicilio: alta?.domicilio,
          email: alta?.email,
          ...(numero ? { tipoDocumento: item.clienteTipoDocumento ?? 'CUIT', numeroDocumento: numero } : {}),
        }}
        onCerrar={onCerrar}
        // El modal se cierra al guardar: la asignación no puede depender de que este componente siga montado.
        onGuardado={(c) => {
          void pedir(`/importaciones/items/${item.id}`, 'PATCH', { clienteId: c.id })
            .then(onGuardado)
            .catch((err: unknown) => window.alert(`El cliente se creó, pero no se pudo asignar: ${(err as Error).message}`));
        }}
      />
    );
  }

  return (
    <Modal abierto titulo="Asignar cliente" onCerrar={onCerrar}>
      <div className="space-y-4 text-sm">
        {(alta?.razonSocial || numero) && (
          <p className="text-slate-600">
            El origen lo identifica como <strong>{alta?.razonSocial ?? '—'}</strong>
            {numero && <> ({cuit(numero)})</>}.
            {item.clienteReferenciaExterna && ' Al asignarlo, se recuerda para las próximas importaciones y se aplica a los otros ítems de ese cliente.'}
          </p>
        )}
        <Campo etiqueta="Cliente del Facturador">
          <Selector value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Elegí un cliente…</option>
            {(clientes.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.razonSocial}
              </option>
            ))}
          </Selector>
        </Campo>
        <AlertaError error={asignar.error ?? clientes.error} />
        <div className="flex flex-wrap justify-between gap-2">
          <Boton variante="secundario" onClick={() => setCreando(true)}>
            Crear cliente nuevo
          </Boton>
          <div className="flex gap-2">
            <Boton variante="fantasma" onClick={onCerrar}>
              Cancelar
            </Boton>
            <Boton onClick={() => asignar.mutate(clienteId)} disabled={!clienteId} cargando={asignar.isPending}>
              Asignar
            </Boton>
          </div>
        </div>
      </div>
    </Modal>
  );
}
