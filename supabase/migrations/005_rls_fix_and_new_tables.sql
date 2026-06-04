-- ============================================================
--  Migración 005: Corregir RLS + cubrir tablas nuevas
--
--  1. Agregar RLS a grupo_pruebas y grupo_resultados
--  2. Agregar INSERT policy a visitas para técnicos (sync push)
--  3. Agregar INSERT policy a tablas de campo para técnicos
--  4. Permitir a técnicos escribir solicitudes asignadas a ellos
-- ============================================================

-- ─── grupo_pruebas (catálogo — read-only para no-admin) ───

CREATE TABLE IF NOT EXISTS grupo_pruebas (
  id              BIGSERIAL PRIMARY KEY,
  codigo          TEXT NOT NULL UNIQUE,
  nombre          TEXT NOT NULL,
  tipo_equipo     TEXT NOT NULL,
  orden           INT NOT NULL DEFAULT 0,
  schema_mediciones JSONB NOT NULL DEFAULT '{"columnas":[]}',
  slots_imagen    JSONB NOT NULL DEFAULT '[]',
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE grupo_pruebas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura autenticada" ON grupo_pruebas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Escritura admin" ON grupo_pruebas
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── grupo_resultados (datos de campo — sync bidireccional) ───

CREATE TABLE IF NOT EXISTS grupo_resultados (
  id                BIGSERIAL PRIMARY KEY,
  visita_id         BIGINT NOT NULL REFERENCES visitas(id) ON DELETE CASCADE,
  grupo_id          BIGINT NOT NULL REFERENCES grupo_pruebas(id),
  equipo_id         BIGINT NOT NULL REFERENCES equipos(id),
  mediciones_json   JSONB NOT NULL DEFAULT '[]',
  imagenes          JSONB NOT NULL DEFAULT '[]',
  completado        BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_ejecucion   DATE,
  last_modified     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grupo_resultados_visita ON grupo_resultados(visita_id);

ALTER TABLE grupo_resultados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura autenticada" ON grupo_resultados
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Escritura grupo_resultados propio" ON grupo_resultados
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM visitas
      WHERE visitas.id = grupo_resultados.visita_id
        AND (visitas.tecnico_id = public.get_usuario_id() OR public.is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM visitas
      WHERE visitas.id = grupo_resultados.visita_id
        AND (visitas.tecnico_id = public.get_usuario_id() OR public.is_admin())
    )
  );

-- ─── Corregir: técnicos deben poder INSERT en visitas (sync push) ───
-- La policy "Insertar visitas admin" de 002 solo permite admin.
-- Agregar policy para que técnicos puedan insertar sus propias visitas.

DROP POLICY IF EXISTS "Insertar visitas admin" ON visitas;

CREATE POLICY "Insertar visitas" ON visitas
  FOR INSERT TO authenticated
  WITH CHECK (
    tecnico_id = public.get_usuario_id() OR public.is_admin()
  );

-- ─── Corregir: técnicos deben poder INSERT en tablas de campo (sync push) ───

-- prueba_resultados: agregar WITH CHECK para INSERT
DROP POLICY IF EXISTS "Escritura pruebas propio" ON prueba_resultados;

CREATE POLICY "Escritura pruebas propio" ON prueba_resultados
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM visitas WHERE visitas.id = prueba_resultados.visita_id
            AND (visitas.tecnico_id = public.get_usuario_id() OR public.is_admin()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM visitas WHERE visitas.id = prueba_resultados.visita_id
            AND (visitas.tecnico_id = public.get_usuario_id() OR public.is_admin()))
  );

-- mediciones_radiometricas
DROP POLICY IF EXISTS "Escritura mediciones propio" ON mediciones_radiometricas;

CREATE POLICY "Escritura mediciones propio" ON mediciones_radiometricas
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM visitas WHERE visitas.id = mediciones_radiometricas.visita_id
            AND (visitas.tecnico_id = public.get_usuario_id() OR public.is_admin()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM visitas WHERE visitas.id = mediciones_radiometricas.visita_id
            AND (visitas.tecnico_id = public.get_usuario_id() OR public.is_admin()))
  );

-- evidencias
DROP POLICY IF EXISTS "Escritura evidencias propio" ON evidencias;

CREATE POLICY "Escritura evidencias propio" ON evidencias
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM visitas WHERE visitas.id = evidencias.visita_id
            AND (visitas.tecnico_id = public.get_usuario_id() OR public.is_admin()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM visitas WHERE visitas.id = evidencias.visita_id
            AND (visitas.tecnico_id = public.get_usuario_id() OR public.is_admin()))
  );

-- elementos_proteccion
DROP POLICY IF EXISTS "Escritura elementos propio" ON elementos_proteccion;

CREATE POLICY "Escritura elementos propio" ON elementos_proteccion
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM visitas WHERE visitas.id = elementos_proteccion.visita_id
            AND (visitas.tecnico_id = public.get_usuario_id() OR public.is_admin()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM visitas WHERE visitas.id = elementos_proteccion.visita_id
            AND (visitas.tecnico_id = public.get_usuario_id() OR public.is_admin()))
  );

-- ─── Solicitudes: técnico asignado puede actualizar (sync push) ───

CREATE POLICY "Escritura solicitudes tecnico asignado" ON solicitudes
  FOR UPDATE TO authenticated
  USING (tecnico_asignado_id = public.get_usuario_id());

-- ─── Trigger last_modified para grupo_resultados ───

CREATE TRIGGER trg_grupo_resultados_modified BEFORE UPDATE ON grupo_resultados
  FOR EACH ROW EXECUTE FUNCTION update_last_modified();

-- ─── Agregar columnas sync-related si no existen ───
-- (grupo_resultados ya se creó arriba con last_modified)

-- Actualizar prueba_definiciones para soportar grupos
ALTER TABLE prueba_definiciones ADD COLUMN IF NOT EXISTS grupo_id BIGINT REFERENCES grupo_pruebas(id);
ALTER TABLE prueba_definiciones ADD COLUMN IF NOT EXISTS orden_en_grupo INT;
ALTER TABLE prueba_definiciones ADD COLUMN IF NOT EXISTS formulas JSONB;
ALTER TABLE prueba_definiciones ADD COLUMN IF NOT EXISTS criterios_aceptacion JSONB;
ALTER TABLE prueba_definiciones ADD COLUMN IF NOT EXISTS textos_informe JSONB;
ALTER TABLE prueba_definiciones ADD COLUMN IF NOT EXISTS slots_imagen JSONB;
ALTER TABLE prueba_definiciones ADD COLUMN IF NOT EXISTS numero_tecdoc TEXT;

-- Actualizar prueba_resultados para soportar grupos
ALTER TABLE prueba_resultados ADD COLUMN IF NOT EXISTS grupo_resultado_id BIGINT REFERENCES grupo_resultados(id);
ALTER TABLE prueba_resultados ADD COLUMN IF NOT EXISTS resultados_calculados JSONB;
ALTER TABLE prueba_resultados ADD COLUMN IF NOT EXISTS evaluacion_criterios JSONB;
ALTER TABLE prueba_resultados ADD COLUMN IF NOT EXISTS imagenes JSONB;
