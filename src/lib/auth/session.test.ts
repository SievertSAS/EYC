import { describe, it, expect } from "vitest";
import {
  decodeJwtPayload,
  verifyHS256,
  readSupabaseSession,
  isAuthRejection,
  SESSION_GRACE_MS,
} from "./session";

// ─── helpers de test: firmar un JWT HS256 de verdad ───

function b64url(bytes: Uint8Array | string): string {
  const arr = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signHS256(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${body}`))
  );
  return `${header}.${body}.${b64url(sig)}`;
}

function jwtAlgNone(payload: Record<string, unknown>): string {
  return `${b64url(JSON.stringify({ alg: "none", typ: "JWT" }))}.${b64url(
    JSON.stringify(payload)
  )}.forjada`;
}

const SECRET = "super-secret-jwt-signing-key-for-tests";
const future = Math.floor(Date.now() / 1000) + 3600;

// ─── decodeJwtPayload ───

describe("decodeJwtPayload", () => {
  it("lee el payload sin verificar firma", async () => {
    const token = await signHS256({ sub: "u1", exp: future }, SECRET);
    expect(decodeJwtPayload(token)).toMatchObject({ sub: "u1", exp: future });
  });
  it("null si no tiene 3 segmentos", () => {
    expect(decodeJwtPayload("a.b")).toBeNull();
    expect(decodeJwtPayload("basura")).toBeNull();
  });
});

// ─── verifyHS256 ───

describe("verifyHS256", () => {
  it("devuelve el payload si la firma valida", async () => {
    const token = await signHS256({ sub: "u1", exp: future }, SECRET);
    expect(await verifyHS256(token, SECRET)).toMatchObject({ sub: "u1" });
  });

  it("null si la firma es de otro secreto", async () => {
    const token = await signHS256({ sub: "u1", exp: future }, SECRET);
    expect(await verifyHS256(token, "otro-secreto")).toBeNull();
  });

  it("null para alg:none (el ataque del bug #2)", async () => {
    expect(await verifyHS256(jwtAlgNone({ sub: "atacante", exp: future }), SECRET)).toBeNull();
  });

  it("null si el secreto está vacío o el token es basura", async () => {
    expect(await verifyHS256("x.y.z", SECRET)).toBeNull();
    const token = await signHS256({ sub: "u1" }, SECRET);
    expect(await verifyHS256(token, "")).toBeNull();
  });
});

// ─── readSupabaseSession ───

describe("readSupabaseSession", () => {
  const mkCookie = (name: string, value: string) => ({ name, value });

  it("formato base64- (el real de @supabase/ssr)", () => {
    const session = { access_token: "AT", refresh_token: "RT", expires_at: 123 };
    const encoded = "base64-" + b64url(JSON.stringify(session));
    const s = readSupabaseSession([mkCookie("sb-abc-auth-token", encoded)]);
    expect(s).toEqual({ accessToken: "AT", refreshToken: "RT", expiresAt: 123 });
  });

  it("JSON plano (sin prefijo)", () => {
    const s = readSupabaseSession([
      mkCookie("sb-abc-auth-token", JSON.stringify({ access_token: "AT", refresh_token: "RT" })),
    ]);
    expect(s).toEqual({ accessToken: "AT", refreshToken: "RT", expiresAt: null });
  });

  it("cookie fragmentada en chunks .0 .1", () => {
    const json = JSON.stringify({ access_token: "AAAA", refresh_token: "RRRR" });
    const encoded = "base64-" + b64url(json);
    const mid = Math.ceil(encoded.length / 2);
    const s = readSupabaseSession([
      mkCookie("sb-abc-auth-token.1", encoded.slice(mid)),
      mkCookie("sb-abc-auth-token.0", encoded.slice(0, mid)),
    ]);
    expect(s?.accessToken).toBe("AAAA");
  });

  it("formato viejo: el valor ES el JWT", () => {
    const s = readSupabaseSession([mkCookie("sb-abc-auth-token", "header.payload.sig")]);
    expect(s).toEqual({ accessToken: "header.payload.sig", refreshToken: null, expiresAt: null });
  });

  it("null si no hay cookie de sesión", () => {
    expect(readSupabaseSession([mkCookie("otra", "x")])).toBeNull();
    expect(readSupabaseSession([])).toBeNull();
  });

  it("null si el JSON no tiene access_token", () => {
    expect(
      readSupabaseSession([mkCookie("sb-abc-auth-token", JSON.stringify({ foo: 1 }))])
    ).toBeNull();
  });
});

// ─── isAuthRejection ───

describe("isAuthRejection", () => {
  it("401/403 → rechazo", () => {
    expect(isAuthRejection({ status: 401 })).toBe(true);
    expect(isAuthRejection({ status: 403 })).toBe(true);
  });

  it("5xx / 429 / 408 → NO rechazo (transitorio, bug #16)", () => {
    expect(isAuthRejection({ status: 500 })).toBe(false);
    expect(isAuthRejection({ status: 503 })).toBe(false);
    expect(isAuthRejection({ status: 429 })).toBe(false);
    expect(isAuthRejection({ status: 408 })).toBe(false);
  });

  it("mensajes conocidos de token inválido → rechazo", () => {
    expect(isAuthRejection({ message: "invalid JWT: token is expired" })).toBe(true);
    expect(isAuthRejection({ code: "bad_jwt" })).toBe(true);
    expect(
      isAuthRejection({ message: "Session from session_id claim in JWT does not exist" })
    ).toBe(true);
    expect(isAuthRejection({ code: "refresh_token_not_found" })).toBe(true);
  });

  it("error de red / desconocido → NO rechazo", () => {
    expect(isAuthRejection({ message: "fetch failed" })).toBe(false);
    expect(isAuthRejection({ message: "network error" })).toBe(false);
    expect(isAuthRejection({ message: "algo raro pasó" })).toBe(false);
    expect(isAuthRejection(null)).toBe(false);
    expect(isAuthRejection(undefined)).toBe(false);
  });
});

describe("SESSION_GRACE_MS", () => {
  it("son 7 días", () => {
    expect(SESSION_GRACE_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
