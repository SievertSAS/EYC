import { db } from "./index";
import type { PruebaDefinicion, TipoEquipo, RolUsuario, ModuloApp, RolPermiso } from "./types";
import { ROLES_DISPONIBLES, MODULOS_APP } from "./types";
import type { EquipmentPackage } from "@/lib/equipos/types";
import { CONVENCIONAL_PACKAGE } from "@/lib/equipos/convencional";

// ============================================================
//  Seed: Catálogo de pruebas de control de calidad
//  Basado en IAEA-TECDOC-1958 y Resolución 1811 de 2025
// ============================================================

/** Tipos de equipo de radiografía general */
const RX_GENERAL: TipoEquipo[] = ["CONVENCIONAL", "RX_PORTATIL", "MULTIPROPOSITO"];

/** Tipos de equipo extraoral */
const RX_EXTRAORAL: TipoEquipo[] = ["PANORAMICO", "CT_DENTAL"];

/** Todos los tipos con tubo de rayos X */
const TODOS_RX: TipoEquipo[] = [
  ...RX_GENERAL,
  ...RX_EXTRAORAL,
  "MAMOGRAFO",
  "CT",
  "ARCOENC",
  "FLUOROSCOPIOS",
  "ANGIOGRAFO",
];

const PRUEBAS_CATALOGO: Omit<PruebaDefinicion, "id" | "creado_en">[] = [
  // ─── Pruebas comunes a todos ───
  {
    codigo: "LEV",
    nombre: "Evaluación de condiciones ambientales / Levantamiento radiométrico",
    descripcion:
      "Medir tasa de dosis en puntos representativos para verificar protección radiológica",
    tipos_equipo_aplicables: TODOS_RX,
    orden_sugerido: 1,
    plantilla_informe: "FT-LEC-6c",
    activa: true,
  },
  {
    codigo: "INS",
    nombre: "Inspección visual, descripción de la instalación y blindajes",
    descripcion:
      "Verificar estado físico del equipo, condiciones de operación y elementos de protección",
    tipos_equipo_aplicables: TODOS_RX,
    orden_sugerido: 2,
    plantilla_informe: "FT-LEC-6c",
    activa: true,
  },

  // ─── Pruebas de radiografía general (FT-LEC-6c) ───
  {
    codigo: "COL",
    nombre: "Sistema de colimación del haz y perpendicularidad del rayo central",
    descripcion: "Evaluar coincidencia campo luminoso/campo de radiación y perpendicularidad",
    tipos_equipo_aplicables: RX_GENERAL,
    orden_sugerido: 3,
    plantilla_informe: "FT-LEC-6c",
    activa: true,
  },
  {
    codigo: "TIE",
    nombre: "Exactitud y repetibilidad del tiempo de exposición",
    descripcion: "Evaluar exactitud y repetibilidad del indicador de tiempo del generador",
    tipos_equipo_aplicables: [...RX_GENERAL, ...RX_EXTRAORAL],
    orden_sugerido: 4,
    plantilla_informe: "FT-LEC-6c",
    activa: true,
  },
  {
    codigo: "KVP",
    nombre: "Exactitud y repetibilidad de la tensión del tubo de rayos X",
    descripcion: "Evaluar exactitud y repetibilidad del kVp del generador",
    tipos_equipo_aplicables: [...RX_GENERAL, ...RX_EXTRAORAL],
    orden_sugerido: 5,
    plantilla_informe: "FT-LEC-6c",
    activa: true,
  },
  {
    codigo: "CHR",
    nombre: "Capa hemirreductora (CHR)",
    descripcion: "Determinar la calidad del haz mediante la capa hemirreductora en mmAl",
    tipos_equipo_aplicables: [...RX_GENERAL, ...RX_EXTRAORAL],
    orden_sugerido: 6,
    plantilla_informe: "FT-LEC-6c",
    activa: true,
  },
  {
    codigo: "REN",
    nombre: "Rendimiento del tubo de rayos X, repetibilidad y linealidad",
    descripcion: "Determinar rendimiento del tubo (µGy/mAs), su repetibilidad y linealidad",
    tipos_equipo_aplicables: RX_GENERAL,
    orden_sugerido: 7,
    plantilla_informe: "FT-LEC-6c",
    activa: true,
  },
  {
    codigo: "PKA",
    nombre: "Determinación del factor de corrección del producto kerma-área (PkA)",
    descripcion: "Determinar el factor de corrección del PkA del equipo",
    tipos_equipo_aplicables: RX_GENERAL,
    orden_sugerido: 8,
    plantilla_informe: "FT-LEC-6c",
    activa: true,
  },
  {
    codigo: "DDI",
    nombre:
      "Control de calidad del indicador de dosis digital (DDI) y del índice de exposición (EI)",
    descripcion: "Verificar DDI y EI del sistema de imagen digital CR/DR",
    tipos_equipo_aplicables: RX_GENERAL,
    orden_sugerido: 9,
    plantilla_informe: "FT-LEC-6c",
    activa: true,
  },
  {
    codigo: "DDI_REP",
    nombre: "Repetibilidad del DDI e índice de exposición (EI)",
    descripcion: "Verificar repetibilidad del DDI y EI",
    tipos_equipo_aplicables: RX_GENERAL,
    orden_sugerido: 10,
    plantilla_informe: "FT-LEC-6c",
    activa: true,
  },
  {
    codigo: "UNI",
    nombre: "Uniformidad y artefactos del detector",
    descripcion: "Evaluar uniformidad de respuesta del detector y artefactos",
    tipos_equipo_aplicables: RX_GENERAL,
    orden_sugerido: 11,
    plantilla_informe: "FT-LEC-6c",
    activa: true,
  },
  {
    codigo: "RES",
    nombre: "Resolución espacial de alto contraste",
    descripcion: "Determinar resolución espacial del sistema de imagen",
    tipos_equipo_aplicables: RX_GENERAL,
    orden_sugerido: 12,
    plantilla_informe: "FT-LEC-6c",
    activa: true,
  },
  {
    codigo: "BAJ",
    nombre: "Umbral de sensibilidad a bajo contraste",
    descripcion: "Evaluar capacidad del sistema para detectar diferencias de bajo contraste",
    tipos_equipo_aplicables: RX_GENERAL,
    orden_sugerido: 13,
    plantilla_informe: "FT-LEC-6c",
    activa: true,
  },
  {
    codigo: "CAS",
    nombre: "Integridad y limpieza de cassettes y pantallas IP CR",
    descripcion: "Verificar estado de cassettes y pantallas de fósforo (solo CR)",
    tipos_equipo_aplicables: RX_GENERAL,
    orden_sugerido: 14,
    plantilla_informe: "FT-LEC-6c",
    activa: true,
  },
  {
    codigo: "CAS_UNI",
    nombre: "Uniformidad de sensibilidad de pantallas IP CR",
    descripcion: "Evaluar uniformidad de sensibilidad de pantallas IP (solo CR)",
    tipos_equipo_aplicables: RX_GENERAL,
    orden_sugerido: 15,
    plantilla_informe: "FT-LEC-6c",
    activa: true,
  },
  {
    codigo: "MTF",
    nombre: "Función de transferencia de modulación (MTF)",
    descripcion: "Determinar MTF en direcciones horizontal y vertical del detector",
    tipos_equipo_aplicables: RX_GENERAL,
    orden_sugerido: 16,
    plantilla_informe: "FT-LEC-6c",
    activa: true,
  },
  {
    codigo: "CAE_S",
    nombre: "Sensibilidad del control automático de exposición (CAE)",
    descripcion: "Verificar sensibilidad del CAE",
    tipos_equipo_aplicables: RX_GENERAL,
    orden_sugerido: 17,
    plantilla_informe: "FT-LEC-6c",
    activa: true,
  },
  {
    codigo: "CAE_C",
    nombre: "Consistencia entre los sensores del CAE",
    descripcion: "Verificar consistencia entre sensores del CAE",
    tipos_equipo_aplicables: RX_GENERAL,
    orden_sugerido: 18,
    plantilla_informe: "FT-LEC-6c",
    activa: true,
  },
  {
    codigo: "CAE_R",
    nombre: "Repetibilidad del CAE",
    descripcion: "Verificar consistencia del DDI/EI para exposiciones repetidas con CAE",
    tipos_equipo_aplicables: RX_GENERAL,
    orden_sugerido: 19,
    plantilla_informe: "FT-LEC-6c",
    activa: true,
  },
  {
    codigo: "CAE_COMP",
    nombre: "Compensación del CAE para diferentes valores de kVp y espesores",
    descripcion: "Verificar respuesta del CAE a distintos kVp y espesores",
    tipos_equipo_aplicables: RX_GENERAL,
    orden_sugerido: 20,
    plantilla_informe: "FT-LEC-6c",
    activa: true,
  },
  {
    codigo: "DOS",
    nombre: "Dosis al receptor",
    descripcion: "Estimar dosis al receptor de imagen bajo condiciones clínicas representativas",
    tipos_equipo_aplicables: RX_GENERAL,
    orden_sugerido: 21,
    plantilla_informe: "FT-LEC-6c",
    activa: true,
  },

  // ─── Pruebas específicas de radiología extraoral (FT-LEC-6b) ───
  {
    codigo: "ALI_PAN",
    nombre: "Alineación del haz del sistema panorámico",
    descripcion:
      "Verificar alineación del campo de radiación con la ranura receptora del panorámico",
    tipos_equipo_aplicables: ["PANORAMICO"],
    orden_sugerido: 3,
    plantilla_informe: "FT-LEC-6b",
    activa: true,
  },
  {
    codigo: "COL_CEF",
    nombre: "Colimación del sistema cefalométrico",
    descripcion: "Verificar colimación del sistema cefalométrico",
    tipos_equipo_aplicables: ["PANORAMICO"],
    orden_sugerido: 4,
    plantilla_informe: "FT-LEC-6b",
    activa: true,
  },
  {
    codigo: "PKL_PKA",
    nombre: "Determinación del producto kerma-área (PKA) y producto kerma-longitud (PKL)",
    descripcion: "Determinar PKA y PKL para equipos panorámicos y CT dental",
    tipos_equipo_aplicables: RX_EXTRAORAL,
    orden_sugerido: 8,
    plantilla_informe: "FT-LEC-6b",
    activa: true,
  },
];

