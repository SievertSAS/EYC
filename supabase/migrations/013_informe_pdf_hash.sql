-- ============================================================
-- Migración 013: fingerprint del PDF oficial para verificación por QR
-- qr_token/qr_url (informes) y pdf_url (informe_versiones) ya existían;
-- solo falta el hash SHA-256 para poder detectar manipulaciones.
-- ============================================================

ALTER TABLE informe_versiones
  ADD COLUMN IF NOT EXISTS pdf_hash TEXT;
