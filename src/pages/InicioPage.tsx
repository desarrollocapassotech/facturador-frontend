import { useAuth } from '@/auth/auth-context';

export function InicioPage() {
  const { usuario, tenant } = useAuth();

  return (
    <section>
      <h1 className="text-xl font-semibold">Hola{usuario?.nombre ? `, ${usuario.nombre}` : ''}</h1>
      <p className="mt-1 text-sm text-slate-500">
        Estás trabajando en <strong className="text-slate-700">{tenant?.nombre}</strong>. Borradores, comprobantes y
        clientes llegan en la próxima fase.
      </p>
    </section>
  );
}
