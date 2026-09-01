import { db } from "@/lib/db";

/**
 * Consecutivo legible `SOL-{año}-{NNN}` de una solicitud. El `id` (uuid)
 * sigue siendo la clave real; esto es solo una etiqueta para identificarla
 * a simple vista.
 *
 * Se numera contando las solicitudes locales del año — mismo criterio que
 * `numero_informe` (ver `informe-service.ts`). No garantiza unicidad global
 * offline: dos dispositivos sin conexión pueden generar el mismo número.
 * Aceptable porque no es un identificador, y el backfill de la migración
 * 028 ya numeró las existentes.
 */
export async function generarNumeroSolicitud(fecha = new Date()): Promise<string> {
  const year = fecha.getFullYear();
  const prefix = `SOL-${year}-`;

  const all = await db.solicitudes.toArray();
  let maxSeq = 0;
  for (const s of all) {
    if (!s.numero_solicitud || !s.numero_solicitud.startsWith(prefix)) continue;
    const seq = parseInt(s.numero_solicitud.slice(prefix.length), 10);
    if (!Number.isNaN(seq) && seq > maxSeq) maxSeq = seq;
  }

  return prefix + String(maxSeq + 1).padStart(3, "0");
}
