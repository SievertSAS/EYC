# Módulo: `components/visita-modulos/*` + barra de acciones + manual-drawer

> Estado: 🟡 en curso (Tier 6 — parte 2 de 2) · Última actualización: `2026-08-28` · Responsable: `Juan Pablo Guzmán`

Doc producido por el protocolo de intervención (ver
`~/.claude/plans/en-dias-anteriores-he-cheerful-hopcroft.md`).

Parte 2 de Tier 6. Cubre los **7 módulos de captura de visita** (Módulo 16 del
plan) y las piezas de UI compartidas restantes del Módulo 18
(`visit-action-bar`, `manual-drawer`, hook `useBlobPreviewUrl`). La parte 1
(form-dialogs de maestras) está en `10-ui-form-dialogs.md`.

Alcance de esta pasada: **red de smoke tests + corrección de deuda de
`react-hooks/set-state-in-effect`**. La cobertura profunda tabla-por-tabla de
cada módulo de grupo se hace en Tier 3/4 cuando se recree el flujo completo
desde la app.

---

## 1. Responsabilidad

`visita-modulos/*` son las **superficies de captura de campo** de una visita
CONVENCIONAL. Cada módulo es dueño de escritura de un subconjunto de las
tablas `conv_*` (o de campos de `visitas`/`equipos`/`ubicaciones_rx` en el
caso de `info-modulo`) y encola push a Supabase.

- `info-modulo` — precarga: cliente, sede, ubicación, equipo, tubo, contactos.
- `grupo-a` … `grupo-e` — las 5 baterías de pruebas convencionales (mediciones,
  inspección visual, elementos de protección, evidencias fotográficas).
- `pre-informe-modulo` — resumen de conceptos por prueba + generación del PDF
  de pre-informe (borrador).

`visit-action-bar` es la **única superficie que dispara transiciones de estado
de la visita**: lee `getAvailableActions(estado, cargo)` y ejecuta
`checkGate` + `executeTransition` (Tier 4).

`manual-drawer` es un panel lateral de solo lectura con el manual de cada
prueba; sin acceso a datos.

## 2. API pública

| Export | Firma | Efectos | Convención de error | ¿Idempotente? |
| --- | --- | --- | --- | --- |
| `InfoModulo` / `GrupoAModulo` … `GrupoEModulo` / `PreInformeModulo` | `{ visitaId: string }` | `useLiveQuery` sobre la visita + sus `conv_*`; auto-inicializan filas de setup/inspección si faltan; escrituras vía `updateAndSync` / `db.*.add` + `pushSingle` | `catch` → `console.error`, no re-lanza; sin toast | los guards con `useRef` evitan doble auto-init en el mismo montaje |
| `VisitActionBar` | `{ visitaId, estadoVisita, onTransition?, progressText? }` | `checkGate` + `executeTransition` (Tier 4); `onTransition(newState)` al terminar | `catch` → `console.error` | sí (la state-machine valida estado actual) |
| `ManualDrawer` | `{ open, onClose, pruebas, pruebaCodigo? }` | ninguno (render puro + animación) | n/a | sí |
| `useBlobPreviewUrl` (hook) | `(blob) => string \| null` | `URL.createObjectURL` en render (`useMemo`), `revokeObjectURL` en cleanup | n/a | sí |

## 3. Modelo de datos

- **Tablas propias:** `conv_levantamiento_setup`, `conv_mediciones`,
  `conv_inspeccion_items`, `conv_elementos_proteccion`, `conv_evidencias`,
  `conv_ddi_mediciones`, `conv_cassettes`, `conv_raysafe_mediciones`,
  `conv_cae_mediciones`, `conv_informe_secciones`, … (según el módulo). Además
  `info-modulo` escribe campos de `visitas`, `clientes`, `sedes`,
  `ubicaciones_rx`, `equipos`, `tubos`, `contactos`.
- **`deleted_at`:** los `useLiveQuery` de los módulos de grupo **sí** filtran
  `deleted_at` en `conv_mediciones`, `conv_elementos_proteccion`,
  `conv_evidencias`. `conv_inspeccion_items` se carga **sin filtrar** — es el
  hallazgo #14 (fix-ahora ya aplicado en Tier 1/3 para el camino de
  conformidad; el render del módulo todavía lo lista sin filtro, ver §10).
- **`last_modified`:** cliente-generado en cada write (limitación Módulo 4).
- **Supabase:** todas las `conv_*` son `SYNC_TABLES`.

## 4. Flujo de control

1. La página `dashboard/visitas/[id]` monta el módulo con `visitaId`.
2. `useDb()` indica si Dexie está lista; hasta entonces → "Cargando…".
3. `useLiveQuery` resuelve la visita + sus `conv_*`. Si la visita no existe →
   "Visita no encontrada". `undefined` (aún cargando) → "Cargando…".
4. Al montar, si faltan filas base (`conv_levantamiento_setup`,
   `conv_inspeccion_items`), un `useEffect` con guard de `useRef` las crea una
   sola vez.
5. El usuario edita celdas; cada cambio hace `updateAndSync` (debounce por
   campo en varios módulos) + `pushSingle`.
6. `pre-informe-modulo` deriva el concepto de cada prueba con `evaluacion.ts`
   (Tier 3) y arma el PDF con `generar-pre-informe.ts` (Tier 5).

## 5. Comportamiento offline / online

