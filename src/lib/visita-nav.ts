/**
 * Navegación "dura" hacia/desde el listado y el workspace de visitas.
 *
 * A diferencia de `irAModulo` (ver `modulo-nav.ts`), estos puntos SÍ cruzan
 * entre rutas distintas de Next.js (`/dashboard/visitas` ↔
 * `/dashboard/visitas/[id]`), por lo que `router.push`/`<Link>` disparan un
 * fetch RSC que el Service Worker no puede resolver offline. Usamos
 * `window.location.assign` para forzar una navegación de documento completo,
 * que el Service Worker sí sabe interceptar y servir desde cache
 * (ver `public/sw.js`).
 */

/** true para "/dashboard/visitas/<id>" (un solo segmento tras "visitas/") */
export function isVisitaDetailPath(pathname: string): boolean {
  return /^\/dashboard\/visitas\/[^/]+\/?$/.test(pathname);
}

/** Navega al workspace de una visita, opcionalmente a un módulo puntual. */
export function irAVisita(visitaId: string, modulo?: string): void {
  const url = modulo
    ? `/dashboard/visitas/${visitaId}?modulo=${modulo}`
    : `/dashboard/visitas/${visitaId}`;
  window.location.assign(url);
}

/** Vuelve al listado de visitas. */
export function volverAVisitas(): void {
  window.location.assign("/dashboard/visitas");
}