const PERMISOS_DEFAULT: Record<RolUsuario, ModuloApp[]> = {
  coordinador: [...MODULOS_APP],
  programador: [
    "dashboard",
    "clientes",
    "solicitudes",
    "visitas",
    "revision",
    "equipos",
    "informes",
    "sync",
  ],
  tecnico: ["dashboard", "visitas", "revision", "equipos", "informes", "sync"],
  comercial: ["dashboard", "clientes", "solicitudes"],
};

export async function seedRolPermisos(): Promise<void> {
  const count = await db.rol_permisos.count();
  if (count > 0) return;

  const now = new Date().toISOString();
  const records: Omit<RolPermiso, "id">[] = [];

  for (const rol of ROLES_DISPONIBLES) {
    const modulosActivos = PERMISOS_DEFAULT[rol];
    for (const modulo of MODULOS_APP) {
      records.push({
        rol,
        modulo,
        activo: modulosActivos.includes(modulo),
        modificado_en: now,
      });
    }
  }

  await db.rol_permisos.bulkPut(records as RolPermiso[]);
  console.log(`[Seed] ${records.length} permisos de rol cargados`);
}

/**
 * Poblar el catálogo de pruebas si está vacío.
 * Se ejecuta una sola vez al inicializar la app.
 */
export async function seedPruebaDefiniciones(): Promise<void> {
  await seedRolPermisos();

  const count = await db.prueba_definiciones.count();
  if (count > 0) return;

  const now = new Date().toISOString();

  // 1. Seed pruebas genéricas (para tipos sin paquete)
  const records = PRUEBAS_CATALOGO.map((p) => ({
    ...p,
    creado_en: now,
  }));
  await db.prueba_definiciones.bulkPut(records);
  console.log(`[Seed] ${records.length} pruebas genéricas cargadas`);

  // 2. Seed paquetes de pruebas agrupadas
  await seedFromPackage(CONVENCIONAL_PACKAGE);
}

