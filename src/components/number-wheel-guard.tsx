"use client";

import { useEffect } from "react";

// ============================================================
//  Bloquea la rueda del mouse en inputs numéricos
//  El navegador cambia el valor de un `type="number"` enfocado al girar la
//  rueda sobre él, y un valor medido puede alterarse sin que el técnico lo
//  note. Quitar el foco antes de que actúe deja el valor intacto y la página
//  sigue scrolleando. Se monta una sola vez en el layout raíz.
// ============================================================

export function NumberWheelGuard() {
  useEffect(() => {
    function onWheel(e: WheelEvent) {
      const el = e.target;
      if (el instanceof HTMLInputElement && el.type === "number" && el === document.activeElement) {
        el.blur();
      }
    }
    // capture: corre antes que cualquier handler del propio input.
    document.addEventListener("wheel", onWheel, { capture: true, passive: true });
    return () => document.removeEventListener("wheel", onWheel, { capture: true });
  }, []);

  return null;
}
