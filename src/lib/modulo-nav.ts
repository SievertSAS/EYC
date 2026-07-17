/**
 * Cambia el módulo visible dentro del workspace de una visita sin pasar por
 * el router de Next.js (que siempre intenta un fetch al servidor, incluso
 * para cambios de solo query param). `history.pushState` actualiza la URL
 * y Next sincroniza `useSearchParams()` con ella sin red de por medio.
 */
export function irAModulo(visitaId: string, moduloId?: string) {
  const url = moduloId
    ? `/dashboard/visitas/${visitaId}?modulo=${moduloId}`
    : `/dashboard/visitas/${visitaId}`;
  window.history.pushState(null, "", url);
}
