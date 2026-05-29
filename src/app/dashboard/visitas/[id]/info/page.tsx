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
  Pencil,
  Check,
} from "lucide-react";
import Link from "next/link";
import { trackChange } from "@/lib/workflow/change-tracker";

/** Componente para un campo de dato — modo lectura */
function InfoField({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number | undefined | null;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const display = value != null && value !== "" ? String(value) : "—";
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </p>
      <p className="text-sm font-bold text-slate-800">{display}</p>
    </div>
  );
}

/** Componente para un campo editable — modo inline con autosave */
function EditableField({
  label,
  value,
  icon: Icon,
  onSave,
  type = "text",
}: {
  label: string;
  value: string | number | undefined | null;
  icon?: React.ComponentType<{ className?: string }>;
  onSave: (newValue: string) => void;
  type?: "text" | "number" | "date";
}) {
  const display = value != null && value !== "" ? String(value) : "";
  const [localValue, setLocalValue] = useState(display);
  const [saved, setSaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setLocalValue(value != null && value !== "" ? String(value) : "");
  }, [value]);

  const handleChange = useCallback(
    (newVal: string) => {
      setLocalValue(newVal);
      setSaved(false);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onSave(newVal);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }, 800);
    },
    [onSave]
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
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="—"
      />
    </div>
  );
}

