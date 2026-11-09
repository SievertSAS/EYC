import { z } from "zod/v4";
import { TIPOS_EQUIPO, type TipoEquipo } from "@/lib/db/types";

// ============================================================
//  Plantillas de informe versionadas por tipo de equipo (#196)
//
//  El coordinador edita un BORRADOR y lo PUBLICA como versión nueva
//  (v1, v2…). Las versiones publicadas son inmutables (trigger en la base,
//  migración 045). El informe usa siempre la última publicada; sin
//  ninguna, el catálogo en código hace de "v0" (ver ./base.ts).
// ============================================================

/** Campos de texto editables de cada prueba (mismos nombres que SeccionInfoCatalogo). */
export const CAMPOS_TEXTO_PRUEBA = [
  "objetivo",
  "instrumentacion",
  "metodologia",
  "metodologiaNoAplica",
  "criterio",
  "descripcionInstalacion",
  "analisis",
  "accionesConforme",
  "accionesNoConforme",
] as const;
export type CampoTextoPrueba = (typeof CAMPOS_TEXTO_PRUEBA)[number];

export const CAMPO_TEXTO_LABELS: Record<CampoTextoPrueba, string> = {
  objetivo: "Objetivo",
  instrumentacion: "Instrumentación",
  metodologia: "Metodología",
  metodologiaNoAplica: 'Motivo de "No aplica"',
  criterio: "Criterio de aceptación",
  descripcionInstalacion: "Descripción de la instalación y blindajes",
  analisis: "Análisis",
  accionesConforme: "Acciones correctivas (Conforme)",
  accionesNoConforme: "Acciones correctivas (No conforme)",
};

/** Textos de una prueba. Un campo ausente o vacío cae al texto del catálogo. */
export type TextosPrueba = Partial<Record<CampoTextoPrueba, string>>;

/**
 * Variante de texto de la plantilla para un tipo de instalación (#187). Mismo
 * formato que la plantilla, pero solo con lo que cambia: al resolver se
 * combina campo a campo sobre los textos del equipo fijo, y un campo ausente
 * o vacío cae al del fijo.
 */
export interface VariantePlantilla {
  introduccion?: string;
  pruebas?: Record<string, TextosPrueba>;
}

/** Variantes por tipo de instalación. El fijo es la plantilla misma. */
export interface VariantesPlantilla {
  portatil?: VariantePlantilla;
}

/** Contenido de una plantilla: textos de informe + textos por código de prueba. */
export interface ContenidoPlantilla {
  /** Título de la portada (va después del código del informe). */
  tituloInforme?: string;
  /** INTRODUCCIÓN — párrafos separados por una línea en blanco. */
  introduccion?: string;
  pruebas: Record<string, TextosPrueba>;
  /** Textos que cambian según el tipo de instalación (hoy solo el portátil, #187). */
  variantes?: VariantesPlantilla;
}

export type EstadoPlantilla = "borrador" | "publicada";

/** Fila de `plantillas_informe` (Supabase + Dexie, tabla maestra). */
export interface PlantillaInforme {
  id: string;
  tipo_equipo: TipoEquipo;
  /** Código documental del informe (ej. "FT-LEC-6c"). */
  codigo: string;
  /** Número de versión; null mientras es borrador. Interno: no se imprime. */
  version: number | null;
  estado: EstadoPlantilla;
  contenido: ContenidoPlantilla;
  creada_por?: string | null;
  publicada_por?: string | null;
  publicada_en?: string | null;
  creado_en?: string;
  last_modified?: string;
  deleted_at?: string | null;
}

// ─── Validación (API) ───

const MAX_TEXTO = 20000;
const texto = z.string().max(MAX_TEXTO);

export const textosPruebaSchema = z
  .object(Object.fromEntries(CAMPOS_TEXTO_PRUEBA.map((c) => [c, texto.optional()])))
  .strict();

const pruebasSchema = z
  .record(z.string().regex(/^[A-Za-z0-9_.]{1,20}$/), textosPruebaSchema)
  .refine((p) => Object.keys(p).length <= 200, { message: "Demasiadas pruebas" });

const varianteSchema = z
  .object({ introduccion: texto.optional(), pruebas: pruebasSchema.optional() })
  .strict();

export const contenidoPlantillaSchema = z
  .object({
    tituloInforme: z.string().max(500).optional(),
    introduccion: texto.optional(),
    pruebas: pruebasSchema,
    variantes: z.object({ portatil: varianteSchema.optional() }).strict().optional(),
  })
  .strict();

const tipoEquipoSchema = z.enum(TIPOS_EQUIPO);

export const guardarBorradorSchema = z.object({
  tipo_equipo: tipoEquipoSchema,
  codigo: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(1).max(40)),
  contenido: contenidoPlantillaSchema,
});
export type GuardarBorradorInput = z.infer<typeof guardarBorradorSchema>;

export const publicarPlantillaSchema = z.object({ tipo_equipo: tipoEquipoSchema });
