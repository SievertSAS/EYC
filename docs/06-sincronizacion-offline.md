# 6. Sincronización offline

Motor: [`src/lib/supabase/sync-engine.ts`](../src/lib/supabase/sync-engine.ts).

## 6.1 Estrategia: "local-first con UPSERT por UUID"

- **La app escribe siempre primero en Dexie** y marca el registro `sync_status: "pending"`.
- Como el **`id` local ES el `id` remoto** (UUID generado en cliente), sincronizar es un simple
  `upsert(..., { onConflict: "id" })`. No hay tabla de mapeo local↔remoto ni campo `_remote_id`.
- Los binarios (`blob_local`, `archivo_raysafe_blob`) y los campos de control (`sync_status`,
  `last_modified`) **nunca** viajan a Supabase (`LOCAL_ONLY_FIELDS`, `prepareForRemote`). Los
  Blobs van a Supabase Storage por separado (pendiente).

## 6.2 Tipos de tabla en el sync

| Grupo | Ejemplos | Dirección |
|-------|----------|-----------|
| **SYNC_TABLES** (bidireccional) | `clientes`, `sedes`, `equipos`, `solicitudes`, `visitas`, datos de campo, las 21 tablas `conv_*` | Push + Pull |
| **MASTER_TABLES** (solo descarga) | `departamentos`, `municipios`, `usuarios`, `prueba_definiciones`, `informes`, `rol_permisos`… | Pull (reemplazo total) |

> **Pendiente:** confirmar que las tablas `conv_*` existen en Supabase con el mismo esquema —
> el código ya las incluye en `SYNC_TABLES`, pero si la tabla remota no existe el push/pull
> falla en silencio. Es una tarea abierta en [`../TODO.md`](../TODO.md).

## 6.3 Ciclo `fullSync()`

Orden: **push primero** (para no perder cambios locales), luego pull.

1. **Verifica sesión** (`supabase.auth.getUser`). Sin sesión → error `_auth` y aborta.
2. **PUSH** de `SYNC_TABLES`: por cada tabla, envía los registros `pending` vía `upsert`. Éxito →
   `synced`; fallo → `error` (y se registra en `SyncError` con mensaje legible + detalle técnico).
3. **PULL de maestras**: `select("*")` completo y `bulkPut` (reemplaza el contenido local).
4. **PULL incremental de campo**: solo registros con `last_modified > last_pulled_at` (guardado
   por tabla en `sync_meta`).

Devuelve `SyncResult { pushed, pulled, errors[], timestamp }`.

## 6.4 Resolución de conflictos (pull)

Al bajar un registro de campo, `pullSyncTable` decide según el estado local:

| Estado local | Acción |
|--------------|--------|
| No existe localmente | Se inserta (`synced`) |
| `synced` (sin cambios pendientes) | Se sobrescribe con la versión remota (`synced`) |
| `pending`/otro (hay cambios locales) | **Gana lo local**: se marca `conflict` y se conserva la versión del dispositivo |

Es una política **"last-write-wins con preferencia local"**: nunca se pisan cambios de campo no
sincronizados; quedan marcados como `conflict` para resolución/diagnóstico.

## 6.5 Variantes de sincronización

- **`pushSingle(tabla, id)`** — push inmediato de un registro recién guardado. Se llama desde los
  formularios y desde la máquina de estados justo tras escribir en Dexie. **No bloquea la UI** y
  falla en silencio si está offline (el registro queda `pending` para el próximo ciclo).
- **`pushAllPending()`** — empuja todo lo pendiente sin hacer pull. Es el que usa el **auto-sync**
  periódico (más liviano que `fullSync`).
- **`fullSync()`** — ciclo completo, típicamente disparado manualmente desde el panel de sync o al
  recuperar conexión.

## 6.6 Auto-sync y conectividad

- El hook **`use-auto-sync`** dispara sincronización periódica / al volver online.
- **`use-online-status`** expone el estado de red; **`connection-badge.tsx`** lo muestra en la UI.
- **`checkSyncStatus()`** reporta `{ online, authenticated, pendingCount, errorCount }` para el
  badge y el panel `dashboard/sync`.

## 6.7 Diagnóstico y reintentos

- **`getErrorRecords()`** — lista registros en estado `error` (con un `preview` legible: nombre
  del cliente, código, etc.) para mostrarlos en el panel de sync.
- **`retryErrorRecords()`** — marca todos los `error` como `pending` de nuevo para reintentar en
  el próximo ciclo.
- Los errores se registran con el **logger estructurado** (`@/lib/logger`), nunca con `catch`
  vacíos (convención de [CLAUDE.md](../CLAUDE.md)). `describeError` extrae `message`/`code`/`hint`
  de los errores de Supabase para que el técnico vea algo accionable.

## 6.8 Clientes Supabase

- `src/lib/supabase/client.ts` — cliente **browser** (usa `NEXT_PUBLIC_*`).
- `src/lib/supabase/server.ts` — cliente **server** (SSR, cookies) para `proxy.ts` y la API.
- El **service role** solo se usa server-side en `api/usuarios` (lazy init). Ver [Seguridad](07-seguridad.md).
