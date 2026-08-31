"use client";

import { useState } from "react";
import { useReseedOnOpen } from "@/hooks/use-reseed-on-open";
import { reprogramarVisita } from "@/lib/workflow/reprogramar-visita";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
import { Loader2, CalendarClock } from "lucide-react";

// ============================================================
//  Dialog para reprogramar una visita `asignada` (#64)
//  Fecha + técnico + motivo obligatorio. La lógica (traza, sync de la
//  solicitud padre, gate de estado) vive en reprogramarVisita().
// ============================================================

interface TecnicoLite {
  id?: string;
  nombre: string;
}

interface ReprogramarVisitaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitaId: string;
  tecnicos: TecnicoLite[];
  usuarioId: string;
  /** Valores actuales de la visita, para precargar el form. */
  fechaActual?: string;
  tecnicoActualId?: string;
  onReprogramada?: () => void;
}

const labelClass = "text-xs font-black text-slate-600 uppercase tracking-wider";

export function ReprogramarVisitaDialog({
  open,
  onOpenChange,
  visitaId,
  tecnicos,
  usuarioId,
  fechaActual,
  tecnicoActualId,
  onReprogramada,
}: ReprogramarVisitaDialogProps) {
  const [fecha, setFecha] = useState("");
  const [tecnicoId, setTecnicoId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useReseedOnOpen(open, () => {
    setFecha(fechaActual ?? "");
    setTecnicoId(tecnicoActualId ?? "");
    setMotivo("");
    setError("");
  });

  const tecnicoSel = tecnicos.find((t) => t.id === tecnicoId) ?? null;

  async function handleConfirm() {
    setError("");
    setSaving(true);
    try {
      const r = await reprogramarVisita(visitaId, {
        fechaVisita: fecha,
        tecnicoId,
        motivo,
        usuarioId,
      });
      if (!r.success) {
        setError(r.error ?? "No se pudo reprogramar la visita");
        return;
      }
      onOpenChange(false);
      onReprogramada?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-black flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-primary" /> Reprogramar visita
          </DialogTitle>
          <DialogDescription>
            Cambia la fecha y el técnico. Queda registrado quién reprogramó y por qué. Solo
            disponible mientras la visita no se haya iniciado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className={labelClass}>Nueva fecha</Label>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label className={labelClass}>Técnico asignado</Label>
            <Combobox
              items={tecnicos}
              itemToStringLabel={(t: TecnicoLite) => t.nombre}
              value={tecnicoSel}
              onValueChange={(t: TecnicoLite | null) => setTecnicoId(t?.id ?? "")}
            >
              <ComboboxTrigger className="w-full rounded-xl border-slate-200 h-11 data-[placeholder]:text-slate-400">
                <ComboboxValue placeholder="Seleccionar técnico..." />
              </ComboboxTrigger>
              <ComboboxContent>
                <ComboboxInput placeholder="Buscar técnico..." />
                <ComboboxEmpty>Sin resultados.</ComboboxEmpty>
                <ComboboxList>
                  {(t: TecnicoLite) => (
                    <ComboboxItem key={t.id} value={t}>
                      {t.nombre}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>

          <div className="space-y-2">
            <Label className={labelClass}>Motivo</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Por qué se reprograma (obligatorio)"
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
            Cancelar
          </Button>
          <Button
            className="rounded-xl font-black bg-primary hover:bg-primary/90 text-white"
            onClick={handleConfirm}
            disabled={saving || !fecha || !tecnicoId || !motivo.trim()}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Reprogramar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
