import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { EditorComprobante } from './EditorComprobante';

export function NuevoComprobantePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return (
    <div className="space-y-4">
      <div>
        <Link to="/comprobantes" className="text-sm text-slate-500 hover:underline">
          ← Comprobantes
        </Link>
        <h1 className="text-xl font-semibold">Nueva factura</h1>
        <p className="text-sm text-slate-500">Se guarda como borrador. Lo revisás y lo emitís en el paso siguiente.</p>
      </div>
      <EditorComprobante
        onGuardado={(c) => {
          queryClient.setQueryData(['comprobante', c.id], c);
          void queryClient.invalidateQueries({ queryKey: ['comprobantes'] });
          navigate(`/comprobantes/${c.id}`, { replace: true });
        }}
      />
    </div>
  );
}
