import { db, noBorrado } from "@/lib/db";
import { randomUUID } from "@/lib/uuid";
import { pushSingle } from "@/lib/supabase/sync-engine";
import type {
  CategoriaUbicacion,
  UbicacionFlotanteCatalogo,
  VisitaEjecucion,
} from "@/lib/db/types";
import { limpiarNombreUbicacion, normalizarNombreUbicacion } from "./flotantes";

// ============================================================
//  Catálogo de ubicaciones flotantes del portátil (#188)
//
//  Tabla de sync bidireccional (no maestra): el técnico agrega entradas con
//  "Otro" también sin conexión y el push las sube después. Renombrar o
//  desactivar es del coordinador (RLS + trigger en la migración 050).
//
//  Dos técnicos sin conexión pueden crear el mismo nombre con ids distintos:
//  el servidor descarta el segundo (trigger de la 050) y aquí la lista se
//  deduplica por nombre normalizado, así que nunca se ve repetido. La visita
//  guarda NOMBRES, no ids, así que el informe no depende de cuál quedó.
// ============================================================

/** Entradas activas del catálogo, sin duplicados normalizados, ordenadas. */
export async function listarCatalogoFlotantes(): Promise<UbicacionFlotanteCatalogo[]> {
  const filas = (await db.catalogo_ubicaciones_flotantes.toArray())
    .filter(noBorrado)
    .filter((f) => f.activo !== false)
    .sort((a, b) => (a.creado_en ?? "").localeCompare(b.creado_en ?? ""));

  const porClave = new Map<string, UbicacionFlotanteCatalogo>();
  for (const f of filas) {
    const clave = normalizarNombreUbicacion(f.nombre);
    if (!porClave.has(clave)) porClave.set(clave, f);
  }
  return [...porClave.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export type CrearUbicacionResultado =
  | { ok: true; nombre: string; creada: boolean }
  | { ok: false; error: string };

/**
 * "Otro": agrega `nombre` al catálogo para todos. Si ya existe (ignorando
 * mayúsculas, tildes y espacios) no crea nada y devuelve el nombre del
 * catálogo, para que la visita use siempre la misma grafía.
 */
export async function crearUbicacionFlotante(
  nombre: string,
  usuarioId: string | undefined
): Promise<CrearUbicacionResultado> {
  const limpio = limpiarNombreUbicacion(nombre);
  if (!limpio) return { ok: false, error: "Escribe el nombre de la ubicación" };

  const clave = normalizarNombreUbicacion(limpio);
  const existente = (await listarCatalogoFlotantes()).find(
    (f) => normalizarNombreUbicacion(f.nombre) === clave
  );
  if (existente) return { ok: true, nombre: existente.nombre, creada: false };

  const ahora = new Date().toISOString();
  const id = randomUUID();
  await db.catalogo_ubicaciones_flotantes.add({
    id,
    nombre: limpio,
    activo: true,
    creado_por: usuarioId ?? null,
    creado_en: ahora,
    sync_status: "pending",
    last_modified: ahora,
  });
  pushSingle("catalogo_ubicaciones_flotantes", id);
  return { ok: true, nombre: limpio, creada: true };
}

async function actualizarVisita(visitaId: string, patch: Partial<VisitaEjecucion>) {
  await db.visitas.update(visitaId, {
    ...patch,
    sync_status: "pending",
    last_modified: new Date().toISOString(),
  });
  pushSingle("visitas", visitaId);
}

/**
 * Cambia la categoría de ubicación de la visita. Un informe nunca mezcla fija
 * y flotante: al pasar a fija se limpian las áreas flotantes (con `null`, que
 * sí viaja en el push y limpia la columna remota).
 */
export async function guardarCategoriaUbicacion(
  visitaId: string,
  categoria: CategoriaUbicacion
): Promise<void> {
  await actualizarVisita(visitaId, {
    categoria_ubicacion: categoria,
    ...(categoria === "fija" ? { ubicaciones_flotantes: null } : {}),
  });
}

/** Guarda las áreas flotantes elegidas (nombres del catálogo). */
export async function guardarUbicacionesFlotantes(
  visitaId: string,
  nombres: string[]
): Promise<void> {
  // La categoría viaja junto con la lista: el CHECK de la 050 exige "flotante".
  await actualizarVisita(visitaId, {
    categoria_ubicacion: "flotante",
    ubicaciones_flotantes: nombres,
  });
}
