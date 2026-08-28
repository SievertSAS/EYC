// Helpers de conectividad y reloj para tests del motor de sync.
//
// El sync-engine y useAutoSync se ramifican por `navigator.onLine` y usan
// `new Date()` para el watermark de pull. Estos wrappers permiten forzar
// esas condiciones de forma acotada y con restauración garantizada.

import { vi } from "vitest";

/**
 * Fija `navigator.onLine` y dispara el evento `online`/`offline` en window,
 * ejecuta `fn`, y restaura el valor original al terminar (incluso si lanza).
 */
async function withConnectivity<T>(online: boolean, fn: () => T | Promise<T>): Promise<T> {
  const original = Object.getOwnPropertyDescriptor(navigator, "onLine");
  Object.defineProperty(navigator, "onLine", { configurable: true, value: online });
  window.dispatchEvent(new Event(online ? "online" : "offline"));
  try {
    return await fn();
  } finally {
    if (original) Object.defineProperty(navigator, "onLine", original);
    else Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  }
}

export const withOnline = <T>(fn: () => T | Promise<T>) => withConnectivity(true, fn);
export const withOffline = <T>(fn: () => T | Promise<T>) => withConnectivity(false, fn);

/**
 * Corre `fn` con el reloj del sistema desplazado `offsetMs` respecto de
 * `base` (default: ahora). Sirve para reproducir el bug del watermark con
 * reloj de dispositivo desfasado (hallazgo #5 del plan).
 *
 * Solo fake-ea `Date` — NO `setTimeout`/`setInterval`, porque los timers
 * falsos completos cuelgan las transacciones de fake-indexeddb (mismo
 * motivo por el que sync-retry.test.ts usa `toFake: ["Date"]`).
 */
export async function withClockSkew<T>(
  offsetMs: number,
  fn: () => T | Promise<T>,
  base: Date = new Date()
): Promise<T> {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(base.getTime() + offsetMs));
  try {
    return await fn();
  } finally {
    vi.useRealTimers();
  }
}
