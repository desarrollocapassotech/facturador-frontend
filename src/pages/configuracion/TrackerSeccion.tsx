import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { AlertaError, Aviso, Boton, Campo, Cargando, Entrada, Tarjeta } from '@/components/ui';
import { fechaHora } from '@/lib/formato';
import type { ConexionTracker } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';

/** 32 bytes aleatorios en base64url y su SHA-256 en hex (lo que el tracker guarda). */
async function generarClave(): Promise<{ clave: string; hash: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const clave = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(clave));
  const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return { clave, hash };
}

export function TrackerSeccion() {
  const { pedir } = useApi();
  const { data, error } = useQuery({ queryKey: ['conexion-tracker'], queryFn: () => pedir<ConexionTracker>('/configuracion/tracker') });
  if (error) return <AlertaError error={error} />;
  if (!data) return <Cargando />;
  return <FormularioTracker key={data.configurada ? data.baseUrl : 'nueva'} conexion={data} />;
}

function FormularioTracker({ conexion }: { conexion: ConexionTracker }) {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const [baseUrl, setBaseUrl] = useState(conexion.configurada ? conexion.baseUrl : '');
  const [apiKey, setApiKey] = useState('');
  const [hashGenerado, setHashGenerado] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);

  const actualizar = (c: ConexionTracker) => queryClient.setQueryData(['conexion-tracker'], c);

  const guardar = useMutation({
    mutationFn: () => pedir<ConexionTracker>('/configuracion/tracker', 'PUT', { baseUrl: baseUrl.trim(), ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}) }),
    onSuccess: (c) => {
      setApiKey('');
      setHashGenerado(null);
      setResultado(null);
      actualizar(c);
    },
  });
  const probar = useMutation({
    mutationFn: () => pedir<{ ok: boolean; registrosHoy?: number; error?: string }>('/configuracion/tracker/probar', 'POST'),
    onSuccess: (r) => {
      setResultado(r.ok ? { ok: true, texto: `Conexión correcta (${r.registrosHoy} registro(s) de horas hoy).` } : { ok: false, texto: r.error ?? 'Falló.' });
      void queryClient.invalidateQueries({ queryKey: ['conexion-tracker'] });
    },
  });
  const eliminar = useMutation({
    mutationFn: () => pedir<ConexionTracker>('/configuracion/tracker', 'DELETE'),
    onSuccess: actualizar,
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    guardar.mutate();
  }

  return (
    <div className="space-y-4">
      <Tarjeta titulo="Conexión con el time tracker">
        <form onSubmit={enviar} className="space-y-4">
          <p className="text-sm text-slate-600">
            El Facturador lee las horas del mes con <code className="font-mono">GET /integrations/billable-hours</code>. La clave se guarda
            cifrada y no se vuelve a mostrar.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="URL del backend del tracker" ayuda="Ej.: https://tracker-api.tuempresa.com">
              <Entrada type="url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} required maxLength={300} />
            </Campo>
            <Campo
              etiqueta="Clave de integración"
              ayuda={conexion.configurada ? `Guardada: ${conexion.apiKeyPista}. Dejala vacía para conservarla.` : 'La misma cuyo hash tiene el tracker.'}
            >
              <div className="flex gap-2">
                <Entrada
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  autoComplete="off"
                  required={!conexion.configurada}
                  maxLength={300}
                />
                <Boton
                  variante="secundario"
                  className="shrink-0"
                  onClick={async () => {
                    const g = await generarClave();
                    setApiKey(g.clave);
                    setHashGenerado(g.hash);
                  }}
                >
                  Generar
                </Boton>
              </div>
            </Campo>
          </div>
          {hashGenerado && (
            <Aviso tono="azul">
              <p>
                En el tracker, configurá la variable <code className="font-mono">FACTURADOR_INTEGRATION_KEY_HASH</code> con este valor y
                reinicialo. Después guardá acá.
              </p>
              <code className="mt-2 block break-all rounded bg-white p-2 font-mono text-xs">{hashGenerado}</code>
            </Aviso>
          )}
          <AlertaError error={guardar.error} />
          <div className="flex flex-wrap justify-end gap-2">
            {conexion.configurada && (
              <Boton
                variante="fantasma"
                cargando={eliminar.isPending}
                onClick={() => {
                  if (window.confirm('¿Quitar la conexión con el tracker?')) eliminar.mutate();
                }}
              >
                Quitar conexión
              </Boton>
            )}
            <Boton type="submit" cargando={guardar.isPending}>
              Guardar
            </Boton>
          </div>
        </form>
      </Tarjeta>
      {conexion.configurada && (
        <Tarjeta
          titulo="Prueba de conexión"
          acciones={
            <Boton variante="secundario" cargando={probar.isPending} onClick={() => probar.mutate()}>
              Probar ahora
            </Boton>
          }
        >
          <p className="text-sm text-slate-600">
            Última prueba: {fechaHora(conexion.ultimaPruebaEn)}
            {conexion.ultimoError && <span className="text-red-700"> — {conexion.ultimoError}</span>}
          </p>
          {resultado && (
            <div className="mt-3">
              <Aviso tono={resultado.ok ? 'verde' : 'ambar'}>{resultado.texto}</Aviso>
            </div>
          )}
          <AlertaError error={probar.error} />
        </Tarjeta>
      )}
    </div>
  );
}
