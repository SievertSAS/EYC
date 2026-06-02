import { db } from "@/lib/db";
import type { Informe, InformeVersion } from "@/lib/db/types";

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
async function determinarConceptoGeneral(visitaId: number): Promise<"FAVORABLE" | "NO_FAVORABLE"> {
  const pruebas = await db.prueba_resultados.where("visita_id").equals(visitaId).toArray();

  const hayNoFavorable = pruebas.some((p) => p.concepto === "NO_FAVORABLE");
  return hayNoFavorable ? "NO_FAVORABLE" : "FAVORABLE";
}

/**
 * Crea un informe y su primera versión a partir de una visita aprobada.
 *
 * @param visitaId - ID de la visita aprobada
 * @param ingenieroId - ID del ingeniero que aprobó
 * @param tecnicoId - ID del técnico que ejecutó la visita
 * @returns El informe creado
 */
export async function crearInformeDesdeVisita(
  visitaId: number,
  ingenieroId: number,
  tecnicoId: number
): Promise<Informe> {
  const visita = await db.visitas.get(visitaId);
  if (!visita) throw new Error("Visita no encontrada");

  // Verificar que no exista ya un informe para esta visita
  const existente = await db.informes.where("visita_id").equals(visitaId).first();
  if (existente) return existente;

  const now = new Date();
  const fechaEmision = now.toISOString().split("T")[0]; // YYYY-MM-DD
  const fechaVencimiento = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate())
    .toISOString()
    .split("T")[0];

  const numeroInforme = await generarNumeroInforme();
  const conceptoGeneral = await determinarConceptoGeneral(visitaId);

  const informe: Informe = {
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
    informe_id: informeId as number,
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

  return { ...informe, id: informeId as number };
}
