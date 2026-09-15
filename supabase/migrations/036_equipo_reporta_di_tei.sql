-- ============================================================
--  036 — `equipos.reporta_di`, `equipos.reporta_tei`
--
--  Necesidad de negocio (#111): no todos los sistemas de adquisición (CR/DR)
--  reportan D.I. o TEI en la prueba 2.9/2.10 (DDI/EI) — depende del equipo y
--  solo se descubre en campo durante la visita. `NULL` = sí reporta
--  (comportamiento histórico, columna siempre visible).
-- ============================================================

ALTER TABLE public.equipos
  ADD COLUMN IF NOT EXISTS reporta_di boolean,
  ADD COLUMN IF NOT EXISTS reporta_tei boolean;
