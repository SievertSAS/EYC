// ============================================================
//  Detección de clientes duplicados por NIT o nombre
//  Se valida contra los clientes locales (Dexie) antes de guardar.
// ============================================================

interface ClienteComparable {
  id?: string;
  nombre_cliente: string;
  nit?: string;
  deleted_at?: string | null;
}

export interface ClienteDuplicado<T extends ClienteComparable> {
  campo: "nit" | "nombre";
  cliente: T;
}

/** Solo dígitos: "800.189.984" y "800189984" son el mismo NIT. */
export function normalizarNit(nit: string | undefined): string {
  return (nit ?? "").replace(/\D/g, "");
}

/** Minúsculas, sin tildes, sin puntuación y con espacios colapsados. */
export function normalizarNombre(nombre: string | undefined): string {
  return (nombre ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Busca un cliente existente con el mismo NIT o nombre. El NIT tiene
 * prioridad. `excluirId` evita que un cliente en edición choque consigo mismo.
 */
export function buscarClienteDuplicado<T extends ClienteComparable>(
  existentes: T[],
  candidato: ClienteComparable,
  excluirId?: string
): ClienteDuplicado<T> | null {
  const otros = existentes.filter((c) => c.id !== excluirId && !c.deleted_at);

  const nit = normalizarNit(candidato.nit);
  if (nit) {
    const porNit = otros.find((c) => normalizarNit(c.nit) === nit);
    if (porNit) return { campo: "nit", cliente: porNit };
  }

  const nombre = normalizarNombre(candidato.nombre_cliente);
  if (nombre) {
    const porNombre = otros.find((c) => normalizarNombre(c.nombre_cliente) === nombre);
    if (porNombre) return { campo: "nombre", cliente: porNombre };
  }

  return null;
}