- **100% offline:** toda la captura. `useLiveQuery` lee de IndexedDB.
- **Encola para push:** cada write marca `sync_status = "pending"`.
- **Exige red:** nada de la captura. El PDF de pre-informe se genera local.
- **Al reconectar:** el auto-sync empuja las filas `pending`.

## 6. Interacción con sync

- Writes vía `updateAndSync` / `deleteAndSync` (soft-delete) encolan push.
- Conflicto: modelo global (local gana, `logger.warn` + detección de colisión
  de Tier 2).
- `visit-action-bar` → `executeTransition` hace varios writes no
  transaccionales (hallazgo #9, backlog Tier 4).

## 7. Rol / permisos

- Los módulos de captura **no** chequean permiso: el gate está en la página
  (`hasPermission`), solo cliente.
- `visit-action-bar` **sí** filtra por `role.cargo` vía
  `getAvailableActions` — un rol sin transiciones no ve ningún botón. El
  refuerzo real de la transición vive en `executeTransition` (valida cargo +
  estado). Sigue siendo lógica cliente; no hay RLS que lo imponga.

## 8. Invariantes y supuestos

- Asume que las filas `conv_*` base se auto-crean al primer montaje del módulo
  (los guards de `useRef` no sobreviven a un remount con datos aún sin
  reflejar — de ahí el guard adicional por `visitaId`).
- Asume exactamente una visita por `visitaId` y que su `equipo` es
  CONVENCIONAL (los módulos de grupo no tienen camino no-CONV — hallazgo #7,
  guard en `registry.ts`).
- `ManualDrawer`: `visible` sobrevive a `open=false` durante 250 ms (animación
  de salida) — no se puede derivar en render.

## 9. Modos de falla conocidos

| Falla | Efecto | Manejo actual |
| --- | --- | --- |
| Excepción en un save de celda | write parcial posible | `console.error`, sin feedback UI |
| `executeTransition` falla a mitad | estados visita/informe/solicitud divergentes | detección de reconciliación (Tier 4, #9) |
| `conv_inspeccion_items` con filas `deleted_at` | aparecen en la lista del módulo | filtro pendiente (§10) |

## 10. Preguntas abiertas / smells

- `conv_inspeccion_items` se lista sin filtrar `deleted_at` en los módulos de
  grupo (el camino de conformidad ya lo filtra; la UI de captura no).
- `console.error` en vez de `logger` en toda la carpeta.
- Sin feedback de error de guardado en la UI.
- Cobertura de los módulos de grupo es **smoke-only** (33–62 % líneas): la
  matriz de escenarios completa (celda por celda, cada `conv_*`) queda para
  Tier 3/4 al recrear el flujo desde la app.

---

## Apéndice B — Log de decisiones (triage de hallazgos)

| # | Descripción | Decisión | Razón | Sign-off |
| --- | --- | --- | --- | --- |
| 23 (parcial) | `react-hooks/set-state-in-effect` en "warn" para `visita-modulos/**` + `manual-drawer` sin red de tests | **fix-ahora** | Deuda rastreada con fecha de salida en Tier 6; ya hay smoke tests que respaldan el cambio | ⬜ pendiente dueño |

### Detalle del fix de `set-state-in-effect`

- **`src/hooks/use-blob-preview-url.ts`** (nuevo): reemplaza el patrón
  `useState + useEffect(setPreview(...))` que se repetía **6 veces** en los
  5 módulos de grupo (previsualización de evidencias fotográficas). El URL se
  deriva en render con `useMemo`; el efecto solo revoca en cleanup. — 0
  violaciones.
- **`info-modulo.tsx`** — `EditableField` / `EditableTextArea`: el
  `useEffect(() => setLocal(value), [value])` pasa a **ajuste de estado en
  render** con un `prevValue` de control (patrón sancionado por React docs).
- **`grupo-d-modulo.tsx`** — la inicialización de los valores base 2.9 desde
  DB pasa a ajuste en render guardado por un flag `baseInit`; se elimina el
  `eslint-disable react-hooks/exhaustive-deps` que la acompañaba.
- **`manual-drawer.tsx`** — la sincronización de índice por `pruebaCodigo`
  pasa a ajuste en render (una vez por combinación `codigo × pruebas
  cargadas`). La orquestación de animación de entrada mantiene **un
  `eslint-disable` inline justificado**: `visible` controla el montaje y debe
  sobrevivir a `open=false` durante la animación de salida, así que no puede
  derivarse.
- **`eslint.config.mjs`** — `react-hooks/set-state-in-effect` vuelve a
  `"error"` para `src/components/visita-modulos/**` y
  `src/components/manual-drawer.tsx`.

## Apéndice C — Estado de salida (Fase 6)

- [x] Doc de la parte 2
- [ ] Matriz de escenarios completa (celda por celda) — **diferida a Tier 3/4**
- [x] Smoke tests: 21 (`modulos-smoke.test.tsx`, 3 estados × 7 módulos) +
  7 (`manual-drawer.test.tsx`) + 8 (`visit-action-bar.test.tsx`)
- [x] `react-hooks/set-state-in-effect` = "error" en la ruta, 0 violaciones
  (1 disable inline justificado en `manual-drawer`)
- [x] Thresholds de cobertura (piso actual) por archivo + glob en `vitest.config.ts`
- [x] `npm run verify` limpio (typecheck, lint 0 errores, format, 487 tests, build)
- [ ] Sign-off del dueño
