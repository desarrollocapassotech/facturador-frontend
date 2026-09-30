import { useState } from 'react';
import { CertificadosSeccion } from './CertificadosSeccion';
import { EmisorSeccion } from './EmisorSeccion';
import { EstadoArcaTarjeta } from './EstadoArcaTarjeta';
import { IntegracionesSeccion } from './IntegracionesSeccion';
import { PlantillaSeccion } from './PlantillaSeccion';
import { PlantillasMapeoSeccion } from './PlantillasMapeoSeccion';
import { ProduccionSeccion } from './ProduccionSeccion';
import { PuntosVentaSeccion } from './PuntosVentaSeccion';
import { TarifasSeccion } from './TarifasSeccion';
import { WebhooksSeccion } from './WebhooksSeccion';

const PESTANAS = [
  { id: 'emisor', texto: 'Datos del emisor' },
  { id: 'puntos', texto: 'Puntos de venta' },
  { id: 'certificados', texto: 'Certificados ARCA' },
  { id: 'plantilla', texto: 'Plantilla PDF' },
  { id: 'produccion', texto: 'Producción' },
  { id: 'tarifas', texto: 'Tarifas' },
  { id: 'mapeo', texto: 'Plantillas Excel' },
  { id: 'integraciones', texto: 'Integraciones' },
  { id: 'webhooks', texto: 'Webhooks' },
] as const;

type Pestana = (typeof PESTANAS)[number]['id'];

function pestanaInicial(): Pestana {
  const p = new URLSearchParams(window.location.search).get('tab');
  return PESTANAS.some((x) => x.id === p) ? (p as Pestana) : 'emisor';
}

export function ConfiguracionPage() {
  const [pestana, setPestana] = useState<Pestana>(pestanaInicial);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Configuración</h1>
      <EstadoArcaTarjeta />
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-slate-200">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            role="tab"
            type="button"
            aria-selected={pestana === p.id}
            onClick={() => setPestana(p.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              pestana === p.id ? 'border-slate-900 font-medium text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {p.texto}
          </button>
        ))}
      </div>
      {pestana === 'emisor' && <EmisorSeccion />}
      {pestana === 'puntos' && <PuntosVentaSeccion />}
      {pestana === 'certificados' && <CertificadosSeccion />}
      {pestana === 'plantilla' && <PlantillaSeccion />}
      {pestana === 'produccion' && <ProduccionSeccion />}
      {pestana === 'tarifas' && <TarifasSeccion />}
      {pestana === 'mapeo' && <PlantillasMapeoSeccion />}
      {pestana === 'integraciones' && <IntegracionesSeccion />}
      {pestana === 'webhooks' && <WebhooksSeccion />}
    </div>
  );
}
