# 5. Motor de pruebas y equipos

## 5.1 Paquetes por equipo (`EquipmentPackage`)

Toda la lógica específica de un tipo de equipo se encapsula en un paquete
([`src/lib/equipos/types.ts`](../src/lib/equipos/types.ts)):

```ts
interface EquipmentPackage {
  tipo_equipo: TipoEquipo;
  nombre: string;
  plantilla_informe: string;                 // p. ej. "FT-LEC-6c"
  modulos: ModuloVisita[];                    // pasos de la visita + orden
  grupos: GrupoPruebaDefinition[];            // grupos de pruebas con fórmulas y criterios
  generarInforme: (visitaId) => Promise<Blob | null>;
}
```

El **registro** ([`registry.ts`](../src/lib/equipos/registry.ts)) es el único punto de acceso:

```ts
const PACKAGES: Partial<Record<TipoEquipo, EquipmentPackage>> = {
  CONVENCIONAL: CONVENCIONAL_PACKAGE,
  // CT: CT_PACKAGE,          ← previstos, aún no implementados
  // MAMOGRAFO: MAMOGRAFO_PACKAGE,
};
```

- `getPackage(tipo)` / `hasPackage(tipo)` — obtener/consultar paquete.
- `getModules(tipo)` — módulos del equipo, o `MODULOS_DEFAULT` si el equipo aún no tiene paquete
  (así la app no se rompe mientras se migran tipos).
- `getRequiredModules(tipo)` — IDs de módulos requeridos (los que usa el gate de completitud).

> **Para añadir un equipo nuevo:** crear `src/lib/equipos/<tipo>/` con sus `modulos`, `grupos`,
> tablas dedicadas y `generarInforme`, exportar el paquete y registrarlo en `PACKAGES`. Ninguna
> otra parte de la app necesita cambios.

## 5.2 El paquete CONVENCIONAL

Único implementado hoy ([`convencional/index.ts`](../src/lib/equipos/convencional/index.ts)):
`plantilla_informe: "FT-LEC-6c"`, con **5 grupos** que agrupan **21 pruebas TECDOC**.

| Módulo / grupo | Requerido | Ruta | Pruebas TECDOC |
|----------------|:---------:|------|----------------|
| **A** — Levantamiento radiométrico e inspección visual | Sí | `conv/grupo-a` | 2.1, 2.2 |
| **B** — RaySafe: tiempo, kVp, CHR, rendimiento, dosis | Sí | `conv/grupo-b` | 2.4, 2.5, 2.6, 2.7, 2.21, 2.8 |
| **C** — Control Automático de Exposición (CAE) | No | `conv/grupo-c` | 2.17, 2.18, 2.19, 2.20 |
| **D** — DDI/EI, integridad y uniformidad CR | Sí | `conv/grupo-d` | 2.9, 2.10, 2.14, 2.15 |
| **E** — Colimación, resolución, contraste, MTF | Sí | `conv/grupo-e` | 2.3, 2.11, 2.12, 2.13, 2.16 |
| Pre-informe PDF | No | `pre-informe` | — |

Los grupos se declaran en [`convencional/grupos.ts`](../src/lib/equipos/convencional/grupos.ts);
cada prueba lleva `numero_tecdoc`, `formulas`, `criterios_aceptacion`, `textos_informe` y
`slots_imagen`. Los criterios reales (ejemplos del roadmap):

- **2.17 Sensibilidad CAE:** `|medido − base| / base ≤ 50 %`
- **2.18 Consistencia CAE:** `(MAX − MIN) / promedio ≤ 30 %`
- **2.19 Repetibilidad CAE:** `CV (desv/promedio) ≤ 10 %`
- **2.9 DDI/EI:** desviación vs base `≤ 20 %`
- **2.10 Repetibilidad:** CV de 3 repeticiones `≤ 20 %`

## 5.3 Motor de fórmulas y criterios

El corazón de cálculo es [`src/lib/equipos/engine.ts`](../src/lib/equipos/engine.ts): **puro,
sin Dexie ni React**, por lo que es determinista y fácil de testear
([`engine.test.ts`](../src/lib/equipos/engine.test.ts)). Está **compartido por todos los
paquetes de equipo**.

### Flujo de evaluación

