import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { clientEnv, getServerEnv } from "@/lib/env";

// M2: lazy init — el cliente admin solo se crea al recibir un request, no al cargar el módulo
export function getAdminClient() {
  return createClient(clientEnv.NEXT_PUBLIC_SUPABASE_URL, getServerEnv().SUPABASE_SERVICE_ROLE_KEY);
}

export async function getAuthenticatedUser(request: NextRequest) {
  void request;
  const cookieStore = await cookies();
  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

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
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  }

  const supabaseAdmin = getAdminClient();
  const { data: caller } = await supabaseAdmin
    .from("usuarios")
    .select("cargo")
    .eq("auth_uid", user.id)
    .single();

  if (!caller || caller.cargo !== "coordinador") {
    return { ok: false, response: NextResponse.json({ error: "Sin permisos" }, { status: 403 }) };
  }

  return { ok: true, supabaseAdmin };
}
