-- ============================================================
--  020 — Revierte la 014: elimina equipos.marca / modelo / numero_serie
--
--  Contexto (issue #61, decisión del dueño):
--  La 014 agregó marca/modelo/numero_serie como "identificación propia
--  del equipo", separada de gen_marca/gen_modelo/gen_numero_serie
--  ("del generador"). En la práctica hay UN solo aparato físico: los
--  campos gen_* SON los del equipo (la plantilla oficial FT-LEC-6c los
--  rotula "del generador"). Los campos de la 014 nunca tuvieron captura
--  propia en el módulo de Información General y quedaron como ruido.
--
--  DESTRUCTIVA: descarta los valores de esas 3 columnas. Correr a
--  conciencia. Si algún equipo tiene datos ahí y no en gen_*, migrarlos
--  antes con algo como:
--    UPDATE equipos SET gen_marca = COALESCE(gen_marca, marca),
--                       gen_modelo = COALESCE(gen_modelo, modelo),
--                       gen_numero_serie = COALESCE(gen_numero_serie, numero_serie)
--    WHERE marca IS NOT NULL OR modelo IS NOT NULL OR numero_serie IS NOT NULL;
-- ============================================================

ALTER TABLE public.equipos
  DROP COLUMN IF EXISTS marca,
  DROP COLUMN IF EXISTS modelo,
  DROP COLUMN IF EXISTS numero_serie;
