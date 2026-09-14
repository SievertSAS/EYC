import { NextRequest, NextResponse } from "next/server";
import { patchUsuarioSchema } from "@/lib/validation/schemas";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { requireCoordinador } from "../helpers";
import { EVIDENCIAS_BUCKET } from "@/lib/supabase/storage";

/**
 * Lee el body como JSON normal, o como `multipart/form-data` cuando trae la
 * firma (#109) — un archivo no cabe en JSON. Los campos de texto llegan como
 * strings sueltas en el FormData; `activo` se normaliza a boolean.
 */
async function leerBody(
  request: NextRequest
): Promise<{ campos: Record<string, unknown>; firma: File | null }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return { campos: await request.json(), firma: null };
  }

  const form = await request.formData();
  const campos: Record<string, unknown> = {};
  let firma: File | null = null;
  for (const [key, value] of form.entries()) {
    if (key === "firma" && value instanceof File) {
      firma = value;
      continue;
    }
    campos[key] = value;
  }
  if (typeof campos.activo === "string") campos.activo = campos.activo === "true";
  return { campos, firma };
}

/**
 * PATCH /api/usuarios/[id] — edición de un usuario existente (#58).
 *
 * `usuarios` es MASTER_TABLE: no se sincroniza por el push del cliente. Un
 * `db.usuarios.update(...)` local nunca llega a Supabase. Este endpoint aplica
 * el cambio server-side con el mismo gate que el POST (sesión + coordinador)
 * y devuelve la fila para que el cliente haga `db.usuarios.put(...)`.
 */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const key = await getRateLimitKey("patch-user");
  const { allowed } = rateLimit(key, 10, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo en un minuto." },
      { status: 429 }
    );
  }

  const gate = await requireCoordinador(request);
  if (!gate.ok) return gate.response;
  const { supabaseAdmin } = gate;

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Falta el id del usuario" }, { status: 400 });
  }

  const { campos, firma } = await leerBody(request);

  // Una subida de solo-firma no trae otros campos; el `.refine` del schema
  // ("nada que actualizar") no debe bloquear ese caso.
  let datosValidados: Record<string, unknown> = {};
  if (Object.keys(campos).length > 0) {
    const parsed = patchUsuarioSchema.safeParse(campos);
    if (!parsed.success) {
      // A2: no exponer detalles del schema al cliente
      logger.warn("usuarios", "PATCH validación fallida", parsed.error.issues);
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }
    datosValidados = parsed.data;
  }
  if (Object.keys(datosValidados).length === 0 && !firma) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const { telefono, ...rest } = datosValidados;
  const cambios: Record<string, unknown> = { ...rest };
  if (telefono !== undefined) cambios.telefono = telefono || null;

  if (firma) {
    const path = `usuarios/${id}/firma.jpg`;
    const buffer = Buffer.from(await firma.arrayBuffer());
    const { error: uploadError } = await supabaseAdmin.storage
      .from(EVIDENCIAS_BUCKET)
      .upload(path, buffer, { upsert: true, contentType: "image/jpeg" });
    if (uploadError) {
      logger.error("usuarios", "PATCH: subida de firma falló", { id, uploadError });
      return NextResponse.json({ error: "Error al subir la firma" }, { status: 500 });
    }
    cambios.firma_url = path;
  }

  const { data: usuario, error } = await supabaseAdmin
    .from("usuarios")
    .update(cambios)
    .eq("id", id)
    .select()
    .single();

  if (error || !usuario) {
    if (error?.code === "PGRST116") {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    logger.error("usuarios", "PATCH falló", { id, error });
    return NextResponse.json({ error: "Error al actualizar el usuario" }, { status: 500 });
  }

  return NextResponse.json({ usuario });
}
