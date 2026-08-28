# Módulo: `components/*-form-dialog` + piezas compartidas de UI

> Estado: 🟡 en curso (Tier 6 — parte 1 de 2) · Última actualización: `2026-08-28` · Responsable: `Juan Pablo Guzmán`

Doc producido por el protocolo de intervención (ver
`~/.claude/plans/en-dias-anteriores-he-cheerful-hopcroft.md`).

Esta parte 1 certifica los **7 diálogos de CRUD de maestras** (Módulo 17 del
plan) y dos piezas compartidas chicas del Módulo 18 (`state-timeline`,
`setup-field`). La **parte 2** — `src/components/visita-modulos/*` (Módulo 16:
grupo-a..e, info, pre-informe) + `visit-action-bar` + `manual-drawer` + la
re-escalada de `react-hooks/set-state-in-effect` para esa ruta — queda pendiente
como su propia pasada por volumen (≈330 KB de componentes sin tests).

---

## 1. Responsabilidad

Los `*-form-dialog` son la **única superficie de alta/edición de las entidades
maestras** desde el dashboard: cliente, contacto, sede, ubicación, equipo,
solicitud, y traslado de equipo. Cada uno es dueño de escritura de su(s)
tabla(s) Dexie y encola el push a Supabase vía `pushSingle`. No calculan
nada de dominio: sólo validan campos mínimos, escriben y sincronizan.

`state-timeline` y `setup-field` son componentes de presentación puros
(sin acceso a datos): el primero dibuja el ciclo de vida de la visita, el
segundo es un input no controlado con guardado on-blur.

## 2. API pública

| Export | Firma | Efectos | Convención de error | ¿Idempotente? |
| --- | --- | --- | --- | --- |
| `ClienteFormDialog` | `{open, onOpenChange, cliente?, onSaved?}` | `db.clientes` add/update + `pushSingle("clientes", id)` | `catch` → `console.error`, no re-lanza; sin toast | sí (update determinístico por `id`) |
| `ContactoFormDialog` | `{open, onOpenChange, clienteId, contacto?, onSaved?}` | `db.contactos` add/update + push | idem | sí |
| `SedeFormDialog` | `{open, onOpenChange, clienteId, sede?, onSaved?}` | `db.sedes` add/update + push | idem | sí |
| `UbicacionFormDialog` | `{open, onOpenChange, sedeId, ubicacion?, onSaved?}` | `db.ubicaciones` add/update + push | idem | sí |
| `EquipoFormDialog` | `{open, onOpenChange, ubicacionId, equipo?, onSaved?}` | **transacción `rw`** sobre `equipos` + `tubos` + `colimadores` + `gantry`; push por cada fila afectada | `catch` → `console.error`, no re-lanza | sí (update por `id`; hijos resueltos determinísticamente) |
| `SolicitudFormDialog` | `{open, onOpenChange, editSolicitud?, ...}` | `db.solicitudes` add/update + push | idem | sí |
| `TrasladarEquipoDialog` | `{open, onOpenChange, equipo, ...}` | delega en `equipo-service.trasladarEquipo` (Tier 4) | ver Módulo 14 | sí |
| `StateTimeline` | `{currentState, className?}` | ninguno (render puro) | n/a | sí |
| `SetupField` | `{label, defaultValue, type?, step?, placeholder?, className?, onSave}` | llama `onSave(value)` on-blur | n/a | el `onSave` puede no serlo — ver §8 |

## 3. Modelo de datos

- **Tablas propias (dueño de escritura):** una por diálogo (`clientes`,
  `contactos`, `sedes`, `ubicaciones`, `solicitudes`) — salvo `EquipoFormDialog`
  que escribe **4** (`equipos`, `tubos`, `colimadores`, `gantry`).
- **Dependencias solo-lectura:** el id del padre llega por prop
  (`clienteId`, `sedeId`, `ubicacionId`). Ningún diálogo lee catálogos.
