-- ============================================================
--  051 — Cédula y licencia del Director Técnico en la configuración del informe
--
--  El bloque "Responsable Sievert S.A.S:" del informe imprime, en orden:
--  firma, nombre, cédula (C.C.), cargo y licencia. Se editan en
--  Configuración → Informe (solo coordinador, vía /api/configuracion-informe).
--  Idempotente: se puede volver a correr.
-- ============================================================

ALTER TABLE public.configuracion_informe
  ADD COLUMN IF NOT EXISTS director_cedula TEXT,
  ADD COLUMN IF NOT EXISTS director_licencia TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'configuracion_informe_director_cedula_check'
      AND conrelid = 'public.configuracion_informe'::regclass
  ) THEN
    ALTER TABLE public.configuracion_informe
      ADD CONSTRAINT configuracion_informe_director_cedula_check
      CHECK (director_cedula IS NULL OR length(director_cedula) <= 30);
  END IF;

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
