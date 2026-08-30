-- ============================================================
--  021 — "Otras identificaciones" del equipo (#61)
--
--  Una foto rotulada por equipo: placa del fabricante, número de
--  inventario de la institución, etiqueta de calibración, etc. Se
--  captura desde Información General y se renderiza en el informe.
--  El binario va al bucket `evidencias` (ruta equipos/{equipo_id}/{id}.jpg);
--  la fila guarda el PATH en `url_storage`.
--
--  Sincroniza bidireccional como el resto de tablas de campo. RLS con
--  el mismo modelo permisivo para `authenticated` que la 017.
--  Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.equipo_identificaciones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id     uuid NOT NULL REFERENCES public.equipos (id) ON DELETE CASCADE,
  nombre        text,
  orden         integer,
  url_storage   text,
  deleted_at    timestamptz,
  sync_status   text DEFAULT 'synced',
  last_modified timestamptz NOT NULL DEFAULT now(),
  creado_en     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS equipo_identificaciones_equipo_id_idx
  ON public.equipo_identificaciones (equipo_id);

ALTER TABLE public.equipo_identificaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS equipo_identificaciones_auth_select ON public.equipo_identificaciones;
DROP POLICY IF EXISTS equipo_identificaciones_auth_insert ON public.equipo_identificaciones;
DROP POLICY IF EXISTS equipo_identificaciones_auth_update ON public.equipo_identificaciones;
DROP POLICY IF EXISTS equipo_identificaciones_auth_delete ON public.equipo_identificaciones;

CREATE POLICY equipo_identificaciones_auth_select ON public.equipo_identificaciones
  FOR SELECT TO authenticated USING (true);
CREATE POLICY equipo_identificaciones_auth_insert ON public.equipo_identificaciones
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY equipo_identificaciones_auth_update ON public.equipo_identificaciones
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY equipo_identificaciones_auth_delete ON public.equipo_identificaciones
  FOR DELETE TO authenticated USING (true);
