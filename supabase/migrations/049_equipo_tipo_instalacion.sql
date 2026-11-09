-- ============================================================
--  049 — `equipos.tipo_instalacion` (#187)
--
--  El rayos X portátil NO es un tipo de equipo nuevo: es un CONVENCIONAL
--  (mismo paquete, mismas 21 pruebas y cálculos, mismo informe FT-LEC-6c)
--  marcado como portátil. Solo cambian algunos textos del informe y algunos
--  valores por defecto (CAE en "No aplica", foco grueso opcional).
--
--  Los equipos existentes quedan como 'fijo' (DEFAULT). Idempotente.
-- ============================================================

ALTER TABLE public.equipos
  ADD COLUMN IF NOT EXISTS tipo_instalacion text NOT NULL DEFAULT 'fijo';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'equipos_tipo_instalacion_check'
      AND conrelid = 'public.equipos'::regclass
  ) THEN
    ALTER TABLE public.equipos
      ADD CONSTRAINT equipos_tipo_instalacion_check
      CHECK (tipo_instalacion IN ('fijo', 'portatil'));
  END IF;
END $$;
