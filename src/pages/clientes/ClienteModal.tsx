import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { AlertaError, Aviso, Boton, Campo, Entrada, Modal, Selector } from '@/components/ui';
import { CONDICIONES_IVA, TIPOS_DOCUMENTO } from '@/lib/formato';
import type { Cliente, CondicionIva, Moneda, TipoDocumento } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';

interface DatosPadron {
  cuit: string;
  razonSocial: string;
  domicilio: string | null;
  condicionIva: CondicionIva | null;
}

function formInicial(c?: Cliente | null) {
  return {
    razonSocial: c?.razonSocial ?? '',
    tipoDocumento: c?.tipoDocumento ?? ('CUIT' as TipoDocumento),
    numeroDocumento: c?.numeroDocumento ?? '',
    condicionIva: c?.condicionIva ?? ('RESPONSABLE_INSCRIPTO' as CondicionIva),
    domicilio: c?.domicilio ?? '',
    email: c?.email ?? '',
    monedaPreferida: c?.monedaPreferida ?? ('ARS' as Moneda),
    diasVencimiento: c?.diasVencimiento != null ? String(c.diasVencimiento) : '',
    activo: c?.activo ?? true,
  };
}

export type ValoresInicialesCliente = Partial<Pick<Cliente, 'razonSocial' | 'tipoDocumento' | 'numeroDocumento' | 'condicionIva' | 'domicilio' | 'email'>>;

/** Alta o edición de un cliente. Montarlo con `key` distinta por cliente para reiniciar el formulario. */
export function ClienteModal({
  abierto,
  cliente,
  valoresIniciales,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean;
  cliente?: Cliente | null;
  /** Para un alta: datos sugeridos (por ejemplo, los que trajo una importación). */
  valoresIniciales?: ValoresInicialesCliente;
  onCerrar: () => void;
  onGuardado?: (c: Cliente) => void;
}) {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => {
    const base = formInicial(cliente);
    if (cliente || !valoresIniciales) return base;
    const v = Object.fromEntries(Object.entries(valoresIniciales).filter(([, x]) => x !== undefined && x !== null));
    return { ...base, ...v };
  });
  const [avisoPadron, setAvisoPadron] = useState<string | null>(null);

  function cambiar<K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  const padron = useMutation({
    mutationFn: () => pedir<DatosPadron>(`/clientes/padron/${encodeURIComponent(form.numeroDocumento.replace(/[-.\s]/g, ''))}`),
    onSuccess: (d) => {
      setForm((f) => ({
        ...f,
        razonSocial: d.razonSocial || f.razonSocial,
        domicilio: d.domicilio ?? f.domicilio,
        condicionIva: d.condicionIva ?? f.condicionIva,
      }));
      setAvisoPadron(d.condicionIva ? null : 'ARCA no informó la condición frente al IVA: revisala a mano.');
    },
  });

  const guardar = useMutation({
    mutationFn: () => {
      const body = {
        razonSocial: form.razonSocial.trim(),
        tipoDocumento: form.tipoDocumento,
        numeroDocumento: form.tipoDocumento === 'CONSUMIDOR_FINAL' ? '0' : form.numeroDocumento.trim(),
        condicionIva: form.condicionIva,
        domicilio: form.domicilio.trim() || (cliente ? null : undefined),
        email: form.email.trim() || (cliente ? null : undefined),
        monedaPreferida: form.monedaPreferida,
        diasVencimiento: form.diasVencimiento === '' ? null : Number(form.diasVencimiento),
      };
      return cliente
        ? pedir<Cliente>(`/clientes/${cliente.id}`, 'PATCH', { ...body, activo: form.activo })
        : pedir<Cliente>('/clientes', 'POST', body);
    },
    onSuccess: (c) => {
      void queryClient.invalidateQueries({ queryKey: ['clientes'] });
      onGuardado?.(c);
      onCerrar();
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    guardar.mutate();
  }

  const esCuit = form.tipoDocumento === 'CUIT';
  const sinDocumento = form.tipoDocumento === 'CONSUMIDOR_FINAL';

  return (
    <Modal abierto={abierto} titulo={cliente ? 'Editar cliente' : 'Nuevo cliente'} onCerrar={onCerrar}>
      <form onSubmit={enviar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Tipo de documento">
            <Selector value={form.tipoDocumento} onChange={(e) => cambiar('tipoDocumento', e.target.value as TipoDocumento)}>
              {Object.entries(TIPOS_DOCUMENTO).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </Selector>
          </Campo>
          {!sinDocumento && (
            <Campo etiqueta="Número">
              <div className="flex gap-2">
                <Entrada
                  value={form.numeroDocumento}
                  onChange={(e) => cambiar('numeroDocumento', e.target.value)}
                  inputMode={form.tipoDocumento === 'PASAPORTE' ? 'text' : 'numeric'}
                  required
                  maxLength={20}
                />
                {esCuit && (
                  <Boton
                    variante="secundario"
                    cargando={padron.isPending}
                    disabled={form.numeroDocumento.replace(/\D/g, '').length !== 11}
                    onClick={() => padron.mutate()}
                    className="shrink-0"
                  >
                    Buscar en padrón
                  </Boton>
                )}
              </div>
            </Campo>
          )}
        </div>
        <AlertaError error={padron.error} />
        {avisoPadron && <Aviso>{avisoPadron}</Aviso>}
        <Campo etiqueta="Razón social">
          <Entrada value={form.razonSocial} onChange={(e) => cambiar('razonSocial', e.target.value)} required maxLength={200} />
        </Campo>
        <Campo etiqueta="Condición frente al IVA">
          <Selector value={form.condicionIva} onChange={(e) => cambiar('condicionIva', e.target.value as CondicionIva)}>
            {Object.entries(CONDICIONES_IVA).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Domicilio">
          <Entrada value={form.domicilio} onChange={(e) => cambiar('domicilio', e.target.value)} maxLength={300} />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo etiqueta="Email" className="sm:col-span-3">
            <Entrada type="email" value={form.email} onChange={(e) => cambiar('email', e.target.value)} />
          </Campo>
          <Campo etiqueta="Moneda habitual">
            <Selector value={form.monedaPreferida} onChange={(e) => cambiar('monedaPreferida', e.target.value as Moneda)}>
              <option value="ARS">Pesos</option>
              <option value="USD">Dólares</option>
            </Selector>
          </Campo>
          <Campo etiqueta="Días para el vencimiento" ayuda="Se usa para sugerir el vencimiento de pago." className="sm:col-span-2">
            <Entrada
              type="number"
              min={0}
              max={365}
              value={form.diasVencimiento}
              onChange={(e) => cambiar('diasVencimiento', e.target.value)}
            />
          </Campo>
        </div>
        {cliente && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.activo} onChange={(e) => cambiar('activo', e.target.checked)} />
            Cliente activo (los inactivos no aparecen al facturar)
          </label>
        )}
        <AlertaError error={guardar.error} />
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={guardar.isPending}>
            Guardar
          </Boton>
        </div>
      </form>
    </Modal>
  );
}
