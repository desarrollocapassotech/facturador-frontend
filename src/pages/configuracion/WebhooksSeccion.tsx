import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { AlertaError, Aviso, Boton, Campo, Cargando, Entrada, Etiqueta, Modal, Tarjeta, Vacio } from '@/components/ui';
import { API_URL } from '@/lib/api';
import { fechaHora } from '@/lib/formato';
import { useApi } from '@/lib/useApi';

const EVENTOS: Record<string, string> = {
  'comprobante.emitido': 'Comprobante emitido (con CAE)',
  'comprobante.rechazado': 'Comprobante rechazado por ARCA',
  'importacion.confirmada': 'Importación confirmada',
};

interface Suscripcion {
  id: string;
  url: string;
  eventos: string[];
  activa: boolean;
  createdAt: string;
}

interface Entrega {
  id: string;
  eventoId: string;
  evento: string;
  estado: 'PENDIENTE' | 'ENTREGADA' | 'FALLIDA';
  intentos: number;
  proximoIntento: string;
  ultimoStatus: number | null;
  ultimoError: string | null;
  createdAt: string;
  entregadaEn: string | null;
}

const ESTADO_ENTREGA = {
  PENDIENTE: 'bg-amber-100 text-amber-800',
  ENTREGADA: 'bg-emerald-100 text-emerald-800',
  FALLIDA: 'bg-red-100 text-red-800',
};

/** La documentación se sirve desde el backend (misma base que la API, sin /api). */
export const URL_DOCS = `${API_URL.replace(/\/+$/, '')}/docs`;

