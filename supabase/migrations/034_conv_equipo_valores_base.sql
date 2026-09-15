-- ============================================================
--  034 — Valores base de pruebas 2.x a nivel de EQUIPO (#110)
--
--  Hallazgo: "Con respecto a los valores base esto no se puede
--  almacenar de la visita anterior? Porque quitaría mucho tiempo
--  estar buscando valores anteriores" (reunión 2026-09-09). Los
--  valores base de comparación (2.8, 2.9, 2.16, 2.17, 2.20, 2.21)
--  vivían solo en las tablas de la visita — el físico los transcribía
--  a mano en cada visita. Esta tabla persiste esos valores por EQUIPO
--  (1 fila por equipo_id), referencia permanente que se recupera año
--  tras año.
--
--  Sincroniza bidireccional como el resto de tablas de campo. RLS con
--  el mismo modelo permisivo para `authenticated` que la 017.
--  Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.conv_equipo_valores_base (
  id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id                    uuid NOT NULL UNIQUE REFERENCES public.equipos (id) ON DELETE CASCADE,
  -- 2.8 — Factor de corrección PKA
  pka_base                     numeric,
  -- 2.9 — DDI/EI
  ei_base_29                   numeric,
  di_base_29                   numeric,
  -- 2.16 — MTF
  mtf50_base_horizontal        numeric,
  mtf20_base_horizontal        numeric,
  mtf50_base_vertical          numeric,
  mtf20_base_vertical          numeric,
  -- 2.17 — Sensibilidad CAE
  mas_base_217                 numeric,
  ei_base_217                  numeric,
  di_base_217                  numeric,
  -- 2.20 — Compensación por kVp
  mas_base_60kv                numeric,
  ei_base_60kv                 numeric,
  di_base_60kv                 numeric,
  mas_base_70kv                numeric,
  ei_base_70kv                 numeric,
  di_base_70kv                 numeric,
  mas_base_80kv                numeric,
  ei_base_80kv                 numeric,
  di_base_80kv                 numeric,
  -- 2.20 — Compensación por espesor Cu
  mas_base_cu1                 numeric,
  ei_base_cu1                  numeric,
  di_base_cu1                  numeric,
  mas_base_cu2                 numeric,
  ei_base_cu2                  numeric,
  di_base_cu2                  numeric,
  mas_base_cu3                 numeric,
  ei_base_cu3                  numeric,
  di_base_cu3                  numeric,
  -- 2.21 — Dosis al receptor, por programa clínico
  dosis_base_extremidades_mgy  numeric,
  dosis_base_torax_mgy         numeric,
  dosis_base_columna_mgy       numeric,
  deleted_at                   timestamptz,
  sync_status                  text NOT NULL DEFAULT 'synced',
  last_modified                timestamptz NOT NULL DEFAULT now(),
  creado_en                    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conv_equipo_valores_base_sync_idx
  ON public.conv_equipo_valores_base (sync_status);

ALTER TABLE public.conv_equipo_valores_base ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conv_equipo_valores_base_auth_select ON public.conv_equipo_valores_base;
DROP POLICY IF EXISTS conv_equipo_valores_base_auth_insert ON public.conv_equipo_valores_base;
DROP POLICY IF EXISTS conv_equipo_valores_base_auth_update ON public.conv_equipo_valores_base;
DROP POLICY IF EXISTS conv_equipo_valores_base_auth_delete ON public.conv_equipo_valores_base;

CREATE POLICY conv_equipo_valores_base_auth_select ON public.conv_equipo_valores_base
  FOR SELECT TO authenticated USING (true);
CREATE POLICY conv_equipo_valores_base_auth_insert ON public.conv_equipo_valores_base
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY conv_equipo_valores_base_auth_update ON public.conv_equipo_valores_base
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY conv_equipo_valores_base_auth_delete ON public.conv_equipo_valores_base
  FOR DELETE TO authenticated USING (true);
