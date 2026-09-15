-- ============================================================
--  035 — Corrige el typo 81kv → 80kv en conv_cae_setup (#110)
--
--  El tercer punto de la prueba 2.20 (compensación por kVp) se dispara
--  y compara realmente a 80 kVp, no a 81 kVp — verificado contra la
--  plantilla de trabajo real del cliente (hoja "2.17,18,19,20" de su
--  Excel de campo, donde las 3 tomas de esta sub-prueba son 60/70/80).
--  Renombra las columnas para que el nombre coincida con el valor real.
--  Los datos existentes (si los hay) se conservan bajo el nuevo nombre.
--  Idempotente.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conv_cae_setup' AND column_name = 'mas_base_81kv'
  ) THEN
    ALTER TABLE public.conv_cae_setup RENAME COLUMN mas_base_81kv TO mas_base_80kv;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conv_cae_setup' AND column_name = 'ei_base_81kv'
  ) THEN
    ALTER TABLE public.conv_cae_setup RENAME COLUMN ei_base_81kv TO ei_base_80kv;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conv_cae_setup' AND column_name = 'di_base_81kv'
  ) THEN
    ALTER TABLE public.conv_cae_setup RENAME COLUMN di_base_81kv TO di_base_80kv;
  END IF;
END $$;
