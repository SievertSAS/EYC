import { NextRequest, NextResponse } from "next/server";
import { requireCargo } from "@/lib/auth/require-cargo";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { publicarPlantillaSchema } from "@/lib/plantillas/types";

/**
 * POST /api/plantillas/publicar — publica el borrador de un tipo de equipo
 * como versión nueva (#196). Solo el coordinador.
 *
 * La numeración (máx + 1) y el paso borrador → publicada ocurren en la
 * función SQL `publicar_plantilla_informe` (migración 045), atómica y con
 * lock por tipo, que registra quién publicó y cuándo. Desde ese momento
 * todo pre-informe y todo informe oficial que se genere usa esta versión.
 */
export async function POST(request: NextRequest) {
  const key = await getRateLimitKey("plantilla-publicar");
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

  const parsed = publicarPlantillaSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    logger.warn("plantillas", "Publicar: validación fallida", parsed.error.issues);
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { data: plantilla, error } = await supabaseAdmin.rpc("publicar_plantilla_informe", {
    p_tipo_equipo: parsed.data.tipo_equipo,
    p_publicada_por: usuarioId,
  });

  if (error || !plantilla) {
    // P0002 (no_data_found): la función no encontró borrador para ese tipo.
    if (error?.code === "P0002") {
      return NextResponse.json(
        { error: "No hay un borrador guardado para publicar." },
        { status: 409 }
      );
    }
    logger.error("plantillas", "Publicar: error", error);
    return NextResponse.json({ error: "Error al publicar la plantilla" }, { status: 500 });
  }

  return NextResponse.json({ plantilla });
}
