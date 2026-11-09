import type { CategoriaUbicacion, TipoInstalacion } from "@/lib/db/types";

// ============================================================
//  Ubicaciones del portátil (#188) — lógica pura
//
//  El CONVENCIONAL portátil se evalúa en UNA sala fija (con barreras, igual
//  que el fijo: usa `visitas.ubicacion_id`) o en un grupo de áreas FLOTANTES
//  (solo control administrativo) elegidas del catálogo compartido. Un informe
//  nunca mezcla las dos categorías.
//
//  PENDIENTE DEL FÍSICO (no implementado — se conserva el comportamiento del
//  fijo): si la tabla de zonas A–D de la 2.2.4 se omite para flotante, si
//  T = 1 / U = 1 para flotante, y las lecturas con/sin EPP (#191).
// ============================================================

/** Clave de comparación: sin tildes, en minúsculas y con espacios simples. */
export function normalizarNombreUbicacion(nombre: string): string {
  return nombre.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Nombre tal como se guarda: solo se recortan y colapsan los espacios. */
export function limpiarNombreUbicacion(nombre: string): string {
  return nombre.replace(/\s+/g, " ").trim();
}

/** La categoría fija/flotante solo existe para el CONVENCIONAL portátil. */
export function aplicaCategoriaUbicacion(
  equipo: { tipo_equipo?: string; tipo_instalacion?: TipoInstalacion } | undefined
): boolean {
  return equipo?.tipo_equipo === "CONVENCIONAL" && equipo.tipo_instalacion === "portatil";
}

/**
 * Áreas flotantes de la visita, o `null` si el informe no es de ubicaciones
 * flotantes (fijo, portátil en sala fija o sin categoría). Un equipo que dejó
 * de ser portátil ignora la categoría que haya quedado guardada.
 */
export function areasFlotantesDeVisita(
  visita: {
    categoria_ubicacion?: CategoriaUbicacion | null;
    ubicaciones_flotantes?: string[] | null;
  },
  equipo: { tipo_equipo?: string; tipo_instalacion?: TipoInstalacion } | undefined
): string[] | null {
  if (!aplicaCategoriaUbicacion(equipo) || visita.categoria_ubicacion !== "flotante") return null;
  return visita.ubicaciones_flotantes ?? [];
}

/** Agrega un área a la selección si no estaba (comparación normalizada). */
export function agregarArea(seleccion: string[], nombre: string): string[] {
  const limpio = limpiarNombreUbicacion(nombre);
  if (!limpio) return seleccion;
  const clave = normalizarNombreUbicacion(limpio);
  if (seleccion.some((s) => normalizarNombreUbicacion(s) === clave)) return seleccion;
  return [...seleccion, limpio];
}

/** Quita un área de la selección (comparación normalizada). */
export function quitarArea(seleccion: string[], nombre: string): string[] {
  const clave = normalizarNombreUbicacion(nombre);
  return seleccion.filter((s) => normalizarNombreUbicacion(s) !== clave);
}

/** Párrafo de la 2.2.4 para un informe de ubicaciones flotantes. */
export function textoAreasFlotantes(areas: string[]): string {
  return `Áreas evaluadas (ubicaciones flotantes): ${areas.join(", ")}.`;
}

/**
 * Valor de "Área - servicio" de la portada: las áreas flotantes si el informe
 * es de flotantes; si no, el nombre del servicio (como siempre).
 */
export function textoAreaServicio(
  nombreServicio: string | undefined | null,
  areasFlotantes: string[] | null
): string {
  if (areasFlotantes && areasFlotantes.length > 0) {
    return `Ubicaciones flotantes: ${areasFlotantes.join(", ")}`;
  }
  return nombreServicio ?? "No reporta";
}
