// ============================================================
//  Lock de concurrencia para evitar sincronizaciones simultáneas.
//
//  Usa la Web Locks API (`navigator.locks`) cuando el navegador la
//  soporta: el lock "eyc-sync" es efectivo ENTRE PESTAÑAS del mismo
//  origen, lo cual es necesario porque el Service Worker dispara
//  "SYNC_REQUESTED" a cada tab abierta (ver sw-register.tsx) y cada
//  una corre fullSync()/pushAllPending() en su propio contexto JS —
//  sin este lock, dos tabs podrían pushear/pullear al mismo tiempo.
//
//  Fallback en memoria: si `navigator.locks` no existe (navegadores
//  viejos, o el entorno de test happy-dom, que no implementa Web
//  Locks), se usa un guard a nivel de módulo. Este fallback SOLO
//  protege single-flight DENTRO de la misma pestaña/proceso — NO
//  evita que dos pestañas distintas corran el sync a la vez — pero
//  es mejor que nada para navegadores sin soporte de Web Locks.
// ============================================================

const LOCK_NAME = "eyc-sync";

export type SyncLockResult<T> = { ran: true; value: T } | { ran: false; reason: "locked" };

let inMemoryLocked = false;

async function withInMemoryLock<T>(fn: () => Promise<T>): Promise<SyncLockResult<T>> {
  if (inMemoryLocked) {
    return { ran: false, reason: "locked" };
  }

  inMemoryLocked = true;
  try {
    const value = await fn();
    return { ran: true, value };
  } finally {
    inMemoryLocked = false;
  }
}

/**
 * Ejecuta `fn` protegida por un lock exclusivo de sync (single-flight).
 * Si ya hay una sincronización en curso, `fn` NO se ejecuta y se
 * devuelve `{ ran: false, reason: "locked" }` en su lugar.
 *
 * El lock se libera automáticamente (Web Locks o fallback en memoria)
 * cuando `fn` termina, ya sea con éxito o con excepción — un intento
 * posterior siempre puede volver a adquirirlo.
 */
export async function withSyncLock<T>(fn: () => Promise<T>): Promise<SyncLockResult<T>> {
  if (typeof navigator === "undefined" || !navigator.locks) {
    return withInMemoryLock(fn);
  }

  return navigator.locks.request(
    LOCK_NAME,
    { ifAvailable: true, mode: "exclusive" },
    async (lock) => {
      if (!lock) {
        return { ran: false, reason: "locked" };
      }
      const value = await fn();
      return { ran: true, value };
    }
  );
}