export function WebhooksSeccion() {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const [secreto, setSecreto] = useState<string | null>(null);
  const [viendo, setViendo] = useState<Suscripcion | null>(null);
  const { data, error } = useQuery({ queryKey: ['webhooks'], queryFn: () => pedir<Suscripcion[]>('/configuracion/webhooks') });
  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['webhooks'] });

  const alternar = useMutation({
    mutationFn: (s: Suscripcion) => pedir(`/configuracion/webhooks/${s.id}`, 'PATCH', { activa: !s.activa }),
    onSuccess: refrescar,
  });
  const eliminar = useMutation({ mutationFn: (s: Suscripcion) => pedir(`/configuracion/webhooks/${s.id}`, 'DELETE'), onSuccess: refrescar });
  const rotar = useMutation({
    mutationFn: (s: Suscripcion) => pedir<{ secreto: string }>(`/configuracion/webhooks/${s.id}/rotar-secreto`, 'POST'),
    onSuccess: (r) => setSecreto(r.secreto),
  });
  const probar = useMutation({ mutationFn: (s: Suscripcion) => pedir<{ ok: boolean; status: number | null; error: string | null }>(`/configuracion/webhooks/${s.id}/probar`, 'POST') });

  if (error) return <AlertaError error={error} />;
  if (!data) return <Cargando />;

  return (
    <div className="space-y-4">
      <Tarjeta titulo="Webhooks">
        <p className="mb-3 text-sm text-slate-600">
          Avisan a otro sistema cuando pasa algo (por ejemplo, cuando se emite un comprobante). Cada envío va firmado con HMAC; cómo
          verificarlo está en la{' '}
          <a href={URL_DOCS} target="_blank" rel="noreferrer" className="underline">
            documentación de la API
          </a>
          .
        </p>
        {data.length === 0 ? (
          <Vacio>Todavía no hay webhooks.</Vacio>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {data.map((s) => (
              <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 space-y-1">
                  <p className="break-all font-mono text-xs">{s.url}</p>
                  <p className="text-xs text-slate-500">{s.eventos.map((e) => EVENTOS[e] ?? e).join(' · ')}</p>
                  {!s.activa && <Etiqueta className="bg-slate-100 text-slate-500">Pausado</Etiqueta>}
                  {probar.data && probar.variables?.id === s.id && (
                    <p className={`text-xs ${probar.data.ok ? 'text-emerald-700' : 'text-red-700'}`}>
                      Prueba: {probar.data.ok ? `respondió ${probar.data.status}` : probar.data.error}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  <Boton variante="secundario" cargando={probar.isPending && probar.variables?.id === s.id} onClick={() => probar.mutate(s)}>
                    Probar
                  </Boton>
                  <Boton variante="fantasma" onClick={() => setViendo(s)}>
                    Envíos
                  </Boton>
                  <Boton variante="fantasma" onClick={() => alternar.mutate(s)}>
                    {s.activa ? 'Pausar' : 'Reanudar'}
                  </Boton>
                  <Boton
                    variante="fantasma"
                    onClick={() => {
                      if (window.confirm('¿Generar un secreto nuevo? El anterior deja de valer en el acto.')) rotar.mutate(s);
                    }}
                  >
                    Nuevo secreto
                  </Boton>
                  <Boton
                    variante="fantasma"
                    onClick={() => {
                      if (window.confirm('¿Eliminar este webhook y su historial de envíos?')) eliminar.mutate(s);
                    }}
                  >
                    Eliminar
                  </Boton>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3">
          <AlertaError error={alternar.error ?? eliminar.error ?? rotar.error ?? probar.error} />
        </div>
      </Tarjeta>
      <NuevoWebhook onCreado={setSecreto} />
      <Modal abierto={secreto !== null} titulo="Secreto de firma" onCerrar={() => setSecreto(null)}>
        {secreto && <SecretoUnaVez secreto={secreto} onListo={() => setSecreto(null)} />}
      </Modal>
      {viendo && <EntregasModal suscripcion={viendo} onCerrar={() => setViendo(null)} />}
    </div>
  );
}

function SecretoUnaVez({ secreto, onListo }: { secreto: string; onListo: () => void }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="space-y-4 text-sm">
      <Aviso>Copialo ahora: no se vuelve a mostrar. El receptor lo usa para verificar la firma de cada envío.</Aviso>
      <div className="flex gap-2">
        <Entrada readOnly value={secreto} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
        <Boton
          variante="secundario"
          onClick={async () => {
            await navigator.clipboard.writeText(secreto);
            setCopiado(true);
          }}
        >
          {copiado ? 'Copiado' : 'Copiar'}
        </Boton>
      </div>
      <div className="flex justify-end">
        <Boton onClick={onListo}>Listo</Boton>
      </div>
    </div>
  );
}

function NuevoWebhook({ onCreado }: { onCreado: (secreto: string) => void }) {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [eventos, setEventos] = useState<string[]>(['comprobante.emitido', 'comprobante.rechazado']);

  const crear = useMutation({
    mutationFn: () => pedir<{ secreto: string }>('/configuracion/webhooks', 'POST', { url: url.trim(), eventos }),
    onSuccess: (r) => {
      setUrl('');
      void queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      onCreado(r.secreto);
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    crear.mutate();
  }

  return (
    <Tarjeta titulo="Nuevo webhook">
      <form onSubmit={enviar} className="space-y-4">
        <Campo etiqueta="URL que recibe los avisos" ayuda="Tiene que ser https y responder 2xx en menos de 10 segundos.">
          <Entrada type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://tu-sistema.com/webhooks/facturador" required />
        </Campo>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-700">Eventos</legend>
          {Object.entries(EVENTOS).map(([id, texto]) => (
            <label key={id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={eventos.includes(id)}
                onChange={() => setEventos((es) => (es.includes(id) ? es.filter((x) => x !== id) : [...es, id]))}
              />
              {texto} <code className="text-xs text-slate-500">{id}</code>
            </label>
          ))}
        </fieldset>
        <AlertaError error={crear.error} />
        <div className="flex justify-end">
          <Boton type="submit" cargando={crear.isPending} disabled={!eventos.length}>
            Crear webhook
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

function EntregasModal({ suscripcion, onCerrar }: { suscripcion: Suscripcion; onCerrar: () => void }) {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const clave = ['webhook-entregas', suscripcion.id];
  const { data, error } = useQuery({ queryKey: clave, queryFn: () => pedir<Entrega[]>(`/configuracion/webhooks/${suscripcion.id}/entregas`) });
  const reenviar = useMutation({
    mutationFn: (e: Entrega) => pedir(`/configuracion/webhooks/entregas/${e.id}/reenviar`, 'POST'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clave }),
  });

  return (
    <Modal abierto titulo="Últimos envíos" onCerrar={onCerrar}>
      {error ? (
        <AlertaError error={error} />
      ) : !data ? (
        <Cargando />
      ) : data.length === 0 ? (
        <Vacio>Todavía no hubo envíos.</Vacio>
      ) : (
        <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto text-sm">
          {data.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-2 py-2">
              <div>
                <p>
                  <Etiqueta className={ESTADO_ENTREGA[e.estado]}>{e.estado.toLowerCase()}</Etiqueta> <span className="font-mono text-xs">{e.evento}</span>
                </p>
                <p className="text-xs text-slate-500">
                  {fechaHora(e.createdAt)} · {e.intentos} intento(s){e.ultimoStatus ? ` · HTTP ${e.ultimoStatus}` : ''}
                  {e.estado === 'PENDIENTE' && e.intentos > 0 && ` · próximo ${fechaHora(e.proximoIntento)}`}
                </p>
                {e.ultimoError && <p className="text-xs text-red-700">{e.ultimoError}</p>}
              </div>
              {e.estado !== 'ENTREGADA' && (
                <Boton variante="fantasma" cargando={reenviar.isPending && reenviar.variables?.id === e.id} onClick={() => reenviar.mutate(e)}>
                  Reenviar
                </Boton>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2">
        <AlertaError error={reenviar.error} />
      </div>
    </Modal>
  );
}
