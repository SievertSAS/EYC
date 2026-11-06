-- ============================================================
--  044 — Configuración global del informe: Director Técnico (#194/#195)
--
--  El Director Técnico NO es un usuario de la app: es un dato global del
--  informe que edita el coordinador en Configuración → Informe. Su nombre,
--  título y firma salen en el bloque "Responsable Sievert S.A.S." de todos
--  los informes (pre-informe y versión oficial).
--
--  Tabla de UNA sola fila (id = 'global'). La firma es un path del bucket
--  `evidencias`, igual que `usuarios.firma_url` (#109).
--
--  RLS: lectura para autenticados (el cliente la baja como tabla maestra);
--  NINGUNA política de escritura → solo el service role escribe, desde
--  /api/configuracion-informe (gate: cargo = 'coordinador').
-- ============================================================

CREATE TABLE IF NOT EXISTS public.configuracion_informe (
  id                 TEXT PRIMARY KEY DEFAULT 'global' CHECK (id = 'global'),
  director_nombre    TEXT CHECK (director_nombre IS NULL OR length(director_nombre) <= 150),
  director_titulo    TEXT CHECK (director_titulo IS NULL OR length(director_titulo) <= 150),
  director_firma_url TEXT,
  actualizado_por    UUID REFERENCES public.usuarios(id),
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_modified      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- last_modified (watermark del pull), igual que el resto de tablas (016/039)
DROP TRIGGER IF EXISTS trg_configuracion_informe_modified ON public.configuracion_informe;
CREATE TRIGGER trg_configuracion_informe_modified
  BEFORE INSERT OR UPDATE ON public.configuracion_informe
  FOR EACH ROW EXECUTE FUNCTION update_last_modified();

ALTER TABLE public.configuracion_informe ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura autenticada" ON public.configuracion_informe;
CREATE POLICY "Lectura autenticada" ON public.configuracion_informe
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.configuracion_informe TO authenticated;
GRANT ALL ON public.configuracion_informe TO service_role;

-- La fila única existe desde el inicio (vacía → el PDF imprime el renglón
-- genérico "Director Técnico", como antes).
INSERT INTO public.configuracion_informe (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;
