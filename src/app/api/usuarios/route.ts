import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAuthenticatedUser(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: caller } = await supabaseAdmin
    .from("usuarios")
    .select("cargo")
    .eq("auth_uid", user.id)
    .single();

  if (!caller || caller.cargo !== "coordinador") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await request.json();
  const { email, password, nombre, cedula, cargo, telefono } = body;

  if (!email || !password || !nombre || !cedula || !cargo) {
    return NextResponse.json(
      { error: "Campos requeridos: email, password, nombre, cedula, cargo" },
      { status: 400 }
    );
  }

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (authError) {
    return NextResponse.json(
      { error: authError.message },
      { status: 400 }
    );
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
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json(
      { error: dbError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ usuario }, { status: 201 });
}
