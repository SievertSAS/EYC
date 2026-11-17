"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Estado de filtros/vista de un listado guardado en los query params.
 *
 * La URL es la única fuente de verdad: así los filtros sobreviven a una
 * recarga y se pueden compartir. Para escribirla usamos
 * `window.history.replaceState` en vez del router de Next: el router hace un
 * fetch RSC incluso para cambios de solo query param (falla offline, ver
 * `modulo-nav.ts`), mientras que el History API nativo se integra con el
 * router y sincroniza `useSearchParams()` sin red de por medio.
 * `replaceState` (no `pushState`) para no llenar el historial con cada tecla.
 *
 * El componente que use este hook debe estar dentro de un `<Suspense>`
 * (requisito de `useSearchParams` en páginas prerenderizadas).
 */
export function useFiltrosUrl<T>(
  parse: (params: URLSearchParams) => T,
  serializar: (filtros: T) => URLSearchParams
): [T, (cambio: Partial<T>) => void] {
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const filtros = useMemo(() => parse(new URLSearchParams(qs)), [parse, qs]);

  const actualizar = useCallback(
    (cambio: Partial<T>) => {
      // Se parte de la URL vigente (no del render) para no perder cambios
      // encadenados antes de que React vuelva a renderizar.
      const actual = parse(new URLSearchParams(window.location.search));
      const nuevo = serializar({ ...actual, ...cambio }).toString();
      const { pathname, hash } = window.location;
      window.history.replaceState(null, "", `${pathname}${nuevo ? `?${nuevo}` : ""}${hash}`);
    },
    [parse, serializar]
  );

  return [filtros, actualizar];
}
