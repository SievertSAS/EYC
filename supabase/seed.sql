-- ============================================================
--  Seed LOCAL (solo para `supabase db reset` en Docker).
--  NUNCA ejecutar contra producción. Todos los datos son ficticios.
--
--  Usuarios (password: eyc-local-123):
--    coordinador@eyc.local  → cargo coordinador (admin, firma)
--    tecnico@eyc.local      → cargo tecnico (asignado a la visita)
--    programador@eyc.local  → cargo programador (admin)
--
--  Director Técnico (configuracion_informe, no es un usuario): ficticio, sin
--  firma (ver docs/entorno-local.md para subir una).
--
--  Escenario: un cliente ficticio con una sala de RX convencional (CR,
--  "Digitalizado") y una visita `en_progreso` con datos capturados de las
--  21 pruebas TECDOC, lista para generar el pre-informe. Valores con
--  decimales a propósito (#199) y ubicacion_fisica como oración (#197).
--
--  Las maestras de catálogo (rol_permisos, prueba_definiciones,
--  grupo_pruebas) NO se siembran: el cliente las crea en IndexedDB
--  (src/lib/db/seed.ts) y el pull no las borra si el servidor está vacío.
--  departamentos/municipios ya los inserta la migración 006.
-- ============================================================

-- ============================================================
--  0. Grants del Data API (solo local)
--  Las imágenes recientes de Supabase ya no dan SELECT/INSERT/UPDATE a
--  anon/authenticated sobre tablas nuevas de `public` (default privileges
--  "Dxtm"). Se asume que producción (proyecto anterior) ya los tiene —no
--  verificado—; se otorgan aquí para que PostgREST responda. RLS sigue aplicando.
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- ─── IDs fijos (legibles en Studio / psql) ───
-- auth/usuarios
--   a...01 coordinador · a...02 tecnico · a...03 programador
-- negocio
--   c...01 cliente · c...11/12 contactos · c...21 sede · c...31 ubicación
--   c...41 equipo · c...51 solicitud · c...61 visita

-- ============================================================
--  1. Auth: usuarios + identidades (email/password)
-- ============================================================

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
SELECT
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('eyc-local-123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('nombre', u.nombre), now(), now(),
  '', '', '', '', '', '', '', ''
FROM (VALUES
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'coordinador@eyc.local', 'Coordinadora Local'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'tecnico@eyc.local',     'Técnico Local'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'programador@eyc.local', 'Programador Local')
) AS u(id, email, nombre)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
SELECT
  gen_random_uuid(), u.id, u.id::text, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  now(), now(), now()
FROM auth.users u
WHERE u.email IN ('coordinador@eyc.local', 'tecnico@eyc.local', 'programador@eyc.local')
ON CONFLICT DO NOTHING;

-- ============================================================
--  2. usuarios (perfil de la app, vinculado por auth_uid)
-- ============================================================

-- firma_url queda NULL: es un path del bucket `evidencias` y el archivo no
-- se puede crear desde SQL (ver docs/entorno-local.md para subir uno).
INSERT INTO usuarios (id, auth_uid, nombre, cedula, cargo, email, telefono, activo, titulo_firma)
VALUES
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Coordinadora Local', '9000000001', 'coordinador', 'coordinador@eyc.local', '3000000001', true,
   'Física Médica — Licencia de prueba N.º 0000'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002',
   'Técnico Local', '9000000002', 'tecnico', 'tecnico@eyc.local', '3000000002', true, NULL),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003',
   'Programador Local', '9000000003', 'programador', 'programador@eyc.local', '3000000003', true, NULL)
ON CONFLICT (id) DO NOTHING;

