-- ============================================================
--  Migración 008: Sala y blindaje en ubicaciones_rx
--
--  Se capturan las dimensiones de la sala y la descripción de
--  zonas A–D directamente en la ubicación RX (no en una tabla
--  aparte), ya que pertenecen al recinto y se reutilizan en
--  todas las visitas/equipos de esa sala.
-- ============================================================

ALTER TABLE ubicaciones_rx ADD COLUMN IF NOT EXISTS ubicacion_fisica TEXT;
ALTER TABLE ubicaciones_rx ADD COLUMN IF NOT EXISTS ancho_m NUMERIC(6, 2);
ALTER TABLE ubicaciones_rx ADD COLUMN IF NOT EXISTS largo_m NUMERIC(6, 2);
ALTER TABLE ubicaciones_rx ADD COLUMN IF NOT EXISTS alto_m NUMERIC(6, 2);
ALTER TABLE ubicaciones_rx ADD COLUMN IF NOT EXISTS area_m2 NUMERIC(8, 2);
ALTER TABLE ubicaciones_rx ADD COLUMN IF NOT EXISTS zona_a_desc TEXT;
ALTER TABLE ubicaciones_rx ADD COLUMN IF NOT EXISTS zona_b_desc TEXT;
ALTER TABLE ubicaciones_rx ADD COLUMN IF NOT EXISTS zona_c_desc TEXT;
ALTER TABLE ubicaciones_rx ADD COLUMN IF NOT EXISTS zona_d_desc TEXT;
