import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { EstadoVisita, Solicitud } from "@/lib/db/types";
import { getVisitCompleteness } from "./module-completeness";

// ============================================================
//  Máquina de estados para el ciclo de vida de visitas
//  Funciones puras con gates de validación
// ============================================================

import type { RolUsuario } from "@/lib/db/types";

export type VisitAction =
  | "iniciar_visita"
  | "enviar_revision"
  | "aprobar"
  | "devolver"
  | "marcar_enviado"
  | "solicitar_ajustes_cliente";

export interface ActionDefinition {
  action: VisitAction;
  label: string;
  description: string;
  target: EstadoVisita;
  roles: RolUsuario[];
  /** Si true, ejecuta validación de módulos antes de permitir */
  hasGate: boolean;
  /** Si true, la UI debe pedir una razón escrita antes de ejecutar */
  requiereRazon?: boolean;
  variant: "primary" | "success" | "warning" | "destructive";
  icon: string; // nombre del icono de lucide-react
}

export interface GateResult {
  canProceed: boolean;
  errors: { moduleId: string; message: string }[];
}

export interface TransitionResult {
  success: boolean;
  newState?: EstadoVisita;
  error?: string;
  gateResult?: GateResult;
}

// ─── Mapa de transiciones ───

const TRANSITIONS: Record<EstadoVisita, ActionDefinition[]> = {
  asignada: [
    {
      action: "iniciar_visita",
      label: "Iniciar Visita",
      description: "Comenzar la ejecución del servicio",
      target: "en_progreso",
      roles: ["tecnico", "coordinador"],
      hasGate: false,
      variant: "primary",
      icon: "Play",
    },
  ],
  en_progreso: [
    {
      action: "enviar_revision",
      label: "Enviar a Revisión",
      description:
        "Marcar como lista y enviar al ingeniero para revisión (requiere módulos obligatorios)",
      target: "en_revision",
      roles: ["tecnico"],
      hasGate: true,
      variant: "success",
      icon: "Send",
    },
  ],
  en_revision: [
    {
      action: "aprobar",
      label: "Aprobar",
      description: "Aprobar el informe y generar documento final",
      target: "aprobada",
      roles: ["tecnico", "coordinador", "programador"],
      // #8: aprobar publica el PDF oficial (QR + hash) — no debe poder
      // aprobarse una visita incompleta. Mismo gate de completitud que
      // enviar_revision (los datos pueden haber cambiado desde entonces).
      hasGate: true,
      variant: "success",
      icon: "BadgeCheck",
    },
    {
      action: "devolver",
      label: "Devolver con Observaciones",
      description: "Devolver al técnico para correcciones",
      target: "en_progreso",
      roles: ["tecnico", "coordinador", "programador"],
      hasGate: false,
      requiereRazon: true,
      variant: "warning",
      icon: "RotateCcw",
    },
  ],
  aprobada: [
    {
      action: "marcar_enviado",
      label: "Marcar como Enviado",
      description: "Confirmar que el informe ya fue entregado al cliente",
      target: "enviada",
      roles: ["coordinador", "programador"],
      hasGate: false,
      variant: "primary",
      icon: "Send",
    },
  ],
  enviada: [
    {
      action: "solicitar_ajustes_cliente",
      label: "Solicitar Ajustes (Cliente)",
      description: "El cliente reportó que se necesitan ajustes — devolver al técnico",
      target: "en_progreso",
      roles: ["coordinador", "programador"],
      hasGate: false,
      requiereRazon: true,
      variant: "warning",
      icon: "RotateCcw",
    },
  ],
};

// ─── Orden de estados para timeline ───

export const ESTADO_ORDER: EstadoVisita[] = [
  "asignada",
  "en_progreso",
  "en_revision",
  "aprobada",
  "enviada",
];

export const ESTADO_CONFIG: Record<
  EstadoVisita,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  asignada: {
    label: "Asignada",
    color: "text-slate-600",
    bgColor: "bg-slate-100",
    borderColor: "border-slate-200",
  },
  en_progreso: {
    label: "En Progreso",
    color: "text-amber-700",
    bgColor: "bg-amber-100",
    borderColor: "border-amber-200",
  },
  en_revision: {
    label: "En Revisión",
    color: "text-purple-700",
    bgColor: "bg-purple-100",
    borderColor: "border-purple-200",
  },
  aprobada: {
    label: "Aprobada",
    color: "text-emerald-700",
    bgColor: "bg-emerald-100",
    borderColor: "border-emerald-200",
  },
  enviada: {
    label: "Enviada",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    borderColor: "border-blue-200",
  },
};

