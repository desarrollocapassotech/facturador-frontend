import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertaError, Aviso, Boton, Campo, Cargando, Etiqueta, Selector, Tarjeta, Vacio } from '@/components/ui';
import { ESTADOS_IMPORTACION, fechaHora, ORIGENES } from '@/lib/formato';
import type { Importacion, Paginado, PlantillaMapeo } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';

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
          Traé lo que hay que facturar desde una planilla (o desde otro sistema por la API), revisalo y generá los borradores en un paso.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
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
