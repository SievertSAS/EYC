import { NextRequest, NextResponse } from "next/server";
import { requireCargo } from "@/lib/auth/require-cargo";
import { leerBodyConArchivo } from "@/lib/api/leer-body";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { patchConfiguracionInformeSchema } from "@/lib/validation/schemas";
import { EVIDENCIAS_BUCKET } from "@/lib/supabase/storage";
import { CONFIGURACION_INFORME_ID } from "@/lib/db/types";

/**
 * PATCH /api/configuracion-informe — datos del Director Técnico que firma
 * todos los informes (#194/#195): nombre, título bajo la firma y firma.
 * Solo el coordinador.
 *
 * `configuracion_informe` es MASTER_TABLE de una sola fila y RLS no da
 * escritura a ningún rol autenticado: solo esta ruta (service role) la
 * escribe. Body JSON, o multipart cuando trae la firma (mismo esquema que
 * la firma de usuario, #109). Devuelve la fila para que el cliente haga
 * `db.configuracion_informe.put(...)`.
 */
export async function PATCH(request: NextRequest) {
  const key = await getRateLimitKey("configuracion-informe");
  const { allowed } = rateLimit(key, 10, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo en un minuto." },
      { status: 429 }
    );
  }

  const gate = await requireCargo(request, ["coordinador"]);
  if (!gate.ok) return gate.response;
  const { supabaseAdmin, usuarioId } = gate;

  let campos: Record<string, unknown>;
  let firma: File | null;
  try {
    ({ campos, archivo: firma } = await leerBodyConArchivo(request, "firma"));
  } catch (err) {
    logger.warn("configuracion-informe", "Body ilegible", err);
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const parsed = patchConfiguracionInformeSchema.safeParse(campos);
  if (!parsed.success) {
    // A2: no exponer detalles del schema al cliente
    logger.warn("configuracion-informe", "Validación fallida", parsed.error.issues);
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0 && !firma) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const cambios: Record<string, unknown> = { ...parsed.data };
  if (firma) {
    // Path nuevo por subida: evita servir una firma vieja cacheada.
    const path = `configuracion/director-firma-${Date.now()}.jpg`;
    const buffer = Buffer.from(await firma.arrayBuffer());
    const { error: uploadError } = await supabaseAdmin.storage
      .from(EVIDENCIAS_BUCKET)
      .upload(path, buffer, { upsert: true, contentType: "image/jpeg" });
    if (uploadError) {
      logger.error("configuracion-informe", "Subida de firma falló", uploadError);
      return NextResponse.json({ error: "Error al subir la firma" }, { status: 500 });
    }
    cambios.director_firma_url = path;
  }

  const { data: configuracion, error } = await supabaseAdmin
    .from("configuracion_informe")
    .upsert({ id: CONFIGURACION_INFORME_ID, ...cambios, actualizado_por: usuarioId ?? null })
    .select()
    .single();

  if (error || !configuracion) {
    logger.error("configuracion-informe", "No se pudo guardar", error);
    return NextResponse.json({ error: "Error al guardar la configuración" }, { status: 500 });
  }

  return NextResponse.json({ configuracion });
}
