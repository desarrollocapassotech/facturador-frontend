import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { AlertaError, Aviso, Boton, Campo, Cargando, Entrada, Selector, Tarjeta } from '@/components/ui';
import { ambienteTexto, CONDICIONES_IVA, cuit, soloFecha } from '@/lib/formato';
import type { CondicionIva, Emisor } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';

export function EmisorSeccion() {
  const { pedir } = useApi();
  const { data, error } = useQuery({ queryKey: ['emisor'], queryFn: () => pedir<Emisor>('/configuracion/emisor') });
  if (error) return <AlertaError error={error} />;
  if (!data) return <Cargando />;
  // key: al recargar los datos del servidor, el formulario arranca de nuevo con los valores guardados.
  return <FormularioEmisor key={JSON.stringify(data)} emisor={data} />;
}

function FormularioEmisor({ emisor }: { emisor: Emisor }) {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    nombreFantasia: emisor.nombreFantasia,
    razonSocial: emisor.razonSocial,
    condicionIva: emisor.condicionIva,
    domicilioFiscal: emisor.domicilioFiscal,
    ingresosBrutos: emisor.ingresosBrutos ?? '',
    inicioActividades: soloFecha(emisor.inicioActividades),
  });
  const [guardado, setGuardado] = useState(false);

  const guardar = useMutation({
    mutationFn: () =>
      pedir<Emisor>('/configuracion/emisor', 'PATCH', {
        nombreFantasia: form.nombreFantasia.trim(),
        razonSocial: form.razonSocial.trim(),
        condicionIva: form.condicionIva,
        domicilioFiscal: form.domicilioFiscal.trim(),
        ingresosBrutos: form.ingresosBrutos.trim() || null,
        inicioActividades: form.inicioActividades || null,
      }),
    onSuccess: (emisor) => {
      queryClient.setQueryData(['emisor'], emisor);
      void queryClient.invalidateQueries({ queryKey: ['arca'] });
      setGuardado(true);
    },
  });

  function cambiar<K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
    setGuardado(false);
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    guardar.mutate();
  }

  return (
    <Tarjeta titulo="Datos del emisor">
      <form onSubmit={enviar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="CUIT" ayuda="Se cambia desde soporte: define con qué CUIT se emite en ARCA.">
            <Entrada value={cuit(emisor.cuit)} disabled />
          </Campo>
          <Campo etiqueta="Ambiente ARCA">
            <Entrada value={ambienteTexto(emisor.ambienteArca)} disabled />
          </Campo>
          <Campo etiqueta="Razón social">
            <Entrada value={form.razonSocial} onChange={(e) => cambiar('razonSocial', e.target.value)} required maxLength={200} />
          </Campo>
          <Campo etiqueta="Nombre de fantasía">
            <Entrada value={form.nombreFantasia} onChange={(e) => cambiar('nombreFantasia', e.target.value)} required maxLength={120} />
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
          <Campo etiqueta="Domicilio fiscal">
            <Entrada value={form.domicilioFiscal} onChange={(e) => cambiar('domicilioFiscal', e.target.value)} required maxLength={300} />
          </Campo>
          <Campo etiqueta="Ingresos brutos" ayuda="Opcional. Se imprime en el PDF.">
            <Entrada value={form.ingresosBrutos} onChange={(e) => cambiar('ingresosBrutos', e.target.value)} maxLength={40} />
          </Campo>
          <Campo etiqueta="Inicio de actividades" ayuda="Opcional. Se imprime en el PDF.">
            <Entrada type="date" value={form.inicioActividades} onChange={(e) => cambiar('inicioActividades', e.target.value)} />
          </Campo>
        </div>
        <AlertaError error={guardar.error} />
        {guardado && <Aviso tono="verde">Datos guardados.</Aviso>}
        <div className="flex justify-end">
          <Boton type="submit" cargando={guardar.isPending}>
            Guardar
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}
