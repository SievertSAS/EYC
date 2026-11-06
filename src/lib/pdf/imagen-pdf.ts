import { compressImage } from "@/lib/supabase/storage";
import { logger } from "@/lib/logger";

/**
 * Lado mayor máximo de una foto dentro del PDF. La foto más grande del
 * informe se dibuja a ~130 mm de ancho; a 300 ppp eso son ~1535 px, así que
 * 1600 px no pierde calidad perceptible ni impresa. Es el mismo tamaño con
 * que se suben las fotos al bucket (`compressImage`), así el PDF pesa igual
 * en el dispositivo que capturó la foto que en cualquier otro (#123).
 */
export const MAX_DIM_PDF = 1600;

const CALIDAD_JPEG_PDF = 0.85;

/**
 * Deja la imagen como queda al subirla al bucket, para que el PDF pese igual
 * en el dispositivo que la capturó (blob local) que en cualquier otro:
 * - Más grande que `MAX_DIM_PDF` → se reduce.
 * - PNG → `compressImage` (JPEG solo si pesa menos). En un informe real, 17
 *   fotos subidas como PNG pesaban 4 MB incluso comprimidas sin pérdida.
 * - JPEG dentro del máximo (lo que baja del bucket) → tal cual: recomprimir
 *   un JPEG ya comprimido suma pérdida sin ahorrar casi nada.
 * Nunca lanza: ante cualquier fallo, la imagen original.
 */
export async function reducirParaPdf(blob: Blob): Promise<Blob> {
  if (typeof createImageBitmap === "undefined") return blob;
  try {
    const bitmap = await createImageBitmap(blob);
    const ladoMayor = Math.max(bitmap.width, bitmap.height);
    bitmap.close();
    if (ladoMayor <= MAX_DIM_PDF && blob.type !== "image/png") return blob;
    return await compressImage(blob, MAX_DIM_PDF, CALIDAD_JPEG_PDF);
  } catch (err) {
    logger.warn("pdf", "No se pudo reducir la imagen para el PDF; se usa la original", err);
    return blob;
  }
}
