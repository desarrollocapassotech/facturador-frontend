import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { AlertaError, Aviso, Boton, Campo, Cargando, Entrada, Etiqueta, Modal, Selector, Tarjeta, Vacio } from '@/components/ui';
import { fechaHora, ORIGENES, SCOPES } from '@/lib/formato';
import type { Integracion, OrigenItem, Scope } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';

export function IntegracionesSeccion() {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const [claveNueva, setClaveNueva] = useState<{ nombre: string; clave: string } | null>(null);
  const { data, error } = useQuery({ queryKey: ['integraciones'], queryFn: () => pedir<Integracion[]>('/integraciones') });

  const revocar = useMutation({
    mutationFn: (i: Integracion) => pedir<Integracion>(`/integraciones/${i.id}`, 'DELETE'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['integraciones'] }),
  });

  if (error) return <AlertaError error={error} />;
  if (!data) return <Cargando />;

  return (
    <div className="space-y-4">
      <Tarjeta titulo="Sistemas integrados">
        <p className="mb-3 text-sm text-slate-600">
          Cada sistema que se conecta con el Facturador (por ejemplo, el botón “Ir al facturador” del tracker) usa su propia API key.
        </p>
        {data.length === 0 ? (
          <Vacio>Todavía no hay integraciones.</Vacio>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {data.map((i) => (
              <li key={i.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="space-y-1">
                  <p className="font-medium">
                    {i.nombre}
                    {i.revocadaEn && <Etiqueta className="ml-2 bg-slate-100 text-slate-500">Revocada</Etiqueta>}
                  </p>
                  <p className="font-mono text-xs text-slate-500">{i.keyPrefijo}_…</p>
                  <p className="text-xs text-slate-500">
                    {ORIGENES[i.origen]} · {i.scopes.map((s) => SCOPES[s] ?? s).join(' · ')}
                  </p>
                  <p className="text-xs text-slate-400">
                    Creada {fechaHora(i.createdAt)} · último uso {fechaHora(i.ultimoUsoEn)}
                  </p>
                </div>
                {!i.revocadaEn && (
                  <Boton
                    variante="fantasma"
                    cargando={revocar.isPending && revocar.variables?.id === i.id}
                    onClick={() => {
                      if (window.confirm(`¿Revocar la API key de "${i.nombre}"? El sistema deja de poder conectarse.`)) revocar.mutate(i);
                    }}
                  >
                    Revocar
                  </Boton>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3">
          <AlertaError error={revocar.error} />
        </div>
      </Tarjeta>
      <NuevaIntegracion onCreada={(nombre, clave) => setClaveNueva({ nombre, clave })} />
      <Modal abierto={claveNueva !== null} titulo="API key creada" onCerrar={() => setClaveNueva(null)}>
        {claveNueva && <ClaveUnaVez nombre={claveNueva.nombre} clave={claveNueva.clave} onListo={() => setClaveNueva(null)} />}
      </Modal>
    </div>
  );
}

function ClaveUnaVez({ nombre, clave, onListo }: { nombre: string; clave: string; onListo: () => void }) {
  const [copiada, setCopiada] = useState(false);
  return (
    <div className="space-y-4 text-sm">
      <Aviso>
        Copiá la clave de <strong>{nombre}</strong> ahora: por seguridad no se vuelve a mostrar. Si la perdés, revocala y creá otra.
      </Aviso>
      <div className="flex gap-2">
        <Entrada readOnly value={clave} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
        <Boton
          variante="secundario"
          onClick={async () => {
            await navigator.clipboard.writeText(clave);
            setCopiada(true);
          }}
        >
          {copiada ? 'Copiada' : 'Copiar'}
        </Boton>
      </div>
      <p className="text-slate-600">
        En el tracker va en la variable <code className="font-mono">FACTURADOR_API_KEY</code>, junto con{' '}
        <code className="font-mono">FACTURADOR_API_URL</code> (la URL de la API del Facturador, terminada en <code>/api</code>).
      </p>
      <div className="flex justify-end">
        <Boton onClick={onListo}>Listo, ya la guardé</Boton>
      </div>
    </div>
  );
}

function NuevaIntegracion({ onCreada }: { onCreada: (nombre: string, clave: string) => void }) {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [origen, setOrigen] = useState<OrigenItem>('TRACKER');
  const [scopes, setScopes] = useState<Scope[]>(['acceso:emitir']);

  const crear = useMutation({
    mutationFn: () => pedir<{ integracion: Integracion; clave: string }>('/integraciones', 'POST', { nombre: nombre.trim(), origen, scopes }),
    onSuccess: (r) => {
      setNombre('');
      void queryClient.invalidateQueries({ queryKey: ['integraciones'] });
      onCreada(r.integracion.nombre, r.clave);
    },
  });

  function alternar(s: Scope) {
    setScopes((actual) => (actual.includes(s) ? actual.filter((x) => x !== s) : [...actual, s]));
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    crear.mutate();
  }

  return (
    <Tarjeta titulo="Nueva integración">
      <form onSubmit={enviar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre">
            <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Time tracker" required maxLength={100} />
          </Campo>
          <Campo etiqueta="Origen de sus datos">
            <Selector value={origen} onChange={(e) => setOrigen(e.target.value as OrigenItem)}>
              <option value="TRACKER">{ORIGENES.TRACKER}</option>
              <option value="API">{ORIGENES.API}</option>
            </Selector>
          </Campo>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-700">Permisos</legend>
          {(Object.keys(SCOPES) as Scope[]).map((s) => (
            <label key={s} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={scopes.includes(s)} onChange={() => alternar(s)} />
              {SCOPES[s]}
            </label>
          ))}
          <p className="text-xs text-slate-500">Para el botón “Ir al facturador” del tracker alcanza con el primero.</p>
        </fieldset>
        <AlertaError error={crear.error} />
        <div className="flex justify-end">
          <Boton type="submit" cargando={crear.isPending} disabled={!scopes.length}>
            Crear API key
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}
