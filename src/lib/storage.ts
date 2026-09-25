// localStorage puede no estar disponible (modo privado, bloqueos): nunca debe romper la app.

export function leer(clave: string): string | null {
  try {
    return window.localStorage.getItem(clave);
  } catch {
    return null;
  }
}

export function guardar(clave: string, valor: string): void {
  try {
    window.localStorage.setItem(clave, valor);
  } catch {
    // sin persistencia: la sesión dura lo que dure la pestaña
  }
}

export function borrar(clave: string): void {
  try {
    window.localStorage.removeItem(clave);
  } catch {
    // nada que hacer
  }
}
