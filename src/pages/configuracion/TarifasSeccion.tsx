import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { AlertaError, Boton, Campo, Cargando, Entrada, Selector, Tarjeta, Vacio } from '@/components/ui';
import { ALICUOTAS, dinero, fecha, hoy, ORIGENES, UNIDADES } from '@/lib/formato';
import type { Cliente, Moneda, OrigenItem, Tarifa, Unidad } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';

export interface TarifaInicial {
  clienteId?: string;
  claveExterna?: string;
  origen?: OrigenItem;
  unidad?: Unidad;
  descripcion?: string;
  vigenteDesde?: string;
}

export function TarifasSeccion() {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const { data, error } = useQuery({ queryKey: ['tarifas'], queryFn: () => pedir<Tarifa[]>('/configuracion/tarifas') });

  const eliminar = useMutation({
    mutationFn: (t: Tarifa) => pedir<void>(`/configuracion/tarifas/${t.id}`, 'DELETE'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tarifas'] }),
  });

  if (error) return <AlertaError error={error} />;
  if (!data) return <Cargando />;

  return (
    <div className="space-y-4">
      <Tarjeta titulo="Tarifas por cliente">
        <p className="mb-3 text-sm text-slate-600">
          Se usan cuando un ítem importado llega sin precio (por ejemplo, horas cargadas por la API). Gana la más específica vigente: la del
          proyecto sobre la del cliente, y la del origen sobre la general.
        </p>
        {data.length === 0 ? (
          <Vacio>No hay tarifas cargadas.</Vacio>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">Cliente</th>
                  <th className="py-2 pr-4 font-medium">Aplica a</th>
                  <th className="py-2 pr-4 text-right font-medium">Precio</th>
                  <th className="py-2 pr-4 font-medium">Vigencia</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((t) => (
                  <tr key={t.id}>
                    <td className="py-2 pr-4">
                      {t.cliente.razonSocial}
                      {t.descripcion && <span className="block text-xs text-slate-500">“{t.descripcion}”</span>}
                    </td>
                    <td className="py-2 pr-4 text-xs text-slate-600">
                      {t.claveExterna ? <>Proyecto <span className="font-mono">{t.claveExterna}</span></> : 'Todo el cliente'}
                      {' · '}
                      {t.origen ? ORIGENES[t.origen] : 'Cualquier origen'}
                    </td>
                    <td className="py-2 pr-4 text-right whitespace-nowrap tabular-nums">
                      {dinero(t.precioUnitario, t.moneda)} / {UNIDADES[t.unidad].toLowerCase()}
                      <span className="block text-xs text-slate-500">IVA {Number(t.alicuotaIva)} %</span>
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap text-xs">
                      {fecha(t.vigenteDesde)} → {t.vigenteHasta ? fecha(t.vigenteHasta) : 'sin fin'}
                    </td>
                    <td className="py-2 text-right">
                      <Boton
                        variante="fantasma"
                        cargando={eliminar.isPending && eliminar.variables?.id === t.id}
                        onClick={() => {
                          if (window.confirm('¿Eliminar esta tarifa?')) eliminar.mutate(t);
                        }}
                      >
                        Eliminar
                      </Boton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3">
          <AlertaError error={eliminar.error} />
        </div>
      </Tarjeta>
      <Tarjeta titulo="Nueva tarifa">
        <FormularioTarifa />
      </Tarjeta>
    </div>
  );
}

/** Alta de tarifa. Se usa también desde el staging de importaciones, con datos precargados. */
export function FormularioTarifa({ inicial, onCreada }: { inicial?: TarifaInicial; onCreada?: (t: Tarifa) => void }) {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const clientes = useQuery({ queryKey: ['clientes', { q: '', inactivos: false }], queryFn: () => pedir<Cliente[]>('/clientes?') });
  const [form, setForm] = useState({
    clienteId: inicial?.clienteId ?? '',
    claveExterna: inicial?.claveExterna ?? '',
    origen: (inicial?.origen ?? '') as OrigenItem | '',
    descripcion: inicial?.descripcion ?? '',
    unidad: inicial?.unidad ?? ('HORA' as Unidad),
    precioUnitario: '',
    moneda: 'ARS' as Moneda,
    alicuotaIva: '21',
    vigenteDesde: inicial?.vigenteDesde ?? `${hoy().slice(0, 7)}-01`,
    vigenteHasta: '',
  });

  function cambiar<K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  const crear = useMutation({
    mutationFn: () =>
      pedir<Tarifa>('/configuracion/tarifas', 'POST', {
        clienteId: form.clienteId,
        origen: form.origen || null,
        claveExterna: form.claveExterna.trim() || null,
        descripcion: form.descripcion.trim() || null,
        unidad: form.unidad,
        precioUnitario: form.precioUnitario.trim().replace(',', '.'),
        moneda: form.moneda,
        alicuotaIva: form.alicuotaIva,
        vigenteDesde: form.vigenteDesde,
        vigenteHasta: form.vigenteHasta || null,
      }),
    onSuccess: (t) => {
      void queryClient.invalidateQueries({ queryKey: ['tarifas'] });
      setForm((f) => ({ ...f, precioUnitario: '' }));
      onCreada?.(t);
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    crear.mutate();
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Campo etiqueta="Cliente" className="lg:col-span-2">
          <Selector value={form.clienteId} onChange={(e) => cambiar('clienteId', e.target.value)} required>
            <option value="">Elegí un cliente…</option>
            {(clientes.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.razonSocial}
              </option>
            ))}
          </Selector>
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
        <Campo etiqueta="Precio unitario (sin IVA)">
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
        <Campo etiqueta="Vigente desde">
          <Entrada type="date" value={form.vigenteDesde} onChange={(e) => cambiar('vigenteDesde', e.target.value)} required />
        </Campo>
        <Campo etiqueta="Vigente hasta" ayuda="Opcional.">
          <Entrada type="date" value={form.vigenteHasta} onChange={(e) => cambiar('vigenteHasta', e.target.value)} />
        </Campo>
        <Campo etiqueta="Origen" ayuda="Vacío = cualquiera.">
          <Selector value={form.origen} onChange={(e) => cambiar('origen', e.target.value as OrigenItem | '')}>
            <option value="">Cualquier origen</option>
            {Object.entries(ORIGENES).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Clave de proyecto" ayuda="Opcional: la que manda el otro sistema, para una tarifa distinta por proyecto.">
          <Entrada value={form.claveExterna} onChange={(e) => cambiar('claveExterna', e.target.value)} maxLength={100} className="font-mono" />
        </Campo>
        <Campo etiqueta="Texto de la línea" ayuda="Opcional. Admite {proyecto} y {periodo}." className="sm:col-span-2 lg:col-span-3">
          <Entrada
            value={form.descripcion}
            onChange={(e) => cambiar('descripcion', e.target.value)}
            placeholder="Desarrollo de software {proyecto} - {periodo}"
            maxLength={300}
          />
        </Campo>
      </div>
      <AlertaError error={crear.error} />
      <div className="flex justify-end">
        <Boton type="submit" cargando={crear.isPending}>
          Guardar tarifa
        </Boton>
      </div>
    </form>
  );
}
