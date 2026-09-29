import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { AlertaError, Aviso, Boton, Campo, Cargando, Selector, Tarjeta, Vacio, claseInput } from '@/components/ui';
import { ambienteTexto, fecha } from '@/lib/formato';
import type { Ambiente, Certificado, Emisor } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';
import { AsistenteCertificado } from './AsistenteCertificado';

const DIAS_AVISO = 30;

function diasHasta(iso: string): number {
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export function CertificadosSeccion() {
  const { pedir } = useApi();
  const certificados = useQuery({ queryKey: ['certificados'], queryFn: () => pedir<Certificado[]>('/configuracion/certificados') });
  const emisor = useQuery({ queryKey: ['emisor'], queryFn: () => pedir<Emisor>('/configuracion/emisor') });
  const [claveGenerada, setClaveGenerada] = useState<string | null>(null);

  if (certificados.error) return <AlertaError error={certificados.error} />;
  if (!certificados.data || !emisor.data) return <Cargando />;
  const tieneProduccion = certificados.data.some((c) => c.ambiente === 'PRODUCCION');

  return (
    <div className="space-y-4">
      {!tieneProduccion || claveGenerada ? (
        <AsistenteCertificado emisor={emisor.data} onClaveGenerada={setClaveGenerada} />
      ) : (
        <details className="rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm">
          <summary className="cursor-pointer font-medium">Renovar el certificado de producción (paso a paso)</summary>
          <div className="mt-3">
            <AsistenteCertificado emisor={emisor.data} onClaveGenerada={setClaveGenerada} />
          </div>
        </details>
      )}
      <Tarjeta titulo="Certificados cargados">
        {certificados.data.length === 0 ? (
          <Vacio>
            No hay certificados.
            {emisor.data.ambienteArca === 'HOMOLOGACION' && ' En pruebas no hace falta: se usa el CUIT de prueba de AfipSDK.'}
          </Vacio>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {certificados.data.map((c) => {
              const dias = diasHasta(c.venceEl);
              return (
                <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <div>
                    <p className="font-medium">{ambienteTexto(c.ambiente)}</p>
                    <p className="break-all font-mono text-xs text-slate-500">SHA-256 {c.huellaSha256}</p>
                  </div>
                  <p className={dias < 0 ? 'text-red-700' : dias <= DIAS_AVISO ? 'text-amber-700' : 'text-slate-600'}>
                    {dias < 0 ? `Venció el ${fecha(c.venceEl)}` : `Vence el ${fecha(c.venceEl)}`}
                    <span className="ml-2 text-xs text-slate-400">cargado el {fecha(c.createdAt)}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Tarjeta>
      <CargarCertificado
        key={claveGenerada ? 'con-clave' : 'manual'}
        ambiente={claveGenerada ? 'PRODUCCION' : emisor.data.ambienteArca}
        claveInicial={claveGenerada ?? ''}
      />
    </div>
  );
}

function CargarCertificado({ ambiente, claveInicial }: { ambiente: Ambiente; claveInicial: string }) {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const [amb, setAmb] = useState<Ambiente>(ambiente);
  const [cert, setCert] = useState('');
  const [clave, setClave] = useState(claveInicial);
  const [listo, setListo] = useState(false);

  const cargar = useMutation({
    mutationFn: () =>
      pedir<Certificado>('/configuracion/certificados', 'POST', { ambiente: amb, certificadoPem: cert.trim(), clavePrivadaPem: clave.trim() }),
    onSuccess: () => {
      // La clave no queda en memoria del navegador más de lo necesario.
      setCert('');
      setClave('');
      setListo(true);
      void queryClient.invalidateQueries({ queryKey: ['certificados'] });
      void queryClient.invalidateQueries({ queryKey: ['arca'] });
    },
  });

  function leerArchivo(setter: (v: string) => void) {
    return async (e: ChangeEvent<HTMLInputElement>) => {
      const archivo = e.target.files?.[0];
      e.target.value = '';
      if (archivo) setter(await archivo.text());
      setListo(false);
    };
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    cargar.mutate();
  }

  return (
    <Tarjeta titulo="Cargar certificado">
      <form onSubmit={enviar} className="space-y-4">
        <p className="text-sm text-slate-600">
          El certificado (.crt) y la clave privada (.key) se validan (que sean pareja, que no estén vencidos y que el CUIT
          coincida) y se guardan cifrados. Cargar uno nuevo reemplaza al anterior del mismo ambiente.
        </p>
        <Campo etiqueta="Ambiente" className="max-w-xs">
          <Selector value={amb} onChange={(e) => setAmb(e.target.value as Ambiente)}>
            <option value="HOMOLOGACION">{ambienteTexto('HOMOLOGACION')}</option>
            <option value="PRODUCCION">{ambienteTexto('PRODUCCION')}</option>
          </Selector>
        </Campo>
        <div className="grid gap-4 md:grid-cols-2">
          <Campo etiqueta="Certificado (PEM)">
            <textarea
              className={`${claseInput} h-40 font-mono text-xs`}
              value={cert}
              onChange={(e) => setCert(e.target.value)}
              placeholder="-----BEGIN CERTIFICATE-----"
              spellCheck={false}
              required
            />
            <input type="file" accept=".crt,.pem,.cer" onChange={leerArchivo(setCert)} className="text-xs" />
          </Campo>
          <Campo etiqueta="Clave privada (PEM)">
            <textarea
              className={`${claseInput} h-40 font-mono text-xs`}
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              placeholder="-----BEGIN PRIVATE KEY-----"
              spellCheck={false}
              autoComplete="off"
              required
            />
            <input type="file" accept=".key,.pem" onChange={leerArchivo(setClave)} className="text-xs" />
          </Campo>
        </div>
        <AlertaError error={cargar.error} />
        {listo && <Aviso tono="verde">Certificado cargado.</Aviso>}
        <div className="flex justify-end">
          <Boton type="submit" cargando={cargar.isPending}>
            Cargar certificado
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}
