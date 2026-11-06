// ============================================================
//  Tipo real de una imagen subida, por sus bytes iniciales (#207)
//
//  Las APIs de firma (`/api/usuarios/[id]`, `/api/configuracion-informe`)
//  suben con service role: el `type` y el nombre del File los decide el
//  navegador, así que no sirven como validación. Se miran los "magic
//  bytes" y solo se aceptan los formatos que admite el bucket
//  `evidencias` (JPEG, PNG, WebP).
// ============================================================

export type TipoImagen = "image/jpeg" | "image/png" | "image/webp";

/** Mensaje común de rechazo para las APIs que suben imágenes. */
export const FORMATO_IMAGEN_INVALIDO = "Formato de imagen no válido";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];
const RIFF = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
const WEBP = [0x57, 0x45, 0x42, 0x50]; // "WEBP" (offset 8)

function empiezaCon(datos: Uint8Array, firma: number[], offset = 0): boolean {
  if (datos.length < offset + firma.length) return false;
  return firma.every((b, i) => datos[offset + i] === b);
}

/** Devuelve el MIME real (JPEG/PNG/WebP) o `null` si no es ninguno de ellos. */
export function detectarTipoImagen(entrada: Uint8Array | ArrayBuffer): TipoImagen | null {
  const datos = entrada instanceof Uint8Array ? entrada : new Uint8Array(entrada);
  if (empiezaCon(datos, JPEG)) return "image/jpeg";
  if (empiezaCon(datos, PNG)) return "image/png";
  if (empiezaCon(datos, RIFF) && empiezaCon(datos, WEBP, 8)) return "image/webp";
  return null;
}
