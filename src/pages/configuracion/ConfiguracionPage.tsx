import { useState } from 'react';
import { CertificadosSeccion } from './CertificadosSeccion';
import { EmisorSeccion } from './EmisorSeccion';
import { EstadoArcaTarjeta } from './EstadoArcaTarjeta';
import { PlantillaSeccion } from './PlantillaSeccion';
import { PuntosVentaSeccion } from './PuntosVentaSeccion';

const PESTANAS = [
  { id: 'emisor', texto: 'Datos del emisor' },
  { id: 'puntos', texto: 'Puntos de venta' },
  { id: 'certificados', texto: 'Certificados ARCA' },
  { id: 'plantilla', texto: 'Plantilla PDF' },
] as const;

type Pestana = (typeof PESTANAS)[number]['id'];

export function ConfiguracionPage() {
  const [pestana, setPestana] = useState<Pestana>('emisor');

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
    </div>
  );
}
