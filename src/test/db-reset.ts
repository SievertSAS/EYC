import { db } from "@/lib/db";

/**
 * Resetea completamente la base de datos Dexie entre tests.
 *
 * A diferencia de `resetAllLocalData` (que solo limpia el contenido de cada
 * tabla), esto hace un `delete()` + `open()` real sobre `fake-indexeddb`
 * (configurado globalmente en `vitest.config.ts` vía `fake-indexeddb/auto`),
 * garantizando aislamiento total entre tests — incluyendo `sync_meta`, que
 * guarda el watermark de sincronización y debe partir en blanco en cada test.
 */
export async function resetTestDb(): Promise<void> {
  if (db.isOpen()) {
    db.close();
  }
  await db.delete();
  await db.open();
}
