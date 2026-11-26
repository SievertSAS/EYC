import { db } from "@/lib/db";

// ============================================================
//  Gate del concepto "Referencia" de la prueba 2.8 (factor PKA).
//
//  Desde el corte, la 2.8 aplicada lleva concepto "Referencia" (antes se
//  imprimía "NO APLICA"). Un informe YA emitido antes del corte se conserva
//  tal cual al regenerar su PDF (botón "Regenerar", reintento de "Publicar
//  versión oficial"). Todo lo demás usa la lógica nueva: pre-informes, visitas
//  en curso, informes nuevos y versiones nuevas tras corrección del cliente.
// ============================================================

/**
 * Fecha (ISO, YYYY-MM-DD) a partir de la cual las versiones de informe usan
 * "Referencia" en la 2.8. DEBE coincidir con la fecha de despliegue del cambio.
 */
export const CORTE_CONCEPTO_REFERENCIA_28 = "2026-11-26";

/**
 * ¿La 2.8 aplicada se imprime como "Referencia"? (false = legado "NO APLICA").
 *   - `visitaEmitida`: la visita está aprobada/enviada, es decir, se está
 *     renderizando una versión de informe ya emitida. Una visita devuelta por
 *     el cliente vuelve a "en_progreso": su próxima aprobación crea una
 *     versión nueva, así que usa la lógica nueva.
 *   - `fechaGeneracionVersion`: `fecha_generacion` de la versión vigente
 *     (ISO). Sin versión todavía → lógica nueva.
 */
export function usaConceptoReferencia28(opts: {
  visitaEmitida: boolean;
  fechaGeneracionVersion?: string | null;
}): boolean {
  if (!opts.visitaEmitida || !opts.fechaGeneracionVersion) return true;
  return opts.fechaGeneracionVersion.slice(0, 10) >= CORTE_CONCEPTO_REFERENCIA_28;
}

/**
 * Resuelve el gate para una visita leyendo su estado y la versión VIGENTE de
 * su informe (`version_actual`). En una re-aprobación, `crearInformeDesdeVisita`
 * ya creó la versión nueva (fecha_generacion = ahora) antes de publicar, así
 * que el PDF de esa versión sale con la lógica nueva.
 */
export async function resolverConceptoReferencia28(visitaId: string): Promise<boolean> {
  const visita = await db.visitas.get(visitaId);
  if (!visita) return true;
  const visitaEmitida = visita.estado_visita === "aprobada" || visita.estado_visita === "enviada";
  if (!visitaEmitida) return true;

  const informe = await db.informes.where("visita_id").equals(visitaId).first();
  if (!informe?.id) return true;
  const version = await db.informe_versiones
    .where("informe_id")
    .equals(informe.id)
    .and((v) => v.numero_version === informe.version_actual)
    .first();
  // Sin la fila de la versión vigente (p. ej. aún no sincronizada): la fecha
  // de creación del informe es la mejor aproximación disponible.
  return usaConceptoReferencia28({
    visitaEmitida,
    fechaGeneracionVersion: version?.fecha_generacion ?? informe.creado_en,
  });
}
