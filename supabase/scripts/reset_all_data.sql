-- ============================================================
--  Script: Reset de todos los datos de negocio
--
--  Borra TODOS los registros en orden hijo→padre para respetar FKs.
--  Ejecutar en SQL Editor de Supabase cuando se requiera un entorno limpio.
--
--  NO borra: usuarios, rol_permisos, departamentos, municipios,
--             prueba_definiciones, grupo_pruebas
--
--  USAR CON PRECAUCIÓN — acción irreversible.
-- ============================================================

TRUNCATE TABLE
  -- Conv (campo convencional)
  conv_evidencias,
  conv_resultados_prueba,
  conv_informe_secciones,
  conv_mtf,
  conv_bajo_contraste,
  conv_resolucion,
  conv_uniformidad_detector,
  conv_colimacion,
  conv_uniformidad_cr,
  conv_cassette_inspeccion,
  conv_ddi_mediciones,
  conv_cae_mediciones,
  conv_cae_setup,
  conv_raysafe_mediciones,
  conv_raysafe_setup,
  conv_elementos_proteccion,
  conv_inspeccion_items,
  conv_mediciones,
  conv_levantamiento_setup,
  -- Campo general
  change_logs,
  informe_versiones,
  informes,
  evidencias,
  elementos_proteccion,
  mediciones_radiometricas,
  prueba_resultados,
  grupo_resultados,
  visitas,
  solicitudes,
  cotizaciones,
  -- Equipos y maestros
  partes_equipo,
  valores_referencia,
  equipo_movimientos,
  equipo_identificaciones,
  tubos,
  colimadores,
  gantry,
  sala_dimensiones,
  equipos,
  ubicaciones_rx,
  contactos,
  sedes,
  clientes
RESTART IDENTITY CASCADE;
