import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ============================================================
//  proxy — gate de autenticación server-side para /dashboard/*
//
//  Bug: `hasValidSessionCookie` decodifica el payload del JWT SIN
//  verificar su firma (solo lee `exp`). El fallback a esa cookie
//  no verificada estaba activo tanto cuando `getUser()` lanza una
//  excepción real de red (Supabase inalcanzable) como cuando
//  Supabase responde normalmente con un error de autenticación
//  explícito (JWT inválido/forjado/expirado). Un atacante podía
//  fabricar una cookie `sb-*-auth-token` con un JWT sin firma válida
//  y `exp` futuro para pasar el gate sin sesión real.
// ============================================================

let getUserImpl: () => Promise<{
  data: { user: { id: string } | null };
  error: { message: string } | null;
}>;

// `proxy.ts` valida NEXT_PUBLIC_SUPABASE_* al importarse (vía `clientEnv`);
// `vi.hoisted` garantiza que estos valores existan antes de que el import
// estático de más abajo dispare esa validación.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
});

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: () => getUserImpl(),
    },
  }),
}));

import { proxy } from "./proxy";

/** JWT con firma inválida ("forjada-sin-firma-valida") pero `exp` futuro. */
function jwtForjadoConExpFuturo(): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, sub: "atacante" })
  ).toString("base64url");
  return `${header}.${payload}.forjada-sin-firma-valida`;
}

function requestConCookie(path: string, jwt: string): NextRequest {
  const req = new NextRequest(new URL(path, "http://localhost:3000"));
  req.cookies.set("sb-test-auth-token", jwt);
  return req;
}

function esRedirectALogin(res: Response): boolean {
  const location = res.headers.get("location");
  return res.status >= 300 && res.status < 400 && !!location && location.includes("/login");
}

describe("proxy", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("redirige a /login cuando Supabase rechaza explícitamente el JWT (token forjado/expirado)", async () => {
    getUserImpl = async () => ({
      data: { user: null },
      error: { message: "invalid JWT" },
    });

    const req = requestConCookie("/dashboard", jwtForjadoConExpFuturo());
    const res = await proxy(req);

    expect(esRedirectALogin(res)).toBe(true);
  });

  it("deja pasar con la cookie local ante una falla real de red hacia Supabase (offline)", async () => {
    getUserImpl = async () => {
      throw new TypeError("fetch failed");
    };

    const req = requestConCookie("/dashboard", jwtForjadoConExpFuturo());
    const res = await proxy(req);

    expect(esRedirectALogin(res)).toBe(false);
  });

  it("deja pasar cuando Supabase confirma un usuario autenticado", async () => {
    getUserImpl = async () => ({
      data: { user: { id: "user-1" } },
      error: null,
    });

    const req = requestConCookie("/dashboard", jwtForjadoConExpFuturo());
    const res = await proxy(req);

    expect(esRedirectALogin(res)).toBe(false);
  });

  it("redirige a /login sin ninguna cookie de sesión", async () => {
    getUserImpl = async () => ({
      data: { user: null },
      error: { message: "no session" },
    });

    const req = new NextRequest(new URL("/dashboard", "http://localhost:3000"));
    const res = await proxy(req);

    expect(esRedirectALogin(res)).toBe(true);
  });
});
