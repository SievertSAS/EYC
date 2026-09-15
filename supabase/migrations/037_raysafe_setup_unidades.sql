-- ============================================================
--  037 — `conv_raysafe_setup.unidad_dap` / `unidad_kerma`
--
--  Necesidad de negocio (#113): el DAP nominal (panel del equipo del
--  cliente) y el Kerma/DAP medido (instrumento RaySafe) pueden reportarse
--  en escalas distintas — hoy todo el flujo asume mGy/mGy·cm² fijo. Cada
--  campo se guarda por separado porque son dos fuentes de medición
--  independientes que no siempre coinciden en escala.
-- ============================================================

ALTER TABLE public.conv_raysafe_setup
  ADD COLUMN IF NOT EXISTS unidad_dap text,
  ADD COLUMN IF NOT EXISTS unidad_kerma text;
