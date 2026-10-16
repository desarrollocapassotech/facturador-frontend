// Números en formato argentino: punto para los miles y coma para los decimales ("1.234,56").
// Todo lo que se muestra pasa por acá; los campos se leen con `leerNumero`.

const formatos = new Map<string, Intl.NumberFormat>();

function formato(minimo: number, maximo: number) {
  const clave = `${minimo}-${maximo}`;
  let f = formatos.get(clave);
  if (!f) {
    f = new Intl.NumberFormat('es-AR', { minimumFractionDigits: minimo, maximumFractionDigits: maximo });
    formatos.set(clave, f);
  }
  return f;
}

const aNumero = (valor: number | string | null | undefined) => (typeof valor === 'number' ? valor : Number(valor ?? 0));

/** Con decimales fijos: `numero(1234.5)` → "1.234,50"; `numero(68, 0)` → "68". */
export function numero(valor: number | string | null | undefined, decimales = 2): string {
  const n = aNumero(valor);
  return formato(decimales, decimales).format(Number.isFinite(n) ? n : 0);
}

/** Sin ceros de más: `numeroCorto(35.5)` → "35,5"; `numeroCorto(68)` → "68". */
export function numeroCorto(valor: number | string | null | undefined, maxDecimales = 2): string {
  const n = aNumero(valor);
  return formato(0, maxDecimales).format(Number.isFinite(n) ? n : 0);
}

/** Monto con su prefijo: `monto(1234.5)` → "$ 1.234,50"; `monto(10, 'US$')` → "US$ 10,00". */
export function monto(valor: number | string | null | undefined, prefijo = '$', decimales = 2): string {
  const n = aNumero(valor);
  const signo = n < 0 ? '-' : '';
  return `${signo}${prefijo} ${numero(Math.abs(n), decimales)}`;
}

/** Horas: `horas(35.5)` → "35,50h". */
export function horas(valor: number | string | null | undefined, decimales = 2): string {
  return `${numero(valor, decimales)}h`;
}

/**
 * Lee un número escrito por el usuario. Acepta el formato argentino ("1.540,50", "35,5") y,
 * por costumbre, también el punto como decimal ("1540.5", "35.5"). Un punto seguido de
 * grupos de tres cifras y sin coma se toma como separador de miles ("30.800" → 30800).
 * Devuelve null si está vacío o no es un número.
 */
export function leerNumero(texto: string | null | undefined): number | null {
  const t = (texto ?? '').replace(/\s/g, '').replace(/^\$|^US\$|^ARS\$/i, '');
  if (!t || t === '-' || t === ',' || t === '.') return null;
  let normal: string;
  if (t.includes(',')) {
    normal = t.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) {
    normal = t.replace(/\./g, '');
  } else {
    normal = t;
  }
  if (!/^-?\d*\.?\d*$/.test(normal)) return null;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

/** Para mostrar en un campo mientras no se edita: "30.800" si es entero; si no, con dos decimales ("1.540,50"). */
export function numeroEditable(valor: number | string | null | undefined, maxDecimales = 2): string {
  if (valor === null || valor === undefined || valor === '') return '';
  const n = typeof valor === 'number' ? valor : leerNumero(String(valor));
  if (n === null) return String(valor);
  const minimo = Number.isInteger(n) ? 0 : Math.min(2, maxDecimales);
  return formato(minimo, Math.max(minimo, maxDecimales)).format(n);
}
