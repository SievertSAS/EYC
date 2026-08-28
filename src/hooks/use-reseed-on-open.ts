import { useEffect, useRef } from "react";

/**
 * Ejecuta `seed()` SOLO cuando `open` pasa de `false` a `true` — no en cada
 * re-render mientras el diálogo sigue abierto.
 *
 * Los diálogos de entidad se controlan seteando el prop `open` directo (no
 * vía `onOpenChange` de Radix), así que hay que repoblar el form a mano al
 * reabrir. El problema (#11): si se pone `seed` en un `useEffect` que también
 * depende del prop de la entidad, y el padre spreadea un objeto nuevo en cada
 * render (`entity={{ ...fromLiveQuery }}`), el efecto se re-dispara y pisa lo
 * que el usuario está escribiendo. Este hook solo re-siembra en la
 * transición de apertura.
 */
export function useReseedOnOpen(open: boolean, seed: () => void): void {
  const wasOpen = useRef(false);
  const seedRef = useRef(seed);

  // Mantener la última referencia de `seed` sin escribir el ref en render.
  useEffect(() => {
    seedRef.current = seed;
  });

  useEffect(() => {
    if (open && !wasOpen.current) seedRef.current();
    wasOpen.current = open;
  }, [open]);
}
