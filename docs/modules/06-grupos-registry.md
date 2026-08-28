# Módulo: registry + grupos + catálogos CONVENCIONAL

> Estado: 🟡 en curso (Tier 3 · Módulos 6 y 9) · 2026-08-28
> `src/lib/equipos/registry.ts`, `convencional/grupos.ts`,
> `convencional/informe-secciones.ts`, `convencional/manual.ts`,
> `convencional/inspeccion-items.ts`. Todo data estática + accesores.

---

## 1. Responsabilidad

- **`registry.ts`**: mapea `TipoEquipo → EquipmentPackage`. Hoy solo
  `CONVENCIONAL`. `MODULOS_DEFAULT` es el fallback para tipos sin paquete.
- **`grupos.ts`**: `GRUPOS_CONVENCIONAL` — 5 grupos (a–e), las 21 pruebas
  TECDOC (2.1–2.21) repartidas. `formulas`/`criterios_aceptacion` **vacíos**
  (la conformidad la hace `evaluacion.ts`, no el motor de fórmulas).
- **`informe-secciones.ts`**: `CATALOGO_SECCIONES` — objetivo/instrumentación/
  metodología/criterio por prueba, + su letra de grupo (A–E). Para el PDF.
- **`manual.ts`**: `MANUAL_CONVENCIONAL` — el procedimiento por prueba (drawer
  en la app). Una entrada por código.
- **`inspeccion-items.ts`**: textos del checklist de la prueba 2.2.

## 2. Consistencia (verificada por test)

Los tres mapas código↔grupo **coinciden** (la auditoría sospechaba
divergencia; no hay). Fijado en `grupos.test.ts` / `catalogos.test.ts`:

| Grupo | Códigos                       |
| ----- | ----------------------------- |
| a / A | 2.1, 2.2                      |
| b / B | 2.4, 2.5, 2.6, 2.7, 2.8, 2.21 |
| c / C | 2.17, 2.18, 2.19, 2.20        |
| d / D | 2.9, 2.10, 2.14, 2.15         |
| e / E | 2.3, 2.11, 2.12, 2.13, 2.16   |

`2.8` es el único código sin criterio (`tieneCriterio("2.8") === false`).

## 3. Hallazgo #7 — guard

`module-completeness.getModuleStatuses` solo produce estados para los ids del
paquete CONVENCIONAL (`info`, `grupo-a`..`grupo-e`, `pre-informe`). Los de
`MODULOS_DEFAULT` (`condiciones`, `levantamiento`, `inspeccion`, `pruebas`, …)
nunca aparecen en `progressMap` → una visita de un tipo sin paquete tendría
todos sus módulos requeridos en "sin_iniciar" para siempre → **nunca podría
pasar el gate de "enviar a revisión"**.

Hoy es latente (nadie puede crear visitas no-CONVENCIONAL). El dueño lo puso
como **intervención prioritaria para cuando arranque el segundo tipo de
equipo**.

**Guard agregado** (`registry.ts`): `canCreateVisitFor(tipo)` /
`assertCanCreateVisitFor(tipo)` — lanza `NoPackageError` para cualquier tipo
sin paquete. **Pendiente de cablear en `visita-service.crearVisitaDesdeSolicitud`
(Tier 4).**

Plan del fix real (al habilitar el 2º equipo): unificar los ids entre
`getModuleStatuses` y `getDefaultModules`, y recién ahí quitar el guard.

## Apéndice C — Estado de salida (Fase 6)

- [x] Doc
- [x] `registry.test.ts` — accesores + guard #7 (13 tests con grupos)
- [x] `grupos.test.ts` — estructura + consistencia con catálogo y evaluacion
- [x] `catalogos.test.ts` — manual / secciones / inspeccion-items
- [ ] Cablear `assertCanCreateVisitFor` en `visita-service` → **Tier 4**
- [x] `npm run verify` limpio
- [ ] Sign-off del dueño
