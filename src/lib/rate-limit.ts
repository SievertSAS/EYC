import { headers } from "next/headers";

/**
 * Rate limiter basado en headers + Map con LRU cleanup.
 *
 * Limitación conocida: en serverless cada instancia tiene su propio Map,
 * por lo que el rate limit es per-instance. Sin embargo:
 * 1. Sigue protegiendo contra ráfagas dentro de una misma instancia caliente.
 * 2. Se complementa con el rate limiting nativo de Supabase Auth (GoTrue)
 *    que limita signups/logins a nivel global.
 *
 * Para rate limiting distribuido real, migrar a Upstash Redis (@upstash/ratelimit).
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const MAX_KEYS = 1000;
const hits = new Map<string, RateLimitEntry>();

function evictStale() {
  if (hits.size <= MAX_KEYS) return;
  const now = Date.now();
  for (const [key, entry] of hits) {
    if (now > entry.resetAt) hits.delete(key);
  }
  // Si sigue por encima del límite, borrar las más antiguas
  if (hits.size > MAX_KEYS) {
    const excess = hits.size - MAX_KEYS;
    const keys = hits.keys();
    for (let i = 0; i < excess; i++) {
      const next = keys.next();
      if (!next.done) hits.delete(next.value);
    }
  }
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now > entry.resetAt) {
    evictStale();
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count };
}

/**
 * Extrae un identificador de cliente confiable para rate limiting.
 * Prefiere x-forwarded-for (set por el edge/CDN), fallback a IP directa.
 */
export async function getRateLimitKey(prefix: string): Promise<string> {
  const hdrs = await headers();
  const forwarded = hdrs.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? hdrs.get("x-real-ip") ?? "unknown";
  return `${prefix}:${ip}`;
}
