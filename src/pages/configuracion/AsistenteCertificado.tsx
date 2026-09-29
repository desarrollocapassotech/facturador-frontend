import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertaError, Aviso, Boton, Campo, Entrada, Tarjeta } from '@/components/ui';
import { descargarTexto, generarPedidoCertificado } from '@/lib/csr';
import { cuit as formatearCuit } from '@/lib/formato';
import { leer, guardar } from '@/lib/storage';
import type { Emisor } from '@/lib/tipos';

const CLAVE_PASOS = 'facturador.asistenteCertificado.pasos';

function pasosHechos(): string[] {
  try {
    return JSON.parse(leer(CLAVE_PASOS) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function Paso({
  n,
  titulo,
  hecho,
  onHecho,
  children,
}: {
  n: number;
  titulo: string;
  hecho: boolean;
  onHecho: (v: boolean) => void;
  children: ReactNode;
}) {
  const [abierto, setAbierto] = useState(!hecho);
  return (
    <li className={`rounded-md border ${hecho ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200'} p-3`}>
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setAbierto((v) => !v)} className="flex items-center gap-2 text-left text-sm font-medium">
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${hecho ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'}`}>
            {hecho ? '✓' : n}
          </span>
          {titulo}
        </button>
        <label className="flex items-center gap-1 text-xs text-slate-600">
          <input type="checkbox" checked={hecho} onChange={(e) => onHecho(e.target.checked)} />
          Listo
        </label>
      </div>
      {abierto && <div className="mt-3 space-y-2 pl-8 text-sm text-slate-700">{children}</div>}
    </li>
  );
}

/**
 * Paso a paso para obtener el certificado de producción de ARCA (Web Services de factura
 * electrónica). La clave y el pedido (CSR) se generan en el navegador.
 */
export function AsistenteCertificado({ emisor, onClaveGenerada }: { emisor: Emisor; onClaveGenerada: (clavePem: string) => void }) {
  const [hechos, setHechos] = useState<string[]>(pasosHechos);
  const [alias, setAlias] = useState('facturador');
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [generado, setGenerado] = useState(false);
  const monotributo = emisor.condicionIva.startsWith('MONOTRIBUTO');

  const marcar = (id: string) => (v: boolean) => {
    const nuevos = v ? [...new Set([...hechos, id])] : hechos.filter((x) => x !== id);
    setHechos(nuevos);
    guardar(CLAVE_PASOS, JSON.stringify(nuevos));
  };

  async function generar() {
    setError(null);
    setGenerando(true);
    try {
      const r = await generarPedidoCertificado({ razonSocial: emisor.razonSocial, cuit: emisor.cuit, alias });
      descargarTexto(`${alias}.key`, r.clavePrivadaPem);
      descargarTexto(`${alias}.csr`, r.csrPem);
      onClaveGenerada(r.clavePrivadaPem);
      setGenerado(true);
      marcar('generar')(true);
    } catch (err) {
      setError(err);
    } finally {
      setGenerando(false);
    }
  }

  return (
    <Tarjeta titulo="Cómo obtener el certificado de producción (paso a paso)">
      <p className="mb-3 text-sm text-slate-600">
        El certificado permite que el Facturador emita en tu nombre por Web Services. Se tramita una sola vez con tu clave fiscal (nivel 3) y
        dura 2 años. Tarda unos 15 minutos.
      </p>
      <ol className="space-y-2">
        <Paso n={1} titulo="Generar la clave privada y el pedido de certificado" hecho={hechos.includes('generar')} onHecho={marcar('generar')}>
          <p>
            Se generan acá, en tu navegador: la clave privada no se manda a ningún lado hasta que la cargues en el paso 5 (donde se guarda
            cifrada).
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo etiqueta="Nombre del certificado (alias)" ayuda="Sin espacios. Es el nombre que vas a ver en ARCA.">
              <Entrada value={alias} onChange={(e) => setAlias(e.target.value.replace(/[^A-Za-z0-9_-]/g, ''))} maxLength={30} />
            </Campo>
            <Campo etiqueta="Titular">
              <Entrada value={emisor.razonSocial} disabled />
            </Campo>
            <Campo etiqueta="CUIT">
              <Entrada value={formatearCuit(emisor.cuit)} disabled />
            </Campo>
          </div>
          <Boton onClick={() => void generar()} cargando={generando} disabled={!alias}>
            Generar y descargar {alias || 'facturador'}.key y {alias || 'facturador'}.csr
          </Boton>
          <AlertaError error={error} />
          {generado && (
            <Aviso>
              Guardá <strong>{alias}.key</strong> en un lugar seguro y no se lo mandes a nadie: con esa clave se firman tus facturas. Si la
              perdés antes del paso 5, hay que empezar de nuevo.
            </Aviso>
          )}
        </Paso>

        <Paso n={2} titulo="Subir el pedido a ARCA y descargar el certificado" hecho={hechos.includes('arca-cert')} onHecho={marcar('arca-cert')}>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Entrá a{' '}
              <a href="https://auth.afip.gob.ar/contribuyente_/login.xhtml" target="_blank" rel="noreferrer" className="underline">
                ARCA con tu clave fiscal
              </a>{' '}
              (CUIT {formatearCuit(emisor.cuit)}).
            </li>
            <li>
              Buscá el servicio <strong>Administración de Certificados Digitales</strong>. Si no aparece: entrá a <strong>Administrador de
              Relaciones de Clave Fiscal</strong> → <strong>Adherir servicio</strong> → ARCA → Servicios interactivos → Administración de
              Certificados Digitales, confirmá y volvé a entrar.
            </li>
            <li>
              <strong>Agregar alias</strong>: escribí <code className="rounded bg-slate-100 px-1">{alias || 'facturador'}</code>, elegí el archivo{' '}
              <strong>{alias || 'facturador'}.csr</strong> y tocá <strong>Agregar alias</strong>.
            </li>
            <li>
              En la lista, tocá <strong>Ver</strong> en ese alias y descargá el certificado (<strong>.crt</strong>).
            </li>
          </ol>
        </Paso>

        <Paso n={3} titulo="Autorizar el certificado para facturar" hecho={hechos.includes('arca-relacion')} onHecho={marcar('arca-relacion')}>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              En ARCA, entrá a <strong>Administrador de Relaciones de Clave Fiscal</strong> → <strong>Nueva relación</strong>.
            </li>
            <li>
              <strong>Buscar</strong> → ARCA → <strong>WebServices</strong> → <strong>Facturación Electrónica</strong>.
            </li>
            <li>
              En <strong>Representante</strong> tocá <strong>Buscar</strong>, elegí el alias <strong>{alias || 'facturador'}</strong> (computador
              fiscal) y <strong>Confirmar</strong>.
            </li>
          </ol>
          <p className="text-xs text-slate-500">Sin este paso, ARCA rechaza la conexión aunque el certificado sea válido.</p>
        </Paso>

        <Paso n={4} titulo="Dar de alta un punto de venta para Web Services" hecho={hechos.includes('arca-pv')} onHecho={marcar('arca-pv')}>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              En ARCA, entrá a <strong>Administración de Puntos de Venta y Domicilios</strong> → <strong>A/B/M de Puntos de venta</strong> →{' '}
              <strong>Agregar</strong>.
            </li>
            <li>
              Elegí un número que no uses (por ejemplo, el siguiente al último) y como sistema:{' '}
              <strong>{monotributo ? 'Factura Electrónica - Monotributo - Web Services' : 'RECE para aplicativo y web services'}</strong>. No sirve
              uno de “Factura en línea / Comprobantes en línea”.
            </li>
            <li>Asociale el domicilio fiscal y confirmá.</li>
            <li>
              Cargá ese número en{' '}
              <Link to="/configuracion?tab=puntos" className="underline">
                Configuración → Puntos de venta
              </Link>{' '}
              con ambiente <strong>Producción</strong>.
            </li>
          </ol>
        </Paso>

        <Paso n={5} titulo="Cargar el certificado en el Facturador" hecho={hechos.includes('cargar')} onHecho={marcar('cargar')}>
          <p>
            Más abajo, en <strong>Cargar certificado</strong>: ambiente <strong>Producción</strong>, subí el <strong>.crt</strong> que bajaste
            de ARCA y el <strong>{alias || 'facturador'}.key</strong> del paso 1
            {generado ? ' (si lo generaste recién, ya está completado)' : ''}. El Facturador verifica que sean pareja, que no estén vencidos y
            que el CUIT coincida, y los guarda cifrados.
          </p>
        </Paso>

        <Paso n={6} titulo="Probar la conexión y pasar a producción" hecho={hechos.includes('produccion')} onHecho={marcar('produccion')}>
          <p>
            En{' '}
            <Link to="/configuracion?tab=produccion" className="underline">
              Configuración → Producción
            </Link>{' '}
            tocá <strong>Probar conexión con ARCA producción</strong> (solo consulta, no emite nada). Si da bien, <strong>Pasar a producción</strong>
            . Para la primera factura real, conviene un cliente conocido y un importe chico.
          </p>
        </Paso>
      </ol>
      <p className="mt-3 text-xs text-slate-500">
        Para pruebas en homologación no hace falta certificado. Si querés uno de homologación con tu CUIT, el trámite es el mismo pero en el
        servicio <strong>WSASS - Autogestión Certificados Homologación</strong>.
      </p>
    </Tarjeta>
  );
}
