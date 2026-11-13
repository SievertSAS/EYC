import { PARAMETROS_CONSOLA, type ParametroConsola } from "@/lib/db/types";

// ============================================================
//  Parámetros nominales que muestra la consola (#189, paso 1).
//  Helpers puros del checklist: la selección siempre queda en el orden
//  canónico de `PARAMETROS_CONSOLA` y "sin selección" se guarda como null.
// ============================================================

type Seleccion = readonly ParametroConsola[] | null | undefined;

/** Ordena según `PARAMETROS_CONSOLA` y elimina duplicados. */
function canonico(sel: Seleccion): ParametroConsola[] {
  const set = new Set(sel ?? []);
  return PARAMETROS_CONSOLA.filter((p) => set.has(p));
}

/** Marca o desmarca `p`; devuelve un arreglo nuevo en orden canónico. */
export function toggleParametro(sel: Seleccion, p: ParametroConsola): ParametroConsola[] {
  const actual = canonico(sel);
  return actual.includes(p) ? actual.filter((x) => x !== p) : canonico([...actual, p]);
}

/** `true` si hay al menos un parámetro marcado. */
export function parametrosConsolaDefinidos(v: Seleccion): boolean {
  return Array.isArray(v) && v.length > 0;
}

/** Valor a persistir: selección vacía → `null` (columna sin definir). */
export function normalizarParametrosConsola(sel: Seleccion): ParametroConsola[] | null {
  const out = canonico(sel);
  return out.length > 0 ? out : null;
}
