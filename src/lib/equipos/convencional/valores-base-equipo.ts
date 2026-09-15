// ============================================================
//  Valores base de pruebas 2.x a nivel de EQUIPO (#110)
//
//  Funciones puras (sin Dexie) que deciden QUÉ escribir/leer en
//  `conv_equipo_valores_base` a partir de los campos de la tabla de
//  visita correspondiente. La escritura/lectura real de Dexie vive en
//  cada módulo de captura (grupo-b/c/d/e), que llama a estas funciones.
// ============================================================

import type { ConvEquipoValoresBase } from "./db/types";

/** Campos de `ConvCaeSetup` que existen con el mismo nombre en `ConvEquipoValoresBase`. */
export const CAMPOS_BASE_CAE = [
  "mas_base_217",
  "ei_base_217",
  "di_base_217",
  "mas_base_60kv",
  "ei_base_60kv",
  "di_base_60kv",
  "mas_base_70kv",
  "ei_base_70kv",
  "di_base_70kv",
  "mas_base_80kv",
  "ei_base_80kv",
  "di_base_80kv",
  "mas_base_cu1",
  "ei_base_cu1",
  "di_base_cu1",
  "mas_base_cu2",
  "ei_base_cu2",
  "di_base_cu2",
  "mas_base_cu3",
  "ei_base_cu3",
  "di_base_cu3",
] as const satisfies readonly (keyof ConvEquipoValoresBase)[];

/** Campos de `ConvMtf` que existen con el mismo nombre en `ConvEquipoValoresBase`. */
export const CAMPOS_BASE_MTF = [
  "mtf50_base_horizontal",
  "mtf20_base_horizontal",
  "mtf50_base_vertical",
  "mtf20_base_vertical",
] as const satisfies readonly (keyof ConvEquipoValoresBase)[];

/**
 * De los campos que se van a guardar en la tabla de visita, extrae solo los
 * que también son un valor base de equipo (incluido `undefined` explícito,
 * para propagar un borrado). Devuelve `null` si `fields` no toca ninguno.
 */
export function extraerValoresBaseParaEquipo<K extends keyof ConvEquipoValoresBase>(
  fields: Record<string, unknown>,
  campos: readonly K[]
): Partial<Pick<ConvEquipoValoresBase, K>> | null {
  let encontrado = false;
  const out: Partial<Pick<ConvEquipoValoresBase, K>> = {};
  for (const campo of campos) {
    if (campo in fields) {
      encontrado = true;
      out[campo] = fields[campo] as ConvEquipoValoresBase[K];
    }
  }
  return encontrado ? out : null;
}

/**
 * De los valores base ya guardados a nivel de equipo, cuáles hace falta
 * precargar en la tabla de visita: solo los que la visita todavía no tiene
 * (`actual[campo] == null`) y el equipo sí (`equipoBase[campo] != null`).
 * Devuelve `null` si no hay nada que precargar.
 */
export function calcularPrecarga<K extends keyof ConvEquipoValoresBase>(
  equipoBase: Partial<Pick<ConvEquipoValoresBase, K>> | null | undefined,
  actual: Partial<Record<K, unknown>> | null | undefined,
  campos: readonly K[]
): Partial<Pick<ConvEquipoValoresBase, K>> | null {
  if (!equipoBase) return null;
  let encontrado = false;
  const out: Partial<Pick<ConvEquipoValoresBase, K>> = {};
  for (const campo of campos) {
    const enEquipo = equipoBase[campo];
    const enVisita = actual?.[campo];
    if (enEquipo != null && enVisita == null) {
      encontrado = true;
      out[campo] = enEquipo;
    }
  }
  return encontrado ? out : null;
}

// ─── 2.9 (DDI/EI) — nombres distintos entre visita y equipo ───

/** `ConvDdiMedicion.ei_base`/`.di_base` (visita) → `ei_base_29`/`di_base_29` (equipo). */
export function mapearBase29AEquipo(fields: {
  ei_base?: number;
  di_base?: number;
}): Pick<ConvEquipoValoresBase, "ei_base_29" | "di_base_29"> | null {
  const out: Partial<Pick<ConvEquipoValoresBase, "ei_base_29" | "di_base_29">> = {};
  let encontrado = false;
  if ("ei_base" in fields) {
    out.ei_base_29 = fields.ei_base;
    encontrado = true;
  }
  if ("di_base" in fields) {
    out.di_base_29 = fields.di_base;
    encontrado = true;
  }
  return encontrado ? (out as Pick<ConvEquipoValoresBase, "ei_base_29" | "di_base_29">) : null;
}

/** `ei_base_29`/`di_base_29` (equipo) → `{ ei_base, di_base }` para precargar la visita. */
export function precargarBase29DesdeEquipo(
  equipoBase: Pick<ConvEquipoValoresBase, "ei_base_29" | "di_base_29"> | null | undefined,
  actual: { ei_base?: number; di_base?: number } | null | undefined
): { ei_base?: number; di_base?: number } | null {
  if (!equipoBase) return null;
  const out: { ei_base?: number; di_base?: number } = {};
  let encontrado = false;
  if (equipoBase.ei_base_29 != null && actual?.ei_base == null) {
    out.ei_base = equipoBase.ei_base_29;
    encontrado = true;
  }
  if (equipoBase.di_base_29 != null && actual?.di_base == null) {
    out.di_base = equipoBase.di_base_29;
    encontrado = true;
  }
  return encontrado ? out : null;
}

// ─── 2.21 (dosis al receptor) — desglosado por programa clínico fijo ───

/** Los 3 `programa_clinico` de `sin_rejilla` (`PROGRAMAS_CLINICOS` en grupo-b-modulo.tsx). */
export const CAMPO_DOSIS_BASE_POR_PROGRAMA: Record<
  string,
  keyof Pick<
    ConvEquipoValoresBase,
    "dosis_base_extremidades_mgy" | "dosis_base_torax_mgy" | "dosis_base_columna_mgy"
  >
> = {
  Extremidad: "dosis_base_extremidades_mgy",
  "Tórax AP": "dosis_base_torax_mgy",
  "Columna AP": "dosis_base_columna_mgy",
};

/** Campo de `ConvEquipoValoresBase` para el `dosis_base_mgy` de un `programa_clinico` dado. */
export function campoDosisBasePorPrograma(
  programaClinico: string | null | undefined
): keyof ConvEquipoValoresBase | undefined {
  return programaClinico ? CAMPO_DOSIS_BASE_POR_PROGRAMA[programaClinico] : undefined;
}
