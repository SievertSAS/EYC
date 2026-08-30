-- ============================================================
--  018 — Bucket de Storage `evidencias` + políticas
--
--  Contexto (issue #67): las imágenes capturadas (plano radiométrico,
--  avisos de protección, fotos de equipo, elementos de protección)
--  vivían solo como `blob_local` en IndexedDB y nunca llegaban al
--  servidor. El motor de sync ahora las sube a este bucket en el push
--  y guarda el PATH en `conv_evidencias.url_storage` / `evidencias.url_storage`.
--
--  Ruta: {visita_id}/{prueba_codigo}/{slot}.jpg  (una carpeta por visita).
--
--  Bucket PRIVADO: se muestran con signed URLs (createSignedUrl, 1h).
--  Acceso: cualquier usuario autenticado del staff (mismo modelo que las
--  tablas de sync — ver 017). Idempotente. Correr en Supabase → SQL Editor.
-- ============================================================

-- 1. El bucket (privado). `on conflict` lo deja idempotente.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evidencias',
  'evidencias',
  false,
  15728640,                       -- 15 MB por archivo
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Políticas RLS sobre storage.objects, acotadas al bucket `evidencias`
--    y al rol `authenticated`.
DROP POLICY IF EXISTS "evidencias_auth_select" ON storage.objects;
CREATE POLICY "evidencias_auth_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'evidencias');

DROP POLICY IF EXISTS "evidencias_auth_insert" ON storage.objects;
CREATE POLICY "evidencias_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'evidencias');

DROP POLICY IF EXISTS "evidencias_auth_update" ON storage.objects;
CREATE POLICY "evidencias_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'evidencias')
  WITH CHECK (bucket_id = 'evidencias');

DROP POLICY IF EXISTS "evidencias_auth_delete" ON storage.objects;
CREATE POLICY "evidencias_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'evidencias');
