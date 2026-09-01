# Módulo: motor de fórmulas (`src/lib/equipos/engine.ts`) — ⛔ RETIRADO

> **Estado: BORRADO (#45, opción B) · 2026-09-01.**
> `engine.ts` y `engine.test.ts` se eliminaron. Nunca se usó: las 21 pruebas de
> `grupos.ts` tenían `formulas: []` / `criterios_aceptacion: []` y ningún caller
> fuera de tests. La superficie de seguridad (`new Function` + denylist) no se
> justificaba para un motor dormido. El veredicto Conforme / No conforme lo
> produce **`src/lib/equipos/convencional/evaluacion.ts`** (evaluadores a mano —
> Módulo 7), la única fuente de verdad. #41 (redesign de `engine.ts`) se cierra:
> solo aplicaba si se mantenía el motor.
>
> El resto de este documento se conserva como historia de por qué existió.

---

## 1. Responsabilidad

Evaluador puro de **fórmulas** (`evaluateFormula`) y **criterios de aceptación**
(`evaluateCriterio`) contra datos de medición crudos. Compartido por todos los
`EquipmentPackage`. `stats.*` (media/desvío/CV/…) y `formulaHelpers.*` son el
"stdlib" que se inyecta en el sandbox.

### ⚠️ El módulo está DORMIDO

- **Todos los `formulas: []` y `criterios_aceptacion: []` en `grupos.ts` están
  vacíos.** No hay ni una fórmula real en el proyecto.
- Fuera de tests, **nada llama** `evaluateFormula` / `evaluateGroup`. La lógica
  de conformidad real vive en `evaluacion.ts` (evaluadores a mano — Módulo 7).
- `engine.ts` es un sandbox endurecido esperando fórmulas que todavía no
  existen. Esta pasada es "dejarlo correcto antes de que se use", no arreglar
  un bug de producción activo.
- **Decisión pendiente: `engine.ts` (genérico) vs `evaluacion.ts` (a mano) —
  issue #45.** Hay dos sistemas para lo mismo; hay que elegir uno (activar /
  borrar / híbrido). El redesign #41 solo aplica si se decide mantenerlo.

## 2. API pública

| Export                                             | Firma                                       | Notas                                                          |
| -------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------- |
| `stats`                                            | objeto con mean/stddev/cv/max/min/sum/count | `n<2` → `stddev=0`, `cv=0`; array vacío → `0`                  |
| `formulaHelpers`                                   | `variacionVsCentro`, `variacionVsMedia`     | devuelven `0` si faltan datos (no `null`)                      |
| `evaluateFormula(formula, row, rows, ctx?)`        | → `number \| null`                          | `null` en cualquier fallo (ver #12)                            |
| `evaluateAllFormulas` / `evaluateFormulaSummaries` | mapas por campo                             | summaries: `desviacion`/`cv` → max‑abs; resto → media          |
| `evaluateCriterio(criterio, valor)`                | → `boolean`                                 | `lt/lte/gt/gte/eq/between`; operador desconocido → `false`     |
| `evaluateCriterios`                                | → `EvaluacionCriterio[]`                    | `valor === null` → `cumple: false`                             |
| `suggestConcepto`                                  | `"FAVORABLE" \| "NO_FAVORABLE"`             | FAVORABLE sii todos `cumple`                                   |
| `evaluateGroup`                                    | `ResultadoPruebaCalculado[]`                | sin criterios → concepto `"FAVORABLE"` (por defecto optimista) |

## 3. Sandbox (`new Function`)

- `new Function("row","rows","stats","Math","equipo","valores_ref","helpers",
'"use strict"; return (<expr>);')` — 7 params, `"use strict"` (→ `this`
  `undefined`). Sin `globalThis` en scope.
- **Es una denylist, no una allowlist** (pese al comentario). `BLOCKED_PATTERNS`
  (~50 regex `\bword\b`) + `SUSPICIOUS_BRACKET_ACCESS` + `BRACKET_PROTO` +
  `UNICODE_ESCAPE` + `TEMPLATE_LITERAL` + límite de 2000 chars.
- Vía de escape clásica: llegar a `.constructor` → `Function`. Bloqueado por
  `\bconstructor\b` / `\bFunction\b` / `SUSPICIOUS_BRACKET_ACCESS` (bypass por
  string partido `["con"+"structor"]`).

## Hallazgo #12

| Parte | Qué                                                                                                                                                                                                            | Disposición                                                                                                                                                        |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 12a   | `SUSPICIOUS_BRACKET_ACCESS = /\[[^\]]*["'][^\]]*\]/` bloquea CUALQUIER comilla en corchetes → rechaza acceso legítimo `row['kvp_medido']`. El throw se traga → `null` silencioso indistinguible de "sin dato". | **fix-ahora**: permitir `['<identificador>']` simple (los nombres peligrosos igual los atrapa el keyword-blocklist), bloquear solo concatenación / comillas raras. |
| 12b   | `catch { return null }` + no-finito → `null`. Un fallo de validación, un error de runtime y "no hay dato" son indistinguibles.                                                                                 | **fix-ahora**: loguear el fallo (`logger.error` si es validación — bug en la definición; `logger.warn` si es runtime). Se mantiene el retorno `null`.              |
| 12c   | `Object.freeze` shallow; `row`/`allRows` pasan SIN congelar → una fórmula puede mutar filas y la fórmula N ve las mutaciones de N‑1.                                                                           | **backlog** (#nuevo): deep-freeze de entradas + redesign a allowlist + tipo de retorno `{ value, error }`. Test que fija la fuga de mutación.                      |
| 12d   | El comentario dice "Allowlist" pero es denylist.                                                                                                                                                               | **fix-ahora**: corregir el comentario.                                                                                                                             |

## 5-9

- **Offline/online / sync / permisos**: N/A — puro, sin efectos.
- **Invariantes**: las fórmulas asumen que `row`/`rows` traen números en los
  campos que referencian; un campo `undefined` → `NaN` → `null`.
- **Modo de falla**: fórmula mal escrita = `null` silencioso (12b, ahora
  logueado).

## Apéndice C — Estado de salida (Fase 6)

- [x] Doc completo
- [x] 12a: `SAFE_BRACKET_KEY` permite `['identificador']`; el bypass por
      concatenación / paréntesis sigue bloqueado
- [x] 12b: fallos logueados (`engine:formula` — `error` si validación, `warn`
      si runtime; no-finito no loguea)
- [x] 12d: comentario corregido a "DENYLIST"
- [x] Tests (49): `row['key']` legítimo funciona; bypass bloqueado; logging;
      PIN de la fuga de mutación (12c)
- [x] Issue backlog #41 (redesign 12c: allowlist + deep-freeze + `{value,error}`)
- [x] `npm run verify` limpio
- [ ] Sign-off del dueño
