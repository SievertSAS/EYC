# Módulo: evaluación de conformidad + parser RaySafe

> Estado: 🟡 en curso (Tier 3 · Módulos 7 y 8) · 2026-08-28
> `src/lib/equipos/convencional/evaluacion.ts` (599 líneas),
> `raysafe-parser.ts`. Antes: **cero tests**.

---

## Módulo 7 — `evaluacion.ts`

### 1. Responsabilidad

**Única fuente de verdad** del concepto `Conforme` / `No_conforme` de las 21
pruebas 2.1–2.21. Lo consumen el editor del pre-informe y el generador de PDF
(para que nunca diverjan). 20 evaluadores puros (`evaluar21`…`evaluar221`);
`2.8` no tiene criterio.

Contrato de cada evaluador:

- `"Conforme"` / `"No_conforme"`: veredicto según el criterio.
- `undefined`: **pendiente** — datos insuficientes para evaluar.

`getEstadoPruebasPorGrupo(visitaId)` cuenta `undefined` como "pendiente" →
alimenta el contador del editor y el gate de completitud (Tier 4).

### 2. Hallazgo #13 — datos faltantes que se leen como "Conforme"

Patrón: `variación != null ? variación <= umbral : true`. El `: true` = "si no
se pudo calcular → Conforme".

| Caso                                                                                                                            | Antes                       | Ahora                                                    |
| ------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------- |
| **Setup/base presente, mediciones incompletas/nulas** (2.16, 2.17, 2.18, 2.19, 2.20, 2.21)                                      | `"Conforme"`                | **`undefined`** (fix de este PR — decidido con el dueño) |
| **Sin línea base previa** (primera medición): 2.16 explícito `return "Conforme"`; 2.17/2.20/2.21 devuelven `undefined` sin base | varía                       | **sin cambios — issue de revisión prueba por prueba**    |
| **CV con n=1** (2.4, 2.5, 2.7): `cvPct([x]) = 0`, `0 <= umbral` → pasa repetibilidad                                            | pasa                        | **sin cambios — issue de revisión prueba por prueba**    |
| **Dato faltante → "No_conforme"** (2.3 usa `med ?? 0`; 2.11 `tieneVmp` falso → No_conforme)                                     | inconsistente con los demás | **issue** (mismo review)                                 |

Los PIN en `evaluacion.test.ts` fijan el comportamiento que queda pendiente
de revisión.

### 3. Cobertura nueva (`evaluacion.test.ts`, 32 tests)

- Barrido: los 20 evaluadores devuelven `undefined` con `DatosEvalConv` vacío.
- Por evaluador testeado: un caso `Conforme` y uno `No_conforme` con datos
  reales mínimos.
- #13: 2.16–2.21 con base pero sin mediciones → `undefined` (verifica el fix).
- PIN: 2.4 con n=1 → `"Conforme"`; 2.16 sin base → `"Conforme"`.

### Modos de falla

| Falla                                       | Efecto                                 | Manejo                         |
| ------------------------------------------- | -------------------------------------- | ------------------------------ |
| Medición faltante en 2.17–2.21              | antes: "Conforme" falso en el informe  | ahora: `undefined` → pendiente |
| n=1 en grupo de repetibilidad (2.4/2.5/2.7) | CV=0 pasa el criterio                  | issue de review                |
| Sin línea base                              | 2.16 → "Conforme"; otros → `undefined` | issue de review                |

---

## Módulo 8 — `raysafe-parser.ts`

### 1. Responsabilidad

Convierte los exports de RaySafe X2 (TSV nativo o XLSX plantilla Sievert
multi-hoja) en `RaysafeRow[]` normalizado. Vía de **entrada de datos
numéricos** al informe.

### 2. Funcionamiento

- **TSV**: split por tab; col 0 debe ser entero positivo (si no, la línea se
  descarta en silencio); lee cols 4/6/8/10/12. `toNum` normaliza coma→punto,
  vacío→`null`, no-numérico→`null`.
- **XLSX**: si hay hoja `Paso2_Principales` → plantilla Sievert (4 hojas,
  offset de columna 6 detectado por heurística "grupo" en A1/A2); si no →
  archivo simple (hoja 0, offset 0).

### 3. Riesgos (findings)

| #    | Qué                                                                                                                                                         | Disposición                                                            |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| RS-1 | Layout de columnas inesperado → filas con todo `null`, **sin error**. Un archivo con columnas corridas produce un informe con datos vacíos silenciosamente. | **issue** — necesita archivos de muestra reales para saber qué validar |
| RS-2 | La heurística de offset XLSX depende de la palabra "grupo" en A1/A2. Si el header de la plantilla cambia, lee columnas corridas.                            | mismo issue                                                            |
| RS-3 | `wsToRows` usa `require("xlsx")` síncrono (eslint-disabled) además del `import()` dinámico de `parseRaysafeXlsx`. Inconsistente.                            | menor — unificar en el issue                                           |

### 4. Cobertura nueva (`raysafe-parser.test.ts`, 8 tests)

- TSV: fila completa, coma decimal, celda vacía/no-numérica → `null`, descarte
  de headers/blancos, PIN del layout inesperado, vacío → `[]`.
- XLSX: plantilla (hoja `Paso2_Principales`, offset 6) y simple (hoja 0).

---

## Apéndice C — Estado de salida (Fase 6)

- [x] Doc
- [x] #13 fix acotado: 2.16–2.21 con datos incompletos → `undefined`
- [x] `evaluacion.test.ts` (32) + `raysafe-parser.test.ts` (8)
- [ ] Issue: revisión a fondo prueba por prueba de `evaluacion.ts`
      (línea base, CV n=1, faltante→No_conforme) — al recrear el flujo
- [ ] Issue: validación del parser RaySafe (necesita archivos de muestra)
- [x] `npm run verify` limpio
- [ ] Sign-off del dueño
