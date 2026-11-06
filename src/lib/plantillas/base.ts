import type { TipoEquipo } from "@/lib/db/types";
import { pruebasGenericasDeTipo } from "@/lib/db/seed";
import { getPackage } from "@/lib/equipos/registry";
import { CATALOGO_SECCIONES } from "@/lib/equipos/convencional/informe-secciones";
import { CAMPOS_TEXTO_PRUEBA, type TextosPrueba } from "./types";
import { TEXTOS_PRUEBA_GENERICOS, TEXTO_PRUEBA_GENERICO_DEFECTO } from "./textos-genericos";

// ============================================================
//  Plantilla "v0": los textos que vienen en el código. Es lo que usa el
//  informe mientras el coordinador no haya publicado ninguna versión
//  para el tipo de equipo, y el punto de partida del primer borrador.
//  Fuente única: el catálogo de secciones (CONVENCIONAL) y los textos
//  genéricos (resto de tipos) — el generador de PDF ya no tiene copias.
// ============================================================

export const CODIGO_INFORME_DEFECTO = "FT-LEC-6c";

export const TITULO_INFORME_DEFECTO =
  "CONTROL DE CALIDAD Y ESTUDIO AMBIENTAL EN UNIDADES DE RADIOGRAFÍA GENERAL";

export const INTRODUCCION_DEFECTO = [
  "El presente informe técnico documenta los resultados del control de calidad efectuado al equipo generador de radiación ionizante destinado a la práctica de radiología general y emite el correspondiente concepto técnico, en cumplimiento de la Resolución 1811 de 2025 del Ministerio de Salud y Protección Social y demás disposiciones vigentes en materia de protección radiológica.",
  "Las pruebas fueron realizadas conforme a los lineamientos establecidos en el documento IAEA-TECDOC-1958: Protocolos de Control de Calidad para Radiodiagnóstico en América Latina y el Caribe, específicamente en el capítulo correspondiente a Radiología General, aplicando la estructura metodológica definida para cada ensayo técnico.",
  "El control de calidad se ejecutó mediante un procedimiento técnico no invasivo, desarrollado bajo condiciones normales de operación del equipo y sin intervención física sobre sus componentes internos, con el fin de verificar que los parámetros físicos y operacionales del sistema radiográfico se encuentren dentro de los criterios de aceptación establecidos.",
  "El presente informe tendrá una vigencia máxima de dos (2) años, contados a partir de la fecha de su emisión, siempre que no se presenten modificaciones técnicas, estructurales u operativas que alteren las condiciones evaluadas.",
].join("\n\n");

export interface PruebaBase {
  codigo: string;
  nombre: string;
  /** Solo los campos que esa prueba usa en el informe. */
  textos: TextosPrueba;
}

export interface PlantillaBase {
  codigo: string;
  tituloInforme: string;
  introduccion: string;
  pruebas: PruebaBase[];
  /** Texto para una prueba que no está en `pruebas` (solo tipos sin paquete). */
  textoPorDefecto: TextosPrueba;
}

/** Copia solo los campos de texto definidos (no vacíos) de un objeto. */
function soloTextos(origen: Partial<Record<string, unknown>>): TextosPrueba {
  const t: TextosPrueba = {};
  for (const campo of CAMPOS_TEXTO_PRUEBA) {
    const v = origen[campo];
    if (typeof v === "string" && v.trim() !== "") t[campo] = v;
  }
  return t;
}

/**
 * Código documental de un tipo sin paquete: el de sus pruebas específicas
 * (ej. extraorales → FT-LEC-6b); si todas son comunes, el de radiografía general.
 */
function codigoGenerico(tipo: TipoEquipo): string {
  const codigos = pruebasGenericasDeTipo(tipo)
    .map((p) => p.plantilla_informe)
    .filter((c): c is string => !!c && c !== CODIGO_INFORME_DEFECTO);
  return codigos[0] ?? CODIGO_INFORME_DEFECTO;
}

export function plantillaBase(tipo: TipoEquipo): PlantillaBase {
  const paquete = getPackage(tipo);
  if (paquete) {
    // Hoy el único paquete es CONVENCIONAL, cuyo catálogo de secciones es
    // CATALOGO_SECCIONES. Un paquete nuevo agregaría aquí su catálogo.
    return {
      codigo: paquete.plantilla_informe,
      tituloInforme: TITULO_INFORME_DEFECTO,
      introduccion: INTRODUCCION_DEFECTO,
      pruebas: CATALOGO_SECCIONES.map((c) => ({
        codigo: c.codigo,
        nombre: c.nombre,
        textos: soloTextos(c as unknown as Record<string, unknown>),
      })),
      textoPorDefecto: {},
    };
  }
  return {
    codigo: codigoGenerico(tipo),
    tituloInforme: TITULO_INFORME_DEFECTO,
    introduccion: INTRODUCCION_DEFECTO,
    pruebas: pruebasGenericasDeTipo(tipo).map((p) => ({
      codigo: p.codigo,
      nombre: p.nombre,
      textos: { ...(TEXTOS_PRUEBA_GENERICOS[p.codigo] ?? TEXTO_PRUEBA_GENERICO_DEFECTO) },
    })),
    textoPorDefecto: TEXTO_PRUEBA_GENERICO_DEFECTO,
  };
}
