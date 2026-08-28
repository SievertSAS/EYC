# Módulo: generación del PDF (`src/lib/pdf/`)

> Estado: 🟡 en curso (Tier 5) · 2026-08-28
> `generar-pre-informe.ts` (1814 líneas) + `secciones-convencional.ts` (3229).
> Antes: **cero tests**. ~5000 líneas — el artefacto de mayor valor.

---

## 1. Responsabilidad

`generarPreInforme(visitaId, opts?) → Blob | null`: arma el PDF completo del
informe desde Dexie — portada, datos de cliente/equipo/ubicación, una sección
por prueba TECDOC, fotos, diagrama radiométrico. `opts.qrDataUrl` para la
versión oficial (con QR de verificación).

Consumido por: `informes/[id]` (descarga), `pre-informe-modulo` (preview),
`publicar-informe` (versión oficial).

## 2. Estructura

| Función                                                   | Qué                                                                                                                                                           |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `recopilarDatos(visitaId)` (privada)                      | junta cliente/equipo/ubicación/sede/tubo/sala/técnico/contactos + `prueba_resultados` + `mediciones_radiometricas` + `elementos_proteccion` + `partes_equipo` |
| `recopilarDatosConv(visitaId)` (exportada)                | junta las 19 tablas `conv_*` — el contrato de datos del PDF convencional                                                                                      |
| `generarPreInforme`                                       | orquesta: importa jsPDF+autotable dinámicamente, `recopilarDatos`, `recopilarDatosConv` si `hasPackage`, y dibuja                                             |
| `render*(ctx, conv)` (~30 en `secciones-convencional.ts`) | dibujan cada sección/foto/tabla                                                                                                                               |

- **Marca de agua**: se omite si la visita está `aprobada` o `enviada` (versión final).
- **Logo**: `fetch("/logo-informe.png")` cacheado en módulo — **sin manejo de
  error si el fetch falla** (finding menor).

## 3. Hallazgos

| #                                                              | Qué                                                                                                                                                                                                                                                                                                                                                 | Disposición                                                        |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **deleted_at inconsistente en `recopilarDatosConv`**           | `conv_mediciones`, `conv_elementos_proteccion`, `conv_evidencias`, `conv_uniformidad_detector`, `conv_cassette_inspeccion`, `conv_uniformidad_cr` **filtran** `deleted_at`. `conv_raysafe_mediciones`, `conv_ddi_mediciones`, `conv_cae_mediciones` y las tablas de setup **NO** → una medición RaySafe/CAE/DDI borrada sigue apareciendo en el PDF | **issue** (extiende #34) — pin en `secciones-convencional.test.ts` |
| `recopilarDatos` lee `db.elementos_proteccion`                 | la tabla legacy sin sync (issue #34 / #36) — el camino convencional usa `conv_elementos_proteccion`                                                                                                                                                                                                                                                 | ya trackeado (#34)                                                 |
| `getLogoBase64` sin try/catch                                  | si `/logo-informe.png` falla, `generarPreInforme` lanza entero                                                                                                                                                                                                                                                                                      | **issue menor**                                                    |
| `secciones-convencional.ts` ~30 `renderFotosXX` casi idénticas | mucho copy-paste                                                                                                                                                                                                                                                                                                                                    | fuera de alcance (no es bug)                                       |

## 4. Cobertura nueva

- `generar-pre-informe.test.ts` (5): visita inexistente → `null`; genera `Blob`
  `application/pdf` para CONVENCIONAL; **el nombre del cliente y la serie del
  equipo llegan al PDF** (se extrae texto del buffer crudo — jsPDF no comprime
  por defecto); ruta no-CONVENCIONAL (legacy); acepta `qrDataUrl`.
- `secciones-convencional.test.ts` (6): `recopilarDatosConv` — visita vacía →
  catálogo por defecto; respeta `conv_informe_secciones.incluida`; dedupe de
  `conv_inspeccion_items`; **PIN del `deleted_at` inconsistente**.

**Estrategia:** contrato, no píxeles. Se corre jsPDF de verdad (funciona en
happy-dom con `fetch` mockeado) y se verifica que los datos correctos entran
al documento, extrayendo el texto del PDF crudo.

## Modos de falla

| Falla                                       | Efecto                                        | Manejo                |
| ------------------------------------------- | --------------------------------------------- | --------------------- |
| Medición conv\_\* borrada (raysafe/cae/ddi) | aparece en el PDF                             | ninguno — issue       |
| `/logo-informe.png` 404                     | `generarPreInforme` lanza                     | ninguno — issue menor |
| Visita sin equipo / sin datos               | genera un PDF con secciones vacías (no lanza) | ok                    |

---

## Apéndice C — Estado de salida (Fase 6)

- [x] Doc
- [x] Tests de contrato: `generarPreInforme` end-to-end + `recopilarDatosConv`
- [x] PIN del `deleted_at` inconsistente
- [x] Umbrales de cobertura (`generar-pre-informe.ts` 65%, `secciones` 43%)
- [x] Issue #51: `deleted_at` inconsistente en `recopilarDatosConv`
- [x] Issue #52: `getLogoBase64` sin try/catch
- [x] `npm run verify` limpio
- [ ] Sign-off del dueño
