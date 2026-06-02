"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  FlaskConical,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
  FileText,
} from "lucide-react";
import Link from "next/link";

// ─── Tipos para mediciones dinámicas ───

interface Medicion {
  id: string;
  [key: string]: string | number | undefined;
}

function generarId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export default function PruebaDetallePage({
  params,
}: {
  params: Promise<{ id: string; pruebaId: string }>;
}) {
  const { id, pruebaId } = use(params);
  const visitaId = parseInt(id, 10);
  const pruebaDefId = parseInt(pruebaId, 10);
  const { isReady } = useDb();

  const [concepto, setConcepto] = useState<string>("");
  const [acciones, setAcciones] = useState("");
  const [mediciones, setMediciones] = useState<Medicion[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [initialized, setInitialized] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Cargar definición de la prueba
  const pruebaDef = useLiveQuery(async () => {
    if (!isReady || isNaN(pruebaDefId)) return null;
    return db.prueba_definiciones.get(pruebaDefId);
  }, [isReady, pruebaDefId]);

  // Cargar resultado existente
  const resultado = useLiveQuery(async () => {
    if (!isReady || isNaN(visitaId) || isNaN(pruebaDefId)) return null;
    return db.prueba_resultados
      .where("visita_id")
      .equals(visitaId)
      .filter((r) => r.prueba_definicion_id === pruebaDefId)
      .first();
  }, [isReady, visitaId, pruebaDefId]);

  // Inicializar form desde datos existentes
  useEffect(() => {
    if (resultado && !initialized) {
      setConcepto(resultado.concepto ?? "");
      setAcciones(resultado.acciones_correctivas ?? "");

      // Recuperar mediciones del datos_json
      const datos = resultado.datos_json ?? {};
      if (Array.isArray(datos.mediciones) && datos.mediciones.length > 0) {
        setMediciones(datos.mediciones as Medicion[]);
      } else {
        // Iniciar con una fila vacía
        setMediciones([{ id: generarId() }]);
      }
      setInitialized(true);
    } else if (resultado === null && !initialized) {
      setMediciones([{ id: generarId() }]);
      setInitialized(true);
    }
  }, [resultado, initialized]);

  // Campos dinámicos según el código de la prueba
  const campos = getCamposPrueba(pruebaDef?.codigo ?? "");

  // Guardar en DB
  const saveToDb = useCallback(
    async (data: { concepto: string; acciones: string; mediciones: Medicion[] }) => {
      if (!resultado?.id) return;
      try {
        setSaveStatus("saving");
        const now = new Date().toISOString();
        await db.prueba_resultados.update(resultado.id, {
          concepto: (data.concepto as "FAVORABLE" | "NO_FAVORABLE" | "NO_APLICA") || undefined,
          acciones_correctivas: data.acciones || undefined,
          datos_json: { mediciones: data.mediciones },
          completado: !!data.concepto,
          fecha_ejecucion: now,
          last_modified: now,
          sync_status: "pending",
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("error");
      }
    },
    [resultado?.id]
  );

  // Debounced save
  const triggerSave = useCallback(
    (overrides?: Partial<{ concepto: string; acciones: string; mediciones: Medicion[] }>) => {
      const data = {
        concepto: overrides?.concepto ?? concepto,
        acciones: overrides?.acciones ?? acciones,
        mediciones: overrides?.mediciones ?? mediciones,
      };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => saveToDb(data), 800);
    },
    [concepto, acciones, mediciones, saveToDb]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Handlers
  const handleConceptoChange = (val: string) => {
    setConcepto(val);
    triggerSave({ concepto: val });
  };

  const handleAccionesChange = (val: string) => {
    setAcciones(val);
    triggerSave({ acciones: val });
  };

  const handleMedicionChange = (medicionId: string, campo: string, value: string) => {
    setMediciones((prev) => {
      const next = prev.map((m) => (m.id === medicionId ? { ...m, [campo]: value } : m));
      triggerSave({ mediciones: next });
      return next;
    });
  };

  const agregarMedicion = () => {
    setMediciones((prev) => {
      const next = [...prev, { id: generarId() }];
      triggerSave({ mediciones: next });
      return next;
    });
  };

  const eliminarMedicion = (medicionId: string) => {
    setMediciones((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((m) => m.id !== medicionId);
      triggerSave({ mediciones: next });
      return next;
    });
  };

  // ─── Loading / Error states ───
  if (!isReady || pruebaDef === undefined || resultado === undefined) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-slate-500 font-bold">Cargando prueba...</p>
      </div>
    );
  }

  if (pruebaDef === null || resultado === null) {
    return (
      <div className="space-y-6">
        <Link
          href={`/dashboard/visitas/${id}/pruebas`}
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a pruebas
        </Link>
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="bg-red-100 p-6 rounded-3xl">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <p className="text-slate-500 font-bold text-lg">Prueba no encontrada</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navegación */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/dashboard/visitas/${id}/pruebas`}
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a pruebas
        </Link>
        <div className="flex items-center gap-2 text-xs font-bold">
          {saveStatus === "saving" && (
            <span className="flex items-center gap-1.5 text-amber-600">
              <Save className="w-3.5 h-3.5 animate-pulse" />
              Guardando...
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1.5 text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Guardado
            </span>
          )}
          {saveStatus === "error" && (
            <span className="flex items-center gap-1.5 text-red-500">
              <AlertCircle className="w-3.5 h-3.5" />
              Error
            </span>
          )}
        </div>
      </div>

      {/* Header */}
      <div>
        <span className="text-[10px] font-black text-primary uppercase tracking-widest">
          {pruebaDef.codigo}
        </span>
        <h2 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 tracking-tighter mt-1">
          {pruebaDef.nombre}
        </h2>
        {pruebaDef.descripcion && (
          <p className="text-slate-500 font-medium text-sm mt-1">{pruebaDef.descripcion}</p>
        )}
      </div>

      {/* Tabla de mediciones */}
      <Card className="border-none shadow-sm rounded-2xl md:rounded-3xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2.5 rounded-xl">
                <FlaskConical className="text-primary w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm sm:text-base">Mediciones</h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  {campos.length} campo{campos.length !== 1 ? "s" : ""} por medición
                </p>
              </div>
            </div>
            <Button
              onClick={agregarMedicion}
              className="rounded-xl font-black bg-primary hover:bg-primary/90 text-white h-9 px-3 text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Agregar
            </Button>
          </div>

          {/* Mediciones */}
          <div className="space-y-3">
            {mediciones.map((medicion, idx) => (
              <div key={medicion.id} className="bg-slate-50 rounded-xl p-3 sm:p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Medición #{idx + 1}
                  </span>
                  {mediciones.length > 1 && (
                    <button
                      onClick={() => eliminarMedicion(medicion.id)}
                      className="text-red-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {campos.map((campo) => (
                    <div key={campo.key} className="space-y-1.5">
                      <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        {campo.label}
                      </Label>
                      <Input
                        type={campo.type ?? "number"}
                        step={campo.step ?? "any"}
                        placeholder={campo.placeholder ?? "—"}
                        className="rounded-lg border-slate-200 focus:border-primary font-medium h-9 text-sm"
                        value={(medicion[campo.key] as string | undefined) ?? ""}
                        onChange={(e) =>
                          handleMedicionChange(medicion.id, campo.key, e.target.value)
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Concepto y acciones correctivas */}
      <Card className="border-none shadow-sm rounded-2xl md:rounded-3xl bg-white overflow-hidden">
        <CardContent className="p-4 sm:p-5 md:p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl">
              <FileText className="text-primary w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm sm:text-base">Concepto</h3>
              <p className="text-[11px] text-slate-400 font-medium">Resultado de la prueba</p>
            </div>
          </div>

          {/* Selector de concepto */}
          <div className="space-y-2">
            <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
              Concepto
            </Label>
            <div className="flex flex-wrap gap-2">
              {[
                {
                  value: "FAVORABLE",
                  label: "Favorable",
                  bg: "bg-emerald-100",
                  text: "text-emerald-700",
                  border: "border-emerald-300",
                  activeBg: "bg-emerald-500",
                  activeText: "text-white",
                },
                {
                  value: "NO_FAVORABLE",
                  label: "No Favorable",
                  bg: "bg-red-100",
                  text: "text-red-600",
                  border: "border-red-300",
                  activeBg: "bg-red-500",
                  activeText: "text-white",
                },
                {
                  value: "NO_APLICA",
                  label: "No Aplica",
                  bg: "bg-slate-100",
                  text: "text-slate-500",
                  border: "border-slate-300",
                  activeBg: "bg-slate-500",
                  activeText: "text-white",
                },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleConceptoChange(opt.value)}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${
                    concepto === opt.value
                      ? `${opt.activeBg} ${opt.activeText} ${opt.border} shadow-md`
                      : `${opt.bg} ${opt.text} ${opt.border} hover:shadow-sm`
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Acciones correctivas */}
          <div className="space-y-2">
            <Label className="text-xs font-black text-slate-600 uppercase tracking-wider">
              Acciones Correctivas / Observaciones
            </Label>
            <textarea
              rows={3}
              placeholder="Acciones correctivas recomendadas o notas sobre la prueba..."
              className="w-full rounded-xl border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary/20 font-medium p-3 text-sm resize-none outline-none transition-colors"
              value={acciones}
              onChange={(e) => handleAccionesChange(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
//  Campos dinámicos por prueba
//  Cada prueba tiene sus propias columnas de medición
// ============================================================

interface CampoPrueba {
  key: string;
  label: string;
  type?: string;
  step?: string;
  placeholder?: string;
}

function getCamposPrueba(codigo: string): CampoPrueba[] {
  switch (codigo) {
    case "KVP":
      return [
        { key: "kvp_nominal", label: "kVp Nominal", placeholder: "80" },
        { key: "kvp_medido", label: "kVp Medido", placeholder: "79.5" },
        { key: "desviacion", label: "Desv. (%)", placeholder: "0.6" },
      ];

    case "TIE":
      return [
        { key: "tiempo_nominal", label: "T Nominal (ms)", placeholder: "100" },
        { key: "tiempo_medido", label: "T Medido (ms)", placeholder: "101" },
        { key: "desviacion", label: "Desv. (%)", placeholder: "1.0" },
      ];

    case "CHR":
      return [
        { key: "kvp", label: "kVp", placeholder: "80" },
        { key: "sin_filtro", label: "Sin filtro (µGy)", placeholder: "350" },
        { key: "con_filtro", label: "Con filtro (µGy)", placeholder: "175" },
        { key: "chr_mmal", label: "CHR (mmAl)", placeholder: "3.2" },
      ];

    case "REN":
      return [
        { key: "kvp", label: "kVp", placeholder: "80" },
        { key: "mas", label: "mAs", placeholder: "20" },
        { key: "distancia_cm", label: "Dist. (cm)", placeholder: "100" },
        {
          key: "kerma",
          label: "Kerma (µGy)",
          placeholder: "450",
        },
        {
          key: "rendimiento",
          label: "Rend. (µGy/mAs)",
          placeholder: "45.0",
        },
      ];

    case "COL":
      return [
        {
          key: "campo_luz_x",
          label: "Campo Luz X (cm)",
          placeholder: "20",
        },
        {
          key: "campo_luz_y",
          label: "Campo Luz Y (cm)",
          placeholder: "25",
        },
        {
          key: "campo_rx_x",
          label: "Campo RX X (cm)",
          placeholder: "20.5",
        },
        {
          key: "campo_rx_y",
          label: "Campo RX Y (cm)",
          placeholder: "25.3",
        },
        {
          key: "desalineacion",
          label: "Desalineación (cm)",
          placeholder: "0.3",
        },
      ];

    case "PKA":
      return [
        { key: "kvp", label: "kVp", placeholder: "80" },
        { key: "mas", label: "mAs", placeholder: "20" },
        {
          key: "pka_equipo",
          label: "PKA Equipo (µGy·cm²)",
          placeholder: "120",
        },
        {
          key: "pka_medido",
          label: "PKA Medido (µGy·cm²)",
          placeholder: "115",
        },
        { key: "factor", label: "Factor Corrección", placeholder: "0.96" },
      ];

    case "DDI":
    case "DDI_REP":
      return [
        { key: "kvp", label: "kVp", placeholder: "80" },
        { key: "mas", label: "mAs", placeholder: "10" },
        { key: "ddi", label: "DDI", placeholder: "1500" },
        { key: "ei", label: "EI", placeholder: "250" },
      ];

    case "UNI":
      return [
        { key: "zona", label: "Zona", type: "text", placeholder: "Centro" },
        { key: "valor_pixel", label: "Valor Píxel", placeholder: "1500" },
        { key: "desviacion", label: "Desv. (%)", placeholder: "2.0" },
      ];

    case "RES":
      return [
        {
          key: "direccion",
          label: "Dirección",
          type: "text",
          placeholder: "Horizontal",
        },
        { key: "lp_mm", label: "lp/mm", placeholder: "3.5" },
      ];

    case "BAJ":
      return [
        { key: "objeto_nro", label: "Objeto N°", placeholder: "1" },
        { key: "diametro_mm", label: "Diámetro (mm)", placeholder: "8" },
        { key: "visible", label: "Visible (S/N)", type: "text", placeholder: "S" },
      ];

    case "MTF":
      return [
        {
          key: "frecuencia",
          label: "Frecuencia (lp/mm)",
          placeholder: "1.0",
        },
        { key: "mtf_h", label: "MTF H", placeholder: "0.85" },
        { key: "mtf_v", label: "MTF V", placeholder: "0.83" },
      ];

    case "CAE_S":
    case "CAE_C":
    case "CAE_R":
      return [
        { key: "sensor", label: "Sensor", type: "text", placeholder: "Central" },
        { key: "kvp", label: "kVp", placeholder: "80" },
        { key: "ddi", label: "DDI", placeholder: "1500" },
        { key: "desviacion", label: "Desv. (%)", placeholder: "5" },
      ];

    case "CAE_COMP":
      return [
        { key: "kvp", label: "kVp", placeholder: "60" },
        { key: "espesor_mm", label: "Espesor (mm)", placeholder: "0" },
        { key: "material", label: "Material", type: "text", placeholder: "Cu" },
        { key: "ddi", label: "DDI", placeholder: "1500" },
        { key: "desviacion", label: "Desv. (%)", placeholder: "5" },
      ];

    case "DOS":
      return [
        {
          key: "proyeccion",
          label: "Proyección",
          type: "text",
          placeholder: "Tórax PA",
        },
        { key: "kvp", label: "kVp", placeholder: "120" },
        { key: "mas", label: "mAs", placeholder: "3.2" },
        { key: "dosis_mgy", label: "Dosis (mGy)", placeholder: "0.18" },
      ];

    case "CAS":
    case "CAS_UNI":
      return [
        {
          key: "cassette_id",
          label: "ID Cassette",
          type: "text",
          placeholder: "CR-001",
        },
        {
          key: "estado",
          label: "Estado",
          type: "text",
          placeholder: "Bueno",
        },
        {
          key: "observacion",
          label: "Observación",
          type: "text",
          placeholder: "Sin artefactos",
        },
      ];

    case "ALI_PAN":
      return [
        {
          key: "desalineacion_mm",
          label: "Desalineación (mm)",
          placeholder: "2",
        },
        {
          key: "criterio",
          label: "Criterio (mm)",
          placeholder: "5",
        },
      ];

    case "COL_CEF":
      return [
        {
          key: "campo_irradiado_x",
          label: "Campo irradiado X (cm)",
          placeholder: "18",
        },
        {
          key: "campo_irradiado_y",
          label: "Campo irradiado Y (cm)",
          placeholder: "24",
        },
        {
          key: "campo_receptor_x",
          label: "Campo receptor X (cm)",
          placeholder: "18",
        },
        {
          key: "campo_receptor_y",
          label: "Campo receptor Y (cm)",
          placeholder: "24",
        },
      ];

    case "PKL_PKA":
      return [
        { key: "kvp", label: "kVp", placeholder: "70" },
        { key: "ma", label: "mA", placeholder: "10" },
        {
          key: "pkl_mgy_cm",
          label: "PKL (mGy·cm)",
          placeholder: "85",
        },
        {
          key: "pka_mgy_cm2",
          label: "PKA (mGy·cm²)",
          placeholder: "120",
        },
      ];

    // Pruebas genéricas (LEV, INS)
    case "LEV":
    case "INS":
    default:
      return [
        {
          key: "parametro",
          label: "Parámetro",
          type: "text",
          placeholder: "Descripción",
        },
        {
          key: "valor",
          label: "Valor",
          placeholder: "—",
        },
        {
          key: "observacion",
          label: "Observación",
          type: "text",
          placeholder: "Observación",
        },
      ];
  }
}
