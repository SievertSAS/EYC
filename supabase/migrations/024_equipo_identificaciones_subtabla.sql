-- ============================================================
--  024 — `subtabla` en equipo_identificaciones (#61)
--
--  La tabla ahora guarda dos cosas:
--   - la foto de referencia (placa) de las secciones generador / tubo /
--     colimador — una sola por sección;
--   - las "otras identificaciones" sueltas (título + imagen) de la lista
--     que va después de Condiciones Ambientales.
--
--  `subtabla` discrimina. Default 'otra' → las filas creadas por la 021
--  (antes de este cambio) quedan como "otras", que es su comportamiento
--  previo. Aditiva e idempotente.
-- ============================================================

ALTER TABLE public.equipo_identificaciones
  ADD COLUMN IF NOT EXISTS subtabla text NOT NULL DEFAULT 'otra';

ALTER TABLE public.equipo_identificaciones
  DROP CONSTRAINT IF EXISTS equipo_identificaciones_subtabla_check;

ALTER TABLE public.equipo_identificaciones
  ADD CONSTRAINT equipo_identificaciones_subtabla_check
  CHECK (subtabla IN ('generador', 'tubo', 'colimador', 'otra'));
