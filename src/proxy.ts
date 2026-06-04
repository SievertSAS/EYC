import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clientEnv } from "@/lib/env";

const PROTECTED_PREFIX = "/dashboard";
const LOGIN_PATH = "/login";

/**
 * Decodifica un JWT sin verificar firma y extrae el payload.
 * Suficiente para leer `exp` — la firma se valida server-side por Supabase.
 */
function decodeJwtPayload(token: string): { exp?: number; sub?: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
    return payload;
  } catch {
    return null;
  }
}

/**
 * Verifica si alguna cookie de sesión de Supabase contiene un JWT no expirado.
 * Margen de 60s para evitar race conditions con tokens a punto de expirar.
 */
function hasValidSessionCookie(cookies: { name: string; value: string }[]): boolean {
  const sessionCookies = cookies.filter(
    (c) => c.name.startsWith("sb-") && c.name.includes("-auth-token")
  );
  if (sessionCookies.length === 0) return false;

  // Supabase puede fragmentar el token en múltiples cookies (base, .0, .1, etc.)
  // Intentar reconstruir: la cookie base o la concatenación de chunks
  const baseCookie = sessionCookies.find((c) => !c.name.match(/\.\d+$/));
  let tokenRaw = baseCookie?.value ?? "";

  if (!tokenRaw) {
    // Solo chunks numerados — concatenar en orden
    const chunks = sessionCookies
      .filter((c) => c.name.match(/\.\d+$/))
      .sort((a, b) => {
        const aNum = parseInt(a.name.match(/\.(\d+)$/)?.[1] ?? "0");
        const bNum = parseInt(b.name.match(/\.(\d+)$/)?.[1] ?? "0");
        return aNum - bNum;
      });
    tokenRaw = chunks.map((c) => c.value).join("");
  }

  // El valor puede ser un JSON con access_token dentro (Supabase SSR format)
  let jwt = tokenRaw;
  try {
    const parsed = JSON.parse(tokenRaw);
    if (parsed.access_token) jwt = parsed.access_token;
  } catch {
    // No es JSON — asumir que es el JWT directamente
  }

  const payload = decodeJwtPayload(jwt);
  if (!payload?.exp) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const MARGIN_SECONDS = 60;
  return payload.exp > nowSeconds + MARGIN_SECONDS;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const supabaseUrl = clientEnv.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request: { headers: request.headers },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const allCookies = request.cookies.getAll();

  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      // Error de red o Supabase inalcanzable → confiar en cookie local si JWT no expirado
      if (hasValidSessionCookie(allCookies)) {
        return response;
      }
    } else {
      user = data.user;
    }
  } catch {
    // Error de red total (fetch failed) → confiar en cookie local si JWT no expirado
    if (hasValidSessionCookie(allCookies)) {
      return response;
    }
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
