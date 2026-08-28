# Módulo: Motor de sincronización (`src/lib/supabase/`)

> Estado: 🟡 en curso (Tier 2) · 2026-08-28
> Archivos: `sync-engine.ts` (1024 líneas), `sync-retry.ts`, `sync-lock.ts`,
> `src/hooks/use-auto-sync.ts`. Tests: `sync-engine.test.ts`,
> `sync-retry.test.ts`, `sync-lock.test.ts`, `sync-classification.test.ts` (Tier 0).
>
> **Alcance de esta pasada (Tier 2):** los fix-ahora chicos (#17–#21) + guardas
> interinas para #3 y #5. El **rediseño del modelo de conflicto** (#3/#4/#5
> completo — dirty-tracking por columna, cola de conflictos, UI) es un
> **proyecto follow-on aparte**, NO entra acá.

---

## 1. Responsabilidad

Único dueño de la sincronización bidireccional Dexie ↔ Supabase.

- **PUSH**: filas locales con `sync_status: "pending"` → Supabase (UPSERT por id).
- **PULL**: cambios de Supabase → Dexie. Incremental por `last_modified`.
- El id local ES el id remoto (UUID de cliente). Sin mapeo.

## 2. API pública (`sync-engine.ts`)

| Export                                                   | Qué hace                                                                                                       | Error                                                            |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----- |
| `fullSync()`                                             | push todas SYNC_TABLES → pull MASTER_TABLES → pull SYNC_TABLES. Bajo `withSyncLock`.                           | no lanza; errores en `result.errors[]`                           |
| `pushAllPending()`                                       | solo push SYNC_TABLES. Auto-sync. Bajo lock.                                                                   | `{ pushed, errors }`                                             |
| `pullAllPending()`                                       | solo pull incremental SYNC_TABLES (sin MASTER). Bajo lock.                                                     | `{ pulled, errors }` — **hoy traga los errores por tabla** (#19) |
| `pushSingle(table, id)`                                  | push inmediato tras guardar en un form. `navigator.onLine` gate.                                               | `boolean`, silencioso                                            |
| `updateAndSync(table, id, patch)`                        | patch + `sync_status:"pending"` + `last_modified` + `pushSingle`. **Usar esto**, no `db.table.update` directo. | void                                                             |
| `deleteAndSync(table, id)`                               | `updateAndSync(…, { deleted_at })` — soft delete.                                                              | void                                                             |
| `retryRecord(table, id)`                                 | reintento manual de UNA fila, se salta el backoff. Bajo lock.                                                  | void                                                             |
| `retryErrorRecords()`                                    | mueve filas `"error"` → `"pending"`. **Hoy no hace nada** — nada setea `"error"` (#18).                        | `number`                                                         |
| `getErrorRecords()` / `getPendingRecords()`              | previews para la consola de sync                                                                               | `[]`                                                             |
| `countSyncStatuses()`                                    | `{ pendingCount, errorCount }` (error = error+failed)                                                          | —                                                                |
| `getAuthenticatedUser(supabase, retries=1, delayMs=500)` | `getUser()` con 1 reintento (race del login)                                                                   | `{id}                                                            | null` |
| `SYNC_TABLES`, `MASTER_TABLES`                           | listas de clasificación (exportadas en Tier 0)                                                                 | —                                                                |

## 3. Modelo de datos

- **`sync_status`** (Dexie): el motor solo escribe `pending`/`synced`/`failed`.
  **`"error"` y `"conflict"` del enum están MUERTOS** — nada los setea
  (issues #35 + este módulo). `getErrorRecords` consulta `["error","failed"]`
  → en la práctica solo `failed`. `retryErrorRecords` consulta `"error"` → en
  la práctica **no hace nada**.
- **`last_modified`**: lo pone el cliente al escribir, PERO `prepareForRemote`
  lo **quita** antes de pushear (`LOCAL_ONLY_FIELDS`). Del lado Supabase:
  columna `DEFAULT NOW()` + trigger `BEFORE UPDATE` **solo en 5 tablas**
  (`visitas`, `prueba_resultados`, `mediciones_radiometricas`, `evidencias`,
  `grupo_resultados`). En las otras ~30 SYNC_TABLES, un UPDATE **no avanza
  `last_modified`** → el pull incremental de otro dispositivo (`.gt(last_modified,
watermark)`) nunca vuelve a traer esa fila editada. → **#5, parte grave.**
- **`sync_meta`** (PK `table_name`): watermark `last_pulled_at` por tabla.
- **`sync_retry`** (PK `[table_name+record_id]`): backoff exponencial.
- **`prepareForRemote`** recorta `LOCAL_ONLY_FIELDS` + `EXTRA_LOCAL_FIELDS`
  (listas a mano — #20, guard parcial en `sync-classification.test.ts`).

## 4. Flujo — conflicto (`applyRemoteSyncRecord`)

Al pull, por cada fila remota:

- Sin fila local, o local `synced`: si remoto trae `deleted_at` → `delete()`
  local; si no → `put({...remoto, synced})`.
- Local con `sync_status != "synced"` (edición pendiente): **conflicto → se
  mantiene local, `logger.warn`, cuenta 0.** El próximo push sobrescribe el
  remoto (last-writer-wins = **local siempre gana, en silencio**). → #3.

## 5. Flujo de control

**Push** (`pushTable`): `where("sync_status").equals("pending")` → por fila,
si `sync_retry` programado y no vencido → saltar; `prepareForRemote` →
`upsert(onConflict:"id")` → éxito: `synced` + `recordSuccess`; error:
`recordFailure` (backoff) y solo marca `failed` si el retry es terminal.

**Pull incremental** (`pullSyncTable` → `pullSyncPages`): watermark de
`sync_meta` leído ANTES de paginar; keyset por `id` con
`.gt("last_modified", watermark)`; el watermark solo avanza si TODAS las
páginas ok (a-least-once). `applyRemoteSyncRecord` por fila (ver §4).
Éxito → `setLastSyncTimestamp` limpia `last_pull_error`. Falla → el caller
llama `recordPullError` (#19).

**Auto-sync** (`useAutoSync`): al reconectar espera `RECONNECT_DEBOUNCE_MS`
(3s) de conexión estable, después `syncCycle` (push → pull, secuencial por
el lock) + `setInterval` 5 min. `runningRef` evita solapar dos ciclos.

## 6. Offline / online

- `pushSingle` / `runPushAllPending` / `runPullAllPending`: gate
  `navigator.onLine`; sin sesión → no-op.
- `recordFailure` no consume un intento si `!navigator.onLine` (el fallo es
  de red, no del registro).
- Offline: todo queda `pending` en Dexie; al reconectar, el debounce +
  `syncCycle` lo sube.

## 7. Rol / permisos

- No chequea rol. `runFullSync`/`runPushAllPending`/`runPullAllPending`
  exigen sesión (`getAuthenticatedUser`), no un cargo.
- `retryRecord` es explícitamente sin gate de rol (el técnico de campo lo
  usa).

## 8. Invariantes y supuestos

1. El id local == id remoto (UUID de cliente). Sin mapeo.
2. `last_modified` server-side monótono — **requiere la migración 016**
   (antes solo 5 tablas lo tenían). Sin ella, los edits de ~30 tablas no
   propagan entre dispositivos.
3. `LOCAL_ONLY_FIELDS` / `EXTRA_LOCAL_FIELDS` cubren TODA columna Dexie que
   no existe en Supabase (#20 — hoy a mano).
4. Conflicto = local gana. El dato del servidor más nuevo se pierde al
   próximo push (contado por `getPullConflictStats`, no evitado).
5. `withSyncLock` es single-flight real entre pestañas solo con
   `navigator.locks`; el fallback en memoria es por-pestaña.

## 9. Modos de falla conocidos

| Falla | Efecto | Manejo |
|---|---|---|
| Migración 016 sin correr | edits de ~30 tablas no propagan | ninguno hasta correrla |
| Colisión (remoto más nuevo que local pendiente) | se pierde el dato del servidor al push | `logger.error` + `getPullConflictStats` (visible, no evitado) |
| Pull de una tabla falla cada ciclo | antes: invisible | `sync_meta.last_pull_error` + `getFailingPullTables()` |
| Columna local nueva sin clasificar | `PGRST204`/`42703` → fila a `failed` | `retryErrorRecords` la recupera; guard #20 pendiente |
| `navigator.locks` ausente + multi-pestaña | dos pull/push a la vez | fallback en memoria (single-tab) |
| Reloj de cliente desfasado | con 016: inocuo (timestamps server); sin 016: watermark corrido | 016 |

## Hallazgos de esta pasada

| #          | Qué                                                                                                      | Disposición Tier 2                                                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| #17        | Login `fullSync()` fire-and-forget; si el retry-1 pierde la carrera, pull inicial no-op                  | endurecer: `retries=2`, test de la carrera                                                                                        |
| #18        | `retryErrorRecords()` apunta a `"error"` (muerto) → el botón "reintentar" de la consola no recupera nada | **fix-ahora**: apuntar a `"failed"` + resetear `sync_retry`                                                                       |
| #19        | `pullAllPending` traga errores por tabla (cuenta + log, nadie lee)                                       | **fix-ahora**: registrar último error por tabla en `sync_meta`, exponer a la consola                                              |
| #21        | `useAutoSync` deps `[isOnline]` → parpadeo de red encola ciclos                                          | **fix-ahora**: debounce del reconnect + guard de solapamiento                                                                     |
| #5 (parte) | `last_modified` no avanza server-side en ~30 tablas al UPDATE                                            | **interim fix-ahora**: migración `016` — trigger en todas las SYNC_TABLES. Test de clock skew.                                    |
| #3 (parte) | conflicto = local gana silencioso                                                                        | **interim**: `logger.error` + detectar "remoto más nuevo que el local" + contador para la consola. Rediseño completo → follow-on. |
| #20        | `LOCAL_ONLY_FIELDS`/`EXTRA_LOCAL_FIELDS` a mano                                                          | guard: test que diffea el schema Dexie vs las listas                                                                              |
| #35        | `SyncStatus."conflict"` y `"error"` muertos en el enum                                                   | quitar del tipo                                                                                                                   |

---

## Apéndice C — Estado de salida (Fase 6)

- [x] Doc completo (10 secciones)
- [x] #18 `retryErrorRecords` recupera `failed` + borra `sync_retry` + tests
- [x] #19 `recordPullError` → `sync_meta` + `getFailingPullTables()` + tests
- [x] #21 `useAutoSync` con debounce de reconnect + `runningRef` + tests
- [x] #17 `getAuthenticatedUser` `retries: 1 → 2` + tests actualizados
- [x] `016_last_modified_all_sync_tables.sql` — **PENDIENTE: el dueño la corre**
      en Supabase (SQL Editor). Trigger en las 34 SYNC_TABLES.
- [x] #3 interino: `logger.error` + `getPullConflictStats()` + tests
- [x] #35: `"conflict"` quitado del enum `SyncStatus`. (`"error"` se deja —
      `getErrorRecords` lo tolera; se limpia con la consola de sync en Tier 7.)
- [x] Test de clock skew (`withClockSkew` + `stampServerTimestamps`)
- [ ] #20 guard completo de field-lists — **parcial**: `sync-classification.test.ts`
      (Tier 0) cubre tablas; el diff de columnas queda como issue.
- [x] `npm run verify` limpio
- [ ] Sign-off del dueño + correr migración 016
- [ ] **Follow-on nombrado**: rediseño del modelo de conflicto (#3 completo +
      #4 dirty-tracking por columna + #5 completo) — issue aparte.
