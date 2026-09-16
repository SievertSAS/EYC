# 6. Sincronización offline

Motor: [`src/lib/supabase/sync-engine.ts`](../src/lib/supabase/sync-engine.ts).

## 6.1 Estrategia: "local-first con UPSERT por UUID"

- **La app escribe siempre primero en Dexie** y marca el registro `sync_status: "pending"`.
- Como el **`id` local ES el `id` remoto** (UUID generado en cliente), sincronizar es un simple
  `upsert(..., { onConflict: "id" })`. No hay tabla de mapeo local↔remoto ni campo `_remote_id`.
- Los binarios (`blob_local`, `archivo_raysafe_blob`) y los campos de control (`sync_status`,
  `last_modified`) **nunca** viajan a Supabase (`LOCAL_ONLY_FIELDS`, `prepareForRemote`). Antes de
  cada push, `ensureBlobUploaded` (línea 188) sube el blob al bucket **privado** `evidencias`
  (comprimido a JPEG, `storage.ts`) y guarda el **path** devuelto (no una URL) en `url_storage`;
  ese campo sí viaja como columna normal. Mostrar la imagen pide una signed URL bajo demanda
  (`resolverImagenSrc`, cacheada 55 min).
- Si el push falla, `sync-retry.ts` programa un reintento con **backoff exponencial + jitter**
  (`computeBackoffDelayMs`: ~1 min, ~4 min, ~16 min, tope 60 min) hasta `MAX_ATTEMPTS = 5`, tras lo
  cual el registro pasa a `sync_status: "failed"` (reintento manual vía `retryRecord`). Un error de
  Postgres/PostgREST de la lista `PERMANENT_ERROR_CODES` (violación de unicidad, columna
  inexistente, RLS, etc.) salta directo a `"failed"` sin agotar los 5 intentos.

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
   por tabla en `sync_meta`), paginado por **keyset en `id`** (línea 928) — nunca por offset, para
   no perder filas si se insertan registros mientras el pull está en curso. El **watermark se
   captura al iniciar el pull, no al terminar** (línea 940), y solo se persiste
   (`setLastSyncTimestamp`) si **todas** las páginas se procesaron sin error; si una página falla,
   la excepción se propaga y el watermark queda intacto para reintentar desde ahí en el próximo
   ciclo (`recordPullError` deja registrado el fallo sin tocarlo).

Devuelve `SyncResult { pushed, pulled, errors[], timestamp }`.

## 6.4 Resolución de conflictos (pull)

Al bajar un registro de campo, `applyRemoteSyncRecord` (línea 816) decide según el estado local:

| Estado local | Acción |
|--------------|--------|
| No existe localmente | Se inserta (`synced`); si el remoto trae `deleted_at`, se aplica el soft-delete borrando la copia local |
| `synced` (sin cambios pendientes) | Se sobrescribe con la versión remota (`synced`) |
| Cualquier otro estado (hay cambios locales sin subir) | **Gana lo local**: se conserva la fila y su `sync_status` tal cual (normalmente `pending`), para que el próximo push la reintente |

