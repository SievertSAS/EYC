# Módulo: Auth (`src/proxy.ts`, `src/lib/auth/`, `role-provider`, `/login`)

> Estado: 🟡 en curso (Tier 1 · Módulo 3) · 2026-08-28
> Archivos: `src/proxy.ts` (gate server-side), `src/lib/auth/session.ts` (nuevo —
> helpers puros), `src/components/role-provider.tsx` (rol activo, cliente),
> `src/app/login/page.tsx`. Tests: `proxy.test.ts`, `src/lib/auth/session.test.ts`.

---

## 1. Responsabilidad

Responder dos preguntas, en dos capas:

- **Servidor (`proxy.ts`)**: "¿hay una sesión válida?" — antes de renderizar
  cualquier ruta `/dashboard/*`. Redirige a `/login` si no.
- **Cliente (`role-provider`)**: "¿qué usuario y qué rol está activo?" — cruza la
  sesión de Supabase con la fila `usuarios` de Dexie. Alimenta `hasPermission`
  (Módulo 2).

La autorización por módulo es **toda del lado del cliente**. El único chequeo de
rol server-enforced es `/api/usuarios` (Tier 7). La barrera real de datos es
**Row Level Security en Supabase** (a verificar en este módulo).

## 2. Las tres capas de "offline"

| Situación                                   | ¿Corre `proxy.ts`?                       | Quién sostiene la sesión                                                                                                          |
| ------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Sin red total                               | **No** (el navegador no llega al server) | Service Worker sirve el HTML cacheado (que ya pasó por `proxy.ts` antes); `role-provider` resuelve rol desde Dexie + sesión local |
| Con red, Supabase caído/lento (5xx/timeout) | Sí                                       | `proxy.ts` → chequeo de sesión local                                                                                              |
| Todo online                                 | Sí                                       | `proxy.ts` valida contra Supabase                                                                                                 |

`proxy.ts` solo importa para la fila del medio y para los parpadeos de conexión.

## 3. Hallazgos (estado ANTES de este módulo)

| #          | Qué                                                                                                                                                                                                                                                                                                                   | Severidad |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| #2         | El fallback offline decodifica el JWT y lee `exp` **sin verificar la firma**. Un `{alg:"none"}` + `exp` futuro pasa el gate cuando Supabase parece inalcanzable.                                                                                                                                                      | alta      |
| #16        | supabase-js devuelve `{error}` (no lanza) para 5xx/429. `proxy.ts` trata _cualquier_ `{error}` como "sesión inválida" → `/login`. Un pico de carga de Supabase desloguea a todos.                                                                                                                                     | alta      |
| #3 (nuevo) | El access token dura ~1h y no se puede refrescar offline. `hasValidSessionCookie` chequea `exp` con margen de 60s → un técnico >1h offline es mandado a `/login`, donde tampoco puede loguearse.                                                                                                                      | alta      |
| #4 (nuevo) | `@supabase/ssr` 0.10.3 escribe el valor de la cookie como `base64-<base64url(JSON)>`. `hasValidSessionCookie` no quita ese prefijo → `JSON.parse` falla → `decodeJwtPayload` recibe `base64-…` → `parts.length !== 3` → devuelve `false`. **El fallback offline probablemente no funciona hoy para sesiones reales.** | alta      |

## 4. Diseño (decidido con el dueño)

**Opción A** (elegida): agregar `SUPABASE_JWT_SECRET` al entorno y **verificar la
firma HS256 offline** con Web Crypto (Edge-compatible). **Gracia offline: 7 días.**

### `proxy.ts` — clasificación en TRES, no en dos

```
try {
  const { data, error } = await getUser()
  if (!error)                          → user = data.user          // AUTENTICADO
  else if (isAuthRejection(error))     → user = null               // RECHAZADO → /login
  else                                 → indeterminado             // 5xx/429/desconocido
} catch {                              → indeterminado             // excepción de red
}

if (!user && indeterminado) {
  const s = readSupabaseSession(cookies)              // maneja base64- + chunks
  const payload = s && verifyHS256(s.accessToken, JWT_SECRET)
  if (payload && s.refreshToken) {
    const expiradoHace = now - payload.exp
    if (expiradoHace < 7 días)  → dejar pasar         // gracia offline
  }
}
```

