# Guía de auditoría e implementación — prueba por prueba

Referencia: `Copia de Control de calidad Convencional SURA LOS ALMENDROS (1).xlsx`

## Archivos clave

| Propósito | Archivo |
|---|---|
| Definición de prueba (objetivo, metodología, criterio) | `src/lib/equipos/convencional/informe-secciones.ts` |
| Renderizadores de resultados/análisis en PDF | `src/lib/pdf/secciones-convencional.ts` |
| Estructura del PDF (subsecciones, concepto, acciones) | `src/lib/pdf/generar-pre-informe.ts` |
| Tipos de BD (campos de mediciones) | `src/lib/equipos/convencional/db/types.ts` |
| UI de entrada de datos grupo B | `src/app/dashboard/visitas/[id]/conv/grupo-b/page.tsx` |

## Hojas de la plantilla

| Hoja | Contenido |
|---|---|
| `CE_NIT` | Informe completo renderizado — fuente de verdad de texto y estructura |
| `2.4, 5, 6, 7, 21, 8` | Datos y fórmulas grupo B |
| `2.9 , 10` / `2,14 , 15` / etc. | Datos de otros grupos |
| `Listado de patrones de prueba` | Numeración oficial y nombre de cada prueba |

---

## Fase 1 — Auditoría (leer y comparar)

### 1. Localizar la sección en CE_NIT

```python
import openpyxl, sys
sys.stdout.reconfigure(encoding='utf-8')
wb = openpyxl.load_workbook('plantilla.xlsx', data_only=True)
ws = wb['CE_NIT']
for i, row in enumerate(ws.iter_rows(values_only=True), 1):
    if any('2.9' in str(v) for v in row if v):  # cambiar código
        print(i, row[:6])
```

Anotar: fila de inicio, fila de fin, hoja de datos que la alimenta.

### 2. Extraer texto de referencia

Leer de `CE_NIT` y comparar contra `informe-secciones.ts`:

| Subsección | Campo en `informe-secciones.ts` |
|---|---|
| `.1 Objetivo` | `objetivo` |
| `.2 Instrumentación` | `instrumentacion` |
| `.3 Metodología` | `metodologia` |
| `.6 Criterio de aceptación` | `criterio` |

Leer de `CE_NIT` y comparar contra `secciones-convencional.ts` función `renderXX`:

| Subsección | Dónde está en el código |
|---|---|
| `.4 Resultados` | cabeceras de `autoTable` + cálculos |
| `.5 Análisis` | `ctx.addParagraph(...)` después de la tabla |

### 3. Extraer fórmulas de cálculo

```python
wb2 = openpyxl.load_workbook('plantilla.xlsx')  # sin data_only para ver fórmulas
ws2 = wb2['hoja-datos']
for i in range(fila_inicio, fila_fin):
    row = ws2[i]
    print([(c.column_letter, c.value) for c in row if c.value])
```

Comparar cada columna de la hoja de datos contra el código en `renderXX`.

### 4. Verificar estructura de subsecciones

`renderXX` retorna `nextSub` (el número de la siguiente subsección disponible). El flujo en `generar-pre-informe.ts` es siempre:

```
.1 Objetivo         ← informe-secciones.ts
.2 Instrumentación  ← informe-secciones.ts
.3 Metodología      ← informe-secciones.ts
.4 Resultados  ┐
.5 Análisis    ┘  ← renderXX (retorna nextSub al salir)
.N   Criterio       ← generar-pre-informe.ts (nextSub++)
.N+1 Evidencia      ← generar-pre-informe.ts (solo si hay bloque `codigo === "X.X"`)
.N+2 Concepto       ← generar-pre-informe.ts
.N+3 Acciones       ← generar-pre-informe.ts
```