-- Datos del Director Técnico que firma todos los informes (#194/#195). La fila
-- 'global' la crea la migración 044; aquí solo se le ponen datos ficticios.
INSERT INTO configuracion_informe (id, director_nombre, director_titulo)
VALUES ('global', 'Directora Técnica Ficticia', 'Directora Técnica — Licencia de prueba N.º 0001')
ON CONFLICT (id) DO UPDATE
  SET director_nombre = EXCLUDED.director_nombre, director_titulo = EXCLUDED.director_titulo;

-- ============================================================
--  3. Cliente, contactos, sede, ubicación (sala), equipo
-- ============================================================

INSERT INTO clientes (id, nombre_cliente, nombre_prestador, nit, digito_verificacion, naturaleza,
                      direccion, telefono, email, nombre_representante_legal)
VALUES
  ('c0000000-0000-4000-8000-000000000001', 'Clínica Ficticia de Pruebas S.A.S.',
   'IPS Ficticia de Pruebas', '900000001', '0', 'privado',
   'Calle Falsa 123', '6040000000', 'contacto@clinica-ficticia.test', 'Representante Ficticio')
ON CONFLICT (id) DO NOTHING;

INSERT INTO contactos (id, cliente_id, nombre, cargo, cedula, telefono, email, para_programar)
VALUES
  ('c0000000-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000001',
   'Persona Responsable Ficticia', 'responsable_visita', '8000000001', '3100000001',
   'responsable@clinica-ficticia.test', true),
  ('c0000000-0000-4000-8000-000000000012', 'c0000000-0000-4000-8000-000000000001',
   'Médico Ficticio', 'medico_responsable', '8000000002', '3100000002',
   'medico@clinica-ficticia.test', false)
ON CONFLICT (id) DO NOTHING;

-- Medellín (municipio 5001, departamento 5 — insertados por la migración 006)
INSERT INTO sedes (id, cliente_id, nombre_sede, direccion_sede, ciudad, departamento,
                   departamento_id, municipio_id, telefono, email)
VALUES
  ('c0000000-0000-4000-8000-000000000021', 'c0000000-0000-4000-8000-000000000001',
   'Sede Principal Ficticia', 'Carrera Imaginaria 45 # 67-89', 'Medellín', 'Antioquia',
   5, 5001, '6040000001', 'sede@clinica-ficticia.test')
ON CONFLICT (id) DO NOTHING;

-- #197: ubicacion_fisica escrita como oración completa terminada en punto.
-- Dimensiones con decimales (#199): 3.45 m.
INSERT INTO ubicaciones_rx (id, sede_id, nombre_servicio, licencia, fecha_expiracion_licencia,
                            codigo_habilitacion, horas_x_dia, ubicacion_fisica,
                            ancho_m, largo_m, alto_m, area_m2,
                            zona_a_desc, zona_b_desc, zona_c_desc, zona_d_desc,
                            piso_desc, techo_desc, sin_fecha_expiracion_licencia)
VALUES
  ('c0000000-0000-4000-8000-000000000031', 'c0000000-0000-4000-8000-000000000021',
   'Radiología Convencional', 'LIC-PRUEBA-0001', '2028-12-31', '0500000000-01', 12.5,
   'La sala se encuentra en el primer piso del bloque B, al final del pasillo de urgencias.',
   3.45, 4.25, 2.75, 14.66,
   'Pasillo de circulación de pacientes', 'Sala de espera', 'Consultorio contiguo',
   'Cuarto de control', 'Concreto de 15 cm', 'Losa de concreto de 12.5 cm', false)
ON CONFLICT (id) DO NOTHING;

-- Sistema "Digitalizado" (CR): así aplican también 2.14 y 2.15 (las 21 pruebas).
INSERT INTO equipos (id, ubicacion_id, tipo_equipo, planilla_espacial, sistema_adquisicion,
                     distancia_foco_paciente, bucky, gen_marca, gen_modelo, gen_numero_serie,
                     gen_fecha_fabricacion, gen_fase, filtracion_inherente_mmal,
                     filtracion_anadida_mmal, reporta_di, reporta_tei)
VALUES
  ('c0000000-0000-4000-8000-000000000041', 'c0000000-0000-4000-8000-000000000031',
   'CONVENCIONAL', false, 'Digitalizado', 100, 'Si', 'MarcaFicticia', 'Modelo RX-100',
   'SN-PRUEBA-0001', '2019-05', 'alta_frecuencia', 1.5, 1.0, true, true)
ON CONFLICT (id) DO NOTHING;

-- Valores base del equipo (visita del año anterior)
INSERT INTO conv_equipo_valores_base (id, equipo_id, pka_base, ei_base_29, di_base_29,
  mtf50_base_horizontal, mtf20_base_horizontal, mtf50_base_vertical, mtf20_base_vertical,
  mas_base_217, ei_base_217, di_base_217,
  mas_base_60kv, ei_base_60kv, di_base_60kv, mas_base_70kv, ei_base_70kv, di_base_70kv,
  mas_base_80kv, ei_base_80kv, di_base_80kv,
  mas_base_cu1, ei_base_cu1, di_base_cu1, mas_base_cu2, ei_base_cu2, di_base_cu2,
  mas_base_cu3, ei_base_cu3, di_base_cu3,
  dosis_base_extremidades_mgy, dosis_base_torax_mgy, dosis_base_columna_mgy)
VALUES
  ('c0000000-0000-4000-8000-000000000042', 'c0000000-0000-4000-8000-000000000041',
   1.05, 245.5, 0.2, 1.85, 2.95, 1.80, 2.90,
   0.25, 250.5, 0.1,
   0.45, 248.5, 0.15, 0.25, 250.5, 0.1,
   0.18, 252.5, 0.12,
   0.18, 252.5, 0.12, 0.35, 249.5, 0.08,
   0.65, 247.5, 0.05,
   0.0105, 0.0125, 0.0215)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
--  4. Solicitud + visita (en_progreso → pipeline "ejecucion")
-- ============================================================

INSERT INTO solicitudes (id, cliente_id, contacto_programar_id, ubicacion_id, tecnico_asignado_id,
                         tipo_servicio, pipeline_estado, forma_pago, pago_recibido,
                         fecha_solicitud, fecha_estimada_visita, fecha_real_visita, numero_solicitud)
VALUES
  ('c0000000-0000-4000-8000-000000000051', 'c0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000031',
   'b0000000-0000-4000-8000-000000000002', 'control_calidad', 'ejecucion', 'transferencia', false,
   current_date - 14, current_date - 1, current_date - 1, 'SOL-' || to_char(now(), 'YYYY') || '-001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO visitas (id, solicitud_id, equipo_id, ubicacion_id, tecnico_id, estado_visita,
                     dias_laborados_semana, pacientes_por_semana, radiografias_por_semana,
                     kv_maximo_usado, mas_maximo_usado, max_disparos_paciente, porcentaje_rechazo,
                     temperatura_c, presion_hpa, observaciones, fecha_visita)
VALUES
  ('c0000000-0000-4000-8000-000000000061', 'c0000000-0000-4000-8000-000000000051',
   'c0000000-0000-4000-8000-000000000041', 'c0000000-0000-4000-8000-000000000031',
   'b0000000-0000-4000-8000-000000000002', 'en_progreso',
   6, 120, 180, 90.5, 12.5, 3, 2.5, 22.5, 851.25,
   'Visita de prueba generada por seed local.', current_date - 1)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
--  5. Datos convencionales de la visita (21 pruebas TECDOC)
--     visita = c...61
-- ============================================================

-- ─── Grupo A · 2.1 Levantamiento radiométrico ───
INSERT INTO conv_levantamiento_setup (visita_id, fondo_natural_usv_h, distancia_tubo_operario_m,
  tecnica_kv, tecnica_ma, tecnica_tiempo_s, tecnica_mas, w_estimada, w_estandar, factor_uso_u,
  semanas_laborales, carga_trabajo_modo)
VALUES ('c0000000-0000-4000-8000-000000000061', 0.12, 2.5, 80, 12.5, 0.2, 2.5, 187.5, 250, 0.25,
        50, 'tipica');

-- dosis_anual_msv = (µSv/h / 1000) / 60 · T · U · W · semanas / I  (mismo cálculo que grupo-a-modulo)
INSERT INTO conv_mediciones (visita_id, punto_numero, ubicacion_descripcion, tasa_dosis_usv_h,
  tasa_dosis_msv_h, factor_ocupacion_t, factor_uso_u, carga_trabajo_w, corriente_prueba_i,
  tipo_area, dosis_anual_msv, concepto)
SELECT 'c0000000-0000-4000-8000-000000000061', p.n, p.descr, p.usv, p.usv / 1000, p.t, 0.25, 250,
       12.5, p.area, (p.usv / 1000) / 60 * p.t * 0.25 * 250 * 50 / 12.5, 'Conforme'
FROM (VALUES
  (1, 'Puesto del operador (cuarto de control)', 1.25, 1.0,   'controlada'),
  (2, 'Puerta de acceso de pacientes',           0.85, 0.25,  'supervisada'),
  (3, 'Pasillo de circulación',                  0.45, 0.125, 'supervisada'),
  (4, 'Consultorio contiguo',                    0.35, 1.0,   'supervisada')
) AS p(n, descr, usv, t, area);

-- ─── Grupo A · 2.2 Inspección visual ───
INSERT INTO conv_inspeccion_items (visita_id, seccion, item_numero, concepto, observacion)
SELECT 'c0000000-0000-4000-8000-000000000061', 'equipo', n, 'Conforme', NULL
FROM generate_series(1, 4) AS n;

INSERT INTO conv_inspeccion_items (visita_id, seccion, item_numero, concepto, observacion)
SELECT 'c0000000-0000-4000-8000-000000000061', 'condiciones_operacion', n,
       CASE WHEN n = 12 THEN 'No_aplica' ELSE 'Conforme' END, NULL
FROM generate_series(1, 12) AS n;

INSERT INTO conv_elementos_proteccion (visita_id, descripcion, cantidad, tipo_paciente, concepto, observacion)
VALUES
  ('c0000000-0000-4000-8000-000000000061', 'Delantal plomado 0.5 mm Pb', 2, 'adulto', 'Conforme', NULL),
  ('c0000000-0000-4000-8000-000000000061', 'Protector de tiroides 0.25 mm Pb', 1, 'pediatrico', 'Conforme', NULL);

-- ─── Grupo B · RaySafe (2.4, 2.5, 2.6, 2.7, 2.8, 2.21) ───
INSERT INTO conv_raysafe_setup (visita_id, distancia_foco_sensor_cm, distancia_foco_sensor_d1_cm,
  distancia_foco_detector_d2_cm, archivo_raysafe_nombre, unidad_dap, unidad_kerma)
VALUES ('c0000000-0000-4000-8000-000000000061', 100, 90.5, 100, NULL, 'mgy_cm2', 'mgy');

-- Principales: grupos 1-8 (mismo protocolo que GRUPOS_DISPAROS de grupo-b-modulo).
-- mA × t = mAs en cada fila.
INSERT INTO conv_raysafe_mediciones (visita_id, tipo_medicion, grupo_numero, toma_numero,
  kv_nominal, ma_nominal, tiempo_nominal_s, mas_nominal,
  kv_medido, tiempo_medido_s, dosis_medida_mgy, chr_medido_mmal)
SELECT 'c0000000-0000-4000-8000-000000000061', 'principal', r.g, r.toma,
       r.kv, r.ma, r.t, r.mas, r.kv_med, r.t_med, r.dosis, r.chr
FROM (VALUES
  -- g  toma  kV  mA     t      mAs   kV_med  t_med   dosis    CHR
  (1,  1,   60, 80,   0.125, 10,   59.5,  0.124,  0.285,  2.3),
  (1,  2,   60, 80,   0.125, 10,   59.75, 0.125,  0.2875, 2.3),
  (1,  3,   60, 80,   0.125, 10,   59.25, 0.126,  0.2825, 2.3),
  (2,  4,   80, 40,   0.125, 5,    79.5,  0.124,  0.2525, 3.15),
  (2,  5,   80, 40,   0.125, 5,    79.75, 0.125,  0.255,  3.15),
  (2,  6,   80, 40,   0.125, 5,    80.25, 0.126,  0.2575, 3.2),
  (3,  7,   80, 80,   0.125, 10,   79.5,  0.125,  0.505,  NULL),
  (3,  8,   80, 80,   0.125, 10,   79.75, 0.125,  0.5075, NULL),
  (3,  9,   80, 80,   0.125, 10,   80.0,  0.124,  0.5025, NULL),
  (4,  10,  80, 20,   0.125, 2.5,  79.5,  0.125,  0.1265, NULL),
  (4,  11,  80, 20,   0.125, 2.5,  79.75, 0.124,  0.1255, NULL),
  (4,  12,  80, 20,   0.125, 2.5,  80.0,  0.126,  0.127,  NULL),
  (5,  13,  80, 160,  0.125, 20,   79.5,  0.125,  1.0125, NULL),
  (5,  14,  80, 160,  0.125, 20,   79.75, 0.125,  1.015,  NULL),
  (5,  15,  80, 160,  0.125, 20,   80.0,  0.124,  1.01,   NULL),
  (6,  16,  90, 80,   0.125, 10,   89.5,  0.125,  0.6425, 3.45),
  (6,  17,  90, 80,   0.125, 10,   89.75, 0.126,  0.645,  3.45),
  (6,  18,  90, 80,   0.125, 10,   90.25, 0.124,  0.64,   3.5),
  (7,  19,  80, 80,   0.125, 10,   79.75, 0.125,  0.505,  NULL),
  (8,  20,  80, 80,   0.125, 10,   80.0,  0.125,  0.5075, NULL)
) AS r(g, toma, kv, ma, t, mas, kv_med, t_med, dosis, chr);

-- Programas clínicos: con rejilla / sin rejilla (2.21) / kerma (2.8)
INSERT INTO conv_raysafe_mediciones (visita_id, tipo_medicion, toma_numero, programa_clinico,
  kv_nominal, ma_nominal, tiempo_nominal_s, mas_nominal, kv_medido, tiempo_medido_s,
  dosis_medida_mgy, dosis_base_mgy, dap_nominal, ancho_irradiacion_cm, largo_irradiacion_cm,
  distancia_foco_sensor_cm, distancia_foco_detector_cm)
SELECT 'c0000000-0000-4000-8000-000000000061', r.tipo, r.toma, r.prog,
       r.kv, r.ma, r.t, r.mas, r.kv_med, r.t_med, r.dosis, r.base, r.dap, r.ancho, r.largo, r.d1, r.d2
FROM (VALUES
  ('con_rejilla', 21, 'Extremidad', 55, 100, 0.025, 2.5,  54.75, 0.025, 0.0425, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric),
  ('con_rejilla', 22, 'Tórax AP',   85, 200, 0.02,  4,    84.5,  0.02,  0.0525, NULL, NULL, NULL, NULL, NULL, NULL),
  ('con_rejilla', 23, 'Columna AP', 75, 250, 0.08,  20,   74.75, 0.081, 0.0875, NULL, NULL, NULL, NULL, NULL, NULL),
  -- dosis·(d1/d2)² ≈ base → 2.21 conforme (|dif| < 0.01 mGy)
  ('sin_rejilla', 24, 'Extremidad', 55, 100, 0.025, 2.5,  54.75, 0.025, 0.0128, 0.0105, NULL, NULL, NULL, NULL, NULL),
  ('sin_rejilla', 25, 'Tórax AP',   85, 200, 0.02,  4,    84.5,  0.02,  0.0153, 0.0125, NULL, NULL, NULL, NULL, NULL),
  ('sin_rejilla', 26, 'Columna AP', 75, 250, 0.08,  20,   74.75, 0.081, 0.0262, 0.0215, NULL, NULL, NULL, NULL, NULL),
  ('kerma',       27, 'Extremidad', 55, 100, 0.025, 2.5,  54.75, 0.025, 0.0625, NULL, 22.5,  18.5, 24.5, 100, 100),
  ('kerma',       28, 'Tórax AP',   85, 200, 0.02,  4,    84.5,  0.02,  0.1525, NULL, 95.25, 34.5, 28.5, 100, 100),
  ('kerma',       29, 'Columna AP', 75, 250, 0.08,  20,   74.75, 0.081, 0.6125, NULL, 195.5, 18.5, 43.5, 100, 100)
) AS r(tipo, toma, prog, kv, ma, t, mas, kv_med, t_med, dosis, base, dap, ancho, largo, d1, d2);

-- ─── Grupo C · CAE (2.17-2.20) — carga mAs con decimales (#199) ───
INSERT INTO conv_cae_setup (visita_id,
  mas_base_217, ei_base_217, di_base_217,
  mas_base_60kv, ei_base_60kv, di_base_60kv, mas_base_70kv, ei_base_70kv, di_base_70kv,
  mas_base_80kv, ei_base_80kv, di_base_80kv,
  mas_base_cu1, ei_base_cu1, di_base_cu1, mas_base_cu2, ei_base_cu2, di_base_cu2,
  mas_base_cu3, ei_base_cu3, di_base_cu3)
VALUES ('c0000000-0000-4000-8000-000000000061',
  0.25, 250.5, 0.1,
  0.45, 248.5, 0.15, 0.25, 250.5, 0.1,
  0.18, 252.5, 0.12,
  0.18, 252.5, 0.12, 0.35, 249.5, 0.08,
  0.65, 247.5, 0.05);

-- Tomas 1-15 (mismo protocolo que DISPAROS_CAE de grupo-c-modulo)
INSERT INTO conv_cae_mediciones (visita_id, toma_numero, kv_nominal, espesor_cu_mm, posicion_sensor,
  carga_mas, ei, di, tei, dap)
SELECT 'c0000000-0000-4000-8000-000000000061', c.toma, c.kv, c.cu, c.sensor, c.mas, c.ei, c.di, 250, c.dap
FROM (VALUES
  (1,  60, 1, 'Centro',             0.47,  247.5, 0.12, 1.25),
  (2,  70, 1, 'Izquierda',          0.26,  251.5, 0.11, 0.85),
  (3,  70, 1, 'Centro',             0.25,  250.5, 0.1,  0.82),
  (4,  70, 1, 'Derecha',            0.24,  249.5, 0.09, 0.8),
  (5,  70, 1, 'Izq + Der',          0.25,  252.25, 0.13, 0.83),
  (6,  70, 1, 'Izq + Centro',       0.26,  250.75, 0.1,  0.84),
  (7,  70, 1, 'Centro + Der',       0.25,  249.25, 0.08, 0.82),
  (8,  70, 1, 'Izq + Centro + Der', 0.25,  251.0, 0.11, 0.83),
  (9,  70, 1, 'Centro',             0.25,  250.25, 0.1,  0.82),
  (10, 70, 1, 'Centro',             0.26,  251.25, 0.11, 0.84),
  (11, 70, 1, 'Centro',             0.25,  249.75, 0.09, 0.82),
  (12, 70, 1, 'Centro',             0.25,  250.5, 0.1,  0.82),
  (13, 80, 1, 'Centro',             0.19,  253.5, 0.13, 0.75),
  (14, 80, 2, 'Centro',             0.36,  250.25, 0.09, 1.15),
  (15, 80, 3, 'Centro',             0.67,  246.75, 0.06, 1.95)
) AS c(toma, kv, cu, sensor, mas, ei, di, dap);

-- ─── Grupo D · DDI/EI (2.9, 2.10), cassettes (2.14), uniformidad CR (2.15) ───
INSERT INTO conv_ddi_mediciones (visita_id, grupo, toma_numero, serie_detector, kv_nominal,
  carga_mas, ei, di, tei, ei_base, di_base)
VALUES
  ('c0000000-0000-4000-8000-000000000061', 1, 1, 'IP-PRUEBA-01', 70, 2.5, 250.5, 0.21, 250, 245.5, 0.2),
  ('c0000000-0000-4000-8000-000000000061', 1, 2, 'IP-PRUEBA-01', 70, 2.5, 252.25, 0.22, 250, NULL, NULL),
  ('c0000000-0000-4000-8000-000000000061', 1, 3, 'IP-PRUEBA-01', 70, 2.5, 248.75, 0.19, 250, NULL, NULL);

INSERT INTO conv_cassette_inspeccion (visita_id, item_numero, serie_detector, integridad_externa,
  estado_interno, polvo_suciedad, rayones_defectos, limpieza_realizada, concepto, observacion)
VALUES
  ('c0000000-0000-4000-8000-000000000061', 1, 'IP-PRUEBA-01', 'Conforme', 'Conforme', 'Conforme',
   'Conforme', 'Conforme', 'Conforme', NULL),
  ('c0000000-0000-4000-8000-000000000061', 2, 'IP-PRUEBA-02', 'Conforme', 'Conforme', 'Conforme',
   'Conforme', 'Conforme', 'Conforme', 'Se realizó limpieza preventiva.');

INSERT INTO conv_uniformidad_cr (visita_id, item_numero, serie_cassette, carga_mas, ei, di, tei)
VALUES
  ('c0000000-0000-4000-8000-000000000061', 1, 'IP-PRUEBA-01', 2.5, 250.5, 0.1, 250),
  ('c0000000-0000-4000-8000-000000000061', 2, 'IP-PRUEBA-02', 2.5, 246.25, 0.05, 250),
  ('c0000000-0000-4000-8000-000000000061', 3, 'IP-PRUEBA-03', 2.5, 255.75, 0.15, 250);

-- ─── Grupo E · 2.3 colimación (#199: 9.0 vs 8.5, 7.0 vs 6.5; mAs 2.5, t 0.125 s) ───
INSERT INTO conv_colimacion (visita_id, sid_cm, tecnica_kv, tecnica_ma, tecnica_tiempo_s, tecnica_mas,
  anodo_nominal, anodo_medido, catodo_nominal, catodo_medido,
  izquierda_nominal, izquierda_medido, derecha_nominal, derecha_medido, posicion_esfera)
VALUES ('c0000000-0000-4000-8000-000000000061', 100, 60, 20, 0.125, 2.5,
        9.0, 8.5, 9.0, 9.4, 7.0, 6.5, 7.0, 7.3, 'Primer circulo');

-- ─── 2.11 uniformidad del detector (tolerancia CR 10%) ───
INSERT INTO conv_uniformidad_detector (visita_id, item_numero, serie_detector,
  roi_0_vmp_ac, roi_1_vmp_ac, roi_2_vmp_ac, roi_3_vmp_ac, roi_4_vmp_ac,
  roi_0_desv_ac, roi_1_desv_ac, roi_2_desv_ac, roi_3_desv_ac, roi_4_desv_ac,
  roi_0_vmp_ca, roi_1_vmp_ca, roi_2_vmp_ca, roi_3_vmp_ca, roi_4_vmp_ca,
  roi_0_desv_ca, roi_1_desv_ca, roi_2_desv_ca, roi_3_desv_ca, roi_4_desv_ca,
  tolerancia_pct, pixeles_defectuosos, artefactos, artefactos_descripcion)
VALUES ('c0000000-0000-4000-8000-000000000061', 1, 'IP-PRUEBA-01',
  512.4, 505.25, 518.75, 498.5, 520.1,
  12.25, 12.5, 13.1, 12.75, 12.4,
  510.6, 503.8, 516.2, 501.35, 519.45,
  12.1, 12.35, 12.9, 12.6, 12.55,
  10, false, false, NULL);

-- ─── 2.12 resolución (mA 12.5 · 0.2 s = 2.5 mAs) ───
INSERT INTO conv_resolucion (visita_id, sid_cm, tecnica_kv, tecnica_ma, tecnica_tiempo_s, tecnica_mas,
  pares_lineas_plmm, concepto)
VALUES ('c0000000-0000-4000-8000-000000000061', 100, 50, 12.5, 0.2, 2.5, 2.8, 'Conforme');

-- ─── 2.13 bajo contraste ───
INSERT INTO conv_bajo_contraste (visita_id, sid_cm, tecnica_kv, tecnica_ma, tecnica_tiempo_s,
  tecnica_mas, contraste_9_4, contraste_8_0, contraste_5_6, contraste_4_0, contraste_2_8,
  contraste_1_8, contraste_1_3, contraste_0_9, concepto, formato)
VALUES ('c0000000-0000-4000-8000-000000000061', 100, 70, 100, 0.025, 2.5,
        true, true, true, true, true, true, false, false, 'Conforme', 'contraste');

-- ─── 2.16 MTF ───
INSERT INTO conv_mtf (visita_id, distancia_foco_sensor_cm, tecnica_kv, tecnica_ma, tecnica_tiempo_s,
  tecnica_mas, pixel_size_mm, nyquist_lpmm, mtf50_horizontal, mtf20_horizontal, mtf50_vertical,
  mtf20_vertical, mtf50_base_horizontal, mtf20_base_horizontal, mtf50_base_vertical,
  mtf20_base_vertical, concepto)
VALUES ('c0000000-0000-4000-8000-000000000061', 150, 70, 200, 0.05, 10, 0.1, 5,
        1.82, 2.91, 1.78, 2.87, 1.85, 2.95, 1.80, 2.90, 'Conforme');

-- ─── Pre-informe: 21 secciones incluidas (orden = CATALOGO_SECCIONES) ───
INSERT INTO conv_informe_secciones (visita_id, prueba_codigo, orden, incluida)
SELECT 'c0000000-0000-4000-8000-000000000061', '2.' || n, n, true
FROM generate_series(1, 21) AS n;