- **`isAuthRejection(error)`**: `status` 401/403, o mensajes conocidos de
  supabase-js (`invalid JWT`, `invalid claim`, `token is expired`,
  `session_not_found`, `refresh_token_not_found`, `bad_jwt`). Todo lo demás →
  indeterminado.
- **`verifyHS256`**: `crypto.subtle.importKey('raw', secret, {name:'HMAC',
hash:'SHA-256'}, false, ['verify'])` + `crypto.subtle.verify`. Devuelve el
  payload solo si la firma valida. Un `alg:none` o firma incorrecta → `null`.
- **Gracia**: se mide desde `payload.exp`. Un token válidamente firmado que
  expiró hace menos de 7 días + con `refresh_token` presente = "tuvo sesión
  real, no estuvo online para refrescar". Al volver la conexión, supabase-js
  refresca solo.
- Si `SUPABASE_JWT_SECRET` no está configurado: `proxy.ts` loguea un warning y
  cae al comportamiento Opción B (barrera blanda + confianza en RLS) — no
  rompe con un 500 en cada request.

### Defensa en profundidad

Verificar (fuera de código, con el dueño) que **RLS está activo en todas las
tablas de Supabase**, para que un token falsificado que pase el gate offline no
pueda leer ni escribir datos reales.

## 5. Flujo de control (`proxy.ts`, implementado)

1. Construye el cliente SSR de Supabase con las cookies de la request.
2. `getUser()` — clasifica en tres:
   - sin error → `user = data.user` (**autenticado**).
   - error y `isAuthRejection(error)` → `user` queda `null` (**rechazo**).
   - error y NO es rechazo (5xx/429/timeout/desconocido) → `indeterminado = true`.
   - excepción (catch) → `indeterminado = true`.
3. Si `!user && indeterminado` → `hasAcceptableLocalSession(cookies, secret)`:
   - `readSupabaseSession` reconstruye `{ accessToken, refreshToken, expiresAt }`
     (maneja `base64-` + chunks).
   - **Con `SUPABASE_JWT_SECRET`**: `verifyHS256`; exige firma válida + `exp`
     presente + `refreshToken` presente + `(now - exp) < 7 días`.
   - **Sin el secreto**: warning (una vez) + acepta JWT bien formado y no
     expirado (margen 60s). RLS es la barrera real.
   - Si acepta → `return response` (pasa).
4. `pathname.startsWith("/dashboard") && !user` → redirect a `/login?redirect=…`.
5. `pathname === "/login" && user` → redirect a `/dashboard`.
6. Si no, `return response`.

## 6. Comportamiento offline / online

| Estado                                                  | Resultado                                                              |
| ------------------------------------------------------- | ---------------------------------------------------------------------- |
| Online, sesión válida                                   | pasa (Supabase confirma)                                               |
| Online, token expirado/revocado (Supabase responde 401) | → `/login`, **sin** fallback                                           |
| Online, Supabase 5xx/429                                | indeterminado → sesión local: si firma OK y dentro de gracia → pasa    |
| Sin red (excepción)                                     | indeterminado → igual que arriba                                       |
| Sin red total                                           | `proxy.ts` no corre; SW sirve HTML cacheado                            |
| >1h offline (access token expirado)                     | pasa si `(now - exp) < 7 días` y hay refresh token — la gracia offline |
| >7 días offline                                         | → `/login` al volver la conexión                                       |

## 7. Rol / permisos

- `proxy.ts` NO chequea rol, solo "hay sesión". El rol lo resuelve
  `role-provider` en el cliente (Módulo 2).
- El `matcher` no excluye `/api/*`: esas rutas pasan por el gate pero, al no ser
  `/dashboard` ni `/login`, devuelven `response` sin enforcement. El único
  chequeo de rol server-side sigue siendo el que hace `/api/usuarios` internamente.

## 8. Invariantes y supuestos

1. `SUPABASE_JWT_SECRET` (si está) es el secreto HS256 correcto del proyecto. Un
   secreto equivocado haría que TODA sesión offline falle la verificación → todos
   a `/login` en cuanto Supabase tenga un hipo. **Verificar al configurarlo.**
2. Supabase firma los JWT con HS256 (proyectos "classic"). Si el proyecto migra a
   claves asimétricas (ES256/RS256 + JWKS), `verifyHS256` devuelve `null` para
   todo y se cae a barrera blanda. → issue de seguimiento.
3. La cookie de sesión contiene `refresh_token` cuando hay sesión real (lo pone
   `@supabase/ssr`). Sin él, la gracia no aplica (evita aceptar un access token
   suelto sin sesión detrás).
