// Doble de `useSearchParams` de next/navigation para tests de componentes.
//
// En la app real, Next parchea `history.pushState/replaceState` para que
// `useSearchParams()` se resincronice. Acá replicamos eso: el hook lee
// `window.location.search` y re-renderiza cuando cambia por el History API.
//
// Uso (vi.mock es hoisted, por eso el import dinámico):
//
//   vi.mock("next/navigation", async () => {
//     const { useSearchParamsDeVentana } = await import("@/test/search-params");
//     return { useSearchParams: useSearchParamsDeVentana, useRouter: () => ({ push }) };
//   });

import { useMemo, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
let parcheado = false;

function parchearHistory() {
  if (parcheado) return;
  parcheado = true;
  for (const metodo of ["pushState", "replaceState"] as const) {
    const original = window.history[metodo].bind(window.history);
    window.history[metodo] = (...args: Parameters<History["pushState"]>) => {
      original(...args);
      listeners.forEach((l) => l());
    };
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useSearchParamsDeVentana(): URLSearchParams {
  parchearHistory();
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => ""
  );
  return useMemo(() => new URLSearchParams(search), [search]);
}

/** Fija la URL actual (path + query) antes de renderizar. */
export function fijarUrl(url: string) {
  parchearHistory();
  window.history.replaceState(null, "", url);
}
