import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { AlertaError, Aviso, Boton, Campo, Cargando, Entrada, Etiqueta, Selector, Tarjeta, Vacio } from '@/components/ui';
import { ambienteTexto } from '@/lib/formato';
import type { Ambiente, Emisor, PuntoVenta } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';

export function PuntosVentaSeccion() {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const puntos = useQuery({ queryKey: ['puntos-venta'], queryFn: () => pedir<PuntoVenta[]>('/configuracion/puntos-venta') });
  const emisor = useQuery({ queryKey: ['emisor'], queryFn: () => pedir<Emisor>('/configuracion/emisor') });

  const cambiarActivo = useMutation({
    mutationFn: (pv: PuntoVenta) => pedir<PuntoVenta>(`/configuracion/puntos-venta/${pv.id}`, 'PATCH', { activo: !pv.activo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['puntos-venta'] }),
  });

  if (puntos.error) return <AlertaError error={puntos.error} />;
  if (!puntos.data || !emisor.data) return <Cargando />;

  const ambiente = emisor.data.ambienteArca;
  const delAmbiente = puntos.data.filter((p) => p.ambiente === ambiente && p.activo);

  return (
    <div className="space-y-4">
      {delAmbiente.length === 0 && (
        <Aviso>
          No hay puntos de venta activos para {ambienteTexto(ambiente).toLowerCase()}. Sin uno no se puede emitir.
          {ambiente === 'HOMOLOGACION' && ' En pruebas, usá el número 1.'}
        </Aviso>
      )}
      <Tarjeta titulo="Puntos de venta">
        {puntos.data.length === 0 ? (
          <Vacio>Todavía no cargaste puntos de venta.</Vacio>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">Número</th>
                  <th className="py-2 pr-4 font-medium">Ambiente</th>
                  <th className="py-2 pr-4 font-medium">Descripción</th>
                  <th className="py-2 pr-4 font-medium">Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {puntos.data.map((pv) => (
                  <tr key={pv.id}>
                    <td className="py-2 pr-4 font-mono">{String(pv.numero).padStart(5, '0')}</td>
                    <td className="py-2 pr-4">{ambienteTexto(pv.ambiente)}</td>
                    <td className="py-2 pr-4">{pv.descripcion ?? '—'}</td>
                    <td className="py-2 pr-4">
                      <Etiqueta className={pv.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}>
                        {pv.activo ? 'Activo' : 'Inactivo'}
                      </Etiqueta>
                    </td>
                    <td className="py-2 text-right">
                      <Boton
                        variante="fantasma"
                        cargando={cambiarActivo.isPending && cambiarActivo.variables?.id === pv.id}
                        onClick={() => cambiarActivo.mutate(pv)}
                      >
                        {pv.activo ? 'Desactivar' : 'Activar'}
                      </Boton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3">
          <AlertaError error={cambiarActivo.error} />
        </div>
      </Tarjeta>
      <NuevoPuntoVenta ambiente={ambiente} sugerirUno={ambiente === 'HOMOLOGACION' && puntos.data.length === 0} />
    </div>
  );
}

function NuevoPuntoVenta({ ambiente, sugerirUno }: { ambiente: Ambiente; sugerirUno: boolean }) {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const [numero, setNumero] = useState(sugerirUno ? '1' : '');
  const [amb, setAmb] = useState<Ambiente>(ambiente);
  const [descripcion, setDescripcion] = useState('');

  const crear = useMutation({
    mutationFn: () =>
      pedir<PuntoVenta>('/configuracion/puntos-venta', 'POST', {
        numero: Number(numero),
        ambiente: amb,
        ...(descripcion.trim() ? { descripcion: descripcion.trim() } : {}),
      }),
    onSuccess: () => {
      setNumero('');
      setDescripcion('');
      void queryClient.invalidateQueries({ queryKey: ['puntos-venta'] });
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    crear.mutate();
  }

  return (
    <Tarjeta titulo="Agregar punto de venta">
      <form onSubmit={enviar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo etiqueta="Número" ayuda="Tiene que existir en ARCA como “RECE / Web Services”.">
            <Entrada type="number" min={1} max={99998} value={numero} onChange={(e) => setNumero(e.target.value)} required />
          </Campo>
          <Campo etiqueta="Ambiente">
            <Selector value={amb} onChange={(e) => setAmb(e.target.value as Ambiente)}>
              <option value="HOMOLOGACION">{ambienteTexto('HOMOLOGACION')}</option>
              <option value="PRODUCCION">{ambienteTexto('PRODUCCION')}</option>
            </Selector>
          </Campo>
          <Campo etiqueta="Descripción" ayuda="Opcional.">
            <Entrada value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={100} />
          </Campo>
        </div>
        <AlertaError error={crear.error} />
        <div className="flex justify-end">
          <Boton type="submit" cargando={crear.isPending}>
            Agregar
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}
