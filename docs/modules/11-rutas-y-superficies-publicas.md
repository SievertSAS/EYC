# Módulo: rutas del dashboard + superficies públicas

> Estado: 🟡 en curso (Tier 7) · Última actualización: `2026-08-28` · Responsable: `Juan Pablo Guzmán`

Doc producido por el protocolo de intervención (ver
`~/.claude/plans/en-dias-anteriores-he-cheerful-hopcroft.md`).

Tier 7 — pasada **enfocada en seguridad** sobre las rutas. Cubre:
- `POST /api/usuarios` — el único chequeo de rol server-enforced.
- `/verificar/[token]` — página pública service-role (QR).
- `/login` — entrada de sesión.
- `src/app/dashboard/*` (14 páginas) — auditoría de gates de rol.

---

## 1. Responsabilidad

- **`/api/usuarios`** — única fuente de verdad del alta de usuarios. Valida
  sesión + rol `coordinador` **en el servidor** (no confía en el cliente),
  rate-limita por IP, y hace rollback del usuario `auth` si falla el insert.
- **`/verificar/[token]`** — publica el estado de un informe a quien escanee
  su QR. Sin sesión; usa `service_role` (salta RLS). Debe exponer **solo**
  datos del informe/equipo, nunca PII del cliente.
- **`/login`** — autentica contra Supabase Auth y redirige. El destino sale
  de `?redirect=` y **debe** ser una ruta interna.
- **`dashboard/*`** — cada página compone módulos ya certificados; el gate de
  rol es cliente (`hasPermission` / `isAdmin` de `useRole`). `proxy.ts`
  garantiza sesión (autenticación) server-side, no rol (autorización).

## 2. API pública

| Ruta | Método | Efecto | Errores |
| --- | --- | --- | --- |
| `/api/usuarios` | `POST` | crea usuario `auth` + fila `usuarios` (rollback si falla) | 429 rate limit · 401 sin sesión · 403 no-coordinador · 400 body inválido (genérico) · 500 error de guardado |
| `/verificar/[token]` | `GET` (RSC) | render del estado del informe + link al PDF firmado (1 h) | informe no encontrado → pantalla "Informe no encontrado" |
| `/login` | client | `signInWithPassword` + `router.push(safeRedirect(redirect))` | credenciales → mensaje + cooldown exponencial (2 s → 30 s) |

## 3. Modelo de datos

- `/api/usuarios`: lee `usuarios.cargo` (por `auth_uid`) con el cliente
  **admin**; escribe `auth.users` + `usuarios`. Rate-limit en memoria
  (per-instancia, ver `rate-limit.ts`).
- `/verificar/[token]`: lee **solo** `informes`, `informe_versiones`,
  `equipos` (con listas de columnas explícitas, sin `*`) + un signed URL de
  Storage. `qr_token` es `crypto.randomUUID()` (v4, 122 bits) → enumeración
  inviable, no requiere rate-limit adicional.
- `/login`: sin acceso directo a datos.

## 4. Flujo de control

**`/api/usuarios` (orden exacto):**
1. `rateLimit(create-user:<ip>, 5, 60s)` → 429 si excede.
2. `getAuthenticatedUser` (`supabase.auth.getUser()` verifica el JWT) → 401 si null.
3. Lookup `usuarios.cargo` por `auth_uid` con cliente admin → 403 si no es `coordinador`.
4. `createUsuarioSchema.safeParse(body)` → 400 genérico si falla (el detalle va a `logger.warn`, no al cliente).
5. `auth.admin.createUser` → si error, 400 con el mensaje de GoTrue.
6. `insert` en `usuarios` → si error, `auth.admin.deleteUser` (rollback; loguea si el rollback falla) + 500.
7. 201 `{ usuario }`.

**`/verificar/[token]`:** token → `informes` por `qr_token` → (`informe_versiones` + `equipos` en paralelo) → signed URL si hay `pdf_url` → render.

**`/login`:** submit → `signInWithPassword` → en éxito `router.push(safeRedirect(redirect))` + `fullSync()` en background (no bloquea).

## 5. Comportamiento offline / online

- `/api/usuarios` y `/verificar` exigen red (server-side).
- `/login`: el submit exige red; el cooldown de reintento es cliente.

## 6. Interacción con sync

- `/login` dispara `fullSync()` fire-and-forget tras autenticar (con
  `logger.warn`/`error` si el pull inicial falla — Tier 2).
- Las demás rutas no tocan el sync engine.

## 7. Rol / permisos

- **`/api/usuarios`** — server-enforced: `coordinador` únicamente. ✅
- **`/verificar`** — público por diseño (capability = el `qr_token`).
- **`dashboard/*`** — matriz de gates auditada:

