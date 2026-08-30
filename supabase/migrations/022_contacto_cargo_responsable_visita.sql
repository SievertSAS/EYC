-- ============================================================
--  022 — `contactos.cargo` admite 'responsable_visita'
--
--  Hallazgo de la pasada de prueba E2E: al crear el "Responsable de la
--  Visita" desde Información General, el contacto se guarda local con
--  `cargo = 'responsable_visita'` pero el push falla y la fila queda
--  atascada en `pending`. Causa: el CHECK de `contactos.cargo` (migración
--  009) solo permite medico_responsable / tecnologo / opr / representante /
--  otro. El valor `responsable_visita` viola la restricción (error 23514).
--
--  El tipo `Contacto["cargo"]` de la app y `info-modulo` ya usan
--  `responsable_visita`; esto alinea la restricción de la base.
--  Idempotente.
-- ============================================================

ALTER TABLE public.contactos DROP CONSTRAINT IF EXISTS contactos_cargo_check;

ALTER TABLE public.contactos
  ADD CONSTRAINT contactos_cargo_check
  CHECK (
    cargo IS NULL
    OR cargo IN (
      'medico_responsable',
      'tecnologo',
      'opr',
      'representante',
      'responsable_visita',
      'otro'
    )
  );
