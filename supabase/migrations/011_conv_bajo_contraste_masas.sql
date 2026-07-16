-- ============================================================
-- Migración 011: formato alterno "Masas(mm)" para prueba 2.13
-- (conv_bajo_contraste) — agrega el discriminante de plantilla y
-- las 8 columnas de la plantilla alterna, sin tocar los datos
-- existentes de la plantilla %Contraste.
-- ============================================================

ALTER TABLE conv_bajo_contraste
  ADD COLUMN IF NOT EXISTS formato TEXT,
  ADD COLUMN IF NOT EXISTS masa_1 BOOLEAN,
  ADD COLUMN IF NOT EXISTS masa_2 BOOLEAN,
  ADD COLUMN IF NOT EXISTS masa_3 BOOLEAN,
  ADD COLUMN IF NOT EXISTS masa_4 BOOLEAN,
  ADD COLUMN IF NOT EXISTS masa_5 BOOLEAN,
  ADD COLUMN IF NOT EXISTS masa_6 BOOLEAN,
  ADD COLUMN IF NOT EXISTS masa_7 BOOLEAN,
  ADD COLUMN IF NOT EXISTS masa_8 BOOLEAN;

ALTER TABLE conv_bajo_contraste
  ADD CONSTRAINT conv_bajo_contraste_formato_check
  CHECK (formato IS NULL OR formato IN ('contraste', 'masas'));
