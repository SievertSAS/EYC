import { NextRequest, NextResponse } from "next/server";
import { requireCargo } from "@/lib/auth/require-cargo";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { guardarBorradorSchema } from "@/lib/plantillas/types";

/**
 * PUT /api/plantillas/borrador — guarda el borrador de la plantilla de
 * informe de un tipo de equipo (#196). Solo el coordinador.
 *
 * `plantillas_informe` es MASTER_TABLE y RLS no da escritura a ningún rol
 * autenticado: solo esta ruta (service role) la escribe. Hay a lo sumo un
 * borrador por tipo (índice único parcial); si existe se actualiza, si no
 * se crea. Las versiones publicadas no se tocan (trigger de inmutabilidad).
 * Devuelve la fila para que el cliente haga `db.plantillas_informe.put(...)`.
 */
export async function PUT(request: NextRequest) {
  const key = await getRateLimitKey("plantilla-borrador");
  const { allowed } = rateLimit(key, 20, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo en un minuto." },
      { status: 429 }
    );
  }

  const gate = await requireCargo(request, ["coordinador"]);
  if (!gate.ok) return gate.response;
  const { supabaseAdmin, usuarioId } = gate;

  const parsed = guardarBorradorSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    // A2: no exponer detalles del schema al cliente
    logger.warn("plantillas", "Borrador: validación fallida", parsed.error.issues);
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { tipo_equipo, codigo, contenido } = parsed.data;

  const { data: existente, error: buscarError } = await supabaseAdmin
    .from("plantillas_informe")
    .select("id")
    .eq("tipo_equipo", tipo_equipo)
    .eq("estado", "borrador")
    .is("deleted_at", null)
    .maybeSingle();
  if (buscarError) {
    logger.error("plantillas", "Borrador: error buscando el borrador", buscarError);
    return NextResponse.json({ error: "Error al guardar el borrador" }, { status: 500 });
  }

  const { data: plantilla, error } = existente?.id
    ? await supabaseAdmin
        .from("plantillas_informe")
        .update({ codigo, contenido })
        .eq("id", existente.id)
        .eq("estado", "borrador")
        .select()
        .single()
    : await supabaseAdmin
        .from("plantillas_informe")
        .insert({ tipo_equipo, codigo, contenido, estado: "borrador", creada_por: usuarioId })
        .select()
        .single();

  if (error || !plantilla) {
    // 23505: otro borrador del mismo tipo se creó en paralelo.
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "Otro borrador se guardó al mismo tiempo. Recarga e intenta de nuevo." },
        { status: 409 }
      );
    }
    logger.error("plantillas", "Borrador: error guardando", error);
    return NextResponse.json({ error: "Error al guardar el borrador" }, { status: 500 });
  }

  return NextResponse.json({ plantilla });
}