4. RLS activo en Supabase (defensa en profundidad).

## 9. Modos de falla conocidos

| Falla                                           | Efecto                                     | Manejo                         |
| ----------------------------------------------- | ------------------------------------------ | ------------------------------ |
| `SUPABASE_JWT_SECRET` sin configurar            | gate offline no verifica firma             | warning + barrera blanda + RLS |
| Secreto configurado mal                         | toda sesión offline → `/login`             | ninguno — verificar al setear  |
| Proyecto Supabase con firma asimétrica          | idem anterior                              | → issue de seguimiento         |
| Supabase 5xx sostenido + token dentro de gracia | el técnico sigue trabajando offline-first  | correcto (era el objetivo)     |
| Reloj del servidor desfasado                    | la gracia se corre; con ±minutos es inocuo | aceptable                      |

## 10. Preguntas abiertas

- `role-provider` (cliente): `catch {}` vacío en `loadUser` (línea ~98). Offline
  es esperado, pero conviene un `logger.debug`. → Tier 6.
- `login/page.tsx`: `router.push` + `fullSync()` fire-and-forget. El race del
  login inicial ya se atacó (getAuthenticatedUser retry). → verificar acá.
- El `matcher` de `config` no excluye `/api/*` — las rutas API pasan por el gate
  pero como no son `/dashboard` ni `/login`, simplemente devuelven `response`
  (sin enforcement). Documentar.

---

## Apéndice B — Log de decisiones

| #                                   | Descripción                    | Decisión                                                                                  | Razón                                                                                   |
| ----------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| #2 firma sin verificar              | `alg:none` pasaba offline      | **fix-ahora**: `verifyHS256` con `SUPABASE_JWT_SECRET`. Test: `forgedAlgNone` → `/login`. | Cierra el bypass de raíz.                                                               |
| #16 5xx desloguea                   | cualquier `{error}` → `/login` | **fix-ahora**: `isAuthRejection` clasifica; 5xx/429/timeout → indeterminado.              | Mantiene offline-first justo cuando el backend está frágil.                             |
| #3 token expira offline             | >1h offline → `/login`         | **fix-ahora**: gracia de 7 días desde `exp` si hay refresh token.                         | El técnico no puede refrescar sin red; punir mid-visita es peor que el riesgo marginal. |
| #4 cookie `base64-`                 | el parser viejo no la entendía | **fix-ahora**: `readSupabaseSession` quita el prefijo + arma chunks.                      | El fallback offline no funcionaba para sesiones reales.                                 |
| Firma asimétrica                    | `verifyHS256` solo HS256       | **backlog**: issue de seguimiento; hoy el proyecto es HS256.                              | —                                                                                       |
| `role-provider` catch vacío         | offline esperado, sin log      | **backlog Tier 6**                                                                        | Es cliente, no `proxy.ts`.                                                              |
| `/api/*` sin enforcement en el gate | documentado en §7              | **aceptar** — `/api/usuarios` valida rol internamente                                     | El gate es de _sesión_, no de rol.                                                      |

## Apéndice C — Estado de salida (Fase 6)

- [x] Doc completo (10 secciones)
- [x] `SUPABASE_JWT_SECRET` en `env.ts` (opcional) + `.env.example` (nuevo) +
      placeholder en `.env.local` — **el dueño debe pegar el valor real**
      (Supabase → Settings → API → JWT Secret) en `.env.local` y en Vercel.
- [x] `src/lib/auth/session.ts` + `session.test.ts` (17 tests): `verifyHS256`,
      `readSupabaseSession`, `isAuthRejection`, `decodeJwtPayload`,
      `SESSION_GRACE_MS`
- [x] `proxy.ts` reescrito — clasificación en 3 + gracia 7 días + degradación
      sin secreto
- [x] `proxy.test.ts` — matriz completa (26 casos: respuesta Supabase × estado
      cookie × con/sin secreto + rutas)
- [ ] **Pendiente dueño**: pegar el `SUPABASE_JWT_SECRET` real (local + Vercel)
- [ ] **Pendiente dueño**: confirmar que RLS está activo en todas las tablas de
      Supabase (defensa en profundidad)
- [ ] Issue de seguimiento: firma asimétrica
- [x] `npm run verify` limpio (314 tests)
- [ ] Sign-off del dueño