// ─── Mapeo visita → solicitud pipeline ───

const SOLICITUD_SYNC: Partial<Record<EstadoVisita, string>> = {
  en_progreso: "ejecucion",
  en_revision: "ejecucion",
  aprobada: "notificado",
  enviada: "enviado",
};

// ─── API pública ───

/**
 * Devuelve las acciones disponibles para el estado y rol actuales.
 */
export function getAvailableActions(estado: EstadoVisita, cargo: RolUsuario): ActionDefinition[] {
  return (TRANSITIONS[estado] ?? []).filter((t) => t.roles.includes(cargo));
}

/**
 * Verifica si una transición específica es posible (sin ejecutar gates).
 */
export function canTransition(
  estado: EstadoVisita,
  action: VisitAction,
  cargo: RolUsuario
): boolean {
  return getAvailableActions(estado, cargo).some((t) => t.action === action);
}

/**
 * Ejecuta la gate de validación para una acción.
 * Retorna si puede proceder y los errores de bloqueo.
 */
const GATED_ACTIONS: VisitAction[] = ["enviar_revision", "aprobar"];

export async function checkGate(visitaId: string, action: VisitAction): Promise<GateResult> {
  if (GATED_ACTIONS.includes(action)) {
    const completeness = await getVisitCompleteness(visitaId);
    if (completeness.blocking.length > 0) {
      return {
        canProceed: false,
        errors: completeness.blocking.map((moduleId) => ({
          moduleId,
          message: getBlockingMessage(moduleId),
        })),
      };
    }
  }
  return { canProceed: true, errors: [] };
}

/**
 * Ejecuta una transición de estado en la base de datos.
 * Valida rol, estado actual, y gates antes de proceder.
 */
export async function executeTransition(
  visitaId: string,
  action: VisitAction,
  cargo: RolUsuario,
  extra?: { observaciones_revision?: string; usuarioId?: string }
): Promise<TransitionResult> {
  const visita = await db.visitas.get(visitaId);
  if (!visita) {
    return { success: false, error: "Visita no encontrada" };
  }

  const actionDef = getAvailableActions(visita.estado_visita, cargo).find(
    (t) => t.action === action
  );
  if (!actionDef) {
    return {
      success: false,
      error: `Acción "${action}" no permitida en estado "${visita.estado_visita}" para rol "${cargo}"`,
    };
  }

  // Ejecutar gate si aplica
  if (actionDef.hasGate) {
    const gateResult = await checkGate(visitaId, action);
    if (!gateResult.canProceed) {
      return { success: false, error: "No se cumplen los requisitos", gateResult };
    }
  }

  // Actualizar estado de la visita
  const nowIso = new Date().toISOString();
  const updateData: Record<string, unknown> = {
    estado_visita: actionDef.target,
    sync_status: "pending",
    last_modified: nowIso,
  };

  // Si es devolución (interna o por cliente), guardar observaciones
  if (
    (action === "devolver" || action === "solicitar_ajustes_cliente") &&
    extra?.observaciones_revision
  ) {
    updateData.observaciones_revision = extra.observaciones_revision;
    updateData.devuelto_en = nowIso;
  }

  const newPipelineEstado = SOLICITUD_SYNC[actionDef.target];

  // #9 interino: las tres escrituras de estado (visita + solicitud + informe
  // a "correccion_cliente") van en UNA transacción, para que no queden
  // divergentes si algo falla a mitad. La creación del informe y la
  // publicación del PDF quedan afuera (son async/red) — ver más abajo.
  let informeAfectadoId: string | undefined;
  await db.transaction("rw", [db.visitas, db.solicitudes, db.informes], async () => {
    await db.visitas.update(visitaId, updateData);

    if (action === "solicitar_ajustes_cliente") {
      // Una visita tiene un solo informe (el versionado va en informe_versiones);
      // se ordena por número de versión por si acaso hubiera datos duplicados.
      const informes = await db.informes.where("visita_id").equals(visitaId).toArray();
      const informe = informes.sort((a, b) => (b.version_actual ?? 0) - (a.version_actual ?? 0))[0];
      if (informe?.id) {
        await db.informes.update(informe.id, { estado: "correccion_cliente" });
        informeAfectadoId = informe.id;
      }
    }

    if (newPipelineEstado && visita.solicitud_id) {
      await db.solicitudes.update(visita.solicitud_id, {
        pipeline_estado: newPipelineEstado as Solicitud["pipeline_estado"],
        sync_status: "pending",
        last_modified: nowIso,
      });
    }
  });

  // Al aprobar: crear/versionar el informe y publicar el PDF oficial (QR+hash).
  // Centralizado aquí (no en el handler de un botón específico) para que ocurra
  // sin importar qué pantalla dispare la transición "aprobar".
  if (action === "aprobar" && extra?.usuarioId) {
    const { crearInformeDesdeVisita } = await import("./informe-service");
    const informe = await crearInformeDesdeVisita(
      visitaId,
      extra.usuarioId,
      visita.tecnico_id ?? extra.usuarioId
    );
    if (informe.id) {
      informeAfectadoId = informe.id;
      const { publicarVersionOficial } = await import("./publicar-informe");
      publicarVersionOficial(informe.id, visitaId).then((r) => {
        if (!r.success) {
          // #9: la transición ya ocurrió pero el PDF oficial NO se publicó.
          // Queda pendiente de reintento (botón "Publicar versión oficial"
          // en informes/[id]). Se registra como error, no como console.
          logger.error(
            "workflow:aprobar",
            `Visita ${visitaId} aprobada pero la versión oficial del informe ${informe.id} NO se publicó: ${r.error}`
          );
        }
      });
    }
  }

  // Push inmediato (import dinámico para no cargar el cliente Supabase en tests)
  const { pushSingle } = await import("@/lib/supabase/sync-engine");
  pushSingle("visitas", visitaId);
  if (newPipelineEstado && visita.solicitud_id) {
    pushSingle("solicitudes", visita.solicitud_id);
  }
  if (informeAfectadoId) {
    pushSingle("informes", informeAfectadoId);
  }

  return { success: true, newState: actionDef.target };
}

