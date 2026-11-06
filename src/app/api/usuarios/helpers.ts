import type { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireCargo } from "@/lib/auth/require-cargo";

export { getAdminClient, getAuthenticatedUser } from "@/lib/auth/require-cargo";

/**
 * Gate común de las rutas de `/api/usuarios`: exige sesión y que el llamante
 * tenga `cargo = "coordinador"` en la tabla `usuarios`. Devuelve el cliente
 * admin para reutilizarlo, o una respuesta 401/403 lista para retornar.
 */
export async function requireCoordinador(
  request: NextRequest
): Promise<
  | { ok: true; supabaseAdmin: ReturnType<typeof getAdminClient> }
  | { ok: false; response: NextResponse }
> {
  const gate = await requireCargo(request, ["coordinador"]);
  if (!gate.ok) return gate;
  return { ok: true, supabaseAdmin: gate.supabaseAdmin };
}
