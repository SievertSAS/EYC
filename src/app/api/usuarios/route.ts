import { NextRequest, NextResponse } from "next/server";
import { createUsuarioSchema } from "@/lib/validation/schemas";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { requireCoordinador } from "./helpers";

export async function POST(request: NextRequest) {
  const key = await getRateLimitKey("create-user");
  const { allowed } = rateLimit(key, 5, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo en un minuto." },
      { status: 429 }
    );
  }

  const gate = await requireCoordinador(request);
  if (!gate.ok) return gate.response;
  const { supabaseAdmin } = gate;

  const body = await request.json();
  const parsed = createUsuarioSchema.safeParse(body);

  if (!parsed.success) {
    // A2: no exponer detalles del schema al cliente
    logger.warn("usuarios", "Validación fallida", parsed.error.issues);
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { email, password, nombre, cedula, cargo, telefono } = parsed.data;

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const { data: usuario, error: dbError } = await supabaseAdmin
    .from("usuarios")
    .insert({
      auth_uid: authData.user.id,
      nombre,
      cedula,
      cargo,
      email,
      telefono: telefono || null,
      activo: true,
    })
    .select()
    .single();

  if (dbError) {
    // A3: intentar rollback; loguear si falla para detectar usuarios huérfanos
    const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    if (deleteErr) {
      logger.error("usuarios", "Rollback fallido — usuario auth huérfano", {
        auth_uid: authData.user.id,
        deleteErr,
      });
    }
    return NextResponse.json({ error: "Error al guardar el usuario" }, { status: 500 });
  }

  return NextResponse.json({ usuario }, { status: 201 });
}
