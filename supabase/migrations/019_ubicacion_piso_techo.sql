-- ============================================================
--  019 — Piso y techo del blindaje en ubicaciones_rx
--
--  Contexto (issue #63, pasada de prueba E2E):
--  El informe FT-LEC-6c describe las barreras estructurales colindantes
--  (zonas A–D) pero no tenía dónde registrar el piso ni el techo. Se
--  capturan igual que las zonas (texto libre) y NO intervienen en el
--  cálculo del área (ancho × largo).
--
--  Idempotente: se puede correr más de una vez sin efecto.
-- ============================================================

ALTER TABLE public.ubicaciones_rx
  ADD COLUMN IF NOT EXISTS piso_desc  text,
  ADD COLUMN IF NOT EXISTS techo_desc text;

COMMENT ON COLUMN public.ubicaciones_rx.piso_desc  IS
  'Barrera estructural del piso (material, plomo equivalente, colindancia inferior).';
COMMENT ON COLUMN public.ubicaciones_rx.techo_desc IS
  'Barrera estructural del techo (material, plomo equivalente, colindancia superior).';
