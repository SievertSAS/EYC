import { db } from "@/lib/db";
import { randomUUID } from "@/lib/uuid";
import { pushSingle } from "@/lib/supabase/sync-engine";
import type { EquipoMovimiento } from "@/lib/db/types";

// ============================================================
//  Servicio de traslado de equipos
//
//  Cambia la ubicación actual del equipo y registra el
//  movimiento en equipo_movimientos (auditoría). El histórico
//  de visitas/informes NO se modifica: cada uno ya guarda su
//  equipo_id (los liga al equipo) y su ubicacion_id como
//  instantánea (conservan la ubicación al momento del estudio).
// ============================================================

interface TrasladarEquipoOptions {
  motivo?: string;
  registradoPorId?: string;
}

interface TrasladarEquipoResult {
  success: boolean;
  movimientoId?: string;
  error?: string;
}

/**
 * Traslada un equipo a una nueva ubicación y registra el movimiento.
 *
 * @param equipoId - ID del equipo a trasladar
 * @param ubicacionNuevaId - ID de la ubicación destino (de cualquier cliente)
 */
export async function trasladarEquipo(
  equipoId: string,
  ubicacionNuevaId: string,
  { motivo, registradoPorId }: TrasladarEquipoOptions = {}
): Promise<TrasladarEquipoResult> {
  try {
    const equipo = await db.equipos.get(equipoId);
    if (!equipo) return { success: false, error: "Equipo no encontrado" };

    const ubicacionAnteriorId = equipo.ubicacion_id;
    if (ubicacionAnteriorId === ubicacionNuevaId) {
      return { success: false, error: "El equipo ya está en esa ubicación" };
    }

    const destino = await db.ubicaciones_rx.get(ubicacionNuevaId);
    if (!destino) return { success: false, error: "Ubicación destino no encontrada" };

    const now = new Date().toISOString();
    const movimientoId = randomUUID();

    await db.transaction("rw", [db.equipos, db.equipo_movimientos], async () => {
      await db.equipos.update(equipoId, {
        ubicacion_id: ubicacionNuevaId,
        sync_status: "pending",
        last_modified: now,
      });

      const movimiento: EquipoMovimiento = {
        id: movimientoId,
        equipo_id: equipoId,
        ubicacion_anterior_id: ubicacionAnteriorId || undefined,
        ubicacion_nueva_id: ubicacionNuevaId,
        fecha_movimiento: now,
        motivo: motivo?.trim() || undefined,
        registrado_por_id: registradoPorId || undefined,
        sync_status: "pending",
        last_modified: now,
        creado_en: now,
      };
      await db.equipo_movimientos.add(movimiento);
    });

    pushSingle("equipos", equipoId);
    pushSingle("equipo_movimientos", movimientoId);

    return { success: true, movimientoId };
  } catch (err) {
    console.error("[EquipoService] Error al trasladar:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error desconocido",
    };
  }
}
