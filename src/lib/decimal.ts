// ============================================================
//  Estándar de separador decimal — es-CO (coma)
//
//  Contexto (issue #68): no había una regla. `<input type="number">` se
//  comporta distinto según el locale del navegador/tablet, y varios sitios
//  hacían `parseFloat("1,8")` → 1 (se pierde el decimal en silencio), sobre
//  valores medidos que definen la conformidad.
//
//  Regla única:
//   - En la base: `number` de JS (punto interno). Neutro de idioma. No cambia.
//   - Al mostrar (informe + UI): coma decimal (Intl.NumberFormat "es-CO").
//   - Al ingresar: se acepta coma Y punto; se normaliza a punto antes de
//     `parseFloat`.
// ============================================================

/**
 * Convierte lo que el usuario tipeó a un número. Acepta coma o punto como
 * separador decimal, y tolera separadores de miles ("1.234,56" / "1,234.56").
 * Devuelve `undefined` si la cadena está vacía o no es un número.
 */
export function parseDecimal(raw: string | number | null | undefined): number | undefined {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : undefined;
  if (raw == null) return undefined;

  let s = String(raw).trim();
  if (s === "") return undefined;

  // Deja solo dígitos, separadores, signo.
  s = s.replace(/[^\d.,\-+]/g, "");
  if (s === "" || s === "-" || s === "+") return undefined;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  if (lastComma !== -1 && lastDot !== -1) {
    // El separador que aparece MÁS a la derecha es el decimal; el otro, miles.
    if (lastComma > lastDot) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (lastComma !== -1) {
    // Solo coma. Una sola → decimal ("1,8"). Varias → miles ("1,234,567").
    s = s.split(",").length === 2 ? s.replace(",", ".") : s.replace(/,/g, "");
  } else if ((s.match(/\./g)?.length ?? 0) > 1) {
    // Solo puntos, más de uno → todos son separadores de miles ("1.234.567").
    s = s.replace(/\./g, "");
  }
  // Un solo punto (o ninguno): ya está en formato JS.

  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

const nf = (decimals?: number) =>
  new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? 3,
    useGrouping: false,
  });

/**
 * Formatea un número para mostrar con convención es-CO (coma decimal).
 * `undefined` / `null` / no-número → `fallback` (por defecto "—").
 * Con `decimals` fija la cantidad exacta de decimales.
 */
export function formatDecimal(
  n: number | null | undefined,
  decimals?: number,
  fallback = "—"
): string {
  if (n == null || !Number.isFinite(n)) return fallback;
  return nf(decimals).format(n);
}

/**
 * Igual que `formatDecimal` pero pensado para el `value` de un input de
 * texto: string vacío si no hay número (no "—"), sin agrupar.
 */
export function decimalInputValue(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  return nf().format(n);
}
