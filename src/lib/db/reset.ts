import { db } from "@/lib/db";

/**
 * Borra todos los datos locales de IndexedDB (incluyendo sync_meta).
 * Debe usarse antes de ejecutar el script SQL de reset en Supabase,
 * o cuando se quiere forzar una descarga limpia desde el servidor.
 */
export async function resetAllLocalData(): Promise<void> {
  await Promise.all(db.tables.map((t) => t.clear()));
}
