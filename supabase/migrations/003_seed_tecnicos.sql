-- ============================================================
--  Seed: Técnicos vinculados a Supabase Auth
--  Pegar en SQL Editor → Run
-- ============================================================

INSERT INTO tecnicos (auth_uid, nombre, cedula, cargo, email, activo) VALUES
  ('5cf5c348-1144-4462-b201-c87c802db491', 'Ana Martínez',    '1001001001', 'programador',     'ana@sievert.co',    true),
  ('060fe941-a436-4c6b-ac19-f69fd2473598', 'Carlos Ramírez',  '1002002002', 'tecnologo',       'carlos@sievert.co', true),
  ('99ef02af-5199-40b2-a4fc-d3c272038550', 'John Mario López','1003003003', 'fisico_tecnico',  'john@sievert.co',   true),
  ('c31d2c78-11af-486e-a99c-b92aeabc45bb', 'Jorge Iván Pérez','1004004004', 'ingeniero',       'jorge@sievert.co',  true),
  ('3f5bf700-5727-4806-8adc-1d0cd1dc9bea', 'Laura Gómez',    '1005005005', 'coordinador',     'laura@sievert.co',  true);