// ─── Helpers internos ───

function getBlockingMessage(moduleId: string): string {
  const messages: Record<string, string> = {
    condiciones: "Complete las condiciones ambientales (temperatura y presión)",
    levantamiento: "Agregue al menos una medición radiométrica",
    pruebas: "Complete todas las pruebas de control de calidad",
  };
  return messages[moduleId] ?? `Módulo "${moduleId}" incompleto`;
}

// ─── Reconciliación (#9 interino) ───

export interface VisitConsistencyIssue {
  visitaId: string;
  problema: string;
}

/**
 * Detecta divergencias entre el estado de la visita, el `pipeline_estado`
 * de su solicitud, y el estado del informe. `executeTransition` hace las
 * escrituras de estado en una transacción, pero la creación/publicación del
 * informe queda afuera (async/red) y puede fallar dejando estados
 * inconsistentes. Esta función los encuentra para que la consola de sync /
 * revisión pueda listarlos.
 */
export async function checkVisitConsistency(visitaId: string): Promise<VisitConsistencyIssue[]> {
  const issues: VisitConsistencyIssue[] = [];
  const visita = await db.visitas.get(visitaId);
  if (!visita) return [{ visitaId, problema: "Visita no encontrada" }];

  const esperadoPipeline = SOLICITUD_SYNC[visita.estado_visita];
  if (esperadoPipeline && visita.solicitud_id) {
    const solicitud = await db.solicitudes.get(visita.solicitud_id);
    if (solicitud && solicitud.pipeline_estado !== esperadoPipeline) {
      issues.push({
        visitaId,
        problema: `visita "${visita.estado_visita}" pero solicitud "${solicitud.pipeline_estado}" (se esperaba "${esperadoPipeline}")`,
      });
    }
  }

  if (visita.estado_visita === "aprobada" || visita.estado_visita === "enviada") {
    const informe = (await db.informes.where("visita_id").equals(visitaId).toArray()).sort(
      (a, b) => (b.version_actual ?? 0) - (a.version_actual ?? 0)
    )[0];
    if (!informe) {
      issues.push({ visitaId, problema: `visita "${visita.estado_visita}" pero sin informe` });
    } else {
      const version = await db.informe_versiones
        .where("informe_id")
        .equals(informe.id!)
        .and((v) => v.numero_version === informe.version_actual)
        .first();
      if (!version?.pdf_url) {
        issues.push({
          visitaId,
          problema: `informe ${informe.numero_informe} v${informe.version_actual} sin PDF oficial publicado`,
        });
      }
    }
  }

  return issues;
}
