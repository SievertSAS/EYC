import { useCallback, useRef, useState } from "react";

/**
 * Indicador liviano de "guardado" para filas de tablas densas (mediciones,
 * disparos, cassettes, etc.) — evita repetir un `useState<boolean>` por
 * celda cuando la UI no lo soporta bien. `flash(id)` marca una fila como
 * recién guardada por 1500ms (mismo timing que el check de campo
 * individual en info-modulo.tsx), luego se oculta sola.
 */
export function useRowSavedFlash() {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const flash = useCallback((id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    const existing = timers.current.get(id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      setSavedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      timers.current.delete(id);
    }, 1500);
    timers.current.set(id, timer);
  }, []);

  const isSaved = useCallback((id: string) => savedIds.has(id), [savedIds]);

  return { isSaved, flash };
}
