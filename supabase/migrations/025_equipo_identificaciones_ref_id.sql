-- ============================================================
--  025 — `ref_id` en equipo_identificaciones (#61)
--
--  La foto de referencia de la subtabla "tubo" es POR TUBO (un equipo
--  puede tener N tubos). `ref_id` apunta al `tubos.id` correspondiente.
--  Para generador / colimador / otra queda NULL (hay una sola por equipo).
--
--  Aditiva e idempotente.
-- ============================================================

ALTER TABLE public.equipo_identificaciones
  ADD COLUMN IF NOT EXISTS ref_id uuid;