Checklist:
- [ ] ¿`renderXX` retorna el `nextSub` correcto? (4 + cantidad de subsecciones que agrega)
- [ ] ¿La plantilla tiene evidencia gráfica? → ¿existe `if (codigo === "X.X" && aplica)` en `generar-pre-informe.ts`?
- [ ] ¿Los números `.N` del PDF coinciden con la plantilla?

### 5. Revisar concepto y acciones correctivas de la plantilla

En `CE_NIT`, leer las subsecciones `.8 Concepto` y `.9 Acciones correctivas` y determinar qué tipo son:

| Tipo de concepto | Cómo se ve en la plantilla | Qué hacer en el código |
|---|---|---|
| **Automático con lógica** | "Conforme / No conforme" según criterio numérico | Implementar bloque `else if (codigo === "X.X")` con la lógica |
| **Fijo "No aplica"** | "No aplica: La prueba no define tolerancias..." | Bloque fijo con `conceptoLabel = "NO APLICA"` y párrafo |
| **Manual** | Campo editable por el físico | Sin bloque especial → cae en el `else` genérico |

### 6. Verificar campos de la UI contra el tipo y el renderizador

En `page.tsx` del grupo correspondiente y en `db/types.ts`:
- ¿Los campos mostrados en la tabla existen en `ConvRaysafeMedicion`?
- ¿Los inputs guardan en el campo que lee `renderXX`?  
  (Trampa común: `"campo_real" as "otro_campo"` solo engaña al tipo; en runtime el key sigue siendo `"campo_real"`. Si `renderXX` lee del setup y el input guarda en la medición, no hay conexión.)

---

## Fase 2 — Implementación de ajustes

### A. Corregir texto (objetivo / metodología / criterio / análisis)

Editar directamente en `informe-secciones.ts` (para `.1`–`.3` y `.6`) o en `renderXX` (para `.5`).

### B. Corregir fórmulas de cálculo

En `secciones-convencional.ts`, función `renderXX`. Verificar numéricamente con los datos de la plantilla:

```js
node -e "
const d1=100, d2=102, kerma=0.01266, ancho=26, largo=26, dapNom=6;
const f = (d2/d1)**2;
const dapEst = kerma * f * ancho * largo * f;
console.log('DAP est:', dapEst.toFixed(2), '| FC:', (dapEst/dapNom).toFixed(2));
"
```

Si un campo calculado vive en la medición (no en el setup), agregar el campo al tipo en `db/types.ts` y leerlo por fila en `renderXX` con fallback al setup.

### C. Agregar evidencia gráfica faltante

**1. Campo en `DatosConvencional`** (`secciones-convencional.ts`):
```ts
fotosXX?: { label: string; dataUrl: string; width: number; height: number }[];
```

**2. Poblar el campo** (en la función `recopilarDatosConv`):
```ts
const fotosXX: NonNullable<DatosConvencional["fotosXX"]> = [];
if (img24) fotosXX.push({ label: "Fig X.X.1 Implementación de instrumentación en la prueba", ...img24 });
// ...
return { ..., fotosXX, ... };
```

**3. Función `renderFotosXX`** (copiar el patrón de `renderFotos27`):
```ts
export function renderFotosXX(ctx: InformeCtx, conv: DatosConvencional) {
  const fotos = conv.fotosXX ?? [];
  if (fotos.length === 0) {
    ctx.addParagraph("No se adjuntó evidencia gráfica del montaje experimental.");
    return;
  }
  // ... mismo bloque de render de imagen y caption
}
```

**4. Bloque en `generar-pre-informe.ts`** (después del bloque de 2.7):
```ts
if (codigo === "X.X" && aplica) {
  checkPage(20);
  addSubsectionTitle(`${codigo}.${nextSub}.`, "Evidencia gráfica");
  renderFotosXX(ctx, conv);
  nextSub++;
}
```

**5. Importar** `renderFotosXX` en `generar-pre-informe.ts`.

### D. Implementar concepto automático

En `generar-pre-informe.ts`, agregar **antes** del bloque `else if (!aplica)`:

