import { db } from "@/lib/db";
import type { Informe, InformeVersion } from "@/lib/db/types";
import { randomUUID } from "@/lib/uuid";

// ============================================================
//  Servicio de creación de informes
//  Se ejecuta automáticamente cuando una visita es aprobada
// ============================================================

/**
 * Genera el número secuencial del informe.
 * Formato: EYC-{AÑO}-{SEQ} (ej: EYC-2026-001)
 */
async function generarNumeroInforme(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `EYC-${year}-`;

  // Buscar el último informe del año
  const informesDelAnio = await db.informes.where("numero_informe").startsWith(prefix).toArray();

  const maxSeq = informesDelAnio.reduce((max, inf) => {
    const parts = inf.numero_informe.split("-");
    const seq = parseInt(parts[2] ?? "0", 10);
    return seq > max ? seq : max;
  }, 0);

  const nextSeq = String(maxSeq + 1).padStart(3, "0");
  return `${prefix}${nextSeq}`;
}

/**
 * Determina el concepto general basado en los resultados de las pruebas.
 * Si CUALQUIER prueba es NO_FAVORABLE, el concepto general es NO_FAVORABLE.
 */
async function determinarConceptoGeneral(visitaId: string): Promise<"FAVORABLE" | "NO_FAVORABLE"> {
  const pruebas = await db.prueba_resultados.where("visita_id").equals(visitaId).toArray();

  const hayNoFavorable = pruebas.some((p) => p.concepto === "NO_FAVORABLE");
  return hayNoFavorable ? "NO_FAVORABLE" : "FAVORABLE";
}

/**
 * Crea un informe y su primera versión a partir de una visita aprobada.
 * Si la visita ya tenía un informe (re-aprobación tras una corrección
 * solicitada por el cliente), en vez de crear uno nuevo agrega una versión
 * adicional sobre el mismo número de informe — así se conserva la
 * trazabilidad completa en la hoja de vida del equipo.
 *
 * @param visitaId - ID de la visita aprobada
 * @param ingenieroId - ID del ingeniero que aprobó
 * @param tecnicoId - ID del técnico que ejecutó la visita
 * @returns El informe (creado o actualizado)
 */
export async function crearInformeDesdeVisita(
  visitaId: string,
  ingenieroId: string,
  tecnicoId: string
): Promise<Informe> {
  const visita = await db.visitas.get(visitaId);
  if (!visita) throw new Error("Visita no encontrada");

  const now = new Date();
  const fechaEmision = now.toISOString().split("T")[0]; // YYYY-MM-DD
  const fechaVencimiento = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate())
    .toISOString()
    .split("T")[0];
  const conceptoGeneral = await determinarConceptoGeneral(visitaId);

  const existente = await db.informes.where("visita_id").equals(visitaId).first();

  if (existente?.id) {
    // Re-aprobación tras corrección por cliente: nueva versión, mismo informe
    const nuevaVersionNum = existente.version_actual + 1;
    await db.informes.update(existente.id, {
      version_actual: nuevaVersionNum,
      concepto_general: conceptoGeneral,
      fecha_emision: fechaEmision,
      fecha_vencimiento: fechaVencimiento,
      estado: "aprobado",
    });

    const version: InformeVersion = {
      id: randomUUID(),
      informe_id: existente.id,
      numero_version: nuevaVersionNum,
      motivo_cambio: "correccion_cliente",
      descripcion_cambio: "Nueva versión tras ajustes solicitados por el cliente",
      generado_por_id: tecnicoId,
      revisado_por_id: ingenieroId,
      fecha_generacion: now.toISOString(),
      fecha_revision: now.toISOString(),
      fecha_aprobacion: now.toISOString(),
      estado: "aprobado",
      creado_en: now.toISOString(),
    };
    await db.informe_versiones.add(version);

    return { ...existente, version_actual: nuevaVersionNum, concepto_general: conceptoGeneral };
  }

  const numeroInforme = await generarNumeroInforme();

  const informe: Informe = {
    id: randomUUID(),
    visita_id: visitaId,
    equipo_id: visita.equipo_id!,
    ubicacion_id: visita.ubicacion_id!,
    numero_informe: numeroInforme,
    version_actual: 1,
    concepto_general: conceptoGeneral,
    qr_token: crypto.randomUUID(),
    fecha_emision: fechaEmision,
    fecha_vencimiento: fechaVencimiento,
    estado: "aprobado",
    creado_en: now.toISOString(),
  };

  const informeId = await db.informes.add(informe);

  // Crear la primera versión
  const version: InformeVersion = {
    id: randomUUID(),
    informe_id: informeId as string,
    numero_version: 1,
    motivo_cambio: "emision_inicial",
    descripcion_cambio: "Emisión inicial del informe",
    generado_por_id: tecnicoId,
    revisado_por_id: ingenieroId,
    fecha_generacion: now.toISOString(),
    fecha_revision: now.toISOString(),
    fecha_aprobacion: now.toISOString(),
    estado: "aprobado",
    creado_en: now.toISOString(),
  };

  await db.informe_versiones.add(version);

  return { ...informe, id: informeId as string };
}
