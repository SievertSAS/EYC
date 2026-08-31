"use client";

import { useState } from "react";
import { useReseedOnOpen } from "@/hooks/use-reseed-on-open";
import { db } from "@/lib/db";
import {
  TIPOS_EQUIPO,
  SISTEMAS_ADQUISICION,
  type Equipo,
  type Tubo,
  type Colimador,
  type Gantry,
  type TipoEquipo,
} from "@/lib/db/types";
import { randomUUID } from "@/lib/uuid";
import { parseDecimal } from "@/lib/decimal";
import { pushSingle } from "@/lib/supabase/sync-engine";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";

// ============================================================
//  Dialog para crear / editar un equipo (multi-sección)
//  Incluye sub-formularios para Tubo, Colimador, Gantry
// ============================================================

interface EquipoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ubicacionId: string;
  equipo?: Equipo;
  onSaved?: () => void;
}

const TIPO_LABELS: Record<string, string> = {
  CONVENCIONAL: "Convencional",
  CT: "CT (Tomógrafo)",
  CT_DENTAL: "CT Dental",
  MAMOGRAFO: "Mamógrafo",
  PANORAMICO: "Panorámico",
  PERIAPICAL: "Periapical",
  PERIAPICAL_PORTATIL: "Periapical Portátil",
  RX_PORTATIL: "RX Portátil",
  ARCOENC: "Arco en C",
  FLUOROSCOPIOS: "Fluoroscopio",
  DENSITOMETRO: "Densitómetro",
  ANGIOGRAFO: "Angiógrafo",
  INDUSTRIAL: "Industrial",
  VETERINARIO: "Veterinario",
  MULTIPROPOSITO: "Multipropósito",
  LITOTRIPTOR: "Litotriptor",
  VARIOS_RX: "Varios RX",
};

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <span className="text-xs font-black text-slate-600 uppercase tracking-wider">{title}</span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>
      {open && <div className="p-3 space-y-3">{children}</div>}
    </div>
  );
}

