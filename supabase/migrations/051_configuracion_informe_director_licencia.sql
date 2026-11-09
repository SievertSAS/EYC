-- ============================================================
--  051 — Licencia del Director Técnico en la configuración del informe
--
--  El bloque "Responsable Sievert S.A.S:" del informe imprime, en orden:
--  firma, nombre, cargo y licencia. La licencia se edita en Configuración →
--  Informe (solo coordinador, vía /api/configuracion-informe). Se imprime tal
--  cual se escribe. Idempotente.
-- ============================================================

ALTER TABLE public.configuracion_informe
  ADD COLUMN IF NOT EXISTS director_licencia TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'configuracion_informe_director_licencia_check'
      AND conrelid = 'public.configuracion_informe'::regclass
  ) THEN
    ALTER TABLE public.configuracion_informe
      ADD CONSTRAINT configuracion_informe_director_licencia_check
      CHECK (director_licencia IS NULL OR length(director_licencia) <= 150);
  END IF;
END $$;
