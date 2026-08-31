"use client";

import { useState } from "react";
import { useReseedOnOpen } from "@/hooks/use-reseed-on-open";
import { cancelarSolicitud } from "@/lib/workflow/cancelar-solicitud";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Ban, AlertTriangle } from "lucide-react";

// ============================================================
//  Dialog para cancelar una solicitud (#64)
//  Motivo obligatorio. La regla sobre las visitas hijas (bloquear si hay
//  alguna iniciada, cascada soft-delete si solo hay `asignada`) vive en
//  cancelarSolicitud().
// ============================================================

interface CancelarSolicitudDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solicitudId: string;
  usuarioId: string;
  /** Cantidad de visitas `asignada` que se cancelarían en cascada — para avisar. */
  visitasAsignadas?: number;
  onCancelada?: () => void;
}

const labelClass = "text-xs font-black text-slate-600 uppercase tracking-wider";

export function CancelarSolicitudDialog({
  open,
  onOpenChange,
  solicitudId,
  usuarioId,
  visitasAsignadas = 0,
  onCancelada,
}: CancelarSolicitudDialogProps) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useReseedOnOpen(open, () => {
    setMotivo("");
    setError("");
  });

  async function handleConfirm() {
    setError("");
    setSaving(true);
    try {
      const r = await cancelarSolicitud(solicitudId, { motivo, usuarioId });
      if (!r.success) {
        setError(r.error ?? "No se pudo cancelar la solicitud");
        return;
      }
      onOpenChange(false);
      onCancelada?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-black flex items-center gap-2">
            <Ban className="w-4 h-4 text-red-500" /> Cancelar solicitud
          </DialogTitle>
          <DialogDescription>
            La solicitud pasa a estado <b>Cancelada</b> y sale del pipeline activo. Queda registrado
            quién la canceló y por qué. No se puede si alguna visita ya se inició.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {visitasAsignadas > 0 && (
            <div className="flex gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <span>
                Se cancelarán también {visitasAsignadas} visita{visitasAsignadas > 1 ? "s" : ""}{" "}
                asignada{visitasAsignadas > 1 ? "s" : ""} (todavía sin iniciar).
              </span>
            </div>
          )}

          <div className="space-y-2">
            <Label className={labelClass}>Motivo</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Por qué se cancela (obligatorio)"
              className="rounded-xl"
              rows={3}
            />
          </div>

          {error && (
            <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            className="rounded-xl font-bold"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Volver
          </Button>
          <Button
            className="rounded-xl font-black bg-red-500 hover:bg-red-600 text-white"
            onClick={handleConfirm}
            disabled={saving || !motivo.trim()}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Cancelar solicitud
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