Es una política **"last-write-wins con preferencia local"**: nunca se pisan cambios de campo no
sincronizados. El estado `sync_status: "conflict"` **ya no existe** en el enum del cliente — se
retiró porque dejaba la fila fuera de las colas de `pending`/`error` (invisible para
`getErrorRecords`/`retryErrorRecords` y para el contador de la UI). En su lugar, si el registro
remoto es **estrictamente más nuevo** que la edición local pendiente (colisión real: el próximo
push la va a pisar), se cuenta en memoria (`pullConflictCount`, `getPullConflictStats()`) y se
loguea como error — solución interina documentada en el código hasta el rediseño (merge por
columna o cola de conflictos; issues #3/#4/#5).

Al aplicar la versión remota (fila nueva o `synced`), `mergeLocalBinaries` (línea 147) reinyecta
`blob_local`/`archivo_raysafe_blob` (y los blobs de imágenes anidadas en `imagenes[]`) que el
registro local ya tenía: el pull nunca los trae porque el push los descarta, así que un `put` a
ciegas del remoto borraría la evidencia fotográfica capturada en ese dispositivo (bug #67).

## 6.5 Variantes de sincronización

- **`pushSingle(tabla, id)`** — push inmediato de un registro recién guardado. Se llama desde los
  formularios y desde la máquina de estados justo tras escribir en Dexie. **No bloquea la UI** y
  falla en silencio si está offline (el registro queda `pending` para el próximo ciclo).
- **`pushAllPending()`** — empuja todo lo pendiente sin hacer pull. Es el que usa el **auto-sync**
  periódico (más liviano que `fullSync`).
- **`fullSync()`** — ciclo completo, típicamente disparado manualmente desde el panel de sync o al
  recuperar conexión.

**Concurrencia:** `fullSync`, `pushAllPending`, `pullAllPending` y `retryRecord` corren envueltos
en `withSyncLock` (`sync-lock.ts`) — un lock *single-flight* con la Web Locks API
(`navigator.locks`, efectivo **entre pestañas** del mismo origen, necesario porque el Service
Worker dispara sync a cada tab abierta) y fallback en memoria para entornos sin esa API (solo
protege dentro del mismo proceso/pestaña). Si ya hay una sincronización en curso, la nueva
invocación no ejecuta `fn` y devuelve `{ ran: false, reason: "locked" }` en vez de correr en
paralelo.

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
- **`getFailingPullTables()`** (línea 998) — lista las tablas cuyo *pull* automático viene
  fallando (`sync_meta.last_pull_error`, registrado por `recordPullError`), para que el panel
  muestre "esta tabla viene fallando" en vez de que el error quede solo en el logger (#19). Es el
  único `catch {}` vacío intencional del motor: envuelve un helper de diagnóstico no crítico y
  devuelve `[]` si `sync_meta` no se puede leer, sin riesgo de pérdida de datos — no rompe la
  convención de CLAUDE.md de evitar catches vacíos porque no oculta un fallo de sincronización real.
- Los errores se registran con el **logger estructurado** (`@/lib/logger`), nunca con `catch`
  vacíos salvo la excepción documentada arriba (convención de [CLAUDE.md](../CLAUDE.md)).
  `describeError` extrae `message`/`code`/`hint` de los errores de Supabase para que el técnico
  vea algo accionable.

## 6.8 Clientes Supabase

- `src/lib/supabase/client.ts` — cliente **browser** (usa `NEXT_PUBLIC_*`).
- `src/lib/supabase/server.ts` — cliente **server** (SSR, cookies) para `proxy.ts` y la API.
- El **service role** solo se usa server-side en `api/usuarios` (lazy init). Ver [Seguridad](07-seguridad.md).

## 6.9 RLS y watermark en Supabase

- **RLS permisivo** (`017_rls_politicas_escritura_sync.sql`): todas las tablas de sync tienen RLS
  habilitado con una política por comando (`SELECT`/`INSERT`/`UPDATE`/`DELETE`) que permite
  **cualquier** usuario `authenticated`, sin ownership por fila — el modelo de acceso real es
  "cualquier miembro del staff autenticado puede leer/escribir los datos de campo". Documentado
  como deuda técnica (ownership/RLS por rol es un proyecto aparte).
- **`update_last_modified()`** (`016_last_modified_all_sync_tables.sql`) — trigger `BEFORE INSERT
  OR UPDATE` en cada tabla de sync que reasigna `NOW()` a `last_modified`. Es **crítico** para el
  pull incremental: sin él, un `UPDATE` vía `upsert(..., { onConflict: "id" })` no avanzaba la
  columna y el watermark (`.gt("last_modified", lastSynced)`) nunca volvía a traer esa fila editada
  a otro dispositivo.
