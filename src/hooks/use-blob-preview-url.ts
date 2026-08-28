import { useEffect, useMemo } from "react";

/**
 * Deriva un object-URL de un `Blob` para previsualizar evidencias
 * fotográficas, y lo revoca cuando el blob cambia o el componente se
 * desmonta.
 *
 * Reemplaza el patrón `useState + useEffect(setPreview(...))` que se
 * repetía en los 5 módulos de grupo (A–E): ese patrón dispara
 * `react-hooks/set-state-in-effect`. Acá el URL se calcula en render con
 * `useMemo` (sin `setState`) y el efecto solo hace la limpieza.
 */
export function useBlobPreviewUrl(blob: Blob | null | undefined): string | null {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);

  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  return url;
}