```ts
} else if (codigo === "X.X" && aplica) {
  // --- Caso "No aplica" fijo (prueba descriptiva sin criterio) ---
  conceptoLabel = "NO APLICA";
  conceptoParrafo = "La prueba no define tolerancias, debido a que es de carácter descriptivo y de referencia técnica.";
  accionesTexto = "No Aplica";
  esNoConforme = false;

  // --- Caso con lógica derivada de datos ---
  // const hayDatos = mediciones.length > 0;
  // const conforme = /* evaluar criterio */;
  // esNoConforme = hayDatos && !conforme;
  // conceptoLabel = !hayDatos ? "PENDIENTE" : conforme ? "FAVORABLE" : "NO FAVORABLE";
  // conceptoParrafo = conforme ? "La prueba se considera conforme..." : "La prueba se considera no conforme...";
  // accionesTexto = conforme ? "No se requieren acciones correctivas..." : "Se recomienda...";
}
```

El texto de `conceptoParrafo` se imprime en párrafo debajo del label. El label usa color verde (FAVORABLE/CONFORME), rojo (NO FAVORABLE/NO CONFORME) o gris (PENDIENTE/NO APLICA) según el valor.

---

## Historial de pruebas auditadas

| Prueba | Estado | Ajustes realizados |
|---|---|---|
| 2.8 | ✅ Completa | Fórmula DAP corregida (d1/d2 por fila); agregadas 2.8.7 evidencia gráfica, 2.8.8 concepto "No aplica" automático, 2.8.9 acciones "No Aplica" |
| 2.9 | ✅ Completa | Textos corregidos; render29 con Tabla 2.9.1 y 2.9.2 (desviación vs base); 2.9.7 evidencia gráfica; 2.9.8 concepto FAVORABLE/NO FAVORABLE; valores base ei_base/di_base persistidos en DB |
| 2.10 | ✅ Completa | Textos corregidos; render210 con Tabla 2.10.1 (CV); 2.10.7 evidencia gráfica; 2.10.8 concepto FAVORABLE/NO FAVORABLE basado en CV del EI |
| 2.11 | ✅ Completa | Textos corregidos; render211 con Tabla 2.11.1 (AC 0°) y Tabla 2.11.2 (CA 180°) por detector; campos desviación y tolerancia agregados al tipo; 2.11.7 evidencia gráfica (dicom_0 y dicom_180); 2.11.8 concepto FAVORABLE/NO FAVORABLE basado en uniformidad, píxeles defectuosos y artefactos |
| 2.12 | ✅ Completa | Textos corregidos; render212 con condiciones + tabla pares de líneas + análisis dinámico; 2.12.7 evidencia gráfica (montaje_resolucion); 2.12.8 concepto FAVORABLE/NO FAVORABLE si pares_lineas_plmm >= 2,4 |

## Pruebas pendientes

- [ ] 2.1 — Evaluación de condiciones ambientales / levantamiento radiométrico
- [ ] 2.2 — Inspección visual
- [ ] 2.3 — Sistema de colimación y perpendicularidad
- [ ] 2.4 — Exactitud y repetibilidad del tiempo de exposición
- [ ] 2.5 — Exactitud y repetibilidad de la tensión
- [ ] 2.6 — Capa hemirreductora (CHR)
- [ ] 2.7 — Rendimiento, repetibilidad y linealidad
- [ ] 2.13 — Umbral de sensibilidad a bajo contraste
- [ ] 2.14 — Integridad y limpieza de cassettes e IP CR
- [ ] 2.15 — Uniformidad de sensibilidad de pantallas IP CR
- [ ] 2.16 — MTF
- [ ] 2.17 — Sensibilidad del CAE
- [ ] 2.18 — Consistencia entre sensores del CAE
- [ ] 2.19 — Repetibilidad del CAE
- [ ] 2.20 — Compensación del CAE
- [ ] 2.21 — Dosis al receptor
