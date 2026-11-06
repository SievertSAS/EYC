import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { clientEnv, getServerEnv } from "@/lib/env";
import type { RolUsuario } from "@/lib/db/types";

// ============================================================
//  Gate server-side de las API routes: sesión + cargo del llamante.
//  El cargo se lee con el cliente service-role desde `usuarios` (nunca
//  del body ni de IndexedDB), así que no se puede falsificar desde el
//  cliente. Compartido por las API routes que escriben datos maestros.
// ============================================================

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

export type GateResult =
  | {
      ok: true;
      supabaseAdmin: ReturnType<typeof getAdminClient>;
      /** `usuarios.id` del llamante (puede faltar en datos legacy sin id). */
      usuarioId: string | undefined;
      cargo: RolUsuario;
    }
  | { ok: false; response: NextResponse };

/**
 * Exige sesión válida y que el llamante tenga uno de los `cargos` dados y
 * no esté deshabilitado. Devuelve el cliente admin para reutilizarlo, o una
 * respuesta 401/403 lista para retornar.
 */
export async function requireCargo(
  request: NextRequest,
  cargos: readonly RolUsuario[]
): Promise<GateResult> {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  }

  const supabaseAdmin = getAdminClient();
  const { data: caller } = await supabaseAdmin
    .from("usuarios")
    .select("id, cargo, activo")
    .eq("auth_uid", user.id)
    .single();

  if (!caller || !cargos.includes(caller.cargo) || caller.activo === false) {
    return { ok: false, response: NextResponse.json({ error: "Sin permisos" }, { status: 403 }) };
  }

  return {
    ok: true,
    supabaseAdmin,
    usuarioId: caller.id ?? undefined,
    cargo: caller.cargo as RolUsuario,
  };
}
