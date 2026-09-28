import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { AppLayout } from './components/AppLayout';
import { ClientesPage } from './pages/clientes/ClientesPage';
import { ComprobanteDetallePage } from './pages/comprobantes/ComprobanteDetallePage';
import { ComprobantesPage } from './pages/comprobantes/ComprobantesPage';
import { NuevoComprobantePage } from './pages/comprobantes/NuevoComprobantePage';
import { AccesoPage } from './pages/AccesoPage';
import { ConfiguracionPage } from './pages/configuracion/ConfiguracionPage';
import { ImportacionDetallePage } from './pages/importaciones/ImportacionDetallePage';
import { ImportacionesPage } from './pages/importaciones/ImportacionesPage';
import { LoginPage } from './pages/LoginPage';
import { RecibosPage } from './pages/recibos/RecibosPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/acceso" element={<AccesoPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/comprobantes" replace />} />
        <Route path="comprobantes" element={<ComprobantesPage />} />
        <Route path="comprobantes/nuevo" element={<NuevoComprobantePage />} />
        <Route path="comprobantes/:id" element={<ComprobanteDetallePage />} />
        <Route path="importaciones" element={<ImportacionesPage />} />
        <Route path="importaciones/:id" element={<ImportacionDetallePage />} />
        <Route path="recibos" element={<RecibosPage />} />
        <Route path="clientes" element={<ClientesPage />} />
        <Route path="configuracion" element={<ConfiguracionPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