| Página | Gate de página | Nota |
| --- | --- | --- |
| `dashboard/` (home) | — | dashboard = `ver` para todos los roles; contenido condicionado por `hasPermission` |
| `clientes`, `clientes/[id]` | — | acciones (crear/editar) gated; `comercial` tiene `clientes:GESTIONAR` |
| `equipos`, `equipos/[id]` | — | acciones gated |
| `solicitudes`, `solicitudes/[id]` | — | acciones gated |
| `visitas`, `visitas/[id]` | — | lista filtra por técnico asignado |
| `revision`, `revision/[id]` | `hasPermission("revision")` ✅ | |
| `informes` (lista) | `hasPermission("informes")` ✅ | |
| `informes/[id]` (detalle) | `hasPermission("informes")` ✅ **(agregado en Tier 7)** | + botón "Publicar versión oficial" ahora requiere `informes:editar` |
| `configuracion` | `isAdmin` ✅ | gestión de usuarios/permisos |
| `sync` | — | estado de sync; `sync:ver` para todos los roles |

## 8. Invariantes y supuestos

- Todos los usuarios son personal interno de Sievert (4 roles). No hay
  usuarios "cliente" con login → el riesgo de una página de dashboard sin
  gate de rol está acotado a mal-uso interno, no a exposición pública.
- `proxy.ts` cubre la autenticación de `/dashboard/*`; la autorización por
  rol es responsabilidad de cada página (cliente).
- `?redirect=` de `/login` es una ruta interna tras `safeRedirect`.

## 9. Modos de falla conocidos

| Falla | Efecto | Manejo |
| --- | --- | --- |
| `x-forwarded-for` spoofeado en `/api/usuarios` | rate-limit por IP evadible rotando el header | aceptado — GoTrue tiene su propio límite global; migrar a Upstash para límite distribuido |
| `request.json()` con body no-JSON | excepción → 500 de Next (no 400) | menor; el schema igual rechazaría |
| Página de dashboard sin gate de rol + navegación directa por URL | un rol interno ve datos fuera de su alcance | ver tabla §7; `informes/[id]` corregido, resto documentado |

## 10. Preguntas abiertas / smells

- `rate-limit` es per-instancia (serverless) — límite real requiere Redis.
- Gates de dashboard son 100% cliente; no hay defensa en profundidad
  server-side salvo `/api/usuarios`. Un rediseño con RLS + checks en Server
  Components sería el fix estructural (fuera de alcance de esta pasada).
- `informes/[id]` cargaba `cliente` en su `useLiveQuery` aunque el detalle
  muestra poco de él — revisar si hace falta.

---

## Apéndice B — Log de decisiones (triage de hallazgos)

| # | Descripción | Decisión | Razón | Sign-off |
| --- | --- | --- | --- | --- |
| T7-1 | `/login` hacía `router.push(searchParams.get("redirect"))` sin validar → **open redirect** (`?redirect=https://evil.com` o `//evil.com`) | **fix-ahora** | Vector de phishing post-login; fix contenido | ⬜ pendiente dueño |
| T7-2 | `/dashboard/informes/[id]` sin gate de rol: la lista exige `hasPermission("informes")` pero el detalle no, y ofrecía "Publicar versión oficial" (QR + hash) sin chequeo | **fix-ahora** | Publicar la versión oficial es la acción de mayor impacto sobre el artefacto de mayor valor; inconsistencia con la lista | ⬜ pendiente dueño |
| T7-3 | Otras páginas de dashboard sin gate de página (solo gate de acciones) | **aceptar + documentar** | Base de usuarios 100% interna (4 roles); blast radius acotado; el fix real es defensa en profundidad server-side (proyecto aparte) | ⬜ pendiente dueño |
| T7-4 | `rate-limit` per-instancia | **aceptar** | Ya documentado en `rate-limit.ts`; GoTrue complementa con límite global; migrar a Upstash si escala | ⬜ pendiente dueño |
| — | `/verificar/[token]` filtra PII | **descartado** | No filtra: consulta solo `informes`/`informe_versiones`/`equipos` con columnas explícitas; el PDF firmado sí contiene PII pero es el documento oficial que el QR publica; token = UUID v4 | ⬜ pendiente dueño |

### Detalle de los fixes

- **`src/app/login/page.tsx`** — nueva función exportada `safeRedirect(raw)`:
  solo admite rutas que empiezan con `/` y no con `//` ni `/\`. Se usa en
  lugar del `searchParams.get("redirect") ?? "/dashboard"` crudo.
- **`src/app/dashboard/informes/[id]/page.tsx`** — importa `useRole`; gate de
  página `if (!hasPermission("informes")) → "Acceso restringido"` (mismo
  patrón que `revision/page.tsx`); el botón "Publicar versión oficial" ahora
  requiere `hasPermission("informes", "editar")`.

## Apéndice C — Estado de salida (Fase 6)

- [x] Doc completo
- [x] `POST /api/usuarios` — 8 tests cubren los 6 branches de seguridad + rate limit + rollback
- [x] `/verificar/[token]` — 5 tests: not-found, render, **contrato "solo informes/versiones/equipos"**, PDF firmado, sin-PDF
- [x] `/login` — `safeRedirect` (9 casos) + 2 tests de integración del redirect tras autenticar
- [x] Hallazgos fix-ahora (T7-1, T7-2) cerrados con test / fix aplicado
- [x] `npm run verify` limpio
- [ ] Smoke render por rol de las 14 páginas de dashboard — **diferido**: fricción de `use(params)` + `next/link` sin contexto de router en happy-dom; bajo valor (componen piezas ya certificadas). La auditoría de gates (§7) queda como el entregable de esta pasada.
- [ ] Sign-off del dueño
