-- ============================================================
--  033 — `conv_levantamiento_setup.carga_trabajo_modo`
--
--  Necesidad de negocio (#105): el ingeniero debe poder elegir manualmente
--  si la carga de trabajo usada en el cálculo de dosis anual es la
--  "estimada" (derivada de radiografías/semana × mAs máximo clínico) o la
--  "típica" (estándar fijo, TECDOC-1958) — en vez de tomar siempre el
--  máximo entre las dos automáticamente.
-- ============================================================

ALTER TABLE public.conv_levantamiento_setup
  ADD COLUMN IF NOT EXISTS carga_trabajo_modo text
    CHECK (carga_trabajo_modo IN ('estimada', 'tipica'));
