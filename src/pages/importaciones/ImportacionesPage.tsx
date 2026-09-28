import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertaError, Aviso, Boton, Campo, Cargando, Entrada, Etiqueta, Selector, Tarjeta, Vacio } from '@/components/ui';
import { ESTADOS_IMPORTACION, fechaHora, hoy, ORIGENES } from '@/lib/formato';
import type { BaseHoras, ConexionTracker, Importacion, Paginado, PlantillaMapeo } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';

/** Primer y último día del mes anterior (lo habitual es facturar el mes cerrado). */
function mesAnterior(): { desde: string; hasta: string } {
  const [a, m] = hoy().split('-').map(Number);
  const desde = new Date(Date.UTC(a, m - 2, 1));
  const hasta = new Date(Date.UTC(a, m - 1, 0));
  return { desde: desde.toISOString().slice(0, 10), hasta: hasta.toISOString().slice(0, 10) };
}

export function ImportacionesPage() {
  const { pedir } = useApi();
  const [pagina, setPagina] = useState(1);
  const { data, error } = useQuery({
    queryKey: ['importaciones', pagina],
    queryFn: () => pedir<Paginado<Importacion>>(`/importaciones?pagina=${pagina}`),
    placeholderData: keepPreviousData,
  });
  const paginas = data ? Math.max(1, Math.ceil(data.total / data.porPagina)) : 1;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Importaciones</h1>
        <p className="text-sm text-slate-500">
          Traé lo que hay que facturar desde el tracker o desde una planilla, revisalo y generá los borradores en un paso.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ImportarTracker />
        <ImportarExcel />
      </div>
      <Tarjeta titulo="Historial">
        {error ? (
          <AlertaError error={error} />
        ) : !data ? (
          <Cargando />
        ) : data.items.length === 0 ? (
          <Vacio>Todavía no importaste nada.</Vacio>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Lote</th>
                    <th className="py-2 pr-4 font-medium">Fecha</th>
                    <th className="py-2 pr-4 text-right font-medium">Ítems</th>
                    <th className="py-2 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((i) => (
                    <tr key={i.id} className="hover:bg-slate-50">
                      <td className="py-2 pr-4">
                        <Link to={`/importaciones/${i.id}`} className="font-medium hover:underline">
                          {i.descripcion || ORIGENES[i.origen]}
                        </Link>
                        <span className="block text-xs text-slate-500">{ORIGENES[i.origen]}</span>
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap">{fechaHora(i.createdAt)}</td>
                      <td className="py-2 pr-4 text-right text-xs whitespace-nowrap">
                        <span className="text-emerald-700">{i.validos} listos</span>
                        {i.conErrores > 0 && <span className="ml-2 text-red-700">{i.conErrores} con errores</span>}
                        {i.duplicados > 0 && <span className="ml-2 text-slate-500">{i.duplicados} repetidos</span>}
                      </td>
                      <td className="py-2">
                        <Etiqueta className={ESTADOS_IMPORTACION[i.estado].clase}>{ESTADOS_IMPORTACION[i.estado].texto}</Etiqueta>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {paginas > 1 && (
              <div className="mt-4 flex items-center justify-end gap-2 text-sm">
                <Boton variante="secundario" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
                  Anterior
                </Boton>
                <span className="text-slate-500">
                  Página {pagina} de {paginas}
                </span>
                <Boton variante="secundario" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>
                  Siguiente
                </Boton>
              </div>
            )}
          </>
        )}
      </Tarjeta>
    </div>
  );
}

