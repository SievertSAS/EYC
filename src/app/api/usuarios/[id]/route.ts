import { NextRequest, NextResponse } from "next/server";
import { patchUsuarioSchema } from "@/lib/validation/schemas";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { requireCoordinador } from "../helpers";

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

  const body = await request.json();
  const parsed = patchUsuarioSchema.safeParse(body);
  if (!parsed.success) {
    // A2: no exponer detalles del schema al cliente
    logger.warn("usuarios", "PATCH validación fallida", parsed.error.issues);
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { telefono, ...rest } = parsed.data;
  const cambios: Record<string, unknown> = { ...rest };
  if (telefono !== undefined) cambios.telefono = telefono || null;

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
