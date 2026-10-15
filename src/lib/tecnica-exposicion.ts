// ============================================================
//  Técnica de exposición: corriente × tiempo = carga (mA × t = mAs)
//
//  Según el equipo, la consola muestra cualquier par de los tres valores. Si
//  hay exactamente dos, se calcula el que falta. Nunca se recalcula un valor
//  ya cargado: las consolas redondean (200 mA × 0,032 s puede mostrarse como
//  6,3 mAs) y lo registrado debe coincidir con lo que se lee en la consola.
// ============================================================

export interface Tecnica {
  ma?: number | null;
  t?: number | null;
  mas?: number | null;
}

export type CampoTecnica = keyof Tecnica;

const DECIMALES: Record<CampoTecnica, number> = { ma: 1, t: 4, mas: 2 };

const redondear = (n: number, decimales: number) => Number(n.toFixed(decimales));

const tiene = (n: number | null | undefined): n is number => n != null && Number.isFinite(n);

/** El campo faltante y su valor calculado, o `null` si no hay exactamente dos valores utilizables. */
export function completarTecnica({ ma, t, mas }: Tecnica): {
  campo: CampoTecnica;
  valor: number;
} | null {
  const calcular = (): [CampoTecnica, number] | null => {
    if (tiene(ma) && tiene(t) && !tiene(mas)) return ["mas", ma * t];
    if (tiene(ma) && tiene(mas) && !tiene(t)) return ma > 0 ? ["t", mas / ma] : null;
    if (tiene(t) && tiene(mas) && !tiene(ma)) return t > 0 ? ["ma", mas / t] : null;
    return null;
  };
  const r = calcular();
  if (!r) return null;
  const [campo, valor] = r;
  return { campo, valor: redondear(valor, DECIMALES[campo]) };
}

/** Lee mA / t / mAs de un registro con nombres de columna propios. */
export function leerTecnica<K extends string>(
  campos: Record<CampoTecnica, K>,
  registro: Partial<Record<K, number | null | undefined>>
): Tecnica {
  return { ma: registro[campos.ma], t: registro[campos.t], mas: registro[campos.mas] };
}

/** El campo de la técnica que corresponde a `columna`, o undefined si no es de la técnica. */
export function campoDeColumna<K extends string>(
  campos: Record<CampoTecnica, K>,
  columna: string
): CampoTecnica | undefined {
  return (Object.keys(campos) as CampoTecnica[]).find((c) => campos[c] === columna);
}

/**
 * Igual que `completarTecnica`, pero sobre un registro con nombres de columna
 * propios (ej. `ma_nominal`): devuelve el patch a guardar, vacío si no aplica.
 */
export function patchTecnica<K extends string>(
  campos: Record<CampoTecnica, K>,
  registro: Partial<Record<K, number | null | undefined>>
): Partial<Record<K, number>> {
  const r = completarTecnica(leerTecnica(campos, registro));
  return r ? ({ [campos[r.campo]]: r.valor } as Partial<Record<K, number>>) : {};
}

/** Diferencia relativa aceptada entre mA × t y mAs (redondeo de consola). */
const TOLERANCIA = 0.05;

/** Orden por defecto para elegir el campo a recalcular: mAs suele ser el derivado. */
const PRIORIDAD: CampoTecnica[] = ["mas", "t", "ma"];

/** Agrega `campo` al historial de edición (más reciente primero, sin repetidos). */
export function registrarEdicion(historial: CampoTecnica[], campo: CampoTecnica): CampoTecnica[] {
  return [campo, ...historial.filter((c) => c !== campo)];
}

/**
 * Con los tres valores cargados pero sin cumplir mA × t = mAs (fuera de la
 * tolerancia), el campo que quedó desactualizado: el primero según
 * `PRIORIDAD` que no esté entre las dos últimas ediciones. `null` si cuadran
 * o falta algún valor.
 */
export function campoDesactualizado(
  { ma, t, mas }: Tecnica,
  historial: CampoTecnica[]
): CampoTecnica | null {
  if (!tiene(ma) || !tiene(t) || !tiene(mas)) return null;
  const esperado = ma * t;
  const base = Math.max(Math.abs(esperado), Math.abs(mas));
  if (base === 0 || Math.abs(esperado - mas) / base <= TOLERANCIA) return null;
  const recientes = historial.slice(0, 2);
  return PRIORIDAD.find((c) => !recientes.includes(c)) ?? null;
}

/** Recalcula `campo` a partir de los otros dos, o `null` si no se puede. */
export function recalcularCampo(tecnica: Tecnica, campo: CampoTecnica): number | null {
  const r = completarTecnica({ ...tecnica, [campo]: null });
  return r?.campo === campo ? r.valor : null;
}
