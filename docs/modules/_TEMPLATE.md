# Módulo: `<nombre>`

> Estado: 🔴 sin certificar · 🟡 en curso · 🟢 certificado (Tier N)
> Última actualización: `<fecha>` · Responsable: `<nombre>`

Doc producido por el protocolo de intervención (ver
`~/.claude/plans/en-dias-anteriores-he-cheerful-hopcroft.md`). Las 10 secciones
son obligatorias. El apéndice "Log de decisiones" registra el triage de hallazgos.

---

## 1. Responsabilidad

Un párrafo: de qué es este módulo la **única fuente de verdad**.

## 2. API pública

| Función / Export | Firma | Efectos | Convención de error             | ¿Idempotente? |
| ---------------- | ----- | ------- | ------------------------------- | ------------- |
|                  |       |         | throw / return `{ok:false}` / … |               |

## 3. Modelo de datos

- **Tablas propias** (dueño de escritura):
- **Dependencias solo-lectura**:
- **`deleted_at`**: ¿se filtra en las lecturas? ¿dónde no?
- **`last_modified`**: ¿quién lo setea y cuándo?
- **Tablas Supabase involucradas** y su clase (`SYNC_TABLES` / `MASTER_TABLES` / local-only):

## 4. Flujo de control

Camino(s) principal(es) como secuencia numerada. Diagrama de estados si aplica.

## 5. Comportamiento offline / online

- Funciona 100% offline:
- Encola para push:
- Exige red:
- Al reconectar:

## 6. Interacción con sync

- Qué writes encolan push:
- Comportamiento de conflicto (hoy: local gana, silencioso):
- Campos de watermark:

## 7. Rol / permisos

- Claves de permiso chequeadas:
- ¿Chequeo cliente o server-enforced?
- Qué ve un usuario sin permiso:

## 8. Invariantes y supuestos

- Ej: "asume exactamente un `informe` por visita", "asume reloj del dispositivo correcto", …

## 9. Modos de falla conocidos

- Falla → efecto → manejo actual (o falta de).

## 10. Preguntas abiertas / smells

- Alimenta el triage de la Fase 5.

---

## Apéndice A — Matriz de escenarios

Ver `docs/modules/<nombre>.scenarios.md` (o inline si son pocos).

## Apéndice B — Log de decisiones (triage de hallazgos)

| # Hallazgo | Descripción | Decisión                      | Razón | Sign-off |
| ---------- | ----------- | ----------------------------- | ----- | -------- |
|            |             | fix-ahora / backlog / aceptar |       |          |

## Apéndice C — Estado de salida (Fase 6)

- [ ] Doc completo (10 secciones)
- [ ] Matriz de escenarios 100% ejecutada, resultados commiteados
- [ ] Hallazgos fix-ahora cerrados con test verde
- [ ] Hallazgos backlog con issue + test que reproduce
- [ ] Cobertura del módulo ≥ umbral (pure-logic 90% / resto 80%)
- [ ] `npm run verify` limpio
- [ ] Sin `eslint-disable` nuevo sin justificación
- [ ] Sign-off del dueño
