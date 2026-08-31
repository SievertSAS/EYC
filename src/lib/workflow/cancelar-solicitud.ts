import { db } from "@/lib/db";
import type { EstadoVisita, Solicitud, VisitaEjecucion } from "@/lib/db/types";

// ============================================================
//  Cancelar solicitud (#64)
//
//  Pasa la solicitud a `pipeline_estado: "cancelada"` con traza. Regla sobre
//  las visitas hijas:
//   - si alguna ya arrancó (>= en_progreso) → NO se cancela; hay que
//     resolver esas visitas primero.
//   - si solo hay visitas `asignada` → se soft-deletean en cascada.
// ============================================================

/** Estados de visita que ya no son "solo agendadas" — bloquean la cancelación. */
const ESTADOS_VISITA_EN_MARCHA: EstadoVisita[] = [
  "en_progreso",
  "en_revision",
  "aprobada",
  "enviada",
];

export interface CancelarSolicitudInput {
  motivo: string;
  /** Usuario que cancela (para la traza). */
  usuarioId: string;
}

export interface CancelarSolicitudResult {
  success: boolean;
  error?: string;
  /** Visitas `asignada` que se soft-deletearon en cascada. */
  visitasCanceladas?: number;
}

export async function cancelarSolicitud(
  solicitudId: string,
  input: CancelarSolicitudInput
): Promise<CancelarSolicitudResult> {
  const motivo = input.motivo?.trim() ?? "";
  if (!motivo) return { success: false, error: "El motivo de la cancelación es obligatorio" };

  const solicitud = await db.solicitudes.get(solicitudId);
  if (!solicitud) return { success: false, error: "Solicitud no encontrada" };
  if (solicitud.pipeline_estado === "cancelada") {
    return { success: false, error: "La solicitud ya está cancelada" };
  }

  const visitas = (await db.visitas.where("solicitud_id").equals(solicitudId).toArray()).filter(
    (v) => !v.deleted_at
  );

  const enMarcha = visitas.filter((v) => ESTADOS_VISITA_EN_MARCHA.includes(v.estado_visita));
  if (enMarcha.length > 0) {
    return {
      success: false,
      error: `No se puede cancelar: hay ${enMarcha.length} visita(s) ya iniciada(s). Completá o devolvé esas visitas antes de cancelar la solicitud.`,
    };
  }

  const asignadas = visitas.filter((v) => v.estado_visita === "asignada");
  const now = new Date().toISOString();

  await db.transaction("rw", [db.solicitudes, db.visitas], async () => {
    for (const v of asignadas) {
      await db.visitas.update(v.id!, {
        deleted_at: now,
        sync_status: "pending",
        last_modified: now,
      } satisfies Partial<VisitaEjecucion>);
    }
    await db.solicitudes.update(solicitudId, {
      pipeline_estado: "cancelada",
      cancelada_motivo: motivo,
      cancelada_por_id: input.usuarioId,
      cancelada_en: now,
      sync_status: "pending",
      last_modified: now,
    } satisfies Partial<Solicitud>);
  });

  const { pushSingle } = await import("@/lib/supabase/sync-engine");
  pushSingle("solicitudes", solicitudId);
  for (const v of asignadas) pushSingle("visitas", v.id!);

  return { success: true, visitasCanceladas: asignadas.length };
}
