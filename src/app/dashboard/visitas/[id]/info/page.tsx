"use client";

import { use, useState, useCallback, useRef, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import { useRole } from "@/components/role-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";
import Link from "next/link";

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
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  onSave: (v: string) => void;
  type?: "text" | "number" | "date";
}) {
  const [local, setLocal] = useState(value);
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setLocal(value);
  }, [value]);

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
    [onSave],
  );

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
        {saved && <Check className="w-3 h-3 text-emerald-500" />}
      </p>
      <Input
        type={type}
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

// ─── Progress bar ───

function ProgressBar({ percent, label }: { percent: number; label: string }) {
  const color =
    percent === 100 ? "bg-emerald-500" : percent >= 50 ? "bg-amber-400" : "bg-red-400";
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

export default function InfoGeneralPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const visitaId = parseInt(id, 10);
  const { isReady } = useDb();
  const { role } = useRole();

  const data = useLiveQuery(async () => {
    if (!isReady || isNaN(visitaId)) return null;

    const visita = await db.visitas.get(visitaId);
    if (!visita) return null;

    const equipo = visita.equipo_id ? await db.equipos.get(visita.equipo_id) : undefined;
    const ubicacion = visita.ubicacion_id
      ? await db.ubicaciones_rx.get(visita.ubicacion_id)
      : undefined;
    const solicitud = await db.solicitudes.get(visita.solicitud_id);
    const cliente = solicitud ? await db.clientes.get(solicitud.cliente_id) : undefined;
    const sede = ubicacion
      ? await db.sedes.get((await db.ubicaciones_rx.get(ubicacion.id!))?.sede_id ?? 0)
      : undefined;

    const tubos = visita.equipo_id
      ? await db.tubos.where("equipo_id").equals(visita.equipo_id).toArray()
      : [];
    const tubo = tubos[0];

    const sala = visita.ubicacion_id
      ? await db.sala_dimensiones.where("ubicacion_id").equals(visita.ubicacion_id).first()
      : undefined;

    const contactos = cliente?.id
      ? await db.contactos.where("cliente_id").equals(cliente.id).toArray()
      : [];

    return {
      visita,
      equipo,
      ubicacion,
      sede,
      cliente,
      solicitud,
      tubo,
      nroTubos: tubos.length,
      sala,
      contactos,
    };
  }, [isReady, visitaId]);

  // ─── Save helpers (plain functions, no hooks) ───

  function getContacto(cargo: string) {
    return data?.contactos?.find((c) => c.cargo === cargo);
  }

  async function saveCliente(field: string, value: string) {
    const id = data?.cliente?.id;
    if (!id) return;
    await db.clientes.update(id, { [field]: value || undefined });
  }

  async function saveSede(field: string, value: string) {
    const id = data?.sede?.id;
    if (!id) return;
    await db.sedes.update(id, { [field]: value || undefined });
  }

  async function saveUbicacion(field: string, value: string, numeric = false) {
    const id = data?.ubicacion?.id;
    if (!id) return;
    const parsed = numeric ? (value === "" ? undefined : parseFloat(value)) : value || undefined;
    await db.ubicaciones_rx.update(id, { [field]: parsed });
  }

  async function saveEquipo(field: string, value: string, numeric = false) {
    const id = data?.equipo?.id;
    if (!id) return;
    const parsed = numeric ? (value === "" ? undefined : parseFloat(value)) : value || undefined;
    await db.equipos.update(id, { [field]: parsed });
  }

  async function saveTubo(field: string, value: string, numeric = false) {
    const id = data?.tubo?.id;
    if (!id) return;
    const parsed = numeric ? (value === "" ? undefined : parseFloat(value)) : value || undefined;
    await db.tubos.update(id, { [field]: parsed });
  }

  async function saveVisita(field: string, value: string, numeric = false) {
    if (!visitaId || isNaN(visitaId)) return;
    const parsed = numeric ? (value === "" ? undefined : parseFloat(value)) : value || undefined;
    await db.visitas.update(visitaId, {
      [field]: parsed,
      last_modified: new Date().toISOString(),
      sync_status: "pending",
    });
  }

  async function saveContacto(
    cargo: "medico_responsable" | "tecnologo" | "opr" | "responsable_visita",
    field: string,
    value: string,
  ) {
    const clienteId = data?.cliente?.id;
    if (!clienteId) return;
    const existing = getContacto(cargo);
    if (existing?.id) {
      await db.contactos.update(existing.id, { [field]: value || undefined });
    } else {
      await db.contactos.add({
        cliente_id: clienteId,
        nombre: field === "nombre" ? value : "",
        cargo,
        ...(field !== "nombre" ? { [field]: value || undefined } : {}),
        para_programar: false,
      });
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
        <Link
          href="/dashboard/visitas"
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a visitas
        </Link>
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="bg-red-100 p-6 rounded-3xl">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <p className="text-slate-500 font-bold text-lg">Visita no encontrada</p>
        </div>
      </div>
    );
  }

  const { visita, equipo, ubicacion, sede, cliente, solicitud, tubo, nroTubos, sala, contactos } =
    data;

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
  ]);

  const progTubo = computeProgress([
    tubo?.marca,
    tubo?.modelo,
    tubo?.numero_serie,
    tubo?.tipo,
    tubo?.mas_max,
    tubo?.kv_max,
    tubo?.ma_max,
    tubo?.tiempo_s,
    tubo?.foco_fino_mm,
    tubo?.foco_grueso_mm,
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

  const progSala = computeProgress([sala?.ancho_m, sala?.largo_m, sala?.alto_m]);

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
      <Link
        href={`/dashboard/visitas/${id}`}
        className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Volver al workspace
      </Link>

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
            onSave={(v) => saveCliente("nombre_cliente", v)}
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <EditableField
                label="NIT"
                value={toStr(cliente?.nit)}
                icon={Hash}
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
        </div>
      </SectionCard>

      {/* 4. Especificaciones del Tubo */}
      <SectionCard
        icon={Zap}
        title="Especificaciones del Tubo"
        subtitle={`${nroTubos} tubo${nroTubos !== 1 ? "s" : ""} registrado${nroTubos !== 1 ? "s" : ""}`}
        progress={progTubo}
      >
        {tubo ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <EditableField
              label="Marca"
              value={toStr(tubo.marca)}
              onSave={(v) => saveTubo("marca", v)}
            />
            <EditableField
              label="Modelo"
              value={toStr(tubo.modelo)}
              onSave={(v) => saveTubo("modelo", v)}
            />
            <EditableField
              label="No. de Serie"
              value={toStr(tubo.numero_serie)}
              icon={Hash}
              onSave={(v) => saveTubo("numero_serie", v)}
            />
            <EditableField
              label="Tipo"
              value={toStr(tubo.tipo)}
              onSave={(v) => saveTubo("tipo", v)}
            />
            <ReadonlyField label="No. de Tubos" value={nroTubos} />
            <EditableField
              label="mAs Máximo"
              value={toStr(tubo.mas_max)}
              type="number"
              onSave={(v) => saveTubo("mas_max", v, true)}
            />
            <EditableField
              label="kV Máximo"
              value={toStr(tubo.kv_max)}
              type="number"
              onSave={(v) => saveTubo("kv_max", v, true)}
            />
            <EditableField
              label="mA Máximo"
              value={toStr(tubo.ma_max)}
              type="number"
              onSave={(v) => saveTubo("ma_max", v, true)}
            />
            <EditableField
              label="t (s)"
              value={toStr(tubo.tiempo_s)}
              type="number"
              onSave={(v) => saveTubo("tiempo_s", v, true)}
            />
            <EditableField
              label="Foco Fino (mm)"
              value={toStr(tubo.foco_fino_mm)}
              type="number"
              onSave={(v) => saveTubo("foco_fino_mm", v, true)}
            />
            <EditableField
              label="Foco Grueso (mm)"
              value={toStr(tubo.foco_grueso_mm)}
              type="number"
              onSave={(v) => saveTubo("foco_grueso_mm", v, true)}
            />
          </div>
        ) : (
          <p className="text-sm text-slate-400 font-medium py-4 text-center">
            No hay tubo registrado para este equipo
          </p>
        )}
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
          <EditableField
            label="Sistema de Adquisición de Imágenes"
            value={toStr(equipo?.sistema_adquisicion)}
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
          <EditableField
            label="Ciudad"
            value={toStr(sede?.ciudad)}
            icon={MapPin}
            onSave={(v) => saveSede("ciudad", v)}
          />
          <EditableField
            label="Departamento"
            value={toStr(sede?.departamento)}
            icon={MapPin}
            onSave={(v) => saveSede("departamento", v)}
          />
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

      {/* 7. Dimensiones de la Sala */}
      {sala && (
        <SectionCard
          icon={Ruler}
          title="Sala — Dimensiones y Blindaje"
          subtitle="Características del recinto"
          progress={progSala}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <ReadonlyField label="Ancho (m)" value={sala.ancho_m} />
            <ReadonlyField label="Largo (m)" value={sala.largo_m} />
            <ReadonlyField label="Alto (m)" value={sala.alto_m} />
            <ReadonlyField label="Área (m²)" value={sala.area_m2} />
          </div>

          {(sala.zona_a_desc || sala.zona_b_desc || sala.zona_c_desc || sala.zona_d_desc) && (
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Descripción de zonas
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(["a", "b", "c", "d"] as const).map((z) => {
                  const desc = sala[`zona_${z}_desc` as keyof typeof sala];
                  if (!desc) return null;
                  return (
                    <div key={z} className="bg-slate-50 rounded-xl p-3 space-y-1">
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest">
                        Zona {z.toUpperCase()}
                      </p>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        {String(desc)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
