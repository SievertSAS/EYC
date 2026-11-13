import type { AreaFlotante, CategoriaUbicacion, TipoInstalacion } from "@/lib/db/types";

// ============================================================
//  Ubicaciones del portátil (#188) — lógica pura
//
//  El CONVENCIONAL portátil se evalúa en UNA sala fija (con barreras, igual
//  que el fijo: usa `visitas.ubicacion_id`) o en un grupo de áreas FLOTANTES
//  (solo control administrativo) elegidas del catálogo compartido. Un informe
//  nunca mezcla las dos categorías.
//
//  Flotante no tiene sala: se ocultan (y no se imprimen ni cuentan para la
//  completitud) las dimensiones, las zonas A–D y piso/techo. Cada área lleva
//  una descripción de la ubicación, propia de la visita y obligatoria.
//
//  PENDIENTE DEL FÍSICO (no implementado): si T = 1 / U = 1 para flotante, y
//  las lecturas con/sin EPP (#191).
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
 * Lee `visitas.ubicaciones_flotantes` tal como venga guardado. Filas viejas
 * (antes de la descripción) traen `string[]` con solo los nombres: se
 * convierten en áreas sin descripción. Descarta elementos sin nombre y
 * repetidos (comparación normalizada) en vez de fallar.
 */
export function normalizarAreasFlotantes(raw: unknown): AreaFlotante[] {
  if (!Array.isArray(raw)) return [];
  const areas: AreaFlotante[] = [];
  const vistas = new Set<string>();
  for (const el of raw) {
    let nombre: unknown;
    let descripcion: unknown = "";
    if (typeof el === "string") {
      nombre = el;
    } else if (el && typeof el === "object") {
      nombre = (el as { nombre?: unknown }).nombre;
      descripcion = (el as { descripcion?: unknown }).descripcion;
    }
    if (typeof nombre !== "string") continue;
    const limpio = limpiarNombreUbicacion(nombre);
    const clave = normalizarNombreUbicacion(limpio);
    if (!limpio || vistas.has(clave)) continue;
    vistas.add(clave);
    areas.push({ nombre: limpio, descripcion: typeof descripcion === "string" ? descripcion : "" });
  }
  return areas;
}

/**
 * Áreas flotantes de la visita, o `null` si el informe no es de ubicaciones
 * flotantes (fijo, portátil en sala fija o sin categoría). Un equipo que dejó
 * de ser portátil ignora la categoría que haya quedado guardada.
 */
export function areasFlotantesDeVisita(
  visita: {
    categoria_ubicacion?: CategoriaUbicacion | null;
    ubicaciones_flotantes?: unknown;
  },
  equipo: { tipo_equipo?: string; tipo_instalacion?: TipoInstalacion } | undefined
): AreaFlotante[] | null {
  if (!aplicaCategoriaUbicacion(equipo) || visita.categoria_ubicacion !== "flotante") return null;
  return normalizarAreasFlotantes(visita.ubicaciones_flotantes);
}

/** Agrega un área (sin descripción) si no estaba (comparación normalizada). */
export function agregarArea(seleccion: AreaFlotante[], nombre: string): AreaFlotante[] {
  const limpio = limpiarNombreUbicacion(nombre);
  if (!limpio) return seleccion;
  const clave = normalizarNombreUbicacion(limpio);
  if (seleccion.some((a) => normalizarNombreUbicacion(a.nombre) === clave)) return seleccion;
  return [...seleccion, { nombre: limpio, descripcion: "" }];
}

/** Quita un área de la selección (comparación normalizada). */
export function quitarArea(seleccion: AreaFlotante[], nombre: string): AreaFlotante[] {
  const clave = normalizarNombreUbicacion(nombre);
  return seleccion.filter((a) => normalizarNombreUbicacion(a.nombre) !== clave);
}

/** Cambia la descripción de un área (comparación normalizada), sin mutar. */
export function actualizarDescripcionArea(
  seleccion: AreaFlotante[],
  nombre: string,
  descripcion: string
): AreaFlotante[] {
  const clave = normalizarNombreUbicacion(nombre);
  return seleccion.map((a) =>
    normalizarNombreUbicacion(a.nombre) === clave ? { ...a, descripcion } : a
  );
}

/** Completo: al menos un área y todas con descripción no vacía. */
export function areasFlotantesCompletas(areas: AreaFlotante[]): boolean {
  return areas.length > 0 && areas.every((a) => a.descripcion.trim() !== "");
}

/**
 * Párrafos de la 2.2.4 para un informe de ubicaciones flotantes: encabezado y
 * una línea por área ("Nombre: descripción"). La descripción va tal cual la
 * redactó el ingeniero, sin puntuación agregada (como la ubicación física, #197).
 */
export function textoAreasFlotantes(areas: AreaFlotante[]): string[] {
  return [
    "Áreas evaluadas (ubicaciones flotantes):",
    ...areas.map((a) => {
      const desc = a.descripcion.trim();
      return desc ? `${a.nombre}: ${desc}` : a.nombre;
    }),
  ];
}

/**
 * Valor de "Área - servicio" de la portada: los nombres de las áreas flotantes
 * si el informe es de flotantes; si no, el nombre del servicio (como siempre).
 */
export function textoAreaServicio(
  nombreServicio: string | undefined | null,
  areasFlotantes: AreaFlotante[] | null
): string {
  if (areasFlotantes && areasFlotantes.length > 0) {
    return `Ubicaciones flotantes: ${areasFlotantes.map((a) => a.nombre).join(", ")}`;
  }
  return nombreServicio ?? "No reporta";
}