function ImportarTracker() {
  const { pedir } = useApi();
  const navigate = useNavigate();
  const conexion = useQuery({ queryKey: ['conexion-tracker'], queryFn: () => pedir<ConexionTracker>('/configuracion/tracker') });
  const [rango, setRango] = useState(mesAnterior);
  const [baseHoras, setBaseHoras] = useState<BaseHoras>('FACTURABLES');
  const [agrupacion, setAgrupacion] = useState<'proyecto-mes' | 'registro'>('proyecto-mes');

  const importar = useMutation({
    mutationFn: () => pedir<Importacion>('/importaciones/tracker', 'POST', { ...rango, baseHoras, agrupacion }),
    onSuccess: (imp) => navigate(`/importaciones/${imp.id}`),
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    importar.mutate();
  }

  if (conexion.data && !conexion.data.configurada) {
    return (
      <Tarjeta titulo="Horas del time tracker">
        <Aviso tono="azul">
          Para importar horas, conectá el tracker en{' '}
          <Link to="/configuracion?tab=tracker" className="underline">
            Configuración → Tracker
          </Link>
          .
        </Aviso>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta titulo="Horas del time tracker">
      <form onSubmit={enviar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Desde">
            <Entrada type="date" value={rango.desde} onChange={(e) => setRango((r) => ({ ...r, desde: e.target.value }))} required />
          </Campo>
          <Campo etiqueta="Hasta">
            <Entrada type="date" value={rango.hasta} onChange={(e) => setRango((r) => ({ ...r, hasta: e.target.value }))} required />
          </Campo>
          <Campo etiqueta="Horas a facturar" ayuda="Se puede cambiar después por ítem.">
            <Selector value={baseHoras} onChange={(e) => setBaseHoras(e.target.value as BaseHoras)}>
              <option value="FACTURABLES">Facturables (las que calcula el tracker)</option>
              <option value="TRABAJADAS">Trabajadas</option>
            </Selector>
          </Campo>
          <Campo etiqueta="Una línea por">
            <Selector value={agrupacion} onChange={(e) => setAgrupacion(e.target.value as 'proyecto-mes' | 'registro')}>
              <option value="proyecto-mes">Proyecto y mes</option>
              <option value="registro">Cada registro de horas</option>
            </Selector>
          </Campo>
        </div>
        <p className="text-xs text-slate-500">El precio sale de las tarifas del Facturador (Configuración → Tarifas), nunca de la tarifa del tracker.</p>
        <AlertaError error={importar.error} />
        <div className="flex justify-end">
          <Boton type="submit" cargando={importar.isPending}>
            Importar horas
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

function ImportarExcel() {
  const { pedir, subir } = useApi();
  const navigate = useNavigate();
  const plantillas = useQuery({ queryKey: ['plantillas-mapeo'], queryFn: () => pedir<PlantillaMapeo[]>('/configuracion/plantillas-mapeo') });
  const activas = (plantillas.data ?? []).filter((p) => p.activa);
  const [plantillaId, setPlantillaId] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const elegida = plantillaId || activas[0]?.id || '';

  const importar = useMutation({
    mutationFn: (f: File) => subir<Importacion>('/importaciones/excel', 'archivo', f, { method: 'POST', campos: { plantillaMapeoId: elegida } }),
    onSuccess: (imp) => navigate(`/importaciones/${imp.id}`),
  });

  function elegirArchivo(e: ChangeEvent<HTMLInputElement>) {
    setArchivo(e.target.files?.[0] ?? null);
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (archivo) importar.mutate(archivo);
  }

  if (plantillas.data && activas.length === 0) {
    return (
      <Tarjeta titulo="Planilla Excel / CSV">
        <Aviso tono="azul">
          Primero armá una plantilla que diga qué columna es cada dato, en{' '}
          <Link to="/configuracion?tab=mapeo" className="underline">
            Configuración → Plantillas Excel
          </Link>
          .
        </Aviso>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta titulo="Planilla Excel / CSV">
      <form onSubmit={enviar} className="space-y-4">
        <Campo etiqueta="Plantilla">
          <Selector value={elegida} onChange={(e) => setPlantillaId(e.target.value)}>
            {activas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({p.formato.toUpperCase()})
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Archivo" ayuda=".xlsx o .csv, hasta 5 MB. El formato .xls viejo no está soportado.">
          <input type="file" accept=".xlsx,.csv,.txt" onChange={elegirArchivo} className="text-sm" required />
        </Campo>
        <AlertaError error={importar.error ?? plantillas.error} />
        <div className="flex justify-end">
          <Boton type="submit" cargando={importar.isPending} disabled={!archivo || !elegida}>
            Importar planilla
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}
