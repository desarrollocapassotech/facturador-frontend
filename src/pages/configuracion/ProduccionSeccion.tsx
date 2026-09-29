import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { AlertaError, Aviso, Boton, Campo, Cargando, Entrada, Tarjeta } from '@/components/ui';
import { cuit } from '@/lib/formato';
import type { Ambiente } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';

interface Chequeo {
  id: string;
  titulo: string;
  ok: boolean;
  obligatorio: boolean;
  mensaje: string;
}

interface EstadoProduccion {
  ambiente: Ambiente;
  cuit: string;
  listo: boolean;
  chequeos: Chequeo[];
  puntosVenta: number[];
}

interface ResultadoPrueba {
  ok: boolean;
  resultados: Array<{ puntoVenta: number; ok: boolean; ultimoAutorizado?: number; error?: string }>;
}

export function ProduccionSeccion() {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const { data, error } = useQuery({ queryKey: ['produccion'], queryFn: () => pedir<EstadoProduccion>('/configuracion/produccion') });
  const [prueba, setPrueba] = useState<ResultadoPrueba | null>(null);

  const probar = useMutation({
    mutationFn: () => pedir<ResultadoPrueba>('/configuracion/produccion/probar', 'POST'),
    onSuccess: setPrueba,
  });

  if (error) return <AlertaError error={error} />;
  if (!data) return <Cargando />;
  const enProduccion = data.ambiente === 'PRODUCCION';

  return (
    <div className="space-y-4">
      {enProduccion ? (
        <Aviso tono="verde">La empresa emite en <strong>producción</strong>: los comprobantes tienen validez fiscal.</Aviso>
      ) : (
        <Aviso tono="azul">
          La empresa está en <strong>homologación</strong> (pruebas). Cuando todo esté listo, pasala a producción para emitir comprobantes
          válidos.
        </Aviso>
      )}

      <Tarjeta
        titulo="Chequeo previo"
        acciones={
          <Boton variante="secundario" cargando={probar.isPending} onClick={() => probar.mutate()}>
            Probar conexión con ARCA producción
          </Boton>
        }
      >
        <ul className="space-y-2 text-sm">
          {data.chequeos.map((c) => (
            <li key={c.id} className="flex gap-2">
              <span aria-hidden className={`mt-0.5 font-bold ${c.ok ? 'text-emerald-600' : c.obligatorio ? 'text-red-600' : 'text-amber-600'}`}>
                {c.ok ? '✓' : c.obligatorio ? '✕' : '!'}
              </span>
              <span>
                <span className="font-medium">{c.titulo}</span>
                {!c.obligatorio && <span className="text-xs text-slate-500"> (aviso)</span>}
                <span className="block text-slate-600">{c.mensaje}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          La prueba solo consulta a ARCA el último número autorizado de cada punto de venta: no emite nada.
        </p>
        <div className="mt-3 space-y-2">
          <AlertaError error={probar.error} />
          {prueba && (
            <Aviso tono={prueba.ok ? 'verde' : 'ambar'}>
              <ul className="space-y-0.5">
                {prueba.resultados.map((r) => (
                  <li key={r.puntoVenta}>
                    Punto de venta {String(r.puntoVenta).padStart(5, '0')}:{' '}
                    {r.ok ? `conexión correcta (último comprobante autorizado: ${r.ultimoAutorizado})` : r.error}
                  </li>
                ))}
              </ul>
            </Aviso>
          )}
        </div>
      </Tarjeta>

      <CambiarAmbiente
        estado={data}
        onCambio={() => {
          void queryClient.invalidateQueries();
          // La barra superior y la sesión muestran el ambiente: se recarga para que todo quede coherente.
          window.location.reload();
        }}
      />
    </div>
  );
}

function CambiarAmbiente({ estado, onCambio }: { estado: EstadoProduccion; onCambio: () => void }) {
  const { pedir } = useApi();
  const [confirmacion, setConfirmacion] = useState('');
  const aProduccion = estado.ambiente === 'HOMOLOGACION';

  const cambiar = useMutation({
    mutationFn: () =>
      pedir<EstadoProduccion>(`/configuracion/produccion/${aProduccion ? 'activar' : 'volver-a-homologacion'}`, 'POST', { cuit: confirmacion }),
    onSuccess: onCambio,
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    cambiar.mutate();
  }

  const coincide = confirmacion.replace(/\D/g, '') === estado.cuit;

  return (
    <Tarjeta titulo={aProduccion ? 'Pasar a producción' : 'Volver a homologación'}>
      <form onSubmit={enviar} className="space-y-4">
        {aProduccion ? (
          <p className="text-sm text-slate-600">
            Desde ese momento, cada comprobante que emitas <strong>es real</strong>: se informa a ARCA con tu CUIT y tiene validez fiscal
            (para anularlo hay que hacer una nota de crédito). Antes de activar se vuelve a probar la conexión.
          </p>
        ) : (
          <p className="text-sm text-slate-600">
            Para hacer pruebas otra vez. Los comprobantes ya emitidos en producción siguen siendo válidos y no cambian.
          </p>
        )}
        <Campo etiqueta={`Para confirmar, escribí el CUIT de la empresa (${cuit(estado.cuit)})`} className="max-w-sm">
          <Entrada value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} inputMode="numeric" autoComplete="off" />
        </Campo>
        <AlertaError error={cambiar.error} />
        <div className="flex justify-end">
          <Boton type="submit" variante={aProduccion ? 'peligro' : 'secundario'} cargando={cambiar.isPending} disabled={!coincide || (aProduccion && !estado.listo)}>
            {aProduccion ? 'Pasar a producción' : 'Volver a homologación'}
          </Boton>
        </div>
        {aProduccion && !estado.listo && <p className="text-right text-xs text-slate-500">Completá los puntos marcados con ✕ para habilitarlo.</p>}
      </form>
    </Tarjeta>
  );
}
