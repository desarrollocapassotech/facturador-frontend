// Genera en el navegador la clave privada (RSA 2048) y el pedido de certificado (CSR PKCS#10)
// que ARCA pide en "Administración de Certificados Digitales". La clave no sale del navegador
// hasta que el usuario la carga en el Facturador (que la guarda cifrada).
// Equivale a: openssl req -new -newkey rsa:2048 -nodes -subj "/C=AR/O=…/CN=…/serialNumber=CUIT …"

type Bytes = Uint8Array;

function concatenar(...partes: Bytes[]): Bytes {
  const total = partes.reduce((s, p) => s + p.length, 0);
  const salida = new Uint8Array(total);
  let i = 0;
  for (const p of partes) {
    salida.set(p, i);
    i += p.length;
  }
  return salida;
}

function largo(n: number): Bytes {
  if (n < 0x80) return Uint8Array.of(n);
  const bytes: number[] = [];
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>= 8;
  }
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

function tlv(tag: number, contenido: Bytes): Bytes {
  return concatenar(Uint8Array.of(tag), largo(contenido.length), contenido);
}

const secuencia = (...p: Bytes[]) => tlv(0x30, concatenar(...p));
const conjunto = (...p: Bytes[]) => tlv(0x31, concatenar(...p));
const utf8 = (s: string) => tlv(0x0c, new TextEncoder().encode(s));
const imprimible = (s: string) => tlv(0x13, new TextEncoder().encode(s));

function oid(texto: string): Bytes {
  const [a, b, ...resto] = texto.split('.').map(Number);
  const bytes = [40 * a + b];
  for (const n of resto) {
    const grupo: number[] = [n & 0x7f];
    let v = n >> 7;
    while (v > 0) {
      grupo.unshift((v & 0x7f) | 0x80);
      v >>= 7;
    }
    bytes.push(...grupo);
  }
  return tlv(0x06, Uint8Array.from(bytes));
}

const OID = {
  pais: '2.5.4.6',
  organizacion: '2.5.4.10',
  nombreComun: '2.5.4.3',
  numeroSerie: '2.5.4.5',
  sha256ConRsa: '1.2.840.113549.1.1.11',
};

function atributo(tipo: string, valor: Bytes): Bytes {
  return conjunto(secuencia(oid(tipo), valor));
}

function aBase64(b: Bytes): string {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}

function pem(etiqueta: string, der: Bytes): string {
  const b64 = aBase64(der).replace(/(.{64})/g, '$1\n').replace(/\n$/, '');
  return `-----BEGIN ${etiqueta}-----\n${b64}\n-----END ${etiqueta}-----\n`;
}

/** Solo caracteres que ARCA acepta sin problemas en el sujeto del certificado. */
export function limpiarTextoSujeto(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 .,&()-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 64);
}

export interface PedidoCertificado {
  clavePrivadaPem: string;
  csrPem: string;
}

export async function generarPedidoCertificado(datos: { razonSocial: string; cuit: string; alias: string }): Promise<PedidoCertificado> {
  const cuit = datos.cuit.replace(/\D/g, '');
  if (!/^\d{11}$/.test(cuit)) throw new Error('El CUIT tiene que tener 11 dígitos.');
  const alias = limpiarTextoSujeto(datos.alias).replace(/\s/g, '');
  if (!alias) throw new Error('Poné un nombre (alias) para el certificado.');
  const organizacion = limpiarTextoSujeto(datos.razonSocial) || alias;

  const par = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: Uint8Array.of(1, 0, 1), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', par.publicKey));
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', par.privateKey));

  const sujeto = secuencia(
    atributo(OID.pais, imprimible('AR')),
    atributo(OID.organizacion, utf8(organizacion)),
    atributo(OID.nombreComun, utf8(alias)),
    atributo(OID.numeroSerie, imprimible(`CUIT ${cuit}`)),
  );
  const info = secuencia(tlv(0x02, Uint8Array.of(0)), sujeto, spki, tlv(0xa0, new Uint8Array()));
  const firma = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', par.privateKey, info));
  const csr = secuencia(info, secuencia(oid(OID.sha256ConRsa), Uint8Array.of(0x05, 0x00)), tlv(0x03, concatenar(Uint8Array.of(0), firma)));

  return { clavePrivadaPem: pem('PRIVATE KEY', pkcs8), csrPem: pem('CERTIFICATE REQUEST', csr) };
}

/** Descarga un texto como archivo. */
export function descargarTexto(nombre: string, contenido: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
