// Helpers puros de sesión para el gate server-side (`proxy.ts`).
// Edge-compatible: solo Web Crypto y utilidades de string. No importa
// `@/lib/env` (que lanza si faltan variables) — el secreto se pasa por
// parámetro.

/** Ventana de gracia offline: un access token válidamente firmado que
 * expiró hace menos que esto se sigue aceptando si Supabase está
 * inalcanzable (el cliente no puede refrescar sin red). Decidido con el
 * dueño: 7 días. */
export const SESSION_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export interface JwtPayload {
  exp?: number;
  iat?: number;
  sub?: string;
  [k: string]: unknown;
}

export interface SupabaseSession {
  accessToken: string;
  refreshToken: string | null;
  /** epoch segundos, si viene en la cookie */
  expiresAt: number | null;
}

const BASE64_PREFIX = "base64-";

function base64UrlToBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/** Decodifica el payload de un JWT SIN verificar la firma. Para leer `exp`
 * cuando la verificación no aplica (o como paso previo a verificarla). */
export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(bytesToString(base64UrlToBytes(parts[1])));
  } catch {
    return null;
  }
}

/** Verifica la firma HS256 de un JWT con el secreto compartido de Supabase.
 * Devuelve el payload SOLO si la firma valida (y el alg es HS256).
 * Un `alg: "none"` o una firma incorrecta → null. */
export async function verifyHS256(token: string, secret: string): Promise<JwtPayload | null> {
  if (!secret) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;

  let header: { alg?: string };
  try {
    header = JSON.parse(bytesToString(base64UrlToBytes(headerB64)));
  } catch {
    return null;
  }
  if (header.alg !== "HS256") return null;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(sigB64),
      new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    );
    if (!ok) return null;
    return JSON.parse(bytesToString(base64UrlToBytes(payloadB64)));
  } catch {
    return null;
  }
}

/** Reconstruye la sesión de Supabase desde las cookies de la request.
 * Maneja el fragmentado en chunks (`.0`, `.1`, …) y el prefijo `base64-`
 * que usa `@supabase/ssr` >= 0.x. */
export function readSupabaseSession(
  cookies: { name: string; value: string }[]
): SupabaseSession | null {
  const authCookies = cookies.filter(
    (c) => c.name.startsWith("sb-") && c.name.includes("-auth-token")
  );
  if (authCookies.length === 0) return null;

  const base = authCookies.find((c) => !/\.\d+$/.test(c.name));
  let raw: string;
  if (base) {
    raw = base.value;
  } else {
    raw = authCookies
      .filter((c) => /\.\d+$/.test(c.name))
      .sort(
        (a, b) =>
          parseInt(a.name.match(/\.(\d+)$/)?.[1] ?? "0", 10) -
          parseInt(b.name.match(/\.(\d+)$/)?.[1] ?? "0", 10)
      )
      .map((c) => c.value)
      .join("");
  }
  if (!raw) return null;

  if (raw.startsWith(BASE64_PREFIX)) {
    try {
      raw = bytesToString(base64UrlToBytes(raw.slice(BASE64_PREFIX.length)));
    } catch {
      return null;
    }
  }

  let parsed: {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Formato viejo: el valor ES el JWT directamente.
    return { accessToken: raw, refreshToken: null, expiresAt: null };
  }

  if (!parsed.access_token) return null;
  return {
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token ?? null,
    expiresAt: typeof parsed.expires_at === "number" ? parsed.expires_at : null,
  };
}

const REJECTION_PATTERNS = [
  "invalid jwt",
  "invalid claim",
  "jwt expired",
  "token is expired",
  "token has expired",
  "bad_jwt",
  "session_not_found",
  "session from session_id claim in jwt does not exist",
  "refresh_token_not_found",
  "user from sub claim in jwt does not exist",
  "invalid_grant",
];

/** ¿El error de `getUser()` es un rechazo de autenticación explícito
 * (token inválido/expirado, sesión revocada) — vs un error transitorio
 * del servidor (5xx/429/desconocido)?
 *
 * Rechazo → redirigir a /login. Indeterminado → chequeo de sesión local. */
export function isAuthRejection(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { status?: number; code?: string; message?: string; name?: string };

  if (e.status === 401 || e.status === 403) return true;
  // 5xx / 429 / 408 → transitorio, NO es rechazo.
  if (typeof e.status === "number" && e.status >= 500) return false;
  if (e.status === 429 || e.status === 408) return false;

  const haystack = `${e.code ?? ""} ${e.message ?? ""} ${e.name ?? ""}`.toLowerCase();
  if (haystack.includes("fetch failed") || haystack.includes("network")) return false;
  return REJECTION_PATTERNS.some((p) => haystack.includes(p));
}
