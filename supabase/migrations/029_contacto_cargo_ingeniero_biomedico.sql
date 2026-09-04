-- ============================================================
--  029 — `contactos.cargo` admite 'ingeniero_biomedico'
--
--  Necesidad de negocio: el ingeniero biomédico del cliente debe poder
--  quedar registrado en la lista de contactos de la sede/ubicación, igual
--  que el médico responsable o el tecnólogo. El CHECK de `contactos.cargo`
--  (migración 022) no contemplaba este cargo.
--
--  El tipo `Contacto["cargo"]` de la app y `CARGO_OPTIONS` del formulario
--  ya usan `ingeniero_biomedico`; esto alinea la restricción de la base.
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
      'ingeniero_biomedico',
      'otro'
    )
  );
