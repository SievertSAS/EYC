-- ============================================================
--  053 — `equipos.parametros_consola` (#189, paso 1)
--
--  Checklist "Parámetros nominales que muestra la consola" del CONVENCIONAL
--  (fijo y portátil): qué magnitudes deja seleccionar/visualizar la consola
--  (kV, mA, Tiempo, mAs). En este paso SOLO se captura el dato por equipo; el
--  uso en el informe y en la evaluación de pruebas llega en un PR posterior.
--
--  Nullable y sin DEFAULT: los equipos existentes quedan sin definir (NULL)
--  y el técnico lo completa en Información General (es requerido allí).
--  Sin cambios de RLS: las políticas existentes de `equipos` lo cubren.
--  Idempotente.
-- ============================================================

ALTER TABLE public.equipos
  ADD COLUMN IF NOT EXISTS parametros_consola text[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'equipos_parametros_consola_check'
      AND conrelid = 'public.equipos'::regclass
  ) THEN
    ALTER TABLE public.equipos
      ADD CONSTRAINT equipos_parametros_consola_check
      CHECK (
        parametros_consola IS NULL
        OR parametros_consola <@ ARRAY['kv', 'ma', 'tiempo', 'mas']::text[]
      );
  END IF;
END $$;
