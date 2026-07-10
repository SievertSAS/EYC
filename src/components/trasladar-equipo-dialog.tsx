"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import { useRole } from "@/components/role-provider";
import { trasladarEquipo } from "@/lib/workflow/equipo-service";
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
import { Loader2, MapPin } from "lucide-react";

// ============================================================
//  Dialog para trasladar un equipo a otra ubicación
//  (de cualquier cliente). Cascada cliente → sede → ubicación.
//  Registra el movimiento vía trasladarEquipo().
// ============================================================

interface TrasladarEquipoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipoId: string;
  /** Ubicación actual del equipo — se excluye como destino */
  ubicacionActualId?: string;
  /** Texto de referencia de la ubicación actual (cliente / sede / servicio) */
  ubicacionActualLabel?: string;
  onTrasladado?: () => void;
}

const labelClass = "text-xs font-black text-slate-600 uppercase tracking-wider";
const triggerClass =
  "w-full rounded-xl border-slate-200 h-11 data-[size=default]:h-11 font-medium data-[placeholder]:text-slate-400";

export function TrasladarEquipoDialog({
  open,
  onOpenChange,
  equipoId,
  ubicacionActualId,
  ubicacionActualLabel,
  onTrasladado,
}: TrasladarEquipoDialogProps) {
  const { isReady } = useDb();
  const { role } = useRole();

  const [clienteId, setClienteId] = useState("");
  const [sedeId, setSedeId] = useState("");
  const [ubicacionId, setUbicacionId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientes = useLiveQuery(
    () =>
      isReady
        ? db.clientes
            .toArray()
            .then((cs) => cs.sort((a, b) => a.nombre_cliente.localeCompare(b.nombre_cliente, "es")))
        : [],
    [isReady],
    []
  );

  const sedes = useLiveQuery(
    () => (isReady && clienteId ? db.sedes.where("cliente_id").equals(clienteId).toArray() : []),
    [isReady, clienteId],
    []
  );

  const ubicaciones = useLiveQuery(
    () => (isReady && sedeId ? db.ubicaciones_rx.where("sede_id").equals(sedeId).toArray() : []),
    [isReady, sedeId],
    []
  );

  function resetForm() {
    setClienteId("");
    setSedeId("");
    setUbicacionId("");
    setMotivo("");
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (next) resetForm();
    onOpenChange(next);
  }

  async function handleTrasladar() {
    if (!ubicacionId) return;
    setSaving(true);
    setError(null);
    try {
      const result = await trasladarEquipo(equipoId, ubicacionId, {
        motivo,
        registradoPorId: role?.usuarioId,
      });
      if (result.success) {
        resetForm();
        onOpenChange(false);
        onTrasladado?.();
      } else {
        setError(result.error ?? "No se pudo trasladar el equipo");
      }
    } finally {
      setSaving(false);
    }
  }

  const destinoInvalido = !ubicacionId || ubicacionId === ubicacionActualId;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-3xl border-none shadow-2xl p-0 overflow-hidden sm:max-w-md">
        <DialogHeader className="bg-gradient-to-br from-primary/5 to-primary/10 p-6 border-b border-primary/10">
          <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">
            Trasladar Equipo
          </DialogTitle>
          <DialogDescription className="text-slate-500 font-medium text-sm">
            Mueve el equipo a otra ubicación. Su histórico de visitas e informes se conserva.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4">
          {ubicacionActualLabel && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                  Ubicación actual
                </p>
                <p className="text-sm font-bold text-slate-700">{ubicacionActualLabel}</p>
              </div>
            </div>
          )}

          {/* Cliente destino */}
          <div className="space-y-2">
            <Label className={labelClass}>Cliente destino</Label>
            <Combobox
              items={clientes}
              itemToStringLabel={(c) => c.nombre_cliente}
              value={clientes.find((c) => c.id === clienteId) ?? null}
              onValueChange={(c) => {
                setClienteId(c?.id ?? "");
                setSedeId("");
                setUbicacionId("");
              }}
            >
              <ComboboxTrigger className={triggerClass}>
                <ComboboxValue placeholder="Seleccionar cliente..." />
              </ComboboxTrigger>
              <ComboboxContent>
                <ComboboxInput placeholder="Buscar cliente..." />
                <ComboboxEmpty>Sin resultados.</ComboboxEmpty>
                <ComboboxList>
                  {(c: { id?: string; nombre_cliente: string }) => (
                    <ComboboxItem key={c.id} value={c}>
                      {c.nombre_cliente}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>

          {/* Sede destino */}
          <div className="space-y-2">
            <Label className={labelClass}>Sede destino</Label>
            <Combobox
              items={sedes}
              itemToStringLabel={(s) => s.nombre_sede}
              value={sedes.find((s) => s.id === sedeId) ?? null}
              onValueChange={(s) => {
                setSedeId(s?.id ?? "");
                setUbicacionId("");
              }}
              disabled={!clienteId}
            >
              <ComboboxTrigger className={triggerClass}>
                <ComboboxValue placeholder={clienteId ? "Seleccionar sede..." : "Elige cliente"} />
              </ComboboxTrigger>
              <ComboboxContent>
                <ComboboxInput placeholder="Buscar sede..." />
                <ComboboxEmpty>Sin resultados.</ComboboxEmpty>
                <ComboboxList>
                  {(s: { id?: string; nombre_sede: string }) => (
                    <ComboboxItem key={s.id} value={s}>
                      {s.nombre_sede}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>

          {/* Ubicación destino */}
          <div className="space-y-2">
            <Label className={labelClass}>Ubicación destino</Label>
            <Combobox
              items={ubicaciones}
              itemToStringLabel={(u) => u.nombre_servicio}
              value={ubicaciones.find((u) => u.id === ubicacionId) ?? null}
              onValueChange={(u) => setUbicacionId(u?.id ?? "")}
              disabled={!sedeId}
            >
              <ComboboxTrigger className={triggerClass}>
                <ComboboxValue placeholder={sedeId ? "Seleccionar ubicación..." : "Elige sede"} />
              </ComboboxTrigger>
              <ComboboxContent>
                <ComboboxInput placeholder="Buscar ubicación..." />
                <ComboboxEmpty>Sin resultados.</ComboboxEmpty>
                <ComboboxList>
                  {(u: { id?: string; nombre_servicio: string }) => (
                    <ComboboxItem key={u.id} value={u}>
                      {u.nombre_servicio}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            {ubicacionId && ubicacionId === ubicacionActualId && (
              <p className="text-[11px] font-bold text-amber-600">
                Esta es la ubicación actual del equipo.
              </p>
            )}
          </div>

          {/* Motivo */}
          <div className="space-y-2">
            <Label className={labelClass}>Motivo (opcional)</Label>
            <textarea
              className="w-full rounded-xl border border-slate-200 p-2.5 text-sm font-medium resize-none h-20 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Ej: reubicación por remodelación, venta del equipo…"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl text-sm font-medium bg-red-50 text-red-600 border border-red-200">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="p-6 pt-0 flex justify-end gap-3 border-none bg-transparent">
          <Button
            variant="ghost"
            className="rounded-xl font-black"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            className="rounded-xl font-black bg-primary hover:bg-primary/90 text-white"
            disabled={saving || destinoInvalido}
            onClick={handleTrasladar}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Trasladando...
              </>
            ) : (
              "Trasladar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
