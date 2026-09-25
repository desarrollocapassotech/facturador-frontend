# facturador-frontend

Frontend del Facturador. Vite 6 + React 19 + React Router 7 + Tailwind 4.
La arquitectura completa está en `../ARCHITECTURE.md`.

## Puesta en marcha

```bash
npm install
cp .env.example .env    # VITE_API_URL apunta al backend (default http://localhost:3000/api)
npm run dev             # http://localhost:5173
```

## Autenticación

- `src/auth/AuthProvider.tsx` maneja la sesión y expone `useAuth()` con la misma forma que Clerk (`getToken()`, `logout()`), para poder cambiarlo sin tocar las pantallas.
- `src/auth/RequireAuth.tsx` protege las rutas; sin sesión redirige a `/login` y después vuelve a la ruta pedida.
- Si el email tiene cuenta en varias empresas, el login pide elegir con cuál entrar.
- Cualquier `401` del backend cierra la sesión.
