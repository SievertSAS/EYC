import { db } from "@/lib/db";
import type { Solicitud, VisitaEjecucion } from "@/lib/db/types";

// ============================================================
//  Reprogramar visita (#64)
//
//  Cambia fecha y técnico de una visita que todavía está `asignada`.
//  Motivo obligatorio + traza (quién / cuándo). Propaga fecha/técnico a la
//  solicitud padre. No cambia `estado_visita`.
// ============================================================

export interface ReprogramarVisitaInput {
  /** Fecha de la visita — `yyyy-mm-dd` o ISO. */
  fechaVisita: string;
  tecnicoId: string;
  motivo: string;
  /** Usuario que reprograma (para la traza). */
  usuarioId: string;
}

export interface ReprogramarVisitaResult {
  success: boolean;
  error?: string;
}

export async function reprogramarVisita(
  visitaId: string,
  input: ReprogramarVisitaInput
): Promise<ReprogramarVisitaResult> {
  const motivo = input.motivo?.trim() ?? "";
  if (!motivo) return { success: false, error: "El motivo de la reprogramación es obligatorio" };
  if (!input.fechaVisita) return { success: false, error: "La fecha de la visita es obligatoria" };
  if (!input.tecnicoId) return { success: false, error: "Hay que asignar un técnico" };

  const visita = await db.visitas.get(visitaId);
  if (!visita) return { success: false, error: "Visita no encontrada" };
  if (visita.estado_visita !== "asignada") {
    return {
      success: false,
      error: `Solo se puede reprogramar una visita en estado "asignada" (esta está en "${visita.estado_visita}")`,
    };
  }

  const now = new Date().toISOString();

  await db.transaction("rw", [db.visitas, db.solicitudes], async () => {
    await db.visitas.update(visitaId, {
      fecha_visita: input.fechaVisita,
      tecnico_id: input.tecnicoId,
      reprogramada_en: now,
      reprogramada_por_id: input.usuarioId,
      reprogramacion_motivo: motivo,
      sync_status: "pending",
      last_modified: now,
    } satisfies Partial<VisitaEjecucion>);

    if (visita.solicitud_id) {
      await db.solicitudes.update(visita.solicitud_id, {
        fecha_estimada_visita: input.fechaVisita,
        tecnico_asignado_id: input.tecnicoId,
        sync_status: "pending",
        last_modified: now,
      } satisfies Partial<Solicitud>);
    }
  });

  const { pushSingle } = await import("@/lib/supabase/sync-engine");
  pushSingle("visitas", visitaId);
  if (visita.solicitud_id) pushSingle("solicitudes", visita.solicitud_id);

  return { success: true };
}
