# 7. Seguridad

La app maneja datos de salud y de cumplimiento normativo, y ejecuta expresiones configurables.
La seguridad se aborda en varias capas.

## 7.1 Autenticación

- **Supabase Auth** gestiona las credenciales. La sesión vive en cookies `sb-*-auth-token`.
- El **`proxy.ts`** (equivalente al middleware en Next.js 16) protege todo `/dashboard/*`
  server-side: si no hay usuario válido, redirige a `/login?redirect=...`. Si ya hay sesión y se
  visita `/login`, redirige a `/dashboard`.
- **Tolerancia offline:** si Supabase es inalcanzable (error de red), el proxy no cierra la
  sesión de golpe; valida localmente la cookie decodificando el JWT y comprobando `exp` con un
  **margen de 60 s** (`hasValidSessionCookie`). La firma del JWT la valida Supabase server-side;
  aquí solo se lee `exp` para no expulsar a un técnico que perdió conexión en campo.
- El proxy reconstruye tokens **fragmentados** por Supabase SSR (cookies `.0`, `.1`, …).

## 7.2 Autorización (permisos)

Modelo granular rol × módulo × acción (ver [Workflow y roles §4.3](04-workflow-y-roles.md#43-permisos)).
Puntos de seguridad relevantes:

- **No se confía en el rol local de IndexedDB.** El `RoleProvider` **re-verifica el `cargo`
  contra Supabase** (`serverCargo`) y lo prefiere sobre el valor de Dexie (mitigación C2 en el
  código). El vínculo sesión↔usuario es por `auth_uid` (fallback por email).
- Al cerrar sesión, el estado de rol se limpia **siempre**, con o sin conexión (mitigación A1).
- La autorización de UI (`hasPermission`) es **defensa de conveniencia**; la autorización real de
  datos la imponen las **políticas RLS** de PostgreSQL (`002_row_level_security.sql`,
  `005_rls_fix_and_new_tables.sql`) y la validación server-side de la API.

## 7.3 API de creación de usuarios

Única API route ([`src/app/api/usuarios/route.ts`](../src/app/api/usuarios/route.ts)); es la
superficie más sensible porque usa el **service role**. Controles apilados:

1. **Rate limiting**: 5 peticiones/minuto por clave (`rateLimit`, `getRateLimitKey`) → `429`.
2. **Autenticación**: exige sesión válida → `401` si no.
3. **Autorización server-side**: consulta el `cargo` del llamante en la DB y exige
   `coordinador` → `403` en caso contrario. (No confía en nada que venga del cliente.)
4. **Validación Zod** del cuerpo (`createUsuarioSchema`). Si falla, **no expone** los detalles del
   schema al cliente (`{ error: "Datos inválidos" }`, `400`) y loguea el detalle server-side
   (mitigación A2).
5. **Creación transaccional con rollback**: crea el usuario en Auth y luego en la tabla
   `usuarios`; si el insert falla, intenta **borrar el usuario de Auth** para no dejar huérfanos,
   y si el rollback falla lo registra en el logger (mitigación A3).
6. **Service role lazy init**: el cliente admin se crea por request, no al importar el módulo (M2).

## 7.4 Sandbox de fórmulas

Las `PruebaDefinicion` pueden traer expresiones JS (`FormulaDefinicion.expresion`) que se ejecutan
con `new Function()`. El riesgo (ejecución arbitraria / prototype pollution) se mitiga en
[`engine.ts`](../src/lib/equipos/engine.ts) con `validateExpression`:

- **Blocklist** de ~50 tokens peligrosos (`import`, `require`, `eval`, `Function`, `constructor`,
  `prototype`, `__proto__`, `this`, `new`, `process`, `fetch`, `window`, `Object`, `Reflect`…).
- Bloqueo de **escapes Unicode**, **template literals**, **concatenación en acceso por corchetes**
  y **acceso a proto/constructor por corchetes**.
- **Límite de longitud** (2000 chars) anti-ReDoS.
- En ejecución: `"use strict"`, contexto **congelado** (`Object.freeze`) y sólo se inyectan
  `row`, `rows`, `stats`, `Math`, `equipo`, `valores_ref`, `helpers`.

> Modelo de amenaza: las definiciones de prueba las controla la organización (coordinación /
> catálogo), pero el sandbox protege ante definiciones maliciosas o corruptas que llegaran por
> sync. **Al modificar la blocklist, correr `engine.test.ts`.**

## 7.5 Variables de entorno

Centralizadas y **validadas con Zod** en [`src/lib/env.ts`](../src/lib/env.ts). Convención
(CLAUDE.md): **nunca** leer `process.env` directo; importar de `@/lib/env`.

| Variable | Ámbito | Uso |
|----------|--------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | cliente | URL del proyecto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | cliente | Clave anónima (RLS aplica) |
| `SUPABASE_SERVICE_ROLE_KEY` | **solo server** | Cliente admin en la API de usuarios |

`clientEnv` se valida al importar; `getServerEnv()` valida el service role solo cuando se usa
(por request), de modo que el frontend nunca requiere esa clave.

## 7.6 Auditoría

La tabla `change_logs` y `trackChange` están diseñadas para registrar **quién cambió qué campo y
cuándo**. La infraestructura existe; su activación en los formularios de captura está pendiente
(ver [`../TODO.md`](../TODO.md)). Es un requisito relevante para trazabilidad normativa.

## 7.7 Buenas prácticas del repositorio

- Loguear siempre con `@/lib/logger`; **prohibidos los `catch` vacíos** (CLAUDE.md).
- No exponer detalles internos (schemas, stack traces) en respuestas al cliente.
- TypeScript strict + Zod en las fronteras (entrada de API, env, validación de datos).
