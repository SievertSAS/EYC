"use client";

import { useState, useCallback, useRef } from "react";
import { randomUUID } from "@/lib/uuid";
import { parseDecimal, decimalInputValue } from "@/lib/decimal";
import { useLiveQuery } from "dexie-react-hooks";
import { db, noBorrado } from "@/lib/db";
import { SISTEMAS_ADQUISICION } from "@/lib/db/types";
import type { EquipoIdentificacion, Sede } from "@/lib/db/types";
import { matchIdPorNombre } from "@/lib/divipola";
import { useImagenSrc } from "@/hooks/use-imagen-src";
import { ImagenConTitulo } from "@/components/imagen-con-titulo";
import { useDb } from "@/components/db-provider";
import { useRole } from "@/components/role-provider";
import { pushSingle } from "@/lib/supabase/sync-engine";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  ArrowLeft,
  Building2,
  MapPin,
  Radio,
  Ruler,
  Shield,
  User,
  Phone,
  Mail,
  FileText,
  Loader2,
  AlertCircle,
  Hash,
  Calendar,
  Zap,
  Check,
  Thermometer,
  Activity,
  Users,
  Eye,
  Plus,
  Trash2,
} from "lucide-react";
import { irAModulo } from "@/lib/modulo-nav";

// ─── Helpers ───

function isEmpty(v: unknown): boolean {
  return v == null || v === "" || (typeof v === "number" && isNaN(v));
}

function toStr(v: string | number | undefined | null): string {
  if (v == null || v === "") return "";
  return String(v);
}

function computeProgress(values: unknown[]): number {
  if (values.length === 0) return 100;
  const filled = values.filter((v) => !isEmpty(v)).length;
  return Math.round((filled / values.length) * 100);
}

// ─── Editable Field (own hook scope) ───

