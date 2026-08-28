# Módulo: workflow de visitas (`src/lib/workflow/`)

> Estado: 🟡 en curso (Tier 4 · Módulos 10–14) · 2026-08-28
> `module-completeness.ts`, `visita-service.ts`, `visit-state-machine.ts`,
> `informe-service.ts`, `publicar-informe.ts`, `equipo-service.ts`,
> `change-tracker.ts`, `validation.ts`. Antes: solo `visit-state-machine.test.ts`
> (transiciones/roles, puro).

---

## 1. Responsabilidad

El ciclo de vida de una visita: `asignada → en_progreso → en_revision →
aprobada → enviada` (+ back-edges `devolver` y `solicitar_ajustes_cliente`).

| Archivo               | Qué                                                                |
| --------------------- | ------------------------------------------------------------------ |
| `visita-service`      | `crearVisitaDesdeSolicitud` — nace la visita + auto-genera pruebas |
| `module-completeness` | ¿la visita está lista para avanzar? (gate input)                   |
| `visit-state-machine` | transiciones + gates + `executeTransition` (efecto en DB)          |
| `informe-service`     | `crearInformeDesdeVisita` — numeración, concepto, versionado       |
| `publicar-informe`    | PDF oficial + QR + hash + Storage                                  |
| `equipo-service`      | `trasladarEquipo`                                                  |
| `change-tracker`      | auditoría genérica de cambios (`change_logs`)                      |
| `validation`          | wrapper descriptivo de `getVisitCompleteness` (sin callers hoy)    |

## 2. Hallazgos y disposición

| #                                                    | Qué                                                                                                                                                                                              | En este PR                                                                                                                                                                  |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **#6**                                               | `crearVisitaDesdeSolicitud`: regeneraba el id de la visita; `console.error`; una visita con paquete pero **0 pruebas** (catálogo `grupo_pruebas` sin sembrar) devolvía `success: true` sin señal | **fix-ahora**: usa el id existente; `logger.error`; `logger.warn` si `pruebasCreadas === 0`                                                                                 |
| **#7**                                               | Visita de tipo sin paquete → nunca pasa el gate (ids de `getModuleStatuses` ≠ `getDefaultModules`)                                                                                               | **guard cableado**: `assertCanCreateVisitFor` en `crearVisitaDesdeSolicitud` → `NoPackageError`. Fix real (unificar ids) → issue, cuando arranque el 2º equipo              |
| **#8**                                               | `aprobar` NO tenía gate — se podía aprobar (y publicar el PDF oficial) una visita incompleta                                                                                                     | **fix-ahora**: `aprobar` ahora tiene `hasGate: true`; `checkGate` aplica la misma completitud que `enviar_revision`                                                         |
| **#9**                                               | `executeTransition` hacía visita + solicitud + informe como pasos sueltos no transaccionales; publish fire-and-forget con `console.error`                                                        | **interino**: las 3 escrituras de estado en `db.transaction`; publish falla → `logger.error`; `checkVisitConsistency()` detecta divergencias. **Rediseño completo → issue** |
| **#15**                                              | `getVisitCompletenessBulk` = loop secuencial de `getVisitCompleteness` (O(visitas × ~15 scans conv*\*)), re-corre en cada mutación conv*\*                                                       | **backlog** → issue (batch/memoize)                                                                                                                                         |
| **#22**                                              | `db.informes.where("visita_id").first()` → fila arbitraria si hubiera duplicados                                                                                                                 | **fix defensivo**: se ordena por `version_actual` desc antes de tomar `[0]` (hay 1 informe por visita por diseño)                                                           |
| `pctResueltas` / `preInformePct` `total === 0 → 100` | fail-open: un grupo sin pruebas contaba como completo                                                                                                                                            | **fix-ahora**: → `0` (fail-safe). Hoy es defensivo (para CONVENCIONAL cada grupo tiene 2-6 secciones fijas)                                                                 |
| `change-tracker.getChangeHistory`                    | usa `.where("[tabla+registro_id]")` sin índice compuesto declarado                                                                                                                               | **verificado OK**: Dexie 4 lo resuelve con los índices simples `tabla`/`registro_id`. Sin acción                                                                            |

## 3. Cobertura nueva

- `module-completeness.test.ts` (6): visita fresca → bloquea; todo excluido → pasa; PIN #7; PIN #15.
- `workflow-tier4.test.ts` (11): #8 gate de `aprobar`; #9 transacción + `checkVisitConsistency`; #6/#7 en `crearVisitaDesdeSolicitud`.
- `informe-equipo-service.test.ts` (10): numeración `EYC-año-seq`, concepto rollup, vencimiento 2 años, re-aprobación = nueva versión mismo informe; `trasladarEquipo` (transacción, guards).
- `change-tracker.test.ts` (6): `trackChange`, `updateWithTracking` (diff-only), `getChangeHistory`.

## Modos de falla

| Falla                                                  | Efecto                                  | Manejo                                                                                                 |
| ------------------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Aprobar visita incompleta                              | antes: PDF oficial de datos incompletos | ahora: bloqueado por el gate                                                                           |
| `crearInformeDesdeVisita` falla tras cambiar el estado | visita "aprobada" sin informe           | `checkVisitConsistency` lo detecta; rediseño → issue                                                   |
| `publicarVersionOficial` falla                         | visita aprobada, sin PDF oficial        | `logger.error` + botón "Publicar versión oficial" en `informes/[id]`; `checkVisitConsistency` lo lista |
| Catálogo `grupo_pruebas` sin sembrar                   | visita CONVENCIONAL con 0 pruebas       | `logger.warn` (antes: silencio)                                                                        |

---

## Apéndice C — Estado de salida (Fase 6)

- [x] Doc
- [x] #6: id + `logger` + warn de 0 pruebas
- [x] #7: guard `assertCanCreateVisitFor` cableado en `visita-service`
- [x] #8: `aprobar` con gate de completitud
- [x] #9 interino: transacción de estado + `checkVisitConsistency`
- [x] `pctResueltas` fail-safe
- [x] Tests (33 nuevos)
- [ ] Issue: rediseño completo de #9 (informe/publish transaccional o saga)
- [ ] Issue: #15 perf de `getVisitCompletenessBulk`
- [ ] Issue: #7 unificar ids `getModuleStatuses` ↔ `getDefaultModules` (al 2º equipo)
- [x] `npm run verify` limpio
- [ ] Sign-off del dueño
