import { db } from "@/lib/db";
import type { ChangeLog } from "@/lib/db/types";

// ============================================================
//  Auditoría de cambios — tracking genérico
//  Registra qué campo cambió, valor anterior y nuevo,
//  quién hizo el cambio y cuándo.
// ============================================================

/**
 * Registra un cambio individual en change_logs.
 */
export async function trackChange(
  tabla: string,
  registroId: number,
  campo: string,
  valorAnterior: string | undefined,
  valorNuevo: string | undefined,
  modificadoPorId: number
): Promise<void> {
  await db.change_logs.add({
    tabla,
    registro_id: registroId,
    campo,
    valor_anterior: valorAnterior,
    valor_nuevo: valorNuevo,
    modificado_por_id: modificadoPorId,
    fecha: new Date().toISOString(),
  } as ChangeLog);
}

/**
 * Compara un objeto existente con los cambios propuestos,
 * loguea solo los campos que realmente cambiaron,
 * y aplica el update.
 *
 * @param tabla      Nombre de la tabla Dexie (e.g., "clientes")
 * @param dexieTable Referencia a la tabla Dexie (e.g., db.clientes)
 * @param registroId ID del registro a actualizar
 * @param changes    Objeto parcial con los nuevos valores
 * @param tecnicoId  ID del técnico que realiza el cambio
 * @returns          Lista de campos que cambiaron
 */
export async function updateWithTracking<T extends Record<string, unknown>>(
  tabla: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dexieTable: {
    get: (id: number) => Promise<T | undefined>;
    update: (id: number, changes: Partial<T>) => Promise<number>;
  },
  registroId: number,
  changes: Partial<T>,
  tecnicoId: number
): Promise<string[]> {
  const existing = await dexieTable.get(registroId);
  if (!existing) return [];

  const changedFields: string[] = [];
  const now = new Date().toISOString();

  for (const [campo, nuevoValor] of Object.entries(changes)) {
    const anteriorValor = existing[campo];

    // Solo loguear si realmente cambió
    if (stringify(anteriorValor) !== stringify(nuevoValor)) {
      changedFields.push(campo);

      await db.change_logs.add({
        tabla,
        registro_id: registroId,
        campo,
        valor_anterior: stringify(anteriorValor),
        valor_nuevo: stringify(nuevoValor),
        modificado_por_id: tecnicoId,
        fecha: now,
      } as ChangeLog);
    }
  }

  if (changedFields.length > 0) {
    await dexieTable.update(registroId, changes);
  }

  return changedFields;
}

/**
 * Obtiene el historial de cambios para un registro.
 */
export async function getChangeHistory(tabla: string, registroId: number): Promise<ChangeLog[]> {
  return db.change_logs
    .where("[tabla+registro_id]")
    .equals([tabla, registroId])
    .toArray()
    .catch(() => {
      // Fallback si el índice compuesto no existe
      return db.change_logs
        .where("tabla")
        .equals(tabla)
        .filter((log) => log.registro_id === registroId)
        .toArray();
    });
}

function stringify(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}
