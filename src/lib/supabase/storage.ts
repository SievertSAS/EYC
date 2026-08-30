// ============================================================
//  Subida y resolución de imágenes de evidencia a Supabase Storage
//
//  Contexto (issue #67): las fotos capturadas viven como `blob_local`
//  en IndexedDB y NUNCA llegaban al servidor — el push descarta el
//  binario. Este módulo:
//   - comprime el blob antes de subir (las fotos de tablet pesan MB),
//   - lo sube al bucket `evidencias` en una ruta que lleva el visita_id,
//   - resuelve una URL mostrable (object-URL del blob local, o signed
//     URL del path guardado en `url_storage`).
//
//  El bucket es PRIVADO. `url_storage` guarda el PATH, no una URL — las
//  URLs firmadas expiran y se piden al mostrar.
// ============================================================

export const EVIDENCIAS_BUCKET = "evidencias";

/** Registro genérico con un binario y (opcionalmente) su path remoto. */
export interface RegistroConImagen {
  id?: string;
  visita_id?: string;
  equipo_id?: string;
  prueba_codigo?: string;
  slot?: string;
  tipo?: string;
  blob_local?: Blob | null;
  url_storage?: string | null;
}

/**
 * Ruta de una evidencia dentro del bucket. Una carpeta por visita para
 * que sea navegable en el panel de Storage; el índice real es la fila.
 *   conv_evidencias         → {visita_id}/{prueba_codigo}/{slot}.jpg
 *   equipo_identificaciones → equipos/{equipo_id}/{id}.jpg
 *   evidencias              → {visita_id}/{tipo|id}.jpg
 */
export function evidenciaPath(localTable: string, rec: RegistroConImagen): string {
  const visita = rec.visita_id ?? "sin-visita";
  const id = rec.id ?? crypto.randomUUID();
  if (localTable === "conv_evidencias") {
    const prueba = (rec.prueba_codigo ?? "gen").replace(/[^\w.-]/g, "_");
    const slot = (rec.slot ?? id).replace(/[^\w.-]/g, "_");
    return `${visita}/${prueba}/${slot}.jpg`;
  }
  if (localTable === "equipo_identificaciones") {
    const equipo = (rec.equipo_id ?? "sin-equipo").replace(/[^\w.-]/g, "_");
    return `equipos/${equipo}/${id}.jpg`;
  }
  const nombre = (rec.tipo ?? rec.slot ?? id).replace(/[^\w.-]/g, "_");
  return `${visita}/${nombre}.jpg`;
}

/**
 * Comprime una imagen a JPEG redimensionando el lado mayor a `maxDim`.
 * Corre solo en el navegador (canvas). Si algo falla —o no hay canvas,
 * como en el entorno de test— devuelve el blob original: nunca bloquea.
 */
export async function compressImage(blob: Blob, maxDim = 1600, quality = 0.8): Promise<Blob> {
  if (
    !(blob instanceof Blob) ||
    typeof document === "undefined" ||
    typeof createImageBitmap === "undefined"
  ) {
    return blob;
  }
  try {
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return blob;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();

    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    // Si comprimir no achicó nada (imagen ya chica), quedate con el original.
    return out && out.size > 0 && out.size < blob.size ? out : blob;
  } catch {
    return blob;
  }
}

/**
 * Sube un blob al bucket de evidencias. Devuelve el path si salió bien,
 * o lanza el error de Supabase para que el motor de sync lo trate como
 * cualquier fallo de push (reintento con backoff).
 */
export async function subirEvidencia(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  path: string,
  blob: Blob
): Promise<string> {
  const comprimido = await compressImage(blob);
  const { error } = await supabase.storage
    .from(EVIDENCIAS_BUCKET)
    .upload(path, comprimido, { upsert: true, contentType: "image/jpeg" });
  if (error) throw error;
  return path;
}

// ─── Resolución para mostrar ───

const signedCache = new Map<string, { url: string; exp: number }>();
const SIGNED_TTL_MS = 55 * 60 * 1000; // el signed URL dura 1h; renová antes

/**
 * URL mostrable de una imagen. Prioriza el blob local (offline, instantáneo);
 * si no hay, pide una signed URL del path en `url_storage` y la cachea.
 * Devuelve null si no hay nada que mostrar.
 */
export async function resolverImagenSrc(img: {
  blob_local?: Blob | null;
  url_storage?: string | null;
}): Promise<string | null> {
  if (img.blob_local instanceof Blob) return URL.createObjectURL(img.blob_local);
  const path = img.url_storage;
  if (!path) return null;
  // Compatibilidad: si `url_storage` ya es una URL completa (datos viejos),
  // usarla tal cual.
  if (/^https?:\/\//.test(path)) return path;

  const hit = signedCache.get(path);
  if (hit && hit.exp > Date.now()) return hit.url;

  try {
    // Import perezoso: evita que cualquier componente que importe este
    // módulo arrastre `./client` → `@/lib/env` (que lanza sin env vars) en
    // el load. Solo se necesita al resolver una URL remota.
    const { createClient } = await import("./client");
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from(EVIDENCIAS_BUCKET)
      .createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) return null;
    signedCache.set(path, { url: data.signedUrl, exp: Date.now() + SIGNED_TTL_MS });
    return data.signedUrl;
  } catch {
    return null;
  }
}
