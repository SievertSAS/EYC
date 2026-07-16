import QRCode from "qrcode";
import { db } from "@/lib/db";
import { createClient } from "@/lib/supabase/client";
import { generarPreInforme } from "@/lib/pdf/generar-pre-informe";
import { logger } from "@/lib/logger";

// ============================================================
//  Publicación de la versión oficial de un informe:
//  genera el PDF final (con QR de verificación embebido), calcula
//  su hash SHA-256 y lo sube a Supabase Storage. Es el artefacto
//  inmutable contra el que se puede verificar cualquier copia.
// ============================================================

async function hashBlob(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Genera y publica la versión oficial (PDF con QR + hash en Storage) del
 * informe de una visita ya aprobada. No lanza si falla — la transición de
 * estado ya ocurrió; el llamador decide si avisa al usuario y permite
 * reintentar (ver botón "Publicar versión oficial" en informes/[id]).
 */
export async function publicarVersionOficial(
  informeId: string,
  visitaId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const informe = await db.informes.get(informeId);
    if (!informe) return { success: false, error: "Informe no encontrado" };

    const qrUrl = `${window.location.origin}/verificar/${informe.qr_token}`;
    const qrDataUrl = await QRCode.toDataURL(qrUrl, { errorCorrectionLevel: "M" });

    const blob = await generarPreInforme(visitaId, { qrDataUrl });
    if (!blob) return { success: false, error: "No se pudo generar el PDF" };

    const hash = await hashBlob(blob);
    const path = `${informeId}/v${informe.version_actual}.pdf`;

    const supabase = createClient();
    const { error: uploadError } = await supabase.storage.from("informes").upload(path, blob, {
      upsert: true,
      contentType: "application/pdf",
    });
    if (uploadError) {
      logger.error("publicar-informe", "Error subiendo PDF oficial a Storage", uploadError);
      return { success: false, error: uploadError.message };
    }

    const version = await db.informe_versiones
      .where("informe_id")
      .equals(informeId)
      .and((v) => v.numero_version === informe.version_actual)
      .first();
    if (version?.id) {
      await db.informe_versiones.update(version.id, { pdf_url: path, pdf_hash: hash });
    }
    if (!informe.qr_url) {
      await db.informes.update(informeId, { qr_url: qrUrl });
    }

    return { success: true };
  } catch (err) {
    logger.error("publicar-informe", "Error publicando versión oficial", err);
    return { success: false, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}