function EditableField({
  label,
  value,
  icon: Icon,
  onSave,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  onSave: (v: string) => void;
  type?: "text" | "number" | "date";
  /**
   * Columna NOT NULL: si se deja en blanco NO se guarda y el campo revierte al
   * valor actual. Dejar `undefined` una columna obligatoria rompe el push a
   * Supabase con `23502 not_null_violation` y la fila queda atascada en error.
   */
  required?: boolean;
}) {
  // #68: los campos numéricos se muestran con coma decimal (es-CO) y aceptan
  // coma o punto. El input real es `text` + `inputMode=decimal` (evita la
  // "ruleta de locale" de `type=number`). `onSave` recibe el string crudo;
  // el caller lo pasa por `parseDecimal`.
  const esNumero = type === "number";
  const paraMostrar = (v: string) => (esNumero ? decimalInputValue(parseDecimal(v)) : v);

  const [local, setLocal] = useState(() => paraMostrar(value));
  const [prevValue, setPrevValue] = useState(value);
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Sincronizar `local` cuando el valor externo cambia (guardado remoto,
  // sync entre dispositivos): ajuste de estado en render, no en efecto.
  if (value !== prevValue) {
    setPrevValue(value);
    setLocal(paraMostrar(value));
  }

  const handleChange = useCallback(
    (v: string) => {
      setLocal(v);
      setSaved(false);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (required && !v.trim()) {
          // Campo obligatorio: no se puede dejar en blanco. Revertir al valor real.
          setLocal(paraMostrar(value));
          return;
        }
        onSave(v);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }, 800);
    },
    [onSave, required, value]
  );

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
        {saved && <Check className="w-3 h-3 text-emerald-500" />}
      </p>
      <Input
        type={esNumero ? "text" : type}
        inputMode={esNumero ? "decimal" : undefined}
        className="rounded-xl border-slate-200 focus:border-primary font-medium h-9 text-sm"
        value={local}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="—"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  icon: Icon,
  options,
  onSave,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  options: { label: string; value: string }[];
  onSave: (v: string) => void;
}) {
  const [saved, setSaved] = useState(false);

  function handleChange(v: string) {
    onSave(v);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
        {saved && <Check className="w-3 h-3 text-emerald-500" />}
      </p>
      <select
        className="w-full rounded-xl border border-slate-200 focus:border-primary font-medium h-9 text-sm px-3 bg-white text-slate-800"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// Ciudad / Departamento en Condiciones Ambientales: precarga lo que la sede
// ya tenga definido (id del catálogo DIVIPOLA, o texto plano de sedes viejas)
// y deja elegir de la lista. Escribe id + nombre denormalizado sobre la sede.
function GeoAmbientalFields({
  sede,
  onSave,
}: {
  sede: Sede | undefined;
  onSave: (patch: Partial<Sede>) => void;
}) {
  const [deptoOverride, setDeptoOverride] = useState<string | null>(null);
  const [muniOverride, setMuniOverride] = useState<string | null>(null);

  const departamentos =
    useLiveQuery(
      async () =>
        (await db.departamentos.toArray()).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
      []
    ) ?? [];

  const deptoId =
    deptoOverride ??
    (sede?.departamento_id
      ? String(sede.departamento_id)
      : matchIdPorNombre(departamentos, sede?.departamento));

  const municipios =
    useLiveQuery(
      async () =>
        deptoId
          ? (
              await db.municipios.where("departamento_id").equals(parseInt(deptoId, 10)).toArray()
            ).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
          : [],
      [deptoId]
    ) ?? [];

  const muniId =
    muniOverride ??
    (sede?.municipio_id ? String(sede.municipio_id) : matchIdPorNombre(municipios, sede?.ciudad));

  const catalogoListo = departamentos.length > 0;

  if (!catalogoListo) {
    // Catálogo aún no sincronizado — texto libre como antes.
    return (
      <>
        <EditableField
          label="Departamento"
          value={sede?.departamento ?? ""}
          icon={MapPin}
          onSave={(v) => onSave({ departamento: v || undefined })}
        />
        <EditableField
          label="Ciudad"
          value={sede?.ciudad ?? ""}
          icon={MapPin}
          onSave={(v) => onSave({ ciudad: v || undefined })}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-1">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <MapPin className="w-3 h-3" />
          Departamento
        </p>
        <Combobox
          items={departamentos}
          itemToStringLabel={(d) => d.nombre}
          value={departamentos.find((d) => String(d.id) === deptoId) ?? null}
          onValueChange={(d) => {
            setDeptoOverride(d ? String(d.id) : "");
            setMuniOverride("");
            onSave({
              departamento_id: d?.id,
              departamento: d?.nombre,
              municipio_id: undefined,
              ciudad: undefined,
            });
          }}
        >
          <ComboboxTrigger className="w-full rounded-xl border border-slate-200 focus:border-primary font-medium h-9 text-sm px-3 bg-white text-slate-800 data-[placeholder]:text-slate-400">
            <ComboboxValue placeholder="Seleccionar..." />
          </ComboboxTrigger>
          <ComboboxContent>
            <ComboboxInput placeholder="Buscar departamento..." />
            <ComboboxEmpty>Sin resultados.</ComboboxEmpty>
            <ComboboxList>
              {(d: { id: number; nombre: string }) => (
                <ComboboxItem key={d.id} value={d}>
                  {d.nombre}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <MapPin className="w-3 h-3" />
          Ciudad
        </p>
        <Combobox
          items={municipios}
          itemToStringLabel={(m) => m.nombre}
          value={municipios.find((m) => String(m.id) === muniId) ?? null}
          onValueChange={(m) => {
            setMuniOverride(m ? String(m.id) : "");
            onSave({ municipio_id: m?.id, ciudad: m?.nombre });
          }}
          disabled={!deptoId}
        >
          <ComboboxTrigger className="w-full rounded-xl border border-slate-200 focus:border-primary font-medium h-9 text-sm px-3 bg-white text-slate-800 data-[placeholder]:text-slate-400">
            <ComboboxValue placeholder={deptoId ? "Seleccionar..." : "Elegí departamento"} />
          </ComboboxTrigger>
          <ComboboxContent>
            <ComboboxInput placeholder="Buscar ciudad..." />
            <ComboboxEmpty>Sin resultados.</ComboboxEmpty>
            <ComboboxList>
              {(m: { id: number; nombre: string }) => (
                <ComboboxItem key={m.id} value={m}>
                  {m.nombre}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>
    </>
  );
}

function EditableTextArea({
  label,
  value,
  onSave,
  placeholder = "—",
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Sincronizar `local` cuando el valor externo cambia (guardado remoto,
  // sync entre dispositivos): ajuste de estado en render, no en efecto.
  if (value !== prevValue) {
    setPrevValue(value);
    setLocal(value);
  }

  const handleChange = useCallback(
    (v: string) => {
      setLocal(v);
      setSaved(false);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        onSave(v);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }, 800);
    },
    [onSave]
  );

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
        {label}
        {saved && <Check className="w-3 h-3 text-emerald-500" />}
      </p>
      <textarea
        className="w-full rounded-xl border border-slate-200 p-2.5 text-sm font-medium resize-none h-20 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        value={local}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function ReadonlyField({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number | undefined | null;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const display = !isEmpty(value) ? String(value) : "—";
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </p>
      <p className="text-sm font-bold text-slate-800 h-9 flex items-center">{display}</p>
    </div>
  );
}

/** Una fila de identificación del equipo (#61): resuelve su imagen y delega en <ImagenConTitulo>. */
function IdentificacionRow({
  iden,
  onNombre,
  onCapture,
  onRemoveImagen,
  onDelete,
}: {
  iden: EquipoIdentificacion;
  /** Si se omite, la fila es solo imagen (foto de referencia de una sección). */
  onNombre?: (value: string) => void;
  onCapture: (file: File) => void;
  onRemoveImagen?: () => void;
  onDelete?: () => void;
}) {
  const src = useImagenSrc(iden);
  return (
    <ImagenConTitulo
      nombre={iden.nombre ?? ""}
      src={src}
      placeholder="Ej: Placa del fabricante / N.º de inventario"
      onNombreChange={onNombre}
      onCapture={onCapture}
      onRemoveImagen={onRemoveImagen}
      onDelete={onDelete}
    />
  );
}

/** Foto de referencia (placa) de una sección del equipo: generador / tubo / colimador. */
function RefImagenSlot({
  label,
  iden,
  onCapture,
  onRemove,
}: {
  label: string;
  iden: EquipoIdentificacion | undefined;
  onCapture: (file: File) => void;
  onRemove: () => void;
}) {
  const src = useImagenSrc(iden ?? {});
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <ImagenConTitulo
        src={src}
        onCapture={onCapture}
        onRemoveImagen={src ? onRemove : undefined}
      />
    </div>
  );
}

// ─── Progress bar ───

function ProgressBar({ percent, label }: { percent: number; label: string }) {
  const color = percent === 100 ? "bg-emerald-500" : percent >= 50 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
        <div
          className={`${color} h-2 rounded-full transition-all duration-500`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-[11px] font-black text-slate-500 whitespace-nowrap">
        {percent}% {label}
      </span>
    </div>
  );
}

// ─── Section Card ───

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  progress,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  progress: number;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-none shadow-sm rounded-2xl md:rounded-3xl bg-white overflow-hidden">
      <CardContent className="p-4 sm:p-5 md:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2.5 rounded-xl">
            <Icon className="text-primary w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-slate-900 text-sm sm:text-base">{title}</h3>
            <p className="text-[11px] text-slate-400 font-medium">{subtitle}</p>
          </div>
          <span
            className={`text-xs font-black px-2.5 py-1 rounded-full ${
              progress === 100
                ? "bg-emerald-100 text-emerald-700"
                : progress >= 50
                  ? "bg-amber-100 text-amber-700"
                  : "bg-red-100 text-red-700"
            }`}
          >
            {progress}%
          </span>
        </div>
        <ProgressBar percent={progress} label="completado" />
        {children}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───

export function InfoModulo({ visitaId: id }: { visitaId: string }) {
  const visitaId = id;
  const { isReady } = useDb();
  const { role } = useRole();

  const data = useLiveQuery(async () => {
    if (!isReady || !visitaId) return null;

    const visita = await db.visitas.get(visitaId);
    if (!visita) return null;

    const equipo = visita.equipo_id ? await db.equipos.get(visita.equipo_id) : undefined;
    const ubicacion = visita.ubicacion_id
      ? await db.ubicaciones_rx.get(visita.ubicacion_id)
      : undefined;
    const solicitud = await db.solicitudes.get(visita.solicitud_id);
    const cliente = solicitud ? await db.clientes.get(solicitud.cliente_id) : undefined;
    const sede = ubicacion
      ? await db.sedes.get((await db.ubicaciones_rx.get(ubicacion.id!))?.sede_id ?? "")
      : undefined;

    const tubos = visita.equipo_id
      ? (await db.tubos.where("equipo_id").equals(visita.equipo_id).toArray())
          .filter((t) => !t.deleted_at)
          .sort((a, b) => (a.creado_en ?? "").localeCompare(b.creado_en ?? ""))
      : [];

    const identificaciones = visita.equipo_id
      ? (await db.equipo_identificaciones.where("equipo_id").equals(visita.equipo_id).toArray())
          .filter((r) => !r.deleted_at)
          .sort(
            (a, b) =>
              (a.orden ?? 0) - (b.orden ?? 0) ||
              (a.creado_en ?? "").localeCompare(b.creado_en ?? "")
          )
      : [];

    const contactos = cliente?.id
      ? (await db.contactos.where("cliente_id").equals(cliente.id).toArray()).filter(noBorrado)
      : [];

    return {
      visita,
      equipo,
      ubicacion,
      sede,
      cliente,
      solicitud,
      tubos,
      nroTubos: tubos.length,
      identificaciones,
      contactos,
    };
  }, [isReady, visitaId]);

  // ─── Save helpers (plain functions, no hooks) ───

  function getContacto(cargo: string) {
    return data?.contactos?.find((c) => c.cargo === cargo);
  }

  const now = () => new Date().toISOString();

  // Columnas NOT NULL editables desde Info: dejarlas en blanco (→ `undefined`)
  // rompe el push con `23502 not_null_violation` y la fila queda atascada.
  // Guard de última línea además del `required` de <EditableField>.
  function requeridoVacio(tabla: string, field: string, value: string): boolean {
    const req: Record<string, string[]> = {
      clientes: ["nombre_cliente", "nit"],
      sedes: ["nombre_sede"],
      ubicaciones_rx: ["nombre_servicio"],
    };
    return (req[tabla]?.includes(field) ?? false) && !value.trim();
  }

  async function saveCliente(field: string, value: string) {
    const id = data?.cliente?.id;
    if (!id || requeridoVacio("clientes", field, value)) return;
    await db.clientes.update(id, {
      [field]: value || undefined,
      sync_status: "pending",
      last_modified: now(),
    });
    pushSingle("clientes", id);
  }

  async function saveSede(field: string, value: string) {
    const id = data?.sede?.id;
    if (!id || requeridoVacio("sedes", field, value)) return;
    await db.sedes.update(id, {
      [field]: value || undefined,
      sync_status: "pending",
      last_modified: now(),
    });
    pushSingle("sedes", id);
  }

  // Actualiza varios campos geográficos de la sede a la vez (depto/municipio del
  // catálogo + su nombre denormalizado). `Table.update` con `undefined` borra la
  // clave — acá es lo que queremos al limpiar el municipio.
  async function saveSedeGeo(patch: Partial<Sede>) {
    const id = data?.sede?.id;
    if (!id) return;
    await db.sedes.update(id, {
      ...patch,
      sync_status: "pending",
      last_modified: now(),
    });
    pushSingle("sedes", id);
  }

  async function saveUbicacion(field: string, value: string, numeric = false) {
    const id = data?.ubicacion?.id;
    if (!id || requeridoVacio("ubicaciones_rx", field, value)) return;
    const parsed = numeric ? (value === "" ? undefined : parseDecimal(value)) : value || undefined;
    await db.ubicaciones_rx.update(id, {
      [field]: parsed,
      sync_status: "pending",
      last_modified: now(),
    });
    pushSingle("ubicaciones_rx", id);
  }

  // Guarda una dimensión de la sala y recalcula el área (ancho × largo)
  async function saveUbicacionDim(field: "ancho_m" | "largo_m" | "alto_m", value: string) {
    const id = data?.ubicacion?.id;
    if (!id) return;
    const parsed = value === "" ? undefined : parseDecimal(value);
    const ancho = field === "ancho_m" ? parsed : data?.ubicacion?.ancho_m;
    const largo = field === "largo_m" ? parsed : data?.ubicacion?.largo_m;
    const area = ancho && largo ? Math.round(ancho * largo * 100) / 100 : undefined;
    await db.ubicaciones_rx.update(id, {
      [field]: parsed,
      area_m2: area,
      sync_status: "pending",
      last_modified: now(),
    });
    pushSingle("ubicaciones_rx", id);
  }

  async function saveEquipo(field: string, value: string, numeric = false) {
    const id = data?.equipo?.id;
    if (!id) return;
    const parsed = numeric ? (value === "" ? undefined : parseDecimal(value)) : value || undefined;
    await db.equipos.update(id, { [field]: parsed, sync_status: "pending", last_modified: now() });
    pushSingle("equipos", id);
  }

  async function saveTubo(tuboId: string, field: string, value: string, numeric = false) {
    if (!tuboId) return;
    const parsed = numeric ? (value === "" ? undefined : parseDecimal(value)) : value || undefined;
    await db.tubos.update(tuboId, {
      [field]: parsed,
      sync_status: "pending",
      last_modified: now(),
    });
    pushSingle("tubos", tuboId);
  }

  async function addTubo() {
    const equipoId = data?.equipo?.id;
    if (!equipoId) return;
    const nuevo = {
      id: randomUUID(),
      equipo_id: equipoId,
      creado_en: now(),
      sync_status: "pending" as const,
      last_modified: now(),
    };
    await db.tubos.add(nuevo);
    pushSingle("tubos", nuevo.id);
  }

  async function deleteTubo(tuboId: string) {
    if (!tuboId) return;
    await db.tubos.update(tuboId, {
      deleted_at: now(),
      sync_status: "pending",
      last_modified: now(),
    });
    pushSingle("tubos", tuboId);
  }

  // ─── Identificaciones del equipo (#61) ───
  //  Tabla equipo_identificaciones con `subtabla`:
  //   - generador / tubo / colimador → foto de referencia de esa sección (1 sola)
  //   - otra → entrada libre de la lista "Otras identificaciones"

  async function addIdentificacion() {
    const equipoId = data?.equipo?.id;
    if (!equipoId) return;
    const otras = (data?.identificaciones ?? []).filter((i) => (i.subtabla ?? "otra") === "otra");
    const nueva = {
      id: randomUUID(),
      equipo_id: equipoId,
      subtabla: "otra" as const,
      orden: otras.length + 1,
      creado_en: now(),
      sync_status: "pending" as const,
      last_modified: now(),
    };
    await db.equipo_identificaciones.add(nueva);
    pushSingle("equipo_identificaciones", nueva.id);
  }

  async function saveIdentificacion(idenId: string, patch: Partial<EquipoIdentificacion>) {
    if (!idenId) return;
    await db.equipo_identificaciones.update(idenId, {
      ...patch,
      sync_status: "pending",
      last_modified: now(),
    });
    pushSingle("equipo_identificaciones", idenId);
  }

  async function deleteIdentificacion(idenId: string) {
    if (!idenId) return;
    await db.equipo_identificaciones.update(idenId, {
      deleted_at: now(),
      sync_status: "pending",
      last_modified: now(),
    });
    pushSingle("equipo_identificaciones", idenId);
  }

  /** Foto de referencia de una subtabla (generador/tubo/colimador): crea o reemplaza. */
  const findRef = (subtabla: EquipoIdentificacion["subtabla"], refId?: string) =>
    (data?.identificaciones ?? []).find(
      (i) => i.subtabla === subtabla && (i.ref_id ?? undefined) === refId
    );

  async function captureRefImagen(
    subtabla: EquipoIdentificacion["subtabla"],
    file: File,
    refId?: string
  ) {
    const equipoId = data?.equipo?.id;
    if (!equipoId) return;
    const existente = findRef(subtabla, refId);
    if (existente?.id) {
      await saveIdentificacion(existente.id, { blob_local: file, url_storage: null });
      return;
    }
    const nueva = {
      id: randomUUID(),
      equipo_id: equipoId,
      subtabla,
      ref_id: refId,
      blob_local: file,
      url_storage: null,
      creado_en: now(),
      sync_status: "pending" as const,
      last_modified: now(),
    };
    await db.equipo_identificaciones.add(nueva);
    pushSingle("equipo_identificaciones", nueva.id);
  }

  async function removeRefImagen(subtabla: EquipoIdentificacion["subtabla"], refId?: string) {
    const existente = findRef(subtabla, refId);
    if (existente?.id) await deleteIdentificacion(existente.id);
  }

  async function saveVisita(field: string, value: string, numeric = false) {
    if (!visitaId) return;
    const parsed = numeric ? (value === "" ? undefined : parseDecimal(value)) : value || undefined;
    await db.visitas.update(visitaId, {
      [field]: parsed,
      last_modified: new Date().toISOString(),
      sync_status: "pending",
    });
    pushSingle("visitas", visitaId);
  }

  async function saveContacto(
    cargo: "medico_responsable" | "tecnologo" | "opr" | "responsable_visita",
    field: string,
    value: string
  ) {
    const clienteId = data?.cliente?.id;
    if (!clienteId) return;
    const existing = getContacto(cargo);
    if (existing?.id) {
      await db.contactos.update(existing.id, {
        [field]: value || undefined,
        sync_status: "pending",
        last_modified: now(),
      });
      pushSingle("contactos", existing.id);
    } else {
      const newId = (await db.contactos.add({
        id: randomUUID(),
        cliente_id: clienteId,
        nombre: field === "nombre" ? value : "",
        cargo,
        ...(field !== "nombre" ? { [field]: value || undefined } : {}),
        para_programar: false,
        sync_status: "pending",
        last_modified: now(),
      })) as string;
      pushSingle("contactos", newId);
    }
  }

  // ─── Loading / Error states ───

  if (!isReady || data === undefined) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-slate-500 font-bold">Cargando información...</p>
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="space-y-6">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- navegación dura intencional (ver src/lib/visita-nav.ts): permite offline vía Service Worker */}
        <a
          href="/dashboard/visitas"
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a visitas
        </a>
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="bg-red-100 p-6 rounded-3xl">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <p className="text-slate-500 font-bold text-lg">Visita no encontrada</p>
        </div>
      </div>
    );
  }

  const { visita, equipo, ubicacion, sede, cliente, solicitud, tubos, nroTubos, contactos } = data;
  const identificaciones = data.identificaciones;
  const refImagen = (sub: EquipoIdentificacion["subtabla"], refId?: string) =>
    identificaciones.find((i) => i.subtabla === sub && (i.ref_id ?? undefined) === refId);
  const otrasIdentificaciones = identificaciones.filter((i) => (i.subtabla ?? "otra") === "otra");

  const medico = getContacto("medico_responsable");
  const tecnologo = getContacto("tecnologo");
  const opr = getContacto("opr");
  const respVisita = getContacto("responsable_visita");

  // ─── Progress per section ───

  const progInfoGeneral = computeProgress([
    visita.fecha_visita,
    cliente?.nombre_cliente,
    cliente?.nit,
    sede?.nombre_sede,
    sede?.direccion_sede,
    cliente?.telefono,
    cliente?.naturaleza,
    cliente?.nombre_representante_legal,
    ubicacion?.nombre_servicio,
    medico?.nombre,
    tecnologo?.nombre,
    tecnologo?.email,
    tecnologo?.telefono,
    opr?.nombre,
    cliente?.email,
    respVisita?.nombre,
    respVisita?.cedula,
  ]);

  const progInstalacion = computeProgress([
    ubicacion?.licencia,
    ubicacion?.fecha_expiracion_licencia,
    ubicacion?.codigo_habilitacion,
    visita.dias_laborados_semana,
    visita.pacientes_por_semana,
    visita.kv_maximo_usado,
    visita.porcentaje_rechazo,
    ubicacion?.horas_x_dia,
    visita.max_disparos_paciente,
    visita.mas_maximo_usado,
    visita.radiografias_por_semana,
  ]);

  const progGenerador = computeProgress([
    equipo?.gen_marca,
    equipo?.gen_numero_serie,
    equipo?.gen_modelo,
    equipo?.gen_fecha_fabricacion,
    equipo?.gen_fase,
    equipo?.gen_energia_fotones_mev,
  ]);

  const progTubo = computeProgress([
    tubos[0]?.marca,
    tubos[0]?.modelo,
    tubos[0]?.numero_serie,
    tubos[0]?.tipo,
    tubos[0]?.mas_max,
    tubos[0]?.kv_max,
    tubos[0]?.ma_max,
    tubos[0]?.tiempo_s,
    tubos[0]?.foco_fino_mm,
    tubos[0]?.foco_grueso_mm,
  ]);

  const progColimador = computeProgress([
    equipo?.distancia_foco_paciente,
    equipo?.bucky,
    equipo?.sistema_adquisicion,
    equipo?.filtracion_inherente_mmal,
    equipo?.filtracion_anadida_mmal,
  ]);

  const progCondiciones = computeProgress([
    visita.temperatura_c,
    visita.presion_hpa,
    sede?.ciudad,
    sede?.departamento,
  ]);

  const progSala = computeProgress([ubicacion?.ancho_m, ubicacion?.largo_m, ubicacion?.alto_m]);

  const allValues = [
    progInfoGeneral,
    progInstalacion,
    progGenerador,
    progTubo,
    progColimador,
    progCondiciones,
    progSala,
  ];
  const totalProgress = Math.round(allValues.reduce((a, b) => a + b, 0) / allValues.length);

  return (
    <div className="space-y-6 pb-10">
      <button
        type="button"
        onClick={() => irAModulo(id)}
        className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Volver al workspace
      </button>

      {/* Header con progreso global */}
      <div className="space-y-3">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tighter">
          Información General
        </h2>
        <p className="text-slate-500 font-medium text-sm">
          Completa los datos faltantes de la precarga — estos valores se usan en el informe.
        </p>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-black text-slate-700">Progreso total de la precarga</span>
            <span
              className={`text-lg font-black ${
                totalProgress === 100
                  ? "text-emerald-600"
                  : totalProgress >= 50
                    ? "text-amber-600"
                    : "text-red-500"
              }`}
            >
              {totalProgress}%
            </span>
          </div>
          <ProgressBar percent={totalProgress} label="" />
        </div>
      </div>

      {/* 1. Información General */}
      <SectionCard
        icon={Building2}
        title="Información General"
        subtitle="Datos del cliente, sede y contactos"
        progress={progInfoGeneral}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <EditableField
            label="Fecha de Informe"
            value={toStr(visita.fecha_visita)}
            icon={Calendar}
            type="date"
            onSave={(v) => saveVisita("fecha_visita", v)}
          />
          <EditableField
            label="Nombre de la Institución"
            value={toStr(cliente?.nombre_cliente)}
            icon={Building2}
            required
            onSave={(v) => saveCliente("nombre_cliente", v)}
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <EditableField
                label="NIT"
                value={toStr(cliente?.nit)}
                icon={Hash}
                required
                onSave={(v) => saveCliente("nit", v)}
              />
            </div>
            <div className="w-20">
              <EditableField
                label="Verif."
                value={toStr(cliente?.digito_verificacion)}
                onSave={(v) => saveCliente("digito_verificacion", v)}
              />
            </div>
          </div>
          <EditableField
            label="Sede"
            value={toStr(sede?.nombre_sede)}
            icon={MapPin}
            required
            onSave={(v) => saveSede("nombre_sede", v)}
          />
          <EditableField
            label="Dirección"
            value={toStr(sede?.direccion_sede)}
            icon={MapPin}
            onSave={(v) => saveSede("direccion_sede", v)}
          />
          <EditableField
            label="Teléfono"
            value={toStr(cliente?.telefono)}
            icon={Phone}
            onSave={(v) => saveCliente("telefono", v)}
          />
          <SelectField
            label="Naturaleza de la Institución"
            value={toStr(cliente?.naturaleza)}
            options={[
              { label: "Privado", value: "privado" },
              { label: "Público", value: "publico" },
              { label: "Mixto", value: "mixto" },
            ]}
            onSave={(v) => saveCliente("naturaleza", v)}
          />
          <EditableField
            label="Representante Legal"
            value={toStr(cliente?.nombre_representante_legal)}
            icon={User}
            onSave={(v) => saveCliente("nombre_representante_legal", v)}
          />
          <EditableField
            label="Nombre del Servicio"
            value={toStr(ubicacion?.nombre_servicio)}
            required
            onSave={(v) => saveUbicacion("nombre_servicio", v)}
          />
          <EditableField
            label="Correo Electrónico Institución"
            value={toStr(cliente?.email)}
            icon={Mail}
            onSave={(v) => saveCliente("email", v)}
          />
        </div>

        {/* Contactos */}
        <div className="pt-3 border-t border-slate-100 space-y-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Contactos
          </p>

          {/* Médico Responsable */}
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">
              Médico Responsable
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <EditableField
                label="Nombre"
                value={toStr(medico?.nombre)}
                icon={User}
                onSave={(v) => saveContacto("medico_responsable", "nombre", v)}
              />
            </div>
          </div>

          {/* Tecnólogo Responsable */}
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">
              Tecnólogo Responsable del Servicio
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <EditableField
                label="Nombre"
                value={toStr(tecnologo?.nombre)}
                icon={User}
                onSave={(v) => saveContacto("tecnologo", "nombre", v)}
              />
              <EditableField
                label="Correo Electrónico"
                value={toStr(tecnologo?.email)}
                icon={Mail}
                onSave={(v) => saveContacto("tecnologo", "email", v)}
              />
              <EditableField
                label="Teléfono / Celular"
                value={toStr(tecnologo?.telefono)}
                icon={Phone}
                onSave={(v) => saveContacto("tecnologo", "telefono", v)}
              />
            </div>
          </div>

          {/* OPR */}
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">
              Oficial de Protección Radiológica (OPR)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <EditableField
                label="Nombre"
                value={toStr(opr?.nombre)}
                icon={Shield}
                onSave={(v) => saveContacto("opr", "nombre", v)}
              />
            </div>
          </div>

          {/* Responsable de la Visita */}
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">
              Responsable de la Visita
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <EditableField
                label="Nombre"
                value={toStr(respVisita?.nombre)}
                icon={User}
                onSave={(v) => saveContacto("responsable_visita", "nombre", v)}
              />
              <EditableField
                label="Cédula"
                value={toStr(respVisita?.cedula)}
                icon={Hash}
                onSave={(v) => saveContacto("responsable_visita", "cedula", v)}
              />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* 2. Datos de la Instalación */}
      <SectionCard
        icon={Shield}
        title="Datos de la Instalación"
        subtitle="Licencias, habilitación y operación"
        progress={progInstalacion}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <EditableField
            label="Licencia para Equipos de RX"
            value={toStr(ubicacion?.licencia)}
            icon={FileText}
            onSave={(v) => saveUbicacion("licencia", v)}
          />
          <EditableField
            label="Fecha Expiración Licencia"
            value={toStr(ubicacion?.fecha_expiracion_licencia)}
            icon={Calendar}
            type="date"
            onSave={(v) => saveUbicacion("fecha_expiracion_licencia", v)}
          />
          <EditableField
            label="Código de Habilitación"
            value={toStr(ubicacion?.codigo_habilitacion)}
            icon={Hash}
            onSave={(v) => saveUbicacion("codigo_habilitacion", v)}
          />
          <EditableField
            label="Días Laborados / Semana"
            value={toStr(visita.dias_laborados_semana)}
            type="number"
            onSave={(v) => saveVisita("dias_laborados_semana", v, true)}
          />
          <EditableField
            label="Pacientes / Semana"
            value={toStr(visita.pacientes_por_semana)}
            icon={Users}
            type="number"
            onSave={(v) => saveVisita("pacientes_por_semana", v, true)}
          />
          <EditableField
            label="Radiografías / Semana"
            value={toStr(visita.radiografias_por_semana)}
            type="number"
            onSave={(v) => saveVisita("radiografias_por_semana", v, true)}
          />
          <EditableField
            label="KV Máximo Usado"
            value={toStr(visita.kv_maximo_usado)}
            icon={Zap}
            type="number"
            onSave={(v) => saveVisita("kv_maximo_usado", v, true)}
          />
          <EditableField
            label="mAs Máximo Usado"
            value={toStr(visita.mas_maximo_usado)}
            type="number"
            onSave={(v) => saveVisita("mas_maximo_usado", v, true)}
          />
          <EditableField
            label="Máx. Disparos / Paciente"
            value={toStr(visita.max_disparos_paciente)}
            type="number"
            onSave={(v) => saveVisita("max_disparos_paciente", v, true)}
          />
          <EditableField
            label="% Rechazo de Radiografías"
            value={toStr(visita.porcentaje_rechazo)}
            type="number"
            onSave={(v) => saveVisita("porcentaje_rechazo", v, true)}
          />
          <EditableField
            label="Horas / Día"
            value={toStr(ubicacion?.horas_x_dia)}
            type="number"
            onSave={(v) => saveUbicacion("horas_x_dia", v, true)}
          />
        </div>
      </SectionCard>

      {/* 3. Características del Generador */}
      <SectionCard
        icon={Radio}
        title="Características del Generador"
        subtitle="Datos del equipo de rayos X"
        progress={progGenerador}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <EditableField
            label="Marca"
            value={toStr(equipo?.gen_marca)}
            onSave={(v) => saveEquipo("gen_marca", v)}
          />
          <EditableField
            label="No. de Serie"
            value={toStr(equipo?.gen_numero_serie)}
            icon={Hash}
            onSave={(v) => saveEquipo("gen_numero_serie", v)}
          />
          <EditableField
            label="Modelo"
            value={toStr(equipo?.gen_modelo)}
            onSave={(v) => saveEquipo("gen_modelo", v)}
          />
          <EditableField
            label="Fecha de Fabricación"
            value={toStr(equipo?.gen_fecha_fabricacion)}
            icon={Calendar}
            type="date"
            onSave={(v) => saveEquipo("gen_fecha_fabricacion", v)}
          />
          <SelectField
            label="Fase del Generador"
            value={toStr(equipo?.gen_fase)}
            icon={Zap}
            options={[
              { label: "Monofásico", value: "monofasico" },
              { label: "Trifásico", value: "trifasico" },
              { label: "Alta Frecuencia", value: "alta_frecuencia" },
            ]}
            onSave={(v) => saveEquipo("gen_fase", v)}
          />
          <EditableField
            label="Energía Fotones / Electrones (MeV)"
            value={toStr(equipo?.gen_energia_fotones_mev)}
            icon={Zap}
            onSave={(v) => saveEquipo("gen_energia_fotones_mev", v)}
          />
        </div>
        <div className="pt-3 border-t border-slate-100">
          <RefImagenSlot
            label="Foto de la placa / referencia del generador"
            iden={refImagen("generador")}
            onCapture={(file) => captureRefImagen("generador", file)}
            onRemove={() => removeRefImagen("generador")}
          />
        </div>
      </SectionCard>

      {/* 4. Especificaciones del Tubo (N tubos) */}
      <SectionCard
        icon={Zap}
        title="Especificaciones del Tubo"
        subtitle={`${nroTubos} tubo${nroTubos !== 1 ? "s" : ""} registrado${nroTubos !== 1 ? "s" : ""}`}
        progress={progTubo}
      >
        <div className="space-y-4">
          {tubos.length === 0 && (
            <p className="text-sm text-slate-400 font-medium py-2 text-center">
              No hay tubos registrados para este equipo
            </p>
          )}

          {tubos.map((t, i) => (
            <div key={t.id} className="rounded-xl border border-slate-100 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Tubo {i + 1}
                </p>
                <button
                  type="button"
                  onClick={() => deleteTubo(t.id!)}
                  className="text-slate-300 hover:text-red-500 transition-colors"
                  aria-label={`Eliminar tubo ${i + 1}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <EditableField
                  label="Marca"
                  value={toStr(t.marca)}
                  onSave={(v) => saveTubo(t.id!, "marca", v)}
                />
                <EditableField
                  label="Modelo"
                  value={toStr(t.modelo)}
                  onSave={(v) => saveTubo(t.id!, "modelo", v)}
                />
                <EditableField
                  label="No. de Serie"
                  value={toStr(t.numero_serie)}
                  icon={Hash}
                  onSave={(v) => saveTubo(t.id!, "numero_serie", v)}
                />
                <EditableField
                  label="Tipo"
                  value={toStr(t.tipo)}
                  onSave={(v) => saveTubo(t.id!, "tipo", v)}
                />
                <EditableField
                  label="mAs Máximo"
                  value={toStr(t.mas_max)}
                  type="number"
                  onSave={(v) => saveTubo(t.id!, "mas_max", v, true)}
                />
                <EditableField
                  label="kV Máximo"
                  value={toStr(t.kv_max)}
                  type="number"
                  onSave={(v) => saveTubo(t.id!, "kv_max", v, true)}
                />
                <EditableField
                  label="mA Máximo"
                  value={toStr(t.ma_max)}
                  type="number"
                  onSave={(v) => saveTubo(t.id!, "ma_max", v, true)}
                />
                <EditableField
                  label="t (s)"
                  value={toStr(t.tiempo_s)}
                  type="number"
                  onSave={(v) => saveTubo(t.id!, "tiempo_s", v, true)}
                />
                <EditableField
                  label="Foco Fino (mm)"
                  value={toStr(t.foco_fino_mm)}
                  type="number"
                  onSave={(v) => saveTubo(t.id!, "foco_fino_mm", v, true)}
                />
                <EditableField
                  label="Foco Grueso (mm)"
                  value={toStr(t.foco_grueso_mm)}
                  type="number"
                  onSave={(v) => saveTubo(t.id!, "foco_grueso_mm", v, true)}
                />
              </div>

              <div className="pt-2 border-t border-slate-100">
                <RefImagenSlot
                  label={`Foto de la placa / referencia del tubo ${i + 1}`}
                  iden={refImagen("tubo", t.id)}
                  onCapture={(file) => captureRefImagen("tubo", file, t.id)}
                  onRemove={() => removeRefImagen("tubo", t.id)}
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addTubo}
            disabled={!equipo}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-bold text-slate-500 hover:border-primary hover:text-primary transition-colors disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
            Agregar tubo
          </button>
        </div>
      </SectionCard>

      {/* 5. Colimador y Sistema de Adquisición */}
      <SectionCard
        icon={Eye}
        title="Colimador y Sistema de Adquisición"
        subtitle="Características del colimador e imágenes"
        progress={progColimador}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <EditableField
            label="Distancia Foco / Paciente (cm)"
            value={toStr(equipo?.distancia_foco_paciente)}
            icon={Ruler}
            type="number"
            onSave={(v) => saveEquipo("distancia_foco_paciente", v, true)}
          />
          <SelectField
            label="Bucky"
            value={toStr(equipo?.bucky)}
            options={[
              { label: "Sí", value: "Si" },
              { label: "No", value: "No" },
              { label: "No aplica", value: "No_aplica" },
            ]}
            onSave={(v) => saveEquipo("bucky", v)}
          />
          <SelectField
            label="Sistema de Adquisición de Imágenes"
            value={toStr(equipo?.sistema_adquisicion)}
            options={SISTEMAS_ADQUISICION.map((o) => ({ label: o.label, value: o.value }))}
            onSave={(v) => saveEquipo("sistema_adquisicion", v)}
          />
          <EditableField
            label="Filtración Inherente (mm Al)"
            value={toStr(equipo?.filtracion_inherente_mmal)}
            type="number"
            onSave={(v) => saveEquipo("filtracion_inherente_mmal", v, true)}
          />
          <EditableField
            label="Filtración Añadida (mm Al)"
            value={toStr(equipo?.filtracion_anadida_mmal)}
            type="number"
            onSave={(v) => saveEquipo("filtracion_anadida_mmal", v, true)}
          />
        </div>
        <div className="pt-3 border-t border-slate-100">
          <RefImagenSlot
            label="Foto de la placa / referencia del colimador"
            iden={refImagen("colimador")}
            onCapture={(file) => captureRefImagen("colimador", file)}
            onRemove={() => removeRefImagen("colimador")}
          />
        </div>
      </SectionCard>

      {/* 6. Condiciones Ambientales */}
      <SectionCard
        icon={Thermometer}
        title="Condiciones Ambientales"
        subtitle="Temperatura, presión y ubicación geográfica"
        progress={progCondiciones}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <EditableField
            label="Temperatura (°C)"
            value={toStr(visita.temperatura_c)}
            icon={Thermometer}
            type="number"
            onSave={(v) => saveVisita("temperatura_c", v, true)}
          />
          <EditableField
            label="Presión (hPa)"
            value={toStr(visita.presion_hpa)}
            icon={Activity}
            type="number"
            onSave={(v) => saveVisita("presion_hpa", v, true)}
          />
          <GeoAmbientalFields sede={sede} onSave={saveSedeGeo} />
          <div className="sm:col-span-2 lg:col-span-3">
            <EditableField
              label="Observaciones"
              value={toStr(visita.observaciones)}
              icon={FileText}
              onSave={(v) => saveVisita("observaciones", v)}
            />
          </div>
        </div>
      </SectionCard>

      {/* 6b. Otras identificaciones del equipo de rayos X (lista título + imagen) */}
      <SectionCard
        icon={FileText}
        title="Otras identificaciones del equipo de rayos X"
        subtitle="Placas, inventario, calibración… — título + foto, las que hagan falta"
        progress={otrasIdentificaciones.length > 0 ? 100 : 0}
      >
        <div className="space-y-3">
          {otrasIdentificaciones.length === 0 && (
            <p className="text-sm text-slate-400 font-medium py-2 text-center">
              Sin identificaciones cargadas
            </p>
          )}
          {otrasIdentificaciones.map((iden) => (
            <IdentificacionRow
              key={iden.id}
              iden={iden}
              onNombre={(v) => saveIdentificacion(iden.id!, { nombre: v || undefined })}
              onCapture={(file) =>
                saveIdentificacion(iden.id!, { blob_local: file, url_storage: null })
              }
              onRemoveImagen={() =>
                saveIdentificacion(iden.id!, { blob_local: null, url_storage: null })
              }
              onDelete={() => deleteIdentificacion(iden.id!)}
            />
          ))}
          <button
            type="button"
            onClick={addIdentificacion}
            disabled={!equipo}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-bold text-slate-500 hover:border-primary hover:text-primary transition-colors disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
            Agregar identificación
          </button>
        </div>
      </SectionCard>

      {/* 7. Dimensiones de la Sala (editable; también se captura en la ubicación RX) */}
      {ubicacion && (
        <SectionCard
          icon={Ruler}
          title="Sala — Dimensiones y Blindaje"
          subtitle="Características del recinto"
          progress={progSala}
        >
          <EditableField
            label="Ubicación física del equipo"
            value={toStr(ubicacion.ubicacion_fisica)}
            onSave={(v) => saveUbicacion("ubicacion_fisica", v)}
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <EditableField
              label="Ancho (m)"
              value={toStr(ubicacion.ancho_m)}
              type="number"
              onSave={(v) => saveUbicacionDim("ancho_m", v)}
            />
            <EditableField
              label="Largo (m)"
              value={toStr(ubicacion.largo_m)}
              type="number"
              onSave={(v) => saveUbicacionDim("largo_m", v)}
            />
            <EditableField
              label="Alto (m)"
              value={toStr(ubicacion.alto_m)}
              type="number"
              onSave={(v) => saveUbicacionDim("alto_m", v)}
            />
            <ReadonlyField label="Área (m²)" value={ubicacion.area_m2} />
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Descripción de zonas
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(["a", "b", "c", "d"] as const).map((z) => (
                <EditableTextArea
                  key={z}
                  label={`Zona ${z.toUpperCase()}`}
                  value={toStr(ubicacion[`zona_${z}_desc` as keyof typeof ubicacion] as string)}
                  placeholder="Limita con… / puertas / barreras"
                  onSave={(v) => saveUbicacion(`zona_${z}_desc`, v)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Piso y techo
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <EditableTextArea
                label="Piso"
                value={toStr(ubicacion.piso_desc)}
                placeholder="Material / plomo equiv. / colindancia inferior"
                onSave={(v) => saveUbicacion("piso_desc", v)}
              />
              <EditableTextArea
                label="Techo"
                value={toStr(ubicacion.techo_desc)}
                placeholder="Material / plomo equiv. / colindancia superior"
                onSave={(v) => saveUbicacion("techo_desc", v)}
              />
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
