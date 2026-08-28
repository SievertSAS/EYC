// Recuperación ante una migración de esquema que Dexie no puede aplicar.
//
// El caso concreto es v13 (cambio de PK ++id -> id): si la DB del navegador
// tiene datos de una versión previa, `db.open()` lanza
// `UpgradeError: Not yet support for changing primary key` y la app no abre
// (ver docs/modules/01-db.md §4). El único arreglo real es borrar el
// IndexedDB local y volver a bajar los datos del servidor.
//
// `db-provider` debería llamar `needsLocalReset(err)` en su catch y, si es
// true, ofrecer un botón "borrar datos locales y recargar" que invoque
// `resetAndReopen()` — en vez de mostrar el mensaje crudo de Dexie.

import Dexie from "dexie";
import { db } from "./index";

/**
 * ¿El error de `db.open()` indica que el esquema local no se puede migrar y
 * hace falta borrar el IndexedDB? Cubre el `UpgradeError` de cambio de PK
 * (v13) y, en general, cualquier `Dexie.UpgradeError` / `VersionError`.
 */
export function needsLocalReset(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const name = err.name;
  if (name === "UpgradeError" || name === "VersionError") return true;
  // Algunos entornos envuelven el mensaje sin conservar `name`.
  return /changing primary key|not yet support/i.test(err.message);
}

/**
 * Borra el IndexedDB local y lo vuelve a abrir vacío en la versión actual.
 * Después de esto hay que re-sincronizar desde el servidor (fullSync).
 * Pensado para ejecutarse detrás de una confirmación del usuario.
 */
export async function resetAndReopen(): Promise<void> {
  if (db.isOpen()) db.close();
  await db.delete();
  await db.open();
}

// Re-export para tests / callers que quieran el tipo de error de Dexie.
export const DexieErrors = Dexie.errnames;