/**
 * Carga un paquete de pruebas: crea GrupoPrueba + PruebaDefinicion enriquecidas.
 * Si el paquete ya está cargado (grupo_pruebas ya existen), no hace nada.
 */
export async function seedFromPackage(paquete: EquipmentPackage): Promise<void> {
  const existing = await db.grupo_pruebas.where("tipo_equipo").equals(paquete.tipo_equipo).count();
  if (existing > 0) return;

  const now = new Date().toISOString();

  await db.transaction("rw", [db.grupo_pruebas, db.prueba_definiciones], async () => {
    for (const grupo of paquete.grupos) {
      const grupoId = (await db.grupo_pruebas.add({
        codigo: grupo.codigo,
        nombre: grupo.nombre,
        tipo_equipo: paquete.tipo_equipo,
        orden: grupo.orden,
        schema_mediciones: grupo.schema_mediciones,
        slots_imagen: grupo.slots_imagen,
        activo: true,
        creado_en: now,
      })) as number;

      for (const prueba of grupo.pruebas) {
        await db.prueba_definiciones.add({
          codigo: prueba.codigo,
          numero_tecdoc: prueba.numero_tecdoc,
          nombre: prueba.nombre,
          descripcion: prueba.descripcion,
          grupo_id: grupoId,
          tipos_equipo_aplicables: [paquete.tipo_equipo],
          orden_en_grupo: prueba.orden_en_grupo,
          orden_sugerido: prueba.orden_global,
          formulas: prueba.formulas,
          criterios_aceptacion: prueba.criterios_aceptacion,
          textos_informe: prueba.textos_informe,
          slots_imagen: prueba.slots_imagen,
          plantilla_informe: paquete.plantilla_informe,
          activa: true,
          creado_en: now,
        });
      }

      console.log(`[Seed] Grupo ${grupo.codigo}: ${grupo.pruebas.length} pruebas cargadas`);
    }
  });

  console.log(`[Seed] Paquete ${paquete.tipo_equipo}: ${paquete.grupos.length} grupos cargados`);
}
