import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertaError, Boton, Cargando, Etiqueta, Selector, Tarjeta, Vacio } from '@/components/ui';
import { dinero, ESTADOS, fecha, numeroComprobante, tipoLargo } from '@/lib/formato';
import type { ComprobanteResumen, EstadoComprobante, Paginado } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';

const POR_PAGINA = 25;

export function ComprobantesPage() {
  const { pedir } = useApi();
  const navigate = useNavigate();
  const [estado, setEstado] = useState<EstadoComprobante | ''>('');
  const [pagina, setPagina] = useState(1);

  const { data, error, isFetching } = useQuery({
    queryKey: ['comprobantes', { estado, pagina }],
    queryFn: () => {
      const params = new URLSearchParams({ pagina: String(pagina), porPagina: String(POR_PAGINA) });
      if (estado) params.set('estado', estado);
      return pedir<Paginado<ComprobanteResumen>>(`/comprobantes?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
  });

  const paginas = data ? Math.max(1, Math.ceil(data.total / data.porPagina)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Comprobantes</h1>
        <Boton onClick={() => navigate('/comprobantes/nuevo')}>Nueva factura</Boton>
      </div>
      <Tarjeta>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Selector
            value={estado}
            onChange={(e) => {
              setEstado(e.target.value as EstadoComprobante | '');
              setPagina(1);
            }}
            className="max-w-xs"
            aria-label="Filtrar por estado"
          >
            <option value="">Todos los estados</option>
            {Object.entries(ESTADOS).map(([v, { texto }]) => (
              <option key={v} value={v}>
                {texto}
              </option>
            ))}
          </Selector>
          {isFetching && <span className="text-xs text-slate-400">Actualizando…</span>}
        </div>
        {error ? (
          <AlertaError error={error} />
        ) : !data ? (
          <Cargando />
        ) : data.items.length === 0 ? (
          <Vacio>{estado ? 'No hay comprobantes en ese estado.' : 'Todavía no hay comprobantes. Empezá con “Nueva factura”.'}</Vacio>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Comprobante</th>
                    <th className="py-2 pr-4 font-medium">Fecha</th>
                    <th className="py-2 pr-4 font-medium">Cliente</th>
                    <th className="py-2 pr-4 text-right font-medium">Total</th>
                    <th className="py-2 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="py-2 pr-4">
                        <Link to={`/comprobantes/${c.id}`} className="font-medium hover:underline">
                          {tipoLargo(c.tipo)}
                        </Link>
                        <span className="block font-mono text-xs text-slate-500">{numeroComprobante(c.puntoVenta.numero, c.numero)}</span>
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap">{fecha(c.fechaEmision)}</td>
                      <td className="py-2 pr-4">{c.cliente.razonSocial}</td>
                      <td className="py-2 pr-4 text-right whitespace-nowrap tabular-nums">{dinero(c.importeTotal, c.moneda)}</td>
                      <td className="py-2">
                        <Etiqueta className={ESTADOS[c.estado].clase}>{ESTADOS[c.estado].texto}</Etiqueta>
                        {c.ambiente === 'HOMOLOGACION' && <span className="ml-1 text-xs text-amber-700">prueba</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {paginas > 1 && (
              <div className="mt-4 flex items-center justify-end gap-2 text-sm">
                <Boton variante="secundario" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
                  Anterior
                </Boton>
                <span className="text-slate-500">
                  Página {data.pagina} de {paginas}
                </span>
                <Boton variante="secundario" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>
                  Siguiente
                </Boton>
              </div>
            )}
          </>
        )}
      </Tarjeta>
    </div>
  );
}
