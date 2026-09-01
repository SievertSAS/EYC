// Helpers del catálogo DIVIPOLA (departamentos / municipios).

/**
 * Busca el id de un departamento o municipio por nombre exacto (case-insensitive).
 * Sirve para sedes antiguas que solo guardan `ciudad` / `departamento` como texto
 * plano, sin el `*_id` del catálogo. Devuelve "" si no hay coincidencia.
 */
export function matchIdPorNombre(
  items: { id: number; nombre: string }[],
  nombre?: string | null
): string {
  if (!nombre) return "";
  const target = nombre.trim().toLowerCase();
  const match = items.find((item) => item.nombre.toLowerCase() === target);
  return match ? String(match.id) : "";
}
