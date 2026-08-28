import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clientEnv } from "@/lib/env";
import {
  readSupabaseSession,
  verifyHS256,
  isAuthRejection,
  decodeJwtPayload,
  SESSION_GRACE_MS,
} from "@/lib/auth/session";

const PROTECTED_PREFIX = "/dashboard";
const LOGIN_PATH = "/login";

let warnedNoSecret = false;

/**
 * ¿Hay una sesión local aceptable para dejar pasar cuando Supabase no
 * pudo confirmar (inalcanzable o error transitorio)?
 *
 * Con `SUPABASE_JWT_SECRET`: verifica la firma HS256. Un `alg:none` o
 * firma incorrecta NO pasa (cierra el bug #2). Un token válidamente
 * firmado que expiró hace menos de SESSION_GRACE_MS y tiene refresh
 * token → pasa (gracia offline: el cliente no puede refrescar sin red).
 *
 * Sin el secreto configurado: cae a la barrera blanda — acepta un JWT
 * bien formado y no expirado (comportamiento previo), y deja que RLS de
 * Supabase sea la barrera real de datos. Loguea un warning una vez.
 */
async function hasAcceptableLocalSession(
  cookies: { name: string; value: string }[],
  jwtSecret: string | undefined
): Promise<boolean> {
  const session = readSupabaseSession(cookies);
  if (!session) return false;

  const nowSec = Math.floor(Date.now() / 1000);

  if (jwtSecret) {
    const payload = await verifyHS256(session.accessToken, jwtSecret);
    if (!payload?.exp) return false;
    if (!session.refreshToken) return false;
    const expiredForMs = (nowSec - payload.exp) * 1000;
    // No expirado, o expirado dentro de la ventana de gracia.
    return expiredForMs < SESSION_GRACE_MS;
  }

  // Barrera blanda (sin secreto): JWT bien formado + no expirado (margen 60s).
  if (!warnedNoSecret) {
    console.warn(
      "[proxy] SUPABASE_JWT_SECRET no configurado — el fallback offline no verifica " +
        "la firma del token. Configuralo (Supabase → Settings → API → JWT Secret)."
    );
    warnedNoSecret = true;
  }
  const payload = decodeJwtPayload(session.accessToken);
  return !!payload?.exp && payload.exp > nowSec + 60;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const supabaseUrl = clientEnv.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;

  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: request.headers } });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const allCookies = request.cookies.getAll();

  // Clasificación en TRES:
  //  - autenticado   → Supabase confirmó el usuario
  //  - rechazado     → Supabase respondió "token inválido/expirado/revocado" → /login
  //  - indeterminado → 5xx/429/timeout o excepción de red → chequeo local
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] = null;
  let indeterminado = false;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error) {
      user = data.user;
    } else if (!isAuthRejection(error)) {
      indeterminado = true; // 5xx/429/desconocido — NO desloguear (bug #16)
    }
    // isAuthRejection(error) === true → user queda null → redirige
  } catch {
    indeterminado = true; // excepción real de red (Supabase inalcanzable)
  }

  if (!user && indeterminado && (await hasAcceptableLocalSession(allCookies, jwtSecret))) {
    return response;
  }

  if (pathname.startsWith(PROTECTED_PREFIX) && !user) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === LOGIN_PATH && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|sw.js|manifest.json|logo-sievert.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