export default function InfoGeneralPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const visitaId = parseInt(id, 10);
  const { isReady } = useDb();
  const { role } = useRole();

  const data = useLiveQuery(async () => {
    if (!isReady || isNaN(visitaId)) return null;

    const visita = await db.visitas.get(visitaId);
    if (!visita) return null;

    const equipo = visita.equipo_id
      ? await db.equipos.get(visita.equipo_id)
      : undefined;
    const ubicacion = visita.ubicacion_id
      ? await db.ubicaciones_rx.get(visita.ubicacion_id)
      : undefined;
    const solicitud = await db.solicitudes.get(visita.solicitud_id);
    const cliente = solicitud
      ? await db.clientes.get(solicitud.cliente_id)
      : undefined;
    const sede = ubicacion
      ? await db.sedes.get(
          (await db.ubicaciones_rx.get(ubicacion.id!))?.sede_id ?? 0
        )
      : undefined;

    // Datos del tubo
    const tubo = visita.equipo_id
      ? await db.tubos.where("equipo_id").equals(visita.equipo_id).first()
      : undefined;

    // Datos de la sala
    const sala = visita.ubicacion_id
      ? await db.sala_dimensiones
          .where("ubicacion_id")
          .equals(visita.ubicacion_id)
          .first()
      : undefined;

    // Contacto para programar
    const contacto = solicitud?.contacto_programar_id
      ? await db.contactos.get(solicitud.contacto_programar_id)
      : undefined;

    // Técnico asignado
    const tecnico = visita.tecnico_id
      ? await db.usuarios.get(visita.tecnico_id)
      : undefined;

    return {
      visita,
      equipo,
      ubicacion,
      sede,
      cliente,
      solicitud,
      tubo,
      sala,
      contacto,
      tecnico,
    };
  }, [isReady, visitaId]);

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
          <p className="text-slate-500 font-bold text-lg">
            Visita no encontrada
          </p>
        </div>
      </div>
    );
  }

  const {
    visita,
    equipo,
    ubicacion,
    sede,
    cliente,
    solicitud,
    tubo,
    sala,
    contacto,
    tecnico,
  } = data;

  // El técnico puede editar datos de equipo/ubicación cuando la visita está en progreso
  const canEdit =
    role?.cargo === "tecnico" &&
    ["en_progreso", "completada"].includes(visita.estado_visita);

  const tecnicoId = role?.usuarioId ?? 0;

  // Helpers de autosave con change tracking
  const saveEquipo = useCallback(
    async (field: string, value: string) => {
      if (!equipo?.id) return;
      const parsed =
        field.includes("mmal") || field === "distancia_foco_paciente"
          ? value === "" ? undefined : parseFloat(value)
          : value || undefined;
      const oldVal = equipo[field as keyof typeof equipo];
      await db.equipos.update(equipo.id, { [field]: parsed });
      await trackChange("equipos", equipo.id, field, oldVal != null ? String(oldVal) : undefined, parsed != null ? String(parsed) : undefined, tecnicoId);
    },
    [equipo, tecnicoId]
  );

  const saveUbicacion = useCallback(
    async (field: string, value: string) => {
      if (!ubicacion?.id) return;
      const parsed =
        field === "horas_x_dia"
          ? value === "" ? undefined : parseFloat(value)
          : value || undefined;
      const oldVal = ubicacion[field as keyof typeof ubicacion];
      await db.ubicaciones_rx.update(ubicacion.id, { [field]: parsed });
      await trackChange("ubicaciones_rx", ubicacion.id, field, oldVal != null ? String(oldVal) : undefined, parsed != null ? String(parsed) : undefined, tecnicoId);
    },
    [ubicacion, tecnicoId]
  );

  const saveTubo = useCallback(
    async (field: string, value: string) => {
      if (!tubo?.id) return;
      const numFields = ["kv_max", "ma_max", "mas_max", "foco_fino_mm", "foco_grueso_mm"];
      const parsed = numFields.includes(field)
        ? value === "" ? undefined : parseFloat(value)
        : value || undefined;
      const oldVal = tubo[field as keyof typeof tubo];
      await db.tubos.update(tubo.id, { [field]: parsed });
      await trackChange("tubos", tubo.id, field, oldVal != null ? String(oldVal) : undefined, parsed != null ? String(parsed) : undefined, tecnicoId);
    },
    [tubo, tecnicoId]
  );

  return (
    <div className="space-y-6">
      {/* Navegación */}
      <Link
        href={`/dashboard/visitas/${id}`}
        className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Volver al workspace
      </Link>

      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tighter">
          Información General
        </h2>
        <p className="text-slate-500 font-medium text-sm mt-1">
          {canEdit ? (
            <span className="flex items-center gap-1.5">
              <Pencil className="w-3.5 h-3.5 text-primary" />
              Puedes completar datos de equipo y ubicación
            </span>
          ) : (
            "Datos precargados del servicio"
          )}
        </p>
      </div>

      {/* Cliente */}
      <Card className="border-none shadow-sm rounded-2xl md:rounded-3xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 md:p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl">
              <Building2 className="text-primary w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm sm:text-base">
                Cliente
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Datos del prestador de servicios
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoField
              label="Nombre / Razón Social"
              value={cliente?.nombre_cliente}
              icon={Building2}
            />
            <InfoField
              label="Nombre Prestador"
              value={cliente?.nombre_prestador}
            />
            <InfoField label="NIT" value={cliente?.nit} icon={Hash} />
            <InfoField
              label="Dígito Verificación"
              value={cliente?.digito_verificacion}
            />
            <InfoField
              label="Naturaleza"
              value={cliente?.naturaleza}
            />
            <InfoField
              label="Dirección"
              value={cliente?.direccion}
              icon={MapPin}
            />
            <InfoField
              label="Teléfono"
              value={cliente?.telefono}
              icon={Phone}
            />
            <InfoField
              label="Email"
              value={cliente?.email}
              icon={Mail}
            />
            <InfoField
              label="Representante Legal"
              value={cliente?.nombre_representante_legal}
              icon={User}
            />
          </div>
        </CardContent>
      </Card>

      {/* Sede y Ubicación */}
      <Card className="border-none shadow-sm rounded-2xl md:rounded-3xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 md:p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl">
              <MapPin className="text-primary w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm sm:text-base">
                Sede y Ubicación
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Lugar donde se presta el servicio
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoField label="Sede" value={sede?.nombre_sede} />
            <InfoField label="Dirección Sede" value={sede?.direccion_sede} icon={MapPin} />
            <InfoField label="Ciudad" value={sede?.ciudad} />
            <InfoField label="Departamento" value={sede?.departamento} />
            {canEdit ? (
              <>
                <EditableField label="Servicio / Área" value={ubicacion?.nombre_servicio} onSave={(v) => saveUbicacion("nombre_servicio", v)} />
                <EditableField label="Código Habilitación" value={ubicacion?.codigo_habilitacion} icon={Shield} onSave={(v) => saveUbicacion("codigo_habilitacion", v)} />
                <EditableField label="Licencia" value={ubicacion?.licencia} icon={FileText} onSave={(v) => saveUbicacion("licencia", v)} />
                <EditableField label="Vencimiento Licencia" value={ubicacion?.fecha_expiracion_licencia} icon={Calendar} type="date" onSave={(v) => saveUbicacion("fecha_expiracion_licencia", v)} />
                <EditableField label="Horas / Día" value={ubicacion?.horas_x_dia} type="number" onSave={(v) => saveUbicacion("horas_x_dia", v)} />
              </>
            ) : (
              <>
                <InfoField label="Servicio / Área" value={ubicacion?.nombre_servicio} />
                <InfoField label="Código Habilitación" value={ubicacion?.codigo_habilitacion} icon={Shield} />
                <InfoField label="Licencia" value={ubicacion?.licencia} icon={FileText} />
                <InfoField label="Vencimiento Licencia" value={ubicacion?.fecha_expiracion_licencia} icon={Calendar} />
                <InfoField label="Horas / Día" value={ubicacion?.horas_x_dia} />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Equipo — Generador */}
      <Card className="border-none shadow-sm rounded-2xl md:rounded-3xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 md:p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl">
              <Radio className="text-primary w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm sm:text-base">
                Equipo — Generador
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Datos del equipo de rayos X
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoField
              label="Tipo de Equipo"
              value={equipo?.tipo_equipo?.replace(/_/g, " ")}
            />
            {canEdit ? (
              <>
                <EditableField label="Marca" value={equipo?.gen_marca} onSave={(v) => saveEquipo("gen_marca", v)} />
                <EditableField label="Modelo" value={equipo?.gen_modelo} onSave={(v) => saveEquipo("gen_modelo", v)} />
                <EditableField label="No. Serie" value={equipo?.gen_numero_serie} icon={Hash} onSave={(v) => saveEquipo("gen_numero_serie", v)} />
                <EditableField label="Fecha Fabricación" value={equipo?.gen_fecha_fabricacion} icon={Calendar} type="date" onSave={(v) => saveEquipo("gen_fecha_fabricacion", v)} />
                <EditableField label="Fase" value={equipo?.gen_fase} icon={Zap} onSave={(v) => saveEquipo("gen_fase", v)} />
                <EditableField label="Sistema Adquisición" value={equipo?.sistema_adquisicion} onSave={(v) => saveEquipo("sistema_adquisicion", v)} />
                <EditableField label="Dist. Foco-Paciente (cm)" value={equipo?.distancia_foco_paciente} type="number" onSave={(v) => saveEquipo("distancia_foco_paciente", v)} />
                <EditableField label="Bucky" value={equipo?.bucky} onSave={(v) => saveEquipo("bucky", v)} />
                <EditableField label="Filtración Inherente (mmAl)" value={equipo?.filtracion_inherente_mmal} type="number" onSave={(v) => saveEquipo("filtracion_inherente_mmal", v)} />
                <EditableField label="Filtración Añadida (mmAl)" value={equipo?.filtracion_anadida_mmal} type="number" onSave={(v) => saveEquipo("filtracion_anadida_mmal", v)} />
              </>
            ) : (
              <>
                <InfoField label="Marca" value={equipo?.gen_marca} />
                <InfoField label="Modelo" value={equipo?.gen_modelo} />
                <InfoField label="No. Serie" value={equipo?.gen_numero_serie} icon={Hash} />
                <InfoField label="Fecha Fabricación" value={equipo?.gen_fecha_fabricacion} icon={Calendar} />
                <InfoField label="Fase" value={equipo?.gen_fase} icon={Zap} />
                <InfoField label="Sistema Adquisición" value={equipo?.sistema_adquisicion} />
                <InfoField label="Dist. Foco-Paciente (cm)" value={equipo?.distancia_foco_paciente} />
                <InfoField label="Bucky" value={equipo?.bucky} />
                <InfoField label="Filtración Inherente (mmAl)" value={equipo?.filtracion_inherente_mmal} />
                <InfoField label="Filtración Añadida (mmAl)" value={equipo?.filtracion_anadida_mmal} />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tubo de Rayos X */}
      {tubo && (
        <Card className="border-none shadow-sm rounded-2xl md:rounded-3xl bg-white overflow-hidden">
          <CardContent className="p-4 sm:p-5 md:p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2.5 rounded-xl">
                <Zap className="text-primary w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm sm:text-base">
                  Tubo de Rayos X
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  Características del tubo
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {canEdit ? (
                <>
                  <EditableField label="Marca" value={tubo.marca} onSave={(v) => saveTubo("marca", v)} />
                  <EditableField label="Modelo" value={tubo.modelo} onSave={(v) => saveTubo("modelo", v)} />
                  <EditableField label="No. Serie" value={tubo.numero_serie} icon={Hash} onSave={(v) => saveTubo("numero_serie", v)} />
                  <EditableField label="Tipo" value={tubo.tipo} onSave={(v) => saveTubo("tipo", v)} />
                  <EditableField label="kV Máximo" value={tubo.kv_max} type="number" onSave={(v) => saveTubo("kv_max", v)} />
                  <EditableField label="mA Máximo" value={tubo.ma_max} type="number" onSave={(v) => saveTubo("ma_max", v)} />
                  <EditableField label="mAs Máximo" value={tubo.mas_max} type="number" onSave={(v) => saveTubo("mas_max", v)} />
                  <EditableField label="Foco Fino (mm)" value={tubo.foco_fino_mm} type="number" onSave={(v) => saveTubo("foco_fino_mm", v)} />
                  <EditableField label="Foco Grueso (mm)" value={tubo.foco_grueso_mm} type="number" onSave={(v) => saveTubo("foco_grueso_mm", v)} />
                </>
              ) : (
                <>
                  <InfoField label="Marca" value={tubo.marca} />
                  <InfoField label="Modelo" value={tubo.modelo} />
                  <InfoField label="No. Serie" value={tubo.numero_serie} icon={Hash} />
                  <InfoField label="Tipo" value={tubo.tipo} />
                  <InfoField label="kV Máximo" value={tubo.kv_max} />
                  <InfoField label="mA Máximo" value={tubo.ma_max} />
                  <InfoField label="mAs Máximo" value={tubo.mas_max} />
                  <InfoField label="Foco Fino (mm)" value={tubo.foco_fino_mm} />
                  <InfoField label="Foco Grueso (mm)" value={tubo.foco_grueso_mm} />
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sala / Dimensiones */}
      {sala && (
        <Card className="border-none shadow-sm rounded-2xl md:rounded-3xl bg-white overflow-hidden">
          <CardContent className="p-4 sm:p-5 md:p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2.5 rounded-xl">
                <Ruler className="text-primary w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm sm:text-base">
                  Sala — Dimensiones y Blindaje
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  Características del recinto
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-2">
              <InfoField label="Ancho (m)" value={sala.ancho_m} />
              <InfoField label="Largo (m)" value={sala.largo_m} />
              <InfoField label="Alto (m)" value={sala.alto_m} />
              <InfoField label="Área (m²)" value={sala.area_m2} />
            </div>

            {(sala.zona_a_desc ||
              sala.zona_b_desc ||
              sala.zona_c_desc ||
              sala.zona_d_desc) && (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Descripción de zonas
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {sala.zona_a_desc && (
                    <div className="bg-slate-50 rounded-xl p-3 space-y-1">
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest">
                        Zona A
                      </p>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        {sala.zona_a_desc}
                      </p>
                    </div>
                  )}
                  {sala.zona_b_desc && (
                    <div className="bg-slate-50 rounded-xl p-3 space-y-1">
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest">
                        Zona B
                      </p>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        {sala.zona_b_desc}
                      </p>
                    </div>
                  )}
                  {sala.zona_c_desc && (
                    <div className="bg-slate-50 rounded-xl p-3 space-y-1">
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest">
                        Zona C
                      </p>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        {sala.zona_c_desc}
                      </p>
                    </div>
                  )}
                  {sala.zona_d_desc && (
                    <div className="bg-slate-50 rounded-xl p-3 space-y-1">
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest">
                        Zona D
                      </p>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        {sala.zona_d_desc}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Contacto y Técnico */}
      <Card className="border-none shadow-sm rounded-2xl md:rounded-3xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 md:p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl">
              <User className="text-primary w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm sm:text-base">
                Contacto y Técnico
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Personas involucradas en el servicio
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Contacto del cliente */}
            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Contacto del Cliente
              </p>
              <div className="space-y-3">
                <InfoField
                  label="Nombre"
                  value={contacto?.nombre}
                  icon={User}
                />
                <InfoField label="Cargo" value={contacto?.cargo} />
                <InfoField
                  label="Teléfono"
                  value={contacto?.telefono}
                  icon={Phone}
                />
                <InfoField
                  label="Email"
                  value={contacto?.email}
                  icon={Mail}
                />
              </div>
            </div>

            {/* Técnico asignado */}
            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Técnico / Físico Asignado
              </p>
              <div className="space-y-3">
                <InfoField
                  label="Nombre"
                  value={tecnico?.nombre}
                  icon={User}
                />
                <InfoField label="Cargo" value={tecnico?.cargo} />
                <InfoField
                  label="Cédula"
                  value={tecnico?.cedula}
                  icon={Hash}
                />
                <InfoField
                  label="Email"
                  value={tecnico?.email}
                  icon={Mail}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Datos del servicio */}
      <Card className="border-none shadow-sm rounded-2xl md:rounded-3xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 md:p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl">
              <FileText className="text-primary w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm sm:text-base">
                Datos del Servicio
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Información de la solicitud
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoField
              label="Tipo de Servicio"
              value={solicitud?.tipo_servicio?.replace(/_/g, " ")}
            />
            <InfoField
              label="Fecha Solicitud"
              value={solicitud?.fecha_solicitud}
              icon={Calendar}
            />
            <InfoField
              label="Fecha Estimada Visita"
              value={solicitud?.fecha_estimada_visita}
              icon={Calendar}
            />
            <InfoField
              label="Fecha Visita"
              value={visita.fecha_visita}
              icon={Calendar}
            />
            <InfoField
              label="Estado"
              value={visita.estado_visita.replace(/_/g, " ")}
            />
            <InfoField
              label="Forma de Pago"
              value={solicitud?.forma_pago}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
