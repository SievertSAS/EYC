-- ============================================================
--  052 — Descripción por área flotante del portátil (#188)
--
--  `visitas.ubicaciones_flotantes` (050) pasa de array de NOMBRES
--  (`["UCI adultos", ...]`) a array de OBJETOS con la descripción de la
--  ubicación, propia de la visita (no del catálogo):
--    [{"nombre": "UCI adultos", "descripcion": "Cama 3, junto a la estación"}]
--  La descripción es obligatoria para completar el módulo, pero eso lo valida
--  la app (completitud), no la base: se guarda vacía mientras se diligencia.
--
--  1. Convierte las filas existentes: cada elemento string pasa a
--     {"nombre": <string>, "descripcion": ""}, conservando el orden. El
--     trigger de last_modified (001/016) avanza el watermark, así que los
--     dispositivos reciben la forma nueva en el próximo pull.
--  2. CHECK de forma de cada elemento: string (formato viejo) u objeto con
--     "nombre" string (y "descripcion" string si viene).
--
--  Por qué el CHECK sigue aceptando strings: un dispositivo con la versión
--  anterior de la app (PWA en caché, sin conexión) puede tener cambios
--  pendientes con el formato viejo. Si el CHECK los rechazara, el push
--  fallaría con 23514 y la visita quedaría reintentando para siempre en ese
--  dispositivo. La app nueva lee ambos formatos (`normalizarAreasFlotantes`,
--  src/lib/ubicaciones/flotantes.ts) y la Dexie v26 convierte los datos
--  locales, así que aceptar strings no rompe nada. Se puede endurecer a solo
--  objetos cuando no queden clientes viejos.
--
--  El CHECK de la 050 (lista solo con categoría 'flotante', y que sea array)
--  se mantiene tal cual.
--
--  Idempotente: re-ejecutar no cambia filas ya convertidas.
-- ============================================================

-- ─── 1. Convertir datos viejos ──────────────────────────────

UPDATE public.visitas v
SET ubicaciones_flotantes = (
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN jsonb_typeof(t.e) = 'string'
          THEN jsonb_build_object('nombre', t.e #>> '{}', 'descripcion', '')
        ELSE t.e
      END
      ORDER BY t.ord
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(v.ubicaciones_flotantes) WITH ORDINALITY AS t(e, ord)
)
WHERE jsonb_typeof(v.ubicaciones_flotantes) = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(v.ubicaciones_flotantes) AS x(e)
    WHERE jsonb_typeof(x.e) = 'string'
  );

-- ─── 2. Forma de cada elemento ──────────────────────────────

-- IMMUTABLE: solo mira el valor recibido (requisito para usarla en un CHECK).
CREATE OR REPLACE FUNCTION public.ubicaciones_flotantes_validas(p jsonb)
RETURNS boolean AS $$
  SELECT p IS NULL
    OR jsonb_typeof(p) <> 'array'  -- lo cubre visitas_ubicaciones_flotantes_check (050)
    OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p) AS t(e)
      WHERE NOT (
        jsonb_typeof(t.e) = 'string'
        OR (
          jsonb_typeof(t.e) = 'object'
          AND jsonb_typeof(t.e -> 'nombre') = 'string'
          AND (NOT (t.e ? 'descripcion') OR jsonb_typeof(t.e -> 'descripcion') = 'string')
        )
      )
    )
$$ LANGUAGE sql IMMUTABLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'visitas_ubicaciones_flotantes_elementos_check'
      AND conrelid = 'public.visitas'::regclass
  ) THEN
    ALTER TABLE public.visitas
      ADD CONSTRAINT visitas_ubicaciones_flotantes_elementos_check
      CHECK (public.ubicaciones_flotantes_validas(ubicaciones_flotantes));
  END IF;
END $$;
