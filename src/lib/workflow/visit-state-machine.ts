import { db } from "@/lib/db";
import type { EstadoVisita, Solicitud } from "@/lib/db/types";
import { getVisitCompleteness } from "./module-completeness";

// ============================================================
//  Máquina de estados para el ciclo de vida de visitas
//  Funciones puras con gates de validación
// ============================================================

import type { RolUsuario } from "@/lib/db/types";

export type VisitAction =
  | "iniciar_visita"
  | "completar_visita"
  | "generar_pre_informe"
  | "enviar_revision"
  | "aprobar"
  | "devolver";

export interface ActionDefinition {
  action: VisitAction;
  label: string;
  description: string;
  target: EstadoVisita;
  roles: RolUsuario[];
  /** Si true, ejecuta validación de módulos antes de permitir */
  hasGate: boolean;
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
      roles: ["tecnico"],
      hasGate: false,
      variant: "primary",
      icon: "Play",
    },
  ],
  en_progreso: [
    {
      action: "completar_visita",
      label: "Completar Visita",
      description: "Marcar como completada (requiere módulos obligatorios)",
      target: "completada",
      roles: ["tecnico"],
      hasGate: true,
      variant: "success",
      icon: "CheckCircle2",
    },
  ],
  completada: [
    {
      action: "generar_pre_informe",
      label: "Generar Pre-Informe",
      description: "Generar el PDF del pre-informe",
      target: "pre_informe",
      roles: ["tecnico"],
      hasGate: false,
      variant: "primary",
      icon: "FileText",
    },
  ],
  pre_informe: [
    {
      action: "enviar_revision",
      label: "Enviar a Revisión",
      description: "Enviar al ingeniero para revisión y aprobación",
      target: "en_revision",
      roles: ["tecnico"],
      hasGate: false,
      variant: "primary",
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
      hasGate: false,
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
      variant: "warning",
      icon: "RotateCcw",
    },
  ],
  aprobada: [],
};

// ─── Orden de estados para timeline ───

export const ESTADO_ORDER: EstadoVisita[] = [
  "asignada",
  "en_progreso",
  "completada",
  "pre_informe",
  "en_revision",
  "aprobada",
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
  completada: {
    label: "Completada",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    borderColor: "border-blue-200",
  },
  pre_informe: {
    label: "Pre-Informe",
    color: "text-indigo-700",
    bgColor: "bg-indigo-100",
    borderColor: "border-indigo-200",
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
};

// ─── Mapeo visita → solicitud pipeline ───

const SOLICITUD_SYNC: Partial<Record<EstadoVisita, string>> = {
  en_progreso: "ejecutado",
  completada: "ejecutado",
  pre_informe: "ejecutado",
  en_revision: "ejecutado",
  aprobada: "notificado",
};

// ─── API pública ───

/**
 * Devuelve las acciones disponibles para el estado y rol actuales.
 */
export function getAvailableActions(
  estado: EstadoVisita,
  cargo: RolUsuario
): ActionDefinition[] {
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
export async function checkGate(
  visitaId: number,
  action: VisitAction
): Promise<GateResult> {
  if (action === "completar_visita") {
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
  visitaId: number,
  action: VisitAction,
  cargo: RolUsuario,
  extra?: { observaciones_revision?: string }
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
  const updateData: Record<string, unknown> = {
    estado_visita: actionDef.target,
    last_modified: new Date().toISOString(),
  };

  // Si es devolución, guardar observaciones
  if (action === "devolver" && extra?.observaciones_revision) {
    updateData.observaciones_revision = extra.observaciones_revision;
    updateData.devuelto_en = new Date().toISOString();
  }

  // Si se re-inicia tras devolución, limpiar observaciones
  if (action === "iniciar_visita") {
    // No limpiar — el banner las muestra hasta que se resuelvan
  }

  await db.visitas.update(visitaId, updateData);

  // Sincronizar estado del pipeline de la solicitud
  const newPipelineEstado = SOLICITUD_SYNC[actionDef.target];
  if (newPipelineEstado && visita.solicitud_id) {
    await db.solicitudes.update(visita.solicitud_id, {
      pipeline_estado: newPipelineEstado as Solicitud["pipeline_estado"],
    });
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
