-- ============================================================
--  043 — Fecha de fabricación con precisión variable
--
--  No todos los fabricantes reportan la fecha completa: a veces solo el año,
--  o año y mes. `gen_fecha_fabricacion` pasa de DATE a TEXT con formato ISO
--  parcial: 'AAAA', 'AAAA-MM' o 'AAAA-MM-DD' (ver src/lib/fecha-parcial.ts).
--
--  Las fechas existentes se convierten sin pérdida ('2019-03-15'::text).
--  El CHECK valida el formato; la validez del día/mes la garantiza la app.
--
--  Despliegue: correr ANTES de publicar la versión de la app que guarda
--  fechas parciales; si no, el push de 'AAAA' a una columna DATE falla.
-- ============================================================

ALTER TABLE public.equipos
  ALTER COLUMN gen_fecha_fabricacion TYPE text
  USING to_char(gen_fecha_fabricacion, 'YYYY-MM-DD');

ALTER TABLE public.equipos
  DROP CONSTRAINT IF EXISTS equipos_gen_fecha_fabricacion_formato;

ALTER TABLE public.equipos
  ADD CONSTRAINT equipos_gen_fecha_fabricacion_formato
  CHECK (
    gen_fecha_fabricacion IS NULL
    OR gen_fecha_fabricacion ~ '^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$'
  );
