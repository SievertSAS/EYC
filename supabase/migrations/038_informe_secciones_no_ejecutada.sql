-- ============================================================
--  038 — `conv_informe_secciones.concepto` admite 'No_favorable_no_ejecutada'
--
--  Necesidad de negocio (#120): cuando un componente del equipo falla y por
--  eso una prueba que sí aplica no se puede ejecutar, el físico necesita un
--  override manual distinto de "No aplica" (que es semánticamente incorrecto
--  -- la prueba sí aplica, solo no se pudo realizar). El CHECK original
--  (migración 010) no contemplaba este valor.
--
--  Idempotente.
-- ============================================================

ALTER TABLE public.conv_informe_secciones DROP CONSTRAINT IF EXISTS conv_informe_secciones_concepto_check;

ALTER TABLE public.conv_informe_secciones
  ADD CONSTRAINT conv_informe_secciones_concepto_check
  CHECK (concepto IN ('Conforme', 'No_conforme', 'No_aplica', 'No_favorable_no_ejecutada'));
