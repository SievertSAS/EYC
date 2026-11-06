-- ============================================================
--  045 — Plantillas de informe versionadas por tipo de equipo (#196)
--
--  Los textos genéricos del informe (introducción, título y, por prueba:
--  objetivo, instrumentación, metodología, motivo de "no aplica",
--  criterio, análisis fijo y acciones correctivas) salen del código a esta
--  tabla maestra. El coordinador edita un BORRADOR y lo PUBLICA como
--  versión nueva (v1, v2…) vía /api/plantillas (service role; gate:
--  cargo = 'coordinador').
--
--  Reglas:
--   - A lo sumo un borrador vivo por tipo de equipo.
--   - (tipo_equipo, version) único entre las publicadas.
--   - Una versión publicada es INMUTABLE: ni UPDATE ni DELETE (trigger).
--   - Se registra quién publicó y cuándo (publicada_por / publicada_en).
--   - RLS: lectura para autenticados (el cliente la baja por el pull de
--     maestras); NINGUNA política de escritura → solo service role escribe.
--   - El número de versión es interno: no se imprime en el PDF. Cada
--     versión oficial de un informe guarda la plantilla usada en
--     `informe_versiones.plantilla_version_id` (trazabilidad). Los PDF
--     oficiales ya publicados (con hash) no cambian.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.plantillas_informe (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_equipo   TEXT NOT NULL,
  codigo        TEXT NOT NULL CHECK (length(btrim(codigo)) BETWEEN 1 AND 40),
  version       INTEGER CHECK (version IS NULL OR version > 0),
  estado        TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'publicada')),
  contenido     JSONB NOT NULL DEFAULT '{"pruebas": {}}'::jsonb
                CHECK (jsonb_typeof(contenido) = 'object'),
  creada_por    UUID REFERENCES public.usuarios(id),
  publicada_por UUID REFERENCES public.usuarios(id),
  publicada_en  TIMESTAMPTZ,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  CONSTRAINT plantillas_informe_estado_coherente CHECK (
    (estado = 'borrador' AND version IS NULL AND publicada_en IS NULL)
    OR (estado = 'publicada' AND version IS NOT NULL AND publicada_en IS NOT NULL
        AND publicada_por IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS plantillas_informe_version_unica
  ON public.plantillas_informe (tipo_equipo, version)
  WHERE estado = 'publicada';

CREATE UNIQUE INDEX IF NOT EXISTS plantillas_informe_borrador_unico
  ON public.plantillas_informe (tipo_equipo)
  WHERE estado = 'borrador' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_plantillas_informe_last_modified
  ON public.plantillas_informe (last_modified);

-- ─── Inmutabilidad de las versiones publicadas ───
CREATE OR REPLACE FUNCTION public.plantillas_informe_inmutable()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.estado = 'publicada' THEN
    RAISE EXCEPTION 'La versión % de la plantilla de % está publicada y no se puede modificar',
      OLD.version, OLD.tipo_equipo
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_plantillas_informe_inmutable ON public.plantillas_informe;
CREATE TRIGGER trg_plantillas_informe_inmutable
  BEFORE UPDATE OR DELETE ON public.plantillas_informe
  FOR EACH ROW EXECUTE FUNCTION public.plantillas_informe_inmutable();

-- last_modified (watermark del pull), igual que el resto de tablas (016/039)
DROP TRIGGER IF EXISTS trg_plantillas_informe_modified ON public.plantillas_informe;
CREATE TRIGGER trg_plantillas_informe_modified
  BEFORE INSERT OR UPDATE ON public.plantillas_informe
  FOR EACH ROW EXECUTE FUNCTION update_last_modified();

-- ─── Publicación atómica: borrador → versión (máx + 1) ───
-- SECURITY INVOKER: corre con los permisos de quien llama. Solo la API
-- (service role) puede escribir la tabla; para un rol autenticado RLS no
-- deja ver el borrador como actualizable y la función no publica nada.
CREATE OR REPLACE FUNCTION public.publicar_plantilla_informe(
  p_tipo_equipo TEXT,
  p_publicada_por UUID
)
RETURNS public.plantillas_informe
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_borrador public.plantillas_informe;
  v_version  INTEGER;
  v_fila     public.plantillas_informe;
BEGIN
  -- Serializa publicaciones concurrentes del mismo tipo de equipo.
  PERFORM pg_advisory_xact_lock(hashtext('plantillas_informe:' || p_tipo_equipo));

  SELECT * INTO v_borrador
  FROM public.plantillas_informe
  WHERE tipo_equipo = p_tipo_equipo AND estado = 'borrador' AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No hay borrador de plantilla para %', p_tipo_equipo
      USING ERRCODE = 'no_data_found';
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1 INTO v_version
  FROM public.plantillas_informe
  WHERE tipo_equipo = p_tipo_equipo AND estado = 'publicada';

  UPDATE public.plantillas_informe
  SET estado = 'publicada',
      version = v_version,
      publicada_por = p_publicada_por,
      publicada_en = NOW()
  WHERE id = v_borrador.id
  RETURNING * INTO v_fila;

  RETURN v_fila;
END;
$$;

REVOKE ALL ON FUNCTION public.publicar_plantilla_informe(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publicar_plantilla_informe(TEXT, UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publicar_plantilla_informe(TEXT, UUID) TO service_role;

-- ─── RLS: solo lectura para autenticados ───
ALTER TABLE public.plantillas_informe ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura autenticada" ON public.plantillas_informe;
CREATE POLICY "Lectura autenticada" ON public.plantillas_informe
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.plantillas_informe TO authenticated;
GRANT ALL ON public.plantillas_informe TO service_role;

-- ─── Trazabilidad en las versiones oficiales del informe ───
ALTER TABLE public.informe_versiones
  ADD COLUMN IF NOT EXISTS plantilla_version_id UUID REFERENCES public.plantillas_informe(id);
