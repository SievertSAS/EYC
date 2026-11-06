import { db, noBorrado } from "@/lib/db";
import type { TipoEquipo } from "@/lib/db/types";
import type { SeccionInfoCatalogo } from "@/lib/equipos/convencional/informe-secciones";
import { plantillaBase, type PruebaBase } from "./base";
import {
  CAMPOS_TEXTO_PRUEBA,
  type ContenidoPlantilla,
  type PlantillaInforme,
  type TextosPrueba,
} from "./types";

// ============================================================
//  Resolución de la plantilla vigente (#196).
//
//  Prioridad de un texto en el informe:
//    1. edición por visita del ingeniero (conv_informe_secciones) — la
//       aplica el generador de PDF / editor, no este módulo;
//    2. última versión PUBLICADA de la plantilla del tipo de equipo;
//    3. catálogo en código ("v0", ./base.ts).
//  Campo a campo: un texto vacío en la plantilla cae al catálogo.
// ============================================================

export interface PlantillaResuelta {
  tipoEquipo: TipoEquipo;
  /** id de la fila publicada usada, o null si son los textos del código (v0). */
  plantillaId: string | null;
  /** Versión publicada (0 = catálogo en código). Interna: no se imprime. */
  version: number;
  codigo: string;
  tituloInforme: string;
  introduccion: string;
  /** Pruebas del tipo, en orden, con sus textos efectivos. */
  pruebas: PruebaBase[];
  /** Textos efectivos para un código que no está en `pruebas`. */
  textoPorDefecto: TextosPrueba;
}

function conTexto(v: string | undefined): v is string {
  return typeof v === "string" && v.trim() !== "";
}

/** Combina los textos: los de la plantilla (no vacíos) sobre los del catálogo. */
function combinarTextos(base: TextosPrueba, plantilla: TextosPrueba | undefined): TextosPrueba {
  const out: TextosPrueba = { ...base };
  if (!plantilla) return out;
  for (const campo of CAMPOS_TEXTO_PRUEBA) {
    const v = plantilla[campo];
    // Solo campos que la prueba usa: un texto para un campo inexistente en
    // el catálogo (p. ej. "analisis" de la 2.1) no tendría dónde imprimirse.
    if (conTexto(v) && campo in base) out[campo] = v;
  }
  return out;
}

/** Plantilla efectiva de un tipo dada su última versión publicada (o ninguna). */
export function resolverPlantilla(
  tipoEquipo: TipoEquipo,
  publicada?: PlantillaInforme | null
): PlantillaResuelta {
  const base = plantillaBase(tipoEquipo);
  const contenido = publicada?.contenido;
  return {
    tipoEquipo,
    plantillaId: publicada?.id ?? null,
    version: publicada?.version ?? 0,
    codigo: conTexto(publicada?.codigo) ? publicada.codigo.trim() : base.codigo,
    tituloInforme: conTexto(contenido?.tituloInforme)
      ? contenido.tituloInforme.trim()
      : base.tituloInforme,
    introduccion: conTexto(contenido?.introduccion) ? contenido.introduccion : base.introduccion,
    pruebas: base.pruebas.map((p) => ({
      ...p,
      textos: combinarTextos(p.textos, contenido?.pruebas?.[p.codigo]),
    })),
    textoPorDefecto: base.textoPorDefecto,
  };
}

/** Textos efectivos de una prueba (vacío si el código no existe en un tipo con paquete). */
export function textosDePrueba(p: PlantillaResuelta, codigo: string): TextosPrueba {
  return p.pruebas.find((x) => x.codigo === codigo)?.textos ?? p.textoPorDefecto;
}

/** Sección del catálogo con los textos de la plantilla aplicados (nombre/grupo/orden intactos). */
export function seccionConPlantilla(
  cat: SeccionInfoCatalogo,
  p: PlantillaResuelta
): SeccionInfoCatalogo {
  return { ...cat, ...textosDePrueba(p, cat.codigo) } as SeccionInfoCatalogo;
}

/** Párrafos de la INTRODUCCIÓN (separados por línea en blanco). */
export function parrafosIntroduccion(p: PlantillaResuelta): string[] {
  return p.introduccion
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Contenido efectivo completo — punto de partida del editor de plantillas. */
export function contenidoDe(p: PlantillaResuelta): ContenidoPlantilla {
  return {
    tituloInforme: p.tituloInforme,
    introduccion: p.introduccion,
    pruebas: Object.fromEntries(p.pruebas.map((x) => [x.codigo, { ...x.textos }])),
  };
}

/** Versiones publicadas (no borradas) de un tipo, de la más nueva a la más vieja. */
export async function versionesPublicadas(tipoEquipo: TipoEquipo): Promise<PlantillaInforme[]> {
  const filas = await db.plantillas_informe
    .where("[tipo_equipo+estado]")
    .equals([tipoEquipo, "publicada"])
    .filter(noBorrado)
    .toArray();
  return filas.sort((a, b) => (b.version ?? 0) - (a.version ?? 0));
}

/**
 * Plantilla vigente de un tipo de equipo: la última versión publicada en
 * IndexedDB (llega por el pull de tablas maestras) o el catálogo en código.
 */
export async function obtenerPlantillaVigente(tipoEquipo: TipoEquipo): Promise<PlantillaResuelta> {
  const [ultima] = await versionesPublicadas(tipoEquipo);
  return resolverPlantilla(tipoEquipo, ultima);
}