```
mediciones crudas (rows)  ─►  evaluateFormula(s)  ─►  resultados calculados
                                                             │
resultados calculados     ─►  evaluateCriterios     ─►  EvaluacionCriterio[]
EvaluacionCriterio[]      ─►  suggestConcepto        ─►  FAVORABLE / NO_FAVORABLE
```

- **`evaluateFormula(formula, row, allRows, context)`** — evalúa una `expresion` JS contra una
  fila. Contexto disponible en la expresión: `row`, `rows`, `stats`, `Math`, `equipo`,
  `valores_ref`, `helpers`. Devuelve `number | null` (null si el resultado no es finito o falla).
- **`evaluateAllFormulas`** — mapa `campo_resultado → valores por fila`.
- **`evaluateFormulaSummaries`** — un valor resumen por fórmula (máximo absoluto para
  desviaciones/CV, media para el resto).
- **`evaluateCriterio` / `evaluateCriterios`** — aplica el operador (`lt`, `lte`, `gt`, `gte`,
  `eq`, `between`) contra el valor y produce `EvaluacionCriterio` (`{ campo, valor_obtenido, cumple }`).
- **`suggestConcepto`** — `FAVORABLE` solo si **todos** los criterios cumplen.
- **`evaluateGroup`** — orquesta lo anterior para todas las pruebas de un grupo.

### Helpers de dominio

- `stats`: `mean`, `stddev` (muestral, n−1), `cv` (coeficiente de variación %), `max`, `min`,
  `sum`, `count`.
- `formulaHelpers`: cálculos reutilizables de radioprotección, p. ej. `variacionVsCentro` (vs
  el ROI "Centro") y `variacionVsMedia`. La convención (ver [CLAUDE.md](../CLAUDE.md)) es usar
  `helpers.*` en las expresiones en lugar de IIFEs dentro del string.

### Seguridad del evaluador (sandbox)

Las fórmulas se guardan como **texto** y se ejecutan con `new Function(...)`. Para evitar
inyección/escape, `validateExpression` aplica **defensa en profundidad** antes de compilar:

- **Allowlist conceptual + blocklist de tokens** (`BLOCKED_PATTERNS`): bloquea `import`,
  `require`, `eval`, `Function`, `window`, `document`, `process`, `fetch`, `constructor`,
  `prototype`, `__proto__`, `this`, `new`, `class`, `Object`, `Reflect`, `Proxy`, `JSON`, `Date`,
  timers, promesas, etc.
- Bloqueo de **secuencias Unicode** (`\uXXXX`) que podrían evadir la blocklist.
- Bloqueo de **template literals** (backticks).
- Bloqueo de **acceso por corchetes con concatenación** (`obj["con"+"structor"]`) y de acceso a
  `__proto__`/`constructor` por corchetes.
- **Límite de longitud** de 2000 caracteres (anti-ReDoS/abuso).
- En ejecución, los objetos de contexto (`stats`, `helpers`, `equipo`, `valores_ref`) se pasan
  **congelados** (`Object.freeze`) y la función corre en `"use strict"`, para prevenir
  *prototype pollution* desde dentro de la fórmula.

Más detalle en [Seguridad §7.4](07-seguridad.md#74-sandbox-de-fórmulas).

## 5.4 Integración con instrumentos: RaySafe X2

El Grupo B se alimenta del **sensor multiparamétrico RaySafe X2**. El flujo previsto es
importar el archivo exportado por el instrumento (`.csv`/`.xlsx`) y volcar los valores medidos en
`conv_raysafe_mediciones` (parser en `convencional/raysafe-parser.ts`, dependencia `xlsx`). El
botón "Cargar archivo RaySafe" y el parseo están **pendientes** (ver [`../TODO.md`](../TODO.md));
mientras tanto los valores se capturan manualmente.

## 5.5 Generación del pre-informe PDF

`generarInforme` del paquete produce el PDF con **jsPDF + jspdf-autotable** (import dinámico).
El editor visual (`visitas/[id]/pre-informe`) permite reordenar secciones (drag & drop),
activar/desactivar pruebas, y fijar concepto y acciones correctivas inline; esa configuración se
persiste en `conv_informe_secciones`. La conexión final del generador con las tablas `conv_*` y
el embebido de imágenes desde `conv_evidencias` está **en progreso**.
