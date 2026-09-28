import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { AlertaError, Aviso, Boton, Campo, Cargando, Entrada, Etiqueta, Selector, Tarjeta, Vacio } from '@/components/ui';
import { ALICUOTAS, UNIDADES } from '@/lib/formato';
import type { CampoMapeo, ColumnaMapeo, Moneda, PlantillaMapeo, PlantillaMapeoConfig, Unidad } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';

interface Vista {
  formato: 'xlsx' | 'csv';
  hojas: string[];
  filas: string[][];
  totalFilas: number;
}

const CAMPOS: Array<{ campo: CampoMapeo; texto: string; tipo: ColumnaMapeo['tipo']; requerido?: boolean; ayuda?: string }> = [
  { campo: 'descripcion', texto: 'Descripción', tipo: 'texto', requerido: true },
  { campo: 'cantidad', texto: 'Cantidad', tipo: 'decimal', requerido: true },
  { campo: 'cliente.numeroDocumento', texto: 'CUIT / DNI del cliente', tipo: 'texto', ayuda: 'O la referencia del cliente.' },
  { campo: 'cliente.referenciaExterna', texto: 'Código del cliente en tu sistema', tipo: 'texto' },
  { campo: 'cliente.razonSocial', texto: 'Nombre del cliente', tipo: 'texto', ayuda: 'Para sugerir el alta si no existe.' },
  { campo: 'precioUnitario', texto: 'Precio unitario (sin IVA)', tipo: 'decimal', ayuda: 'Si no hay, se usa la tarifa del cliente.' },
  { campo: 'unidad', texto: 'Unidad', tipo: 'texto' },
  { campo: 'moneda', texto: 'Moneda', tipo: 'texto' },
  { campo: 'alicuotaIva', texto: 'IVA %', tipo: 'decimal' },
  { campo: 'fecha', texto: 'Fecha', tipo: 'fecha' },
  { campo: 'periodo.desde', texto: 'Período desde', tipo: 'fecha' },
  { campo: 'periodo.hasta', texto: 'Período hasta', tipo: 'fecha' },
  { campo: 'referenciaExterna', texto: 'Id único de la fila', tipo: 'texto', ayuda: 'Evita duplicados al reimportar.' },
];

