import { db } from "@/lib/db";
import type { VisitaEjecucion, PruebaResultado, GrupoResultado, Solicitud } from "@/lib/db/types";
import { hasPackage } from "@/lib/equipos";

// ============================================================
//  Servicio de creación de visitas
//  Crea VisitaEjecucion + auto-genera PruebaResultado
//  para cada PruebaDefinicion aplicable al tipo de equipo.
// ============================================================

interface CrearVisitaResult {
  success: boolean;
  visitaId?: number;
  pruebasCreadas?: number;
  gruposCreados?: number;
  error?: string;
}

/**
 * Crea una visita desde una solicitud y auto-genera las pruebas aplicables.
 *
 * @param solicitudId - ID de la solicitud origen
 * @param equipoId - ID del equipo a intervenir (de la ubicación de la solicitud)
 */
export async function crearVisitaDesdeSolicitud(
  solicitudId: number,
  equipoId: number
): Promise<CrearVisitaResult> {
  try {
    const solicitud = await db.solicitudes.get(solicitudId);
    if (!solicitud) return { success: false, error: "Solicitud no encontrada" };

    const equipo = await db.equipos.get(equipoId);
    if (!equipo) return { success: false, error: "Equipo no encontrado" };

    const now = new Date().toISOString();

    // Crear la visita
    const visita: Omit<VisitaEjecucion, "id"> = {
      solicitud_id: solicitudId,
      equipo_id: equipoId,
      ubicacion_id: equipo.ubicacion_id,
      tecnico_id: solicitud.tecnico_asignado_id,
      estado_visita: "asignada",
      fecha_visita: solicitud.fecha_estimada_visita,
      sync_status: "pending",
      last_modified: now,
      creado_en: now,
    };

    let visitaId: number;
    let pruebasCreadas = 0;
    let gruposCreados = 0;

    await db.transaction(
      "rw",
      [
        db.visitas,
        db.prueba_resultados,
        db.grupo_resultados,
        db.grupo_pruebas,
        db.solicitudes,
        db.prueba_definiciones,
      ],
      async () => {
        visitaId = (await db.visitas.add(visita as VisitaEjecucion)) as number;

        if (equipo.tipo_equipo) {
          const usarPaquete = hasPackage(equipo.tipo_equipo);

          if (usarPaquete) {
            // ─── Ruta nueva: pruebas agrupadas ───
            const grupos = await db.grupo_pruebas
              .where("tipo_equipo")
              .equals(equipo.tipo_equipo)
              .sortBy("orden");

            for (const grupo of grupos) {
              // Crear GrupoResultado
              const grupoResultadoId = (await db.grupo_resultados.add({
                visita_id: visitaId!,
                grupo_id: grupo.id!,
                equipo_id: equipoId,
                mediciones_json: [],
                imagenes: [],
                completado: false,
                sync_status: "pending",
                last_modified: now,
                creado_en: now,
              } as GrupoResultado)) as number;
              gruposCreados++;

              // Crear PruebaResultado para cada prueba del grupo
              const definiciones = await db.prueba_definiciones
                .where("grupo_id")
                .equals(grupo.id!)
                .sortBy("orden_en_grupo");

              for (const def of definiciones) {
                await db.prueba_resultados.add({
                  visita_id: visitaId!,
                  prueba_definicion_id: def.id!,
                  equipo_id: equipoId,
                  grupo_resultado_id: grupoResultadoId,
                  completado: false,
                  sync_status: "pending",
                  last_modified: now,
                  creado_en: now,
                } as PruebaResultado);
                pruebasCreadas++;
              }
            }
          } else {
            // ─── Ruta legacy: pruebas genéricas sin grupo ───
            const definiciones = await db.prueba_definiciones
              .filter(
                (def) =>
                  def.activa &&
                  !def.grupo_id &&
                  def.tipos_equipo_aplicables.includes(equipo.tipo_equipo!)
              )
              .toArray();

            definiciones.sort((a, b) => (a.orden_sugerido ?? 999) - (b.orden_sugerido ?? 999));

            for (const def of definiciones) {
              await db.prueba_resultados.add({
                visita_id: visitaId!,
                prueba_definicion_id: def.id!,
                equipo_id: equipoId,
                completado: false,
                sync_status: "pending",
                last_modified: now,
                creado_en: now,
              } as PruebaResultado);
              pruebasCreadas++;
            }
          }
        }

        // Actualizar pipeline de la solicitud
        await db.solicitudes.update(solicitudId, {
          pipeline_estado: "programacion" as Solicitud["pipeline_estado"],
          sync_status: "pending" as Solicitud["sync_status"],
          last_modified: now,
        });
      }
    );

    return {
      success: true,
      visitaId: visitaId!,
      pruebasCreadas,
      gruposCreados,
    };
  } catch (err) {
    console.error("[VisitaService] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error desconocido",
    };
  }
}

/**
 * Obtiene los equipos disponibles para una solicitud
 * (equipos en la ubicación de la solicitud).
 */
export async function getEquiposDeSolicitud(solicitudId: number) {
  const solicitud = await db.solicitudes.get(solicitudId);
  if (!solicitud?.ubicacion_id) return [];

  return db.equipos.where("ubicacion_id").equals(solicitud.ubicacion_id).toArray();
}
