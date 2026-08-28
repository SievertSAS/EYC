import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ============================================================
//  proxy — gate de autenticación server-side para /dashboard/*
//
//  Matriz completa: (respuesta de Supabase) × (estado de la cookie de
//  sesión) → ¿pasa o redirige a /login?
//
//  Diseño (ver docs/modules/03-auth.md):
//   - autenticado   → pasa
//   - rechazo (401 / "invalid JWT" / sesión revocada) → /login, sin fallback
//   - indeterminado (5xx / 429 / excepción de red) → chequeo de sesión local:
//       · con SUPABASE_JWT_SECRET: verifica firma HS256 + gracia offline 7 días
//       · sin el secreto: barrera blanda (JWT bien formado + no expirado)
// ============================================================

let getUserImpl: () => Promise<{
  data: { user: { id: string } | null };
  error: unknown;
}>;

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
});

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser: () => getUserImpl() } }),
}));

import { proxy } from "./proxy";

const SECRET = "test-jwt-signing-secret-0123456789";

// ─── firmar / forjar tokens ───

function b64url(s: string | Uint8Array): string {
  const arr = typeof s === "string" ? new TextEncoder().encode(s) : s;
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signHS256(payload: Record<string, unknown>): Promise<string> {
  const h = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const p = b64url(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${h}.${p}`))
  );
  return `${h}.${p}.${b64url(sig)}`;
}

function forgedAlgNone(payload: Record<string, unknown>): string {
  return `${b64url(JSON.stringify({ alg: "none", typ: "JWT" }))}.${b64url(
    JSON.stringify(payload)
  )}.x`;
}

/** Empaqueta un access token en el formato de cookie de @supabase/ssr. */
function sessionCookie(accessToken: string, withRefresh = true): string {
  const json = JSON.stringify({
    access_token: accessToken,
    refresh_token: withRefresh ? "RT-valido" : undefined,
    expires_at: 0,
  });
  return "base64-" + b64url(json);
}

function reqDashboard(cookieValue?: string): NextRequest {
  const req = new NextRequest(new URL("/dashboard", "http://localhost:3000"));
  if (cookieValue !== undefined) req.cookies.set("sb-test-auth-token", cookieValue);
  return req;
}

function redirigeALogin(res: Response): boolean {
  const loc = res.headers.get("location");
  return res.status >= 300 && res.status < 400 && !!loc && loc.includes("/login");
}

// ─── respuestas de Supabase ───
const RESP = {
  ok: async () => ({ data: { user: { id: "u1" } }, error: null }),
  reject401: async () => ({ data: { user: null }, error: { status: 401, message: "invalid JWT" } }),
  err500: async () => ({ data: { user: null }, error: { status: 500, message: "internal error" } }),
  err429: async () => ({ data: { user: null }, error: { status: 429, message: "rate limited" } }),
  netThrow: async () => {
    throw new TypeError("fetch failed");
  },
};

const now = () => Math.floor(Date.now() / 1000);
const DAY = 86400;

describe("proxy — con SUPABASE_JWT_SECRET configurado", () => {
  beforeEach(() => {
    process.env.SUPABASE_JWT_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.SUPABASE_JWT_SECRET;
    vi.resetAllMocks();
  });

  it("autenticado → pasa (aunque no haya cookie parseable)", async () => {
    getUserImpl = RESP.ok;
    expect(redirigeALogin(await proxy(reqDashboard()))).toBe(false);
  });

  it("rechazo explícito (401) → /login aunque la cookie tenga firma válida", async () => {
    getUserImpl = RESP.reject401;
    const cookie = sessionCookie(await signHS256({ sub: "u1", exp: now() + 3600 }));
    expect(redirigeALogin(await proxy(reqDashboard(cookie)))).toBe(true);
  });

  for (const [name, resp] of [
    ["5xx transitorio", RESP.err500],
    ["429 rate limit", RESP.err429],
    ["excepción de red", RESP.netThrow],
  ] as const) {
    describe(`indeterminado: ${name}`, () => {
      it("token firmado fresco → pasa (offline-first)", async () => {
        getUserImpl = resp;
        const cookie = sessionCookie(await signHS256({ sub: "u1", exp: now() + 3600 }));
        expect(redirigeALogin(await proxy(reqDashboard(cookie)))).toBe(false);
      });

      it("token firmado expirado hace 3 días + refresh token → pasa (gracia)", async () => {
        getUserImpl = resp;
        const cookie = sessionCookie(await signHS256({ sub: "u1", exp: now() - 3 * DAY }));
        expect(redirigeALogin(await proxy(reqDashboard(cookie)))).toBe(false);
      });

      it("token firmado expirado hace 10 días → /login (fuera de gracia)", async () => {
        getUserImpl = resp;
        const cookie = sessionCookie(await signHS256({ sub: "u1", exp: now() - 10 * DAY }));
        expect(redirigeALogin(await proxy(reqDashboard(cookie)))).toBe(true);
      });

      it("token firmado pero SIN refresh token → /login", async () => {
        getUserImpl = resp;
        const cookie = sessionCookie(await signHS256({ sub: "u1", exp: now() - 3600 }), false);
        expect(redirigeALogin(await proxy(reqDashboard(cookie)))).toBe(true);
      });

      it("token forjado alg:none con exp futuro → /login (bug #2 cerrado)", async () => {
        getUserImpl = resp;
        const cookie = sessionCookie(forgedAlgNone({ sub: "atacante", exp: now() + 3600 }));
        expect(redirigeALogin(await proxy(reqDashboard(cookie)))).toBe(true);
      });

      it("sin cookie de sesión → /login", async () => {
        getUserImpl = resp;
        expect(redirigeALogin(await proxy(reqDashboard()))).toBe(true);
      });
    });
  }
});

describe("proxy — SIN SUPABASE_JWT_SECRET (barrera blanda + RLS)", () => {
  afterEach(() => vi.resetAllMocks());

  it("5xx + JWT bien formado y no expirado → pasa (aunque no se verifique firma)", async () => {
    getUserImpl = RESP.err500;
    const cookie = sessionCookie(forgedAlgNone({ sub: "x", exp: now() + 3600 }));
    expect(redirigeALogin(await proxy(reqDashboard(cookie)))).toBe(false);
  });

  it("5xx + JWT expirado → /login", async () => {
    getUserImpl = RESP.err500;
    const cookie = sessionCookie(forgedAlgNone({ sub: "x", exp: now() - 3600 }));
    expect(redirigeALogin(await proxy(reqDashboard(cookie)))).toBe(true);
  });
});

describe("proxy — rutas y redirecciones", () => {
  beforeEach(() => {
    process.env.SUPABASE_JWT_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.SUPABASE_JWT_SECRET;
    vi.resetAllMocks();
  });

  it("/login con usuario autenticado → redirige a /dashboard", async () => {
    getUserImpl = RESP.ok;
    const req = new NextRequest(new URL("/login", "http://localhost:3000"));
    const res = await proxy(req);
    const loc = res.headers.get("location");
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(loc).toContain("/dashboard");
  });

  it("/login sin sesión → pasa (renderiza el login)", async () => {
    getUserImpl = RESP.reject401;
    const req = new NextRequest(new URL("/login", "http://localhost:3000"));
    expect(redirigeALogin(await proxy(req))).toBe(false);
  });

  it("ruta pública sin sesión → pasa", async () => {
    getUserImpl = RESP.reject401;
    const req = new NextRequest(new URL("/verificar/abc", "http://localhost:3000"));
    const res = await proxy(req);
    expect(res.status).toBe(200);
  });

  it("el redirect a /login preserva el path original en ?redirect", async () => {
    getUserImpl = RESP.reject401;
    const req = new NextRequest(new URL("/dashboard/visitas/123", "http://localhost:3000"));
    const res = await proxy(req);
    expect(res.headers.get("location")).toContain("redirect=%2Fdashboard%2Fvisitas%2F123");
  });
});
