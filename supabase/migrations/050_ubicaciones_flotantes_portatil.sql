-- ============================================================
--  050 — Ubicaciones del portátil: sala fija o áreas flotantes (#188)
--
--  El CONVENCIONAL portátil (`equipos.tipo_instalacion = 'portatil'`, 049)
--  se evalúa en UNA sala fija (con barreras: usa `visitas.ubicacion_id`,
--  igual que el fijo) o en un grupo de áreas FLOTANTES (control solo
--  administrativo) elegidas de un catálogo compartido. Un informe = una
--  visita, y nunca mezcla las dos categorías.
--
--  1. `visitas.categoria_ubicacion` ('fija' | 'flotante', NULL = sin definir)
--     y `visitas.ubicaciones_flotantes` (jsonb: array de NOMBRES). Se guardan
--     nombres y no ids: instantánea de lo evaluado (si el catálogo se renombra
--     después, el informe emitido no cambia) y sin dependencia del orden de
--     sync del catálogo. Las escrituras siguen las políticas existentes de
--     `visitas` ("Insertar visitas" / "Actualizar visitas": técnico de la
--     visita o is_admin()).
--  2. `catalogo_ubicaciones_flotantes`: tabla de SYNC bidireccional (no
--     maestra) — el técnico agrega entradas con "Otro" también sin conexión y
--     el push (upsert on_conflict=id) las sube después.
--     RLS: SELECT autenticados; INSERT técnico/programador/coordinador activo
--     (a su nombre); renombrar/desactivar/borrar suave solo coordinador;
--     DELETE físico solo coordinador (RESTRICTIVE, patrón de la 048).
--
--  Pendiente del físico (no cambia nada aquí): si para flotante se omite la
--  tabla de zonas A–D de la 2.2.4, si T = 1 / U = 1, y lecturas con/sin EPP
--  (#191).
--
--  Idempotente.
-- ============================================================

-- ─── 1. Visitas ──────────────────────────────────────────────

ALTER TABLE public.visitas
  ADD COLUMN IF NOT EXISTS categoria_ubicacion text,
  ADD COLUMN IF NOT EXISTS ubicaciones_flotantes jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'visitas_categoria_ubicacion_check'
      AND conrelid = 'public.visitas'::regclass
  ) THEN
    ALTER TABLE public.visitas
      ADD CONSTRAINT visitas_categoria_ubicacion_check
      CHECK (categoria_ubicacion IS NULL OR categoria_ubicacion IN ('fija', 'flotante'));
  END IF;

  -- Nunca se mezclan: solo una visita flotante tiene lista de áreas.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'visitas_ubicaciones_flotantes_check'
      AND conrelid = 'public.visitas'::regclass
  ) THEN
    ALTER TABLE public.visitas
      ADD CONSTRAINT visitas_ubicaciones_flotantes_check
      CHECK (
        ubicaciones_flotantes IS NULL
        OR (
          categoria_ubicacion = 'flotante'
          AND jsonb_typeof(ubicaciones_flotantes) = 'array'
        )
      );
  END IF;
END $$;

-- ─── 2. Catálogo de ubicaciones flotantes ───────────────────

-- Clave de comparación: sin tildes, minúsculas, espacios simples. Debe
-- coincidir con `normalizarNombreUbicacion` (src/lib/ubicaciones/flotantes.ts).
-- `translate` antes de `lower` para no depender de la collation.
CREATE OR REPLACE FUNCTION public.normalizar_nombre_ubicacion(p_nombre text)
RETURNS text AS $$
  SELECT btrim(regexp_replace(lower(translate(
    p_nombre,
    'ÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇáàäâãéèëêíìïîóòöôõúùüûñç',
    'AAAAAEEEEIIIIOOOOOUUUUNCaaaaaeeeeiiiiooooouuuunc'
  )), '\s+', ' ', 'g'))
$$ LANGUAGE sql IMMUTABLE;

CREATE TABLE IF NOT EXISTS public.catalogo_ubicaciones_flotantes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT NOT NULL CHECK (length(btrim(nombre)) BETWEEN 1 AND 120),
  activo        BOOLEAN NOT NULL DEFAULT true,
  creado_por    UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

-- Único sin distinguir mayúsculas ni tildes (entre las no borradas).
CREATE UNIQUE INDEX IF NOT EXISTS catalogo_ubicaciones_flotantes_nombre_unico
  ON public.catalogo_ubicaciones_flotantes (public.normalizar_nombre_ubicacion(nombre))
  WHERE deleted_at IS NULL;

-- last_modified (watermark del pull), igual que el resto de tablas (016).
DROP TRIGGER IF EXISTS trg_catalogo_ubicaciones_flotantes_modified
  ON public.catalogo_ubicaciones_flotantes;
CREATE TRIGGER trg_catalogo_ubicaciones_flotantes_modified
  BEFORE INSERT OR UPDATE ON public.catalogo_ubicaciones_flotantes
  FOR EACH ROW EXECUTE FUNCTION update_last_modified();

