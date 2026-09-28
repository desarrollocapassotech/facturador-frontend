import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { AlertaError, Aviso, Boton, Campo, Cargando, Entrada, Tarjeta, claseInput } from '@/components/ui';
import type { PlantillaPdf } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';

const LOGO_MAX_KB = 300;

export function PlantillaSeccion() {
  const { pedir } = useApi();
  const { data, error } = useQuery({ queryKey: ['plantilla-pdf'], queryFn: () => pedir<PlantillaPdf>('/configuracion/plantilla-pdf') });
  if (error) return <AlertaError error={error} />;
  if (!data) return <Cargando />;
  return (
    <div className="space-y-4">
      <FormularioPlantilla key={JSON.stringify({ ...data, tieneLogo: undefined, logoMime: undefined })} plantilla={data} />
      <Logo tieneLogo={data.tieneLogo} />
    </div>
  );
}

function FormularioPlantilla({ plantilla }: { plantilla: PlantillaPdf }) {
  const { pedir } = useApi();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    colorPrimario: plantilla.colorPrimario,
    colorSecundario: plantilla.colorSecundario,
    textoPie: plantilla.textoPie ?? '',
    mostrarDuplicado: plantilla.mostrarDuplicado,
  });
  const [guardado, setGuardado] = useState(false);

  const guardar = useMutation({
    mutationFn: () => pedir<PlantillaPdf>('/configuracion/plantilla-pdf', 'PATCH', { ...form, textoPie: form.textoPie.trim() || null }),
    onSuccess: (p) => {
      queryClient.setQueryData(['plantilla-pdf'], p);
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
    <Tarjeta titulo="Diseño del PDF">
      <form onSubmit={enviar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Color principal" ayuda="Encabezado y títulos.">
            <div className="flex gap-2">
              <input
                type="color"
                value={form.colorPrimario}
                onChange={(e) => cambiar('colorPrimario', e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-slate-300"
              />
              <Entrada value={form.colorPrimario} onChange={(e) => cambiar('colorPrimario', e.target.value)} pattern="#[0-9a-fA-F]{6}" />
            </div>
          </Campo>
          <Campo etiqueta="Color secundario" ayuda="Fondos de tablas y detalles.">
            <div className="flex gap-2">
              <input
                type="color"
                value={form.colorSecundario}
                onChange={(e) => cambiar('colorSecundario', e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-slate-300"
              />
              <Entrada value={form.colorSecundario} onChange={(e) => cambiar('colorSecundario', e.target.value)} pattern="#[0-9a-fA-F]{6}" />
            </div>
          </Campo>
        </div>
        <Campo etiqueta="Texto al pie" ayuda="Opcional. Por ejemplo, datos bancarios para el pago.">
          <textarea
            className={`${claseInput} h-24`}
            value={form.textoPie}
            onChange={(e) => cambiar('textoPie', e.target.value)}
            maxLength={500}
          />
        </Campo>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.mostrarDuplicado} onChange={(e) => cambiar('mostrarDuplicado', e.target.checked)} />
          Generar también la hoja “Duplicado”
        </label>
        <AlertaError error={guardar.error} />
        {guardado && <Aviso tono="verde">Plantilla guardada.</Aviso>}
        <div className="flex justify-end">
          <Boton type="submit" cargando={guardar.isPending}>
            Guardar
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

function Logo({ tieneLogo }: { tieneLogo: boolean }) {
  const { subir, pedir, imagen } = useApi();
  const queryClient = useQueryClient();
  const [vista, setVista] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  useEffect(() => {
    if (!tieneLogo) {
      setVista(null);
      return;
    }
    let url: string | null = null;
    let cancelado = false;
    void imagen('/configuracion/plantilla-pdf/logo').then((u) => {
      if (cancelado) {
        if (u) URL.revokeObjectURL(u);
        return;
      }
      url = u;
      setVista(u);
    });
    return () => {
      cancelado = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [tieneLogo, revision, imagen]);

  const alTerminar = (p: PlantillaPdf) => {
    queryClient.setQueryData(['plantilla-pdf'], p);
    setRevision((r) => r + 1);
  };

  const subirLogo = useMutation({
    mutationFn: (archivo: File) => subir<PlantillaPdf>('/configuracion/plantilla-pdf/logo', 'logo', archivo),
    onSuccess: alTerminar,
  });
  const borrarLogo = useMutation({
    mutationFn: () => pedir<PlantillaPdf>('/configuracion/plantilla-pdf/logo', 'DELETE'),
    onSuccess: alTerminar,
  });

  function elegir(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    setErrorLocal(null);
    if (!archivo) return;
    if (!['image/png', 'image/jpeg'].includes(archivo.type)) {
      setErrorLocal('El logo tiene que ser PNG o JPG.');
      return;
    }
    if (archivo.size > LOGO_MAX_KB * 1024) {
      setErrorLocal(`El logo no puede pesar más de ${LOGO_MAX_KB} KB.`);
      return;
    }
    subirLogo.mutate(archivo);
  }

  return (
    <Tarjeta titulo="Logo">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-24 w-48 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50">
          {vista ? (
            <img src={vista} alt="Logo de la empresa" className="max-h-20 max-w-44 object-contain" />
          ) : (
            <span className="text-xs text-slate-400">Sin logo</span>
          )}
        </div>
        <div className="space-y-2">
          <label className="inline-flex cursor-pointer items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50">
            {subirLogo.isPending ? 'Subiendo…' : tieneLogo ? 'Reemplazar logo' : 'Subir logo'}
            <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={elegir} disabled={subirLogo.isPending} />
          </label>
          {tieneLogo && (
            <Boton variante="fantasma" cargando={borrarLogo.isPending} onClick={() => borrarLogo.mutate()} className="ml-2">
              Quitar
            </Boton>
          )}
          <p className="text-xs text-slate-500">PNG o JPG, hasta {LOGO_MAX_KB} KB.</p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <AlertaError mensaje={errorLocal} />
        <AlertaError error={subirLogo.error ?? borrarLogo.error} />
      </div>
    </Tarjeta>
  );
}
