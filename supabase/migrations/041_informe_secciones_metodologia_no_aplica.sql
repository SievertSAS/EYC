-- ============================================================
--  041 — `conv_informe_secciones.metodologia_no_aplica`
--
--  Necesidad de negocio: cuando una prueba se marca como "No aplica", el
--  informe debe explicar el motivo en la subsección Metodología, en lugar de
--  imprimir la metodología del catálogo. El físico puede editar ese motivo
--  desde el pre-informe. `NULL` = sin texto propio: se imprime el motivo
--  predeterminado de la prueba (`metodologiaNoAplica` del catálogo).
--
--  No se reutiliza `observaciones` (texto del Análisis) ni
--  `acciones_correctivas`: si la prueba se vuelve a activar, el motivo
--  aparecería como Análisis o como acción correctiva.
--
--  Debe ejecutarse ANTES de desplegar el código que escribe la columna: sin
--  ella, el push de la sección editada falla. Es aditiva, no modifica datos
--  ni políticas RLS.
--
--  Idempotente.
-- ============================================================

ALTER TABLE public.conv_informe_secciones
  ADD COLUMN IF NOT EXISTS metodologia_no_aplica text;
