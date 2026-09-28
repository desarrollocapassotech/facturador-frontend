import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { AlertaError, Boton, Cargando, Entrada, Etiqueta, Tarjeta, Vacio } from '@/components/ui';
import { CONDICIONES_IVA, cuit, TIPOS_DOCUMENTO } from '@/lib/formato';
import type { Cliente } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';
import { ClienteModal } from './ClienteModal';

export function ClientesPage() {
  const { pedir } = useApi();
  const [busqueda, setBusqueda] = useState('');
  const [inactivos, setInactivos] = useState(false);
  const q = useDeferredValue(busqueda.trim());
  // undefined = cerrado; null = nuevo; Cliente = edición.
  const [editando, setEditando] = useState<Cliente | null | undefined>(undefined);

  const { data, error, isFetching } = useQuery({
    queryKey: ['clientes', { q, inactivos }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (inactivos) params.set('incluirInactivos', 'true');
      return pedir<Cliente[]>(`/clientes?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Clientes</h1>
        <Boton onClick={() => setEditando(null)}>Nuevo cliente</Boton>
      </div>
      <Tarjeta>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Entrada
            type="search"
            placeholder="Buscar por nombre o documento"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="max-w-sm"
          />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={inactivos} onChange={(e) => setInactivos(e.target.checked)} />
            Mostrar inactivos
          </label>
          {isFetching && <span className="text-xs text-slate-400">Buscando…</span>}
        </div>
        {error ? (
          <AlertaError error={error} />
        ) : !data ? (
          <Cargando />
        ) : data.length === 0 ? (
          <Vacio>{q ? 'No hay clientes que coincidan con la búsqueda.' : 'Todavía no cargaste clientes.'}</Vacio>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">Razón social</th>
                  <th className="py-2 pr-4 font-medium">Documento</th>
                  <th className="py-2 pr-4 font-medium">Condición IVA</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 pr-4">
                      {c.razonSocial}
                      {!c.activo && <Etiqueta className="ml-2 bg-slate-100 text-slate-600">Inactivo</Etiqueta>}
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {c.tipoDocumento === 'CONSUMIDOR_FINAL'
                        ? TIPOS_DOCUMENTO.CONSUMIDOR_FINAL
                        : `${c.tipoDocumento} ${c.tipoDocumento === 'CUIT' || c.tipoDocumento === 'CUIL' ? cuit(c.numeroDocumento) : c.numeroDocumento}`}
                    </td>
                    <td className="py-2 pr-4">{CONDICIONES_IVA[c.condicionIva]}</td>
                    <td className="py-2 text-right">
                      <Boton variante="fantasma" onClick={() => setEditando(c)}>
                        Editar
                      </Boton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
      {editando !== undefined && (
        <ClienteModal key={editando?.id ?? 'nuevo'} abierto cliente={editando} onCerrar={() => setEditando(undefined)} />
      )}
    </div>
  );
}