-- Dos técnicos sin conexión pueden crear el mismo nombre con ids distintos.
-- El segundo INSERT se descarta en silencio (RETURN NULL) en vez de fallar
-- con 23505: si fallara, la fila quedaría reintentando para siempre en el
-- dispositivo. La visita guarda nombres, así que no pierde nada; el cliente
-- deduplica el catálogo local por nombre normalizado. El índice único sigue
-- siendo la red para inserciones simultáneas.
CREATE OR REPLACE FUNCTION public.catalogo_ubicaciones_flotantes_dedupe()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS NULL AND EXISTS (
    SELECT 1 FROM public.catalogo_ubicaciones_flotantes c
    WHERE c.id <> NEW.id
      AND c.deleted_at IS NULL
      AND public.normalizar_nombre_ubicacion(c.nombre)
        = public.normalizar_nombre_ubicacion(NEW.nombre)
  ) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_catalogo_ubicaciones_flotantes_dedupe
  ON public.catalogo_ubicaciones_flotantes;
CREATE TRIGGER trg_catalogo_ubicaciones_flotantes_dedupe
  BEFORE INSERT ON public.catalogo_ubicaciones_flotantes
  FOR EACH ROW EXECUTE FUNCTION public.catalogo_ubicaciones_flotantes_dedupe();

-- El push del sync es un upsert: re-subir una entrada propia que ya llegó al
-- servidor toma el camino de UPDATE. Por eso el creador tiene política de
-- UPDATE sobre SUS filas, y este trigger impide que alguien que no sea
-- coordinador cambie el contenido (renombrar, desactivar o borrar suave).
-- Sin JWT de usuario (service role / SQL Editor) no aplica.
CREATE OR REPLACE FUNCTION public.catalogo_ubicaciones_flotantes_solo_coordinador()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_coordinador() THEN
    RETURN NEW;
  END IF;
  IF NEW.nombre IS DISTINCT FROM OLD.nombre
     OR NEW.activo IS DISTINCT FROM OLD.activo
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
     OR NEW.creado_por IS DISTINCT FROM OLD.creado_por THEN
    RAISE EXCEPTION 'Solo el coordinador puede renombrar o desactivar ubicaciones del catálogo'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_catalogo_ubicaciones_flotantes_solo_coordinador
  ON public.catalogo_ubicaciones_flotantes;
CREATE TRIGGER trg_catalogo_ubicaciones_flotantes_solo_coordinador
  BEFORE UPDATE ON public.catalogo_ubicaciones_flotantes
  FOR EACH ROW EXECUTE FUNCTION public.catalogo_ubicaciones_flotantes_solo_coordinador();

-- ─── 3. RLS del catálogo ─────────────────────────────────────

ALTER TABLE public.catalogo_ubicaciones_flotantes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura autenticada" ON public.catalogo_ubicaciones_flotantes;
CREATE POLICY "Lectura autenticada" ON public.catalogo_ubicaciones_flotantes
  FOR SELECT TO authenticated USING (true);

-- "Otro": técnico, programador o coordinador activo, a su propio nombre.
DROP POLICY IF EXISTS "catalogo_ubicaciones_flotantes_insert"
  ON public.catalogo_ubicaciones_flotantes;
CREATE POLICY "catalogo_ubicaciones_flotantes_insert" ON public.catalogo_ubicaciones_flotantes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_coordinador()
    OR (
      public.tiene_cargo(ARRAY['tecnico', 'programador'])
      AND creado_por = public.get_usuario_id()
    )
  );

-- Coordinador: todo. Creador: solo el re-push idempotente de su fila (el
-- trigger de arriba rechaza cualquier cambio de contenido).
DROP POLICY IF EXISTS "catalogo_ubicaciones_flotantes_update"
  ON public.catalogo_ubicaciones_flotantes;
CREATE POLICY "catalogo_ubicaciones_flotantes_update" ON public.catalogo_ubicaciones_flotantes
  FOR UPDATE TO authenticated
  USING (
    public.is_coordinador()
    OR (
      public.tiene_cargo(ARRAY['tecnico', 'programador'])
      AND creado_por = public.get_usuario_id()
    )
  )
  WITH CHECK (
    public.is_coordinador()
    OR (
      public.tiene_cargo(ARRAY['tecnico', 'programador'])
      AND creado_por = public.get_usuario_id()
    )
  );

DROP POLICY IF EXISTS "catalogo_ubicaciones_flotantes_coordinador_delete"
  ON public.catalogo_ubicaciones_flotantes;
CREATE POLICY "catalogo_ubicaciones_flotantes_coordinador_delete"
  ON public.catalogo_ubicaciones_flotantes
  FOR DELETE TO authenticated USING (public.is_coordinador());

DROP POLICY IF EXISTS "catalogo_ubicaciones_flotantes_delete_solo_coordinador"
  ON public.catalogo_ubicaciones_flotantes;
CREATE POLICY "catalogo_ubicaciones_flotantes_delete_solo_coordinador"
  ON public.catalogo_ubicaciones_flotantes
  AS RESTRICTIVE FOR DELETE TO authenticated USING (public.is_coordinador());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogo_ubicaciones_flotantes TO authenticated;
GRANT ALL ON public.catalogo_ubicaciones_flotantes TO service_role;

-- ─── 4. Catálogo inicial ─────────────────────────────────────
--  Lista común provisional: el físico enviará la lista definitiva (extraída
--  de informes portátiles anteriores). Idempotente: el índice único y el
--  trigger de dedupe evitan duplicados al re-ejecutar.
INSERT INTO public.catalogo_ubicaciones_flotantes (nombre)
SELECT n FROM unnest(ARRAY[
  'UCI adultos',
  'UCI pediátrica',
  'UCI neonatal',
  'Reanimación',
  'Recuperación',
  'Urgencias',
  'Hospitalización',
  'Observación'
]) AS n
ON CONFLICT DO NOTHING;
