-- ============================================================
-- Migración 014: identificación propia del equipo (marca/modelo/serie)
-- Distinta de gen_marca/gen_modelo/gen_numero_serie, que son del
-- generador (sub-componente interno, puede ser de otro fabricante).
-- ============================================================

ALTER TABLE equipos
  ADD COLUMN IF NOT EXISTS marca TEXT,
  ADD COLUMN IF NOT EXISTS modelo TEXT,
  ADD COLUMN IF NOT EXISTS numero_serie TEXT;