- **`deleted_at`:** al guardar `EquipoFormDialog`, si el usuario **borra todos
  los campos** de un hijo (tubo/colimador/gantry) que ya existía, ese hijo se
  **soft-borra** (`deleted_at = now`, `sync_status = "pending"`), no se deja la
  fila huérfana ni se hace hard-delete. La recarga del form al reabrir ya
  **filtra** filas con `deleted_at` y, ante duplicados preexistentes, toma
  siempre el de menor `id` (selección determinística). Los demás diálogos no
  borran.
- **`last_modified`:** lo setea el diálogo con `new Date().toISOString()` en
  cada add/update (cliente-generado — ver limitación de watermark en Módulo 4).
- **Supabase:** todas estas tablas son `SYNC_TABLES` (push + pull). El push es
  fire-and-forget: `pushSingle(tabla, id)` tras cerrar el diálogo.

## 4. Flujo de control

1. El padre monta el diálogo y controla `open` **directo** (no vía el
   `onOpenChange` de Radix).
2. Al pasar `open` de `false` a `true`, `useReseedOnOpen` ejecuta el `seed()`
   una sola vez → repuebla el estado del form desde la prop de entidad (y, en
   `EquipoFormDialog`, carga async los hijos).
3. El usuario edita. Los cambios viven en `useState` local; **ningún**
   re-render del padre los pisa (ver §9, #11).
4. `handleSave`: valida el campo mínimo (p. ej. `nombre_cliente`), escribe en
   Dexie (`EquipoFormDialog` dentro de `db.transaction`), llama `onSaved?.(id)`,
   cierra (`onOpenChange(false)`) y dispara `pushSingle` por cada fila.
5. Si el `catch` se activa, se loguea en consola y el diálogo **queda abierto**
   (no hay feedback visible — smell §10).

## 5. Comportamiento offline / online

- **100% offline:** alta y edición de todas las maestras. La escritura Dexie
  no depende de red.
- **Encola para push:** cada add/update marca `sync_status = "pending"`; el
  `pushSingle` intenta el envío inmediato y, si falla, la fila queda pendiente
  para el ciclo de `use-auto-sync`.
- **Exige red:** nada en el camino de guardado.
- **Al reconectar:** el auto-sync empuja las filas `pending`. `EquipoFormDialog`
  puede generar hasta 4 pushes por guardado.

## 6. Interacción con sync

- **Writes que encolan push:** todos.
- **Conflicto:** hereda el modelo global — local gana, silencioso
  (`logger.warn`), con detección de colisión server-más-nueva agregada en
  Tier 2. Estos diálogos no añaden lógica de conflicto propia.
- **Watermark:** `last_modified` cliente-generado (limitación conocida,
  Módulo 4).

## 7. Rol / permisos

- Los diálogos **no** chequean permiso internamente. El gate vive en la
  **página** que los monta (`hasPermission()` de `useRole()`), sólo en cliente.
- Un usuario sin permiso no ve el botón que abre el diálogo; no hay refuerzo
  server-side para las maestras (sólo `/api/usuarios` está server-enforced).

## 8. Invariantes y supuestos

- El padre pasa un `id` de padre **válido y ya persistido** (no se valida FK).
- La prop de entidad en modo edición trae el `id`; el `seed()` la spreadea —
  se asume que `id` no cambia entre reaperturas de la misma entidad lógica.
- `EquipoFormDialog` asume **≤ 1** tubo / colimador / gantry "vivo" por equipo.
  Si hay duplicados preexistentes, opera sobre el de menor `id` y **no** los
  deduplica (los demás quedan como están).
- `SetupField` asume que el `onSave` provisto es idempotente o tiene su propio
  debounce: se dispara en cada `blur`, incluso sin cambios.
- `StateTimeline` tolera un `currentState` fuera de `ESTADO_ORDER`
  (`indexOf` → -1 → ningún paso marcado como actual, no explota).

## 9. Modos de falla conocidos

| Falla | Efecto | Manejo actual |
| --- | --- | --- |
| Excepción en `handleSave` | escritura parcial posible salvo en equipo | `console.error`; el diálogo queda abierto sin feedback |
| Push falla (offline / 5xx) | fila queda `pending` | recuperada por `use-auto-sync` |
| `EquipoFormDialog`: falla a mitad de los 4 writes | **antes:** equipo guardado sin hijos (o al revés) | **corregido (#10):** todo en `db.transaction("rw", …)` → rollback total |
| Reabrir el diálogo con un objeto de entidad nuevo por render | **antes:** el `useEffect [open, entity]` re-sembraba y pisaba lo tipeado | **corregido (#11):** `useReseedOnOpen` sólo siembra en la transición `open` false→true |

## 10. Preguntas abiertas / smells

- Sin feedback de error en UI: un guardado que falla es invisible para el
  técnico. Debería mostrar toast + mantener foco.
- `console.error` en vez de `logger` (los demás módulos ya migraron a
  `@/lib/logger`).
- `EquipoFormDialog` no deduplica hijos preexistentes — sólo los ignora.
- `handleOpenChange` (reset en `next === true`) quedó como código muerto en
  varios diálogos ahora que `useReseedOnOpen` cubre la reapertura; limpiar.
- `visita-modulos/*` sigue con `react-hooks/set-state-in-effect` en "warn"
  (parte 2).

---

## Apéndice B — Log de decisiones (triage de hallazgos)

| # | Descripción | Decisión | Razón | Sign-off |
| --- | --- | --- | --- | --- |
| 10 | `EquipoFormDialog` escribía `equipos` + hijos sin transacción; cargaba hijos con `.first()` (duplicados arbitrarios); limpiar campos no borraba la fila hija | **fix-ahora** | Escritura parcial rompe la integridad del equipo, que alimenta toda la captura de visita | ⬜ pendiente dueño |
| 11 | `useEffect [open, entityObject]` re-sembraba el form en cada re-render del padre que spreadea un objeto nuevo → pisaba ediciones en curso; 3 diálogos lo tapaban con `eslint-disable exhaustive-deps` | **fix-ahora** | Pérdida de trabajo del técnico en la carga diaria; afecta los 7 diálogos | ⬜ pendiente dueño |

### Detalle del fix

- **`src/hooks/use-reseed-on-open.ts`** (nuevo): `useReseedOnOpen(open, seed)`
  ejecuta `seed()` sólo en la transición `open` false→true. Usa un ref de
  "última referencia" actualizado dentro de un `useEffect` (no en render, por
  `react-hooks/refs` del compilador). Aplicado a los 7 diálogos; removidos los
  `eslint-disable exhaustive-deps`.
- **`src/components/equipo-form-dialog.tsx`**: `handleSave` envuelve equipo +
  hijos en `db.transaction("rw", [equipos, tubos, colimadores, gantry], …)`;
  helper `guardarHijo` que crea/actualiza si hay datos, o **soft-borra** el
  hijo existente si el usuario limpió todos sus campos; carga de hijos ahora
  filtra `deleted_at` y desempata duplicados por menor `id`.

## Apéndice C — Estado de salida (Fase 6)

- [x] Doc de la parte 1 (7 diálogos + 2 compartidos)
- [ ] Matriz de escenarios manual ejecutada (P1–P5) — pendiente dueño
- [x] Hallazgos #10 y #11 cerrados con test verde
  (`equipo-form-dialog.test.tsx`, `use-reseed-on-open.test.tsx`)
- [x] Cobertura con umbral por archivo en `vitest.config.ts`
- [x] `npm run verify` limpio (typecheck, lint 0 errores, format, 451 tests, build)
- [x] Sin `eslint-disable` nuevo; removidos los 3 `exhaustive-deps` viejos
- [ ] Sign-off del dueño
- [ ] **Parte 2:** `visita-modulos/*`, `visit-action-bar`, `manual-drawer`,
      re-escalar `react-hooks/set-state-in-effect` para esa ruta
