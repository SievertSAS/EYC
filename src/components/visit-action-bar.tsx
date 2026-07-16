"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Play,
  CheckCircle2,
  FileText,
  Send,
  BadgeCheck,
  RotateCcw,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useRole } from "@/components/role-provider";
import {
  getAvailableActions,
  executeTransition,
  checkGate,
  type ActionDefinition,
  type GateResult,
} from "@/lib/workflow/visit-state-machine";
import type { EstadoVisita } from "@/lib/db/types";

// ============================================================
//  Barra de acciones para el ciclo de vida de la visita
//  Sticky en mobile, inline en desktop
// ============================================================

const ICONS: Record<string, React.ElementType> = {
  Play,
  CheckCircle2,
  FileText,
  Send,
  BadgeCheck,
  RotateCcw,
};

const VARIANT_CLASSES: Record<string, string> = {
  primary: "bg-primary hover:bg-primary/90 text-white",
  success: "bg-emerald-600 hover:bg-emerald-700 text-white",
  warning: "bg-amber-500 hover:bg-amber-600 text-white",
  destructive: "bg-red-500 hover:bg-red-600 text-white",
};

interface VisitActionBarProps {
  visitaId: string;
  estadoVisita: EstadoVisita;
  /** Callback tras una transición exitosa */
  onTransition?: (newState: EstadoVisita) => void;
  /** Info de progreso para mostrar junto al botón */
  progressText?: string;
}

export function VisitActionBar({
  visitaId,
  estadoVisita,
  onTransition,
  progressText,
}: VisitActionBarProps) {
  const { role } = useRole();
  const [loading, setLoading] = useState(false);
  const [gateErrors, setGateErrors] = useState<GateResult | null>(null);
  const [pendingReasonAction, setPendingReasonAction] = useState<ActionDefinition | null>(null);
  const [razon, setRazon] = useState("");

  if (!role) return null;

  const actions = getAvailableActions(estadoVisita, role.cargo);

  if (actions.length === 0) {
    // Estado sin acciones para este rol
    if (estadoVisita === "en_revision" && role.cargo === "tecnico") {
      return (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-sm border-t border-slate-200 md:static md:border-0 md:bg-transparent md:p-0 md:mt-6 z-20">
          <div className="flex items-center justify-center gap-2 py-3 px-4 bg-purple-50 rounded-2xl border border-purple-200">
            <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
            <span className="text-sm font-bold text-purple-700">
              En espera de revisión del ingeniero
            </span>
          </div>
        </div>
      );
    }
    if (estadoVisita === "aprobada" || estadoVisita === "enviada") {
      const label = estadoVisita === "enviada" ? "Informe enviado al cliente" : "Visita aprobada";
      return (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-sm border-t border-slate-200 md:static md:border-0 md:bg-transparent md:p-0 md:mt-6 z-20">
          <div className="flex items-center justify-center gap-2 py-3 px-4 bg-emerald-50 rounded-2xl border border-emerald-200">
            <BadgeCheck className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-bold text-emerald-700">{label}</span>
          </div>
        </div>
      );
    }
    return null;
  }

  async function runTransition(actionDef: ActionDefinition, observaciones?: string) {
    if (!role) return;
    setGateErrors(null);
    setLoading(true);

    try {
      if (actionDef.hasGate) {
        const gate = await checkGate(visitaId, actionDef.action);
        if (!gate.canProceed) {
          setGateErrors(gate);
          setLoading(false);
          return;
        }
      }

      const result = await executeTransition(visitaId, actionDef.action, role.cargo, {
        observaciones_revision: observaciones,
        usuarioId: role.usuarioId,
      });

      if (result.success) {
        setPendingReasonAction(null);
        setRazon("");
        onTransition?.(result.newState!);
      } else if (result.gateResult) {
        setGateErrors(result.gateResult);
      }
    } catch (err) {
      console.error("[VisitActionBar] Error en transición:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleAction(actionDef: ActionDefinition) {
    if (actionDef.requiereRazon) {
      setGateErrors(null);
      setPendingReasonAction(actionDef);
      return;
    }
    void runTransition(actionDef);
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-sm border-t border-slate-200 md:static md:border-0 md:bg-transparent md:p-0 md:mt-6 z-20">
      {/* Errores de gate */}
      {gateErrors && !gateErrors.canProceed && (
        <div className="mb-3 p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="text-sm font-black text-amber-800">Módulos incompletos</span>
          </div>
          <ul className="space-y-1 ml-6">
            {gateErrors.errors.map((err) => (
              <li key={err.moduleId} className="text-xs text-amber-700 font-medium">
                {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Formulario inline de razón (devolver / solicitar ajustes cliente) */}
      {pendingReasonAction && (
        <div className="mb-3 p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-3">
          <p className="text-sm font-black text-amber-800">{pendingReasonAction.label}</p>
          <Textarea
            value={razon}
            onChange={(e) => setRazon(e.target.value)}
            placeholder="Describe el motivo..."
            className="rounded-xl bg-white"
            rows={3}
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              className="rounded-xl font-bold"
              onClick={() => {
                setPendingReasonAction(null);
                setRazon("");
              }}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              className={`rounded-xl font-black ${VARIANT_CLASSES[pendingReasonAction.variant] ?? VARIANT_CLASSES.warning}`}
              onClick={() => runTransition(pendingReasonAction, razon.trim())}
              disabled={loading || !razon.trim()}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RotateCcw className="w-4 h-4 mr-2" />
              )}
              Confirmar
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        {progressText && (
          <span className="text-xs font-bold text-slate-500 hidden md:block">{progressText}</span>
        )}

        <div className="flex gap-2 flex-1 md:flex-none md:ml-auto">
          {actions.map((actionDef) => {
            const Icon = ICONS[actionDef.icon] ?? Play;
            return (
              <Button
                key={actionDef.action}
                onClick={() => handleAction(actionDef)}
                disabled={loading}
                className={`flex-1 md:flex-none rounded-xl font-black h-12 px-6 ${
                  VARIANT_CLASSES[actionDef.variant] ?? VARIANT_CLASSES.primary
                }`}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Icon className="w-4 h-4 mr-2" />
                )}
                {actionDef.label}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