export function EquipoFormDialog({
  open,
  onOpenChange,
  ubicacionId,
  equipo,
  onSaved,
}: EquipoFormDialogProps) {
  const isEdit = !!equipo;

  // ─── Equipo fields ───
  const [tipoEquipo, setTipoEquipo] = useState<string>(equipo?.tipo_equipo ?? "");
  const [sistemaAdq, setSistemaAdq] = useState(equipo?.sistema_adquisicion ?? "");
  const [distanciaFoco, setDistanciaFoco] = useState(
    equipo?.distancia_foco_paciente?.toString() ?? ""
  );
  const [bucky, setBucky] = useState(equipo?.bucky ?? "");

  // Generador (en la práctica son los datos del equipo — un solo aparato físico)
  const [genMarca, setGenMarca] = useState(equipo?.gen_marca ?? "");
  const [genModelo, setGenModelo] = useState(equipo?.gen_modelo ?? "");
  const [genSerie, setGenSerie] = useState(equipo?.gen_numero_serie ?? "");
  const [genFechaFab, setGenFechaFab] = useState(equipo?.gen_fecha_fabricacion ?? "");
  const [genFase, setGenFase] = useState(equipo?.gen_fase ?? "");

  // Filtración
  const [filtInherente, setFiltInherente] = useState(
    equipo?.filtracion_inherente_mmal?.toString() ?? ""
  );
  const [filtAnadida, setFiltAnadida] = useState(equipo?.filtracion_anadida_mmal?.toString() ?? "");

  // ─── Tubo fields ───
  const [tuboId, setTuboId] = useState<string | undefined>(undefined);
  const [tuboMarca, setTuboMarca] = useState("");
  const [tuboModelo, setTuboModelo] = useState("");
  const [tuboSerie, setTuboSerie] = useState("");
  const [tuboTipo, setTuboTipo] = useState("");
  const [tuboMasMax, setTuboMasMax] = useState("");
  const [tuboKvMax, setTuboKvMax] = useState("");
  const [tuboMaMax, setTuboMaMax] = useState("");
  const [tuboFocoFino, setTuboFocoFino] = useState("");
  const [tuboFocoGrueso, setTuboFocoGrueso] = useState("");

  // ─── Colimador fields ───
  const [colId, setColId] = useState<string | undefined>(undefined);
  const [colMarca, setColMarca] = useState("");
  const [colModelo, setColModelo] = useState("");
  const [colSerie, setColSerie] = useState("");

  // ─── Gantry fields ───
  const [gantryId, setGantryId] = useState<string | undefined>(undefined);
  const [gantryMarca, setGantryMarca] = useState("");
  const [gantryModelo, setGantryModelo] = useState("");
  const [gantrySerie, setGantrySerie] = useState("");
  const [gantryDetector, setGantryDetector] = useState("");

  const [saving, setSaving] = useState(false);

  // Repoblar el form al reabrir (el padre controla `open` directo). Solo en
  // la transición de apertura — ver useReseedOnOpen (#11).
  useReseedOnOpen(open, () => {
    void (async () => {
      setTipoEquipo(equipo?.tipo_equipo ?? "");
      setSistemaAdq(equipo?.sistema_adquisicion ?? "");
      setDistanciaFoco(equipo?.distancia_foco_paciente?.toString() ?? "");
      setBucky(equipo?.bucky ?? "");
      setGenMarca(equipo?.gen_marca ?? "");
      setGenModelo(equipo?.gen_modelo ?? "");
      setGenSerie(equipo?.gen_numero_serie ?? "");
      setGenFechaFab(equipo?.gen_fecha_fabricacion ?? "");
      setGenFase(equipo?.gen_fase ?? "");
      setFiltInherente(equipo?.filtracion_inherente_mmal?.toString() ?? "");
      setFiltAnadida(equipo?.filtracion_anadida_mmal?.toString() ?? "");

      // Cargar tubo/colimador/gantry existentes del equipo (si los hay) para
      // poder actualizarlos en vez de crear duplicados al guardar. Se ignoran
      // las filas soft-deleted y, si hubiera duplicados preexistentes, se toma
      // siempre el de menor `id` para que la selección sea determinística (#10).
      const primeroVivo = <T extends { id?: string; deleted_at?: string | null }>(
        rows: T[]
      ): T | undefined =>
        rows.filter((r) => !r.deleted_at).sort((a, b) => (a.id ?? "").localeCompare(b.id ?? ""))[0];

      const [tubo, colimador, gantryReg] = equipo?.id
        ? await Promise.all([
            db.tubos.where("equipo_id").equals(equipo.id).toArray().then(primeroVivo),
            db.colimadores.where("equipo_id").equals(equipo.id).toArray().then(primeroVivo),
            db.gantry.where("equipo_id").equals(equipo.id).toArray().then(primeroVivo),
          ])
        : [undefined, undefined, undefined];

      setTuboId(tubo?.id);
      setTuboMarca(tubo?.marca ?? "");
      setTuboModelo(tubo?.modelo ?? "");
      setTuboSerie(tubo?.numero_serie ?? "");
      setTuboTipo(tubo?.tipo ?? "");
      setTuboMasMax(tubo?.mas_max?.toString() ?? "");
      setTuboKvMax(tubo?.kv_max?.toString() ?? "");
      setTuboMaMax(tubo?.ma_max?.toString() ?? "");
      setTuboFocoFino(tubo?.foco_fino_mm?.toString() ?? "");
      setTuboFocoGrueso(tubo?.foco_grueso_mm?.toString() ?? "");

      setColId(colimador?.id);
      setColMarca(colimador?.marca ?? "");
      setColModelo(colimador?.modelo ?? "");
      setColSerie(colimador?.numero_serie ?? "");

      setGantryId(gantryReg?.id);
      setGantryMarca(gantryReg?.marca ?? "");
      setGantryModelo(gantryReg?.modelo ?? "");
      setGantrySerie(gantryReg?.numero_serie ?? "");
      setGantryDetector(gantryReg?.tipo_detector ?? "");
    })();
  });

  async function handleSave() {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const equipoData: Omit<Equipo, "id"> = {
        ubicacion_id: ubicacionId,
        tipo_equipo: (tipoEquipo as TipoEquipo) || undefined,
        planilla_espacial: equipo?.planilla_espacial ?? false,
        sistema_adquisicion: sistemaAdq || undefined,
        distancia_foco_paciente: parseDecimal(distanciaFoco),
        bucky: (bucky as Equipo["bucky"]) || undefined,
        gen_marca: genMarca || undefined,
        gen_modelo: genModelo || undefined,
        gen_numero_serie: genSerie || undefined,
        gen_fecha_fabricacion: genFechaFab || undefined,
        gen_fase: (genFase as Equipo["gen_fase"]) || undefined,
        filtracion_inherente_mmal: parseDecimal(filtInherente),
        filtracion_anadida_mmal: parseDecimal(filtAnadida),
        creado_en: now,
        sync_status: "pending",
        last_modified: now,
      };

      const tuboData: Omit<Tubo, "id"> = {
        equipo_id: "",
        marca: tuboMarca || undefined,
        modelo: tuboModelo || undefined,
        numero_serie: tuboSerie || undefined,
        tipo: tuboTipo || undefined,
        mas_max: parseDecimal(tuboMasMax),
        kv_max: parseDecimal(tuboKvMax),
        ma_max: parseDecimal(tuboMaMax),
        foco_fino_mm: parseDecimal(tuboFocoFino),
        foco_grueso_mm: parseDecimal(tuboFocoGrueso),
        creado_en: now,
        sync_status: "pending",
        last_modified: now,
      };
      const colData: Omit<Colimador, "id"> = {
        equipo_id: "",
        marca: colMarca || undefined,
        modelo: colModelo || undefined,
        numero_serie: colSerie || undefined,
        creado_en: now,
        sync_status: "pending",
        last_modified: now,
      };
      const gantryData: Omit<Gantry, "id"> = {
        equipo_id: "",
        marca: gantryMarca || undefined,
        modelo: gantryModelo || undefined,
        numero_serie: gantrySerie || undefined,
        tipo_detector: gantryDetector || undefined,
        creado_en: now,
        sync_status: "pending",
        last_modified: now,
      };

      const tuboTieneDatos = !!(tuboMarca || tuboModelo || tuboSerie);
      const colTieneDatos = !!(colMarca || colModelo || colSerie);
      const gantryTieneDatos = !!(gantryMarca || gantryModelo || gantrySerie);

      // #10: todos los writes (equipo + hijos) van en una sola transacción,
      // así un fallo a mitad no deja al equipo guardado sin sus hijos (o al
      // revés). Los ids a pushear se acumulan y se envían tras el commit.
      const toPush: Array<[Parameters<typeof pushSingle>[0], string]> = [];

      await db.transaction("rw", [db.equipos, db.tubos, db.colimadores, db.gantry], async () => {
        let equipoId: string;
        if (isEdit && equipo?.id) {
          await db.equipos.update(equipo.id, equipoData);
          equipoId = equipo.id;
        } else {
          equipoId = (await db.equipos.add({ ...equipoData, id: randomUUID() })) as string;
        }
        toPush.push(["equipos", equipoId]);

        // Hijo: si hay datos, crear/actualizar; si el usuario limpió todos los
        // campos y existía una fila, soft-delete (no dejar la fila huérfana).
        type HijoTable = {
          update: (id: string, changes: Record<string, unknown>) => PromiseLike<unknown>;
          add: (obj: Record<string, unknown>) => PromiseLike<unknown>;
        };
        const guardarHijo = async <T extends { equipo_id: string }>(
          nombre: Parameters<typeof pushSingle>[0],
          tabla: HijoTable,
          data: T,
          existingId: string | undefined,
          tieneDatos: boolean
        ) => {
          if (tieneDatos) {
            const payload = { ...data, equipo_id: equipoId };
            if (existingId) {
              await tabla.update(existingId, payload);
              toPush.push([nombre, existingId]);
            } else {
              const nuevoId = (await tabla.add({ ...payload, id: randomUUID() })) as string;
              toPush.push([nombre, nuevoId]);
            }
          } else if (existingId) {
            await tabla.update(existingId, {
              deleted_at: now,
              sync_status: "pending",
              last_modified: now,
            });
            toPush.push([nombre, existingId]);
          }
        };

        await guardarHijo(
          "tubos",
          db.tubos as unknown as HijoTable,
          tuboData,
          tuboId,
          tuboTieneDatos
        );
        await guardarHijo(
          "colimadores",
          db.colimadores as unknown as HijoTable,
          colData,
          colId,
          colTieneDatos
        );
        await guardarHijo(
          "gantry",
          db.gantry as unknown as HijoTable,
          gantryData,
          gantryId,
          gantryTieneDatos
        );
      });

      onOpenChange(false);
      onSaved?.();

      for (const [tabla, id] of toPush) pushSingle(tabla, id);
    } catch (err) {
      console.error("[EquipoForm] Error:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl border-none shadow-2xl p-0 overflow-hidden sm:max-w-xl">
        <DialogHeader className="bg-gradient-to-br from-primary/5 to-primary/10 p-6 border-b border-primary/10">
          <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">
            {isEdit ? "Editar Equipo" : "Nuevo Equipo"}
          </DialogTitle>
          <DialogDescription className="text-slate-500 font-medium text-sm">
            Todos los campos son opcionales. El técnico puede completarlos en visita.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* General */}
          <CollapsibleSection title="General" defaultOpen={true}>
            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                Tipo de Equipo
              </Label>
              <Select value={tipoEquipo} onValueChange={(v) => setTipoEquipo(v ?? "")}>
                <SelectTrigger className="w-full rounded-xl border-slate-200 h-11 data-[size=default]:h-11 font-medium">
                  <SelectValue placeholder="Seleccionar tipo...">
                    {(v) => TIPO_LABELS[v as string] ?? (v as string) ?? "Seleccionar tipo..."}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_EQUIPO.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {TIPO_LABELS[tipo] ?? tipo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  Sistema Adquisición
                </Label>
                <Select value={sistemaAdq} onValueChange={(v) => setSistemaAdq(v ?? "")}>
                  <SelectTrigger className="w-full rounded-xl border-slate-200 h-11 data-[size=default]:h-11 font-medium">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SISTEMAS_ADQUISICION.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  Bucky
                </Label>
                <Select value={bucky} onValueChange={(v) => setBucky(v ?? "")}>
                  <SelectTrigger className="w-full rounded-xl border-slate-200 h-11 data-[size=default]:h-11 font-medium">
                    <SelectValue placeholder="Seleccionar...">
                      {(v) =>
                        ({ Si: "Sí", No: "No", No_aplica: "No aplica" })[v as string] ||
                        "Seleccionar..."
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Si">Sí</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                    <SelectItem value="No_aplica">No aplica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                Distancia Foco-Paciente (cm)
              </Label>
              <Input
                type="number"
                className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                placeholder="100"
                value={distanciaFoco}
                onChange={(e) => setDistanciaFoco(e.target.value)}
              />
            </div>
          </CollapsibleSection>

          {/* Generador */}
          <CollapsibleSection title="Generador" defaultOpen={true}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  Marca
                </Label>
                <Input
                  className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                  placeholder="Marca"
                  value={genMarca}
                  onChange={(e) => setGenMarca(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  Modelo
                </Label>
                <Input
                  className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                  placeholder="Modelo"
                  value={genModelo}
                  onChange={(e) => setGenModelo(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  No. Serie
                </Label>
                <Input
                  className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                  placeholder="Número de serie"
                  value={genSerie}
                  onChange={(e) => setGenSerie(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  Fecha Fabricación
                </Label>
                <Input
                  type="date"
                  className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                  value={genFechaFab}
                  onChange={(e) => setGenFechaFab(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                Fase
              </Label>
              <Select value={genFase} onValueChange={(v) => setGenFase(v ?? "")}>
                <SelectTrigger className="w-full rounded-xl border-slate-200 h-11 data-[size=default]:h-11 font-medium">
                  <SelectValue placeholder="Seleccionar fase...">
                    {(v) =>
                      ({
                        monofasico: "Monofásico",
                        trifasico: "Trifásico",
                        alta_frecuencia: "Alta Frecuencia",
                      })[v as string] || "Seleccionar fase..."
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monofasico">Monofásico</SelectItem>
                  <SelectItem value="trifasico">Trifásico</SelectItem>
                  <SelectItem value="alta_frecuencia">Alta Frecuencia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CollapsibleSection>

          {/* Filtración */}
          <CollapsibleSection title="Filtración">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  Inherente (mmAl)
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                  placeholder="0.5"
                  value={filtInherente}
                  onChange={(e) => setFiltInherente(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  Añadida (mmAl)
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                  placeholder="1.0"
                  value={filtAnadida}
                  onChange={(e) => setFiltAnadida(e.target.value)}
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* Tubo */}
          <CollapsibleSection title="Tubo de Rayos X">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  Marca
                </Label>
                <Input
                  className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                  value={tuboMarca}
                  onChange={(e) => setTuboMarca(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  Modelo
                </Label>
                <Input
                  className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                  value={tuboModelo}
                  onChange={(e) => setTuboModelo(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  No. Serie
                </Label>
                <Input
                  className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                  value={tuboSerie}
                  onChange={(e) => setTuboSerie(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  Tipo
                </Label>
                <Input
                  className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                  placeholder="Ej: Convencional"
                  value={tuboTipo}
                  onChange={(e) => setTuboTipo(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  mAs Max
                </Label>
                <Input
                  type="number"
                  className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                  value={tuboMasMax}
                  onChange={(e) => setTuboMasMax(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  kV Max
                </Label>
                <Input
                  type="number"
                  className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                  value={tuboKvMax}
                  onChange={(e) => setTuboKvMax(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  mA Max
                </Label>
                <Input
                  type="number"
                  className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                  value={tuboMaMax}
                  onChange={(e) => setTuboMaMax(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  Foco Fino (mm)
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                  value={tuboFocoFino}
                  onChange={(e) => setTuboFocoFino(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  Foco Grueso (mm)
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                  value={tuboFocoGrueso}
                  onChange={(e) => setTuboFocoGrueso(e.target.value)}
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* Colimador */}
          <CollapsibleSection title="Colimador">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  Marca
                </Label>
                <Input
                  className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                  value={colMarca}
                  onChange={(e) => setColMarca(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  Modelo
                </Label>
                <Input
                  className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                  value={colModelo}
                  onChange={(e) => setColModelo(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  No. Serie
                </Label>
                <Input
                  className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                  value={colSerie}
                  onChange={(e) => setColSerie(e.target.value)}
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* Gantry (CT) */}
          <CollapsibleSection title="Gantry (CT)">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  Marca
                </Label>
                <Input
                  className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                  value={gantryMarca}
                  onChange={(e) => setGantryMarca(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  Modelo
                </Label>
                <Input
                  className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                  value={gantryModelo}
                  onChange={(e) => setGantryModelo(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  No. Serie
                </Label>
                <Input
                  className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                  value={gantrySerie}
                  onChange={(e) => setGantrySerie(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  Tipo Detector
                </Label>
                <Input
                  className="rounded-xl border-slate-200 focus:border-primary font-medium h-11"
                  placeholder="Ej: Flat Panel"
                  value={gantryDetector}
                  onChange={(e) => setGantryDetector(e.target.value)}
                />
              </div>
            </div>
          </CollapsibleSection>
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
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Guardando...
              </>
            ) : isEdit ? (
              "Guardar"
            ) : (
              "Agregar Equipo"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