export function PlantillasMapeoSeccion() {
  const { pedir } = useApi();
  const [editando, setEditando] = useState<PlantillaMapeo | null | undefined>(undefined);
  const { data, error } = useQuery({ queryKey: ['plantillas-mapeo'], queryFn: () => pedir<PlantillaMapeo[]>('/configuracion/plantillas-mapeo') });

  if (error) return <AlertaError error={error} />;
  if (!data) return <Cargando />;
  if (editando !== undefined) return <EditorPlantilla key={editando?.id ?? 'nueva'} plantilla={editando} onCerrar={() => setEditando(undefined)} />;

  return (
    <Tarjeta titulo="Plantillas de Excel / CSV" acciones={<Boton onClick={() => setEditando(null)}>Nueva plantilla</Boton>}>
      <p className="mb-3 text-sm text-slate-600">Indican qué columna del archivo corresponde a cada dato. Se arma una vez por formato de planilla.</p>
      {data.length === 0 ? (
        <Vacio>Todavía no hay plantillas.</Vacio>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {data.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2">
              <span>
                <span className="font-medium">{p.nombre}</span>
                <Etiqueta className="ml-2 bg-slate-100 text-slate-600">{p.formato.toUpperCase()}</Etiqueta>
                {!p.activa && <Etiqueta className="ml-1 bg-slate-100 text-slate-500">Inactiva</Etiqueta>}
                <span className="block text-xs text-slate-500">{p.config.columnas.map((c) => c.encabezado).join(' · ')}</span>
              </span>
              <Boton variante="fantasma" onClick={() => setEditando(p)}>
                Editar
              </Boton>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

function EditorPlantilla({ plantilla, onCerrar }: { plantilla: PlantillaMapeo | null; onCerrar: () => void }) {
  const { pedir, subir } = useApi();
  const queryClient = useQueryClient();
  const cfg = plantilla?.config;
  const [nombre, setNombre] = useState(plantilla?.nombre ?? '');
  const [formato, setFormato] = useState<'xlsx' | 'csv'>(plantilla?.formato ?? 'xlsx');
  const [hoja, setHoja] = useState(typeof cfg?.hoja === 'string' ? cfg.hoja : '');
  const [delimitador, setDelimitador] = useState<'' | ',' | ';' | '\t'>(cfg?.delimitador ?? '');
  const [encoding, setEncoding] = useState<'utf-8' | 'latin1'>(cfg?.encoding ?? 'utf-8');
  const [filaEncabezado, setFilaEncabezado] = useState(cfg?.filaEncabezado ?? 1);
  const [columnas, setColumnas] = useState<Partial<Record<string, ColumnaMapeo>>>(() =>
    Object.fromEntries((cfg?.columnas ?? []).map((c) => [c.campo, c])),
  );
  const [defaults, setDefaults] = useState({
    unidad: (cfg?.valoresPorDefecto?.unidad ?? 'UNIDAD') as Unidad,
    alicuotaIva: cfg?.valoresPorDefecto?.alicuotaIva ?? '21',
    moneda: (cfg?.valoresPorDefecto?.moneda ?? 'ARS') as Moneda,
  });
  const [referencia, setReferencia] = useState<string[]>(cfg?.referencia?.columnas ?? []);
  const [activa, setActiva] = useState(plantilla?.activa ?? true);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vista, setVista] = useState<Vista | null>(null);

  const previsualizar = useMutation({
    mutationFn: (f: File) =>
      subir<Vista>('/configuracion/plantillas-mapeo/previsualizar', 'archivo', f, {
        method: 'POST',
        campos: { hoja: hoja || undefined, delimitador: delimitador || undefined, encoding },
      }),
    onSuccess: (v) => {
      setVista(v);
      setFormato(v.formato);
    },
  });

  const encabezados = vista
    ? (vista.filas[filaEncabezado - 1] ?? []).map((h) => h.trim()).filter(Boolean)
    : Object.values(columnas).map((c) => c!.encabezado);

  const config = (): PlantillaMapeoConfig => ({
    ...(formato === 'xlsx' && hoja ? { hoja } : {}),
    filaEncabezado,
    ...(formato === 'csv' ? { encoding, ...(delimitador ? { delimitador } : {}) } : {}),
    columnas: Object.values(columnas).filter((c): c is ColumnaMapeo => Boolean(c?.encabezado)),
    valoresPorDefecto: defaults,
    ...(referencia.length ? { referencia: { columnas: referencia } } : {}),
  });

  const guardar = useMutation({
    mutationFn: () =>
      plantilla
        ? pedir<PlantillaMapeo>(`/configuracion/plantillas-mapeo/${plantilla.id}`, 'PATCH', { nombre: nombre.trim(), formato, config: config(), activa })
        : pedir<PlantillaMapeo>('/configuracion/plantillas-mapeo', 'POST', { nombre: nombre.trim(), formato, config: config() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plantillas-mapeo'] });
      onCerrar();
    },
  });

  function elegirArchivo(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    e.target.value = '';
    setArchivo(f);
    if (f) previsualizar.mutate(f);
  }

  function mapear(campo: CampoMapeo, tipo: ColumnaMapeo['tipo'], encabezado: string) {
    setColumnas((c) => ({
      ...c,
      [campo]: encabezado
        ? { ...(c[campo] ?? { campo, tipo, ...(tipo === 'decimal' ? { separadorDecimal: ',' as const } : {}) }), encabezado }
        : undefined,
    }));
  }

  function ajustar(campo: CampoMapeo, cambios: Partial<ColumnaMapeo>) {
    setColumnas((c) => (c[campo] ? { ...c, [campo]: { ...c[campo]!, ...cambios } } : c));
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    guardar.mutate();
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Tarjeta titulo={plantilla ? `Editar “${plantilla.nombre}”` : 'Nueva plantilla de mapeo'} acciones={<Boton variante="fantasma" onClick={onCerrar}>Volver</Boton>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre">
            <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Horas del sistema X" required maxLength={100} />
          </Campo>
          <Campo etiqueta="Archivo de ejemplo" ayuda="Se usa solo para ver las columnas; no se importa.">
            <input type="file" accept=".xlsx,.csv,.txt" onChange={elegirArchivo} className="text-sm" />
          </Campo>
        </div>
        {plantilla && (
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} />
            Plantilla activa
          </label>
        )}
      </Tarjeta>

      <Tarjeta titulo="Lectura del archivo">
        <div className="grid gap-4 sm:grid-cols-4">
          <Campo etiqueta="Fila de encabezados">
            <Entrada type="number" min={1} max={100} value={filaEncabezado} onChange={(e) => setFilaEncabezado(Math.max(1, Number(e.target.value) || 1))} />
          </Campo>
          {formato === 'xlsx' ? (
            <Campo etiqueta="Hoja" ayuda="Vacío = la primera.">
              {vista?.hojas.length ? (
                <Selector value={hoja} onChange={(e) => setHoja(e.target.value)}>
                  <option value="">(la primera)</option>
                  {vista.hojas.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </Selector>
              ) : (
                <Entrada value={hoja} onChange={(e) => setHoja(e.target.value)} />
              )}
            </Campo>
          ) : (
            <>
              <Campo etiqueta="Separador">
                <Selector value={delimitador} onChange={(e) => setDelimitador(e.target.value as '' | ',' | ';' | '\t')}>
                  <option value="">Detectar</option>
                  <option value=";">Punto y coma (;)</option>
                  <option value=",">Coma (,)</option>
                  <option value={'\t'}>Tabulación</option>
                </Selector>
              </Campo>
              <Campo etiqueta="Codificación" ayuda="Excel en Windows suele usar Latin-1.">
                <Selector value={encoding} onChange={(e) => setEncoding(e.target.value as 'utf-8' | 'latin1')}>
                  <option value="utf-8">UTF-8</option>
                  <option value="latin1">Latin-1 (ISO-8859-1)</option>
                </Selector>
              </Campo>
            </>
          )}
          {archivo && (
            <div className="flex items-end">
              <Boton variante="secundario" cargando={previsualizar.isPending} onClick={() => previsualizar.mutate(archivo)}>
                Volver a leer
              </Boton>
            </div>
          )}
        </div>
        <div className="mt-3">
          <AlertaError error={previsualizar.error} />
        </div>
        {vista && (
          <div className="mt-4 overflow-x-auto rounded border border-slate-200">
            <table className="w-full text-xs">
              <tbody>
                {vista.filas.slice(0, 8).map((f, i) => (
                  <tr key={i} className={i + 1 === filaEncabezado ? 'bg-amber-50 font-semibold' : i + 1 < filaEncabezado ? 'text-slate-400' : ''}>
                    <td className="border-r border-slate-200 px-2 py-1 text-slate-400">{i + 1}</td>
                    {f.map((c, j) => (
                      <td key={j} className="max-w-40 truncate px-2 py-1">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-2 py-1 text-xs text-slate-500">{vista.totalFilas} filas en total. La fila resaltada son los encabezados.</p>
          </div>
        )}
      </Tarjeta>

      <Tarjeta titulo="Columnas">
        {!encabezados.length ? (
          <Aviso tono="azul">Subí un archivo de ejemplo para elegir las columnas.</Aviso>
        ) : (
          <div className="space-y-2">
            {CAMPOS.map(({ campo, texto, tipo, requerido, ayuda }) => {
              const col = columnas[campo];
              return (
                <div key={campo} className="grid gap-2 border-b border-slate-100 pb-2 sm:grid-cols-12 sm:items-center">
                  <div className="text-sm sm:col-span-4">
                    {texto}
                    {requerido && <span className="text-red-600"> *</span>}
                    {ayuda && <span className="block text-xs text-slate-500">{ayuda}</span>}
                  </div>
                  <Selector className="sm:col-span-4" value={col?.encabezado ?? ''} onChange={(e) => mapear(campo, tipo, e.target.value)}>
                    <option value="">— no usar —</option>
                    {[...new Set([...(col ? [col.encabezado] : []), ...encabezados])].map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </Selector>
                  <div className="sm:col-span-4">
                    {col && col.tipo === 'decimal' && (
                      <Selector value={col.separadorDecimal ?? ','} onChange={(e) => ajustar(campo, { separadorDecimal: e.target.value as ',' | '.' })}>
                        <option value=",">Decimales con coma (1.234,50)</option>
                        <option value=".">Decimales con punto (1,234.50)</option>
                      </Selector>
                    )}
                    {col && col.tipo === 'fecha' && (
                      <Entrada
                        placeholder="Formato (DD/MM/YYYY)"
                        value={col.formatoFecha ?? ''}
                        onChange={(e) => ajustar(campo, { formatoFecha: e.target.value || undefined })}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Tarjeta>

      <Tarjeta titulo="Valores por defecto y duplicados">
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo etiqueta="Unidad si no hay columna">
            <Selector value={defaults.unidad} onChange={(e) => setDefaults((d) => ({ ...d, unidad: e.target.value as Unidad }))}>
              {Object.entries(UNIDADES).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="IVA % si no hay columna">
            <Selector value={defaults.alicuotaIva} onChange={(e) => setDefaults((d) => ({ ...d, alicuotaIva: e.target.value }))}>
              {ALICUOTAS.map((a) => (
                <option key={a} value={a}>
                  {a.replace('.', ',')}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Moneda si no hay columna">
            <Selector value={defaults.moneda} onChange={(e) => setDefaults((d) => ({ ...d, moneda: e.target.value as Moneda }))}>
              <option value="ARS">Pesos</option>
              <option value="USD">Dólares</option>
            </Selector>
          </Campo>
        </div>
        {encabezados.length > 0 && !columnas.referenciaExterna && (
          <fieldset className="mt-4 space-y-1">
            <legend className="text-sm font-medium text-slate-700">Columnas que identifican una fila (para no duplicar al reimportar)</legend>
            <p className="text-xs text-slate-500">Si no elegís ninguna, se compara la fila completa.</p>
            <div className="flex flex-wrap gap-3 pt-1">
              {encabezados.map((h) => (
                <label key={h} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={referencia.includes(h)}
                    onChange={() => setReferencia((r) => (r.includes(h) ? r.filter((x) => x !== h) : [...r, h]))}
                  />
                  {h}
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </Tarjeta>

      <AlertaError error={guardar.error} />
      <div className="flex justify-end gap-2">
        <Boton variante="secundario" onClick={onCerrar}>
          Cancelar
        </Boton>
        <Boton type="submit" cargando={guardar.isPending}>
          Guardar plantilla
        </Boton>
      </div>
    </form>
  );
}
