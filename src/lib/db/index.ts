import Dexie, { type EntityTable } from "dexie";
import type {
  Cliente,
  Contacto,
  Sede,
  Departamento,
  Municipio,
  UbicacionRx,
  Equipo,
  EquipoMovimiento,
  Tubo,
  Colimador,
  Gantry,
  EquipoIdentificacion,
  SalaDimensiones,
  ParteEquipo,
  ValoresReferencia,
  Usuario,
  RolPermiso,
  Cotizacion,
  Solicitud,
  VisitaEjecucion,
  GrupoPrueba,
  GrupoResultado,
  PruebaDefinicion,
  PruebaResultado,
  MedicionRadiometrica,
  EvidenciaFotografica,
  ElementoProteccion,
  Informe,
  InformeVersion,
  ChangeLog,
  SyncMeta,
  SyncRetry,
} from "./types";
import type {
  ConvLevantamientoSetup,
  ConvMedicionRadiometrica,
  ConvInspeccionItem,
  ConvElementoProteccion,
  ConvRaysafeSetup,
  ConvRaysafeMedicion,
  ConvCaeSetup,
  ConvCaeMedicion,
  ConvDdiMedicion,
  ConvCassetteInspeccion,
  ConvUniformidadCr,
  ConvColimacion,
  ConvUniformidadDetector,
  ConvResolucion,
  ConvBajoContraste,
  ConvMtf,
  ConvInformeSeccion,
  ConvResultadoPrueba,
  ConvEvidencia,
} from "@/lib/equipos/convencional/db/types";

class EyCDatabase extends Dexie {
  clientes!: EntityTable<Cliente, "id">;
  contactos!: EntityTable<Contacto, "id">;
  sedes!: EntityTable<Sede, "id">;
  departamentos!: EntityTable<Departamento, "id">;
  municipios!: EntityTable<Municipio, "id">;
  ubicaciones_rx!: EntityTable<UbicacionRx, "id">;
  equipos!: EntityTable<Equipo, "id">;
  equipo_movimientos!: EntityTable<EquipoMovimiento, "id">;
  tubos!: EntityTable<Tubo, "id">;
  colimadores!: EntityTable<Colimador, "id">;
  gantry!: EntityTable<Gantry, "id">;
  equipo_identificaciones!: EntityTable<EquipoIdentificacion, "id">;
  sala_dimensiones!: EntityTable<SalaDimensiones, "id">;
  partes_equipo!: EntityTable<ParteEquipo, "id">;
  valores_referencia!: EntityTable<ValoresReferencia, "id">;
  usuarios!: EntityTable<Usuario, "id">;
  rol_permisos!: EntityTable<RolPermiso, "id">;
  cotizaciones!: EntityTable<Cotizacion, "id">;
  solicitudes!: EntityTable<Solicitud, "id">;
  prueba_definiciones!: EntityTable<PruebaDefinicion, "id">;
  grupo_pruebas!: EntityTable<GrupoPrueba, "id">;
  grupo_resultados!: EntityTable<GrupoResultado, "id">;
  visitas!: EntityTable<VisitaEjecucion, "id">;
  prueba_resultados!: EntityTable<PruebaResultado, "id">;
  mediciones_radiometricas!: EntityTable<MedicionRadiometrica, "id">;
  evidencias!: EntityTable<EvidenciaFotografica, "id">;
  elementos_proteccion!: EntityTable<ElementoProteccion, "id">;
  informes!: EntityTable<Informe, "id">;
  informe_versiones!: EntityTable<InformeVersion, "id">;
  change_logs!: EntityTable<ChangeLog, "id">;
  sync_meta!: EntityTable<SyncMeta, "table_name">;
  /** Clave compuesta `[table_name+record_id]` — Dexie no soporta EntityTable con PK compuesta */
  sync_retry!: Dexie.Table<SyncRetry, [string, string]>;

  // ─── Convencional (tablas dedicadas) ───
  conv_levantamiento_setup!: EntityTable<ConvLevantamientoSetup, "id">;
  conv_mediciones!: EntityTable<ConvMedicionRadiometrica, "id">;
  conv_inspeccion_items!: EntityTable<ConvInspeccionItem, "id">;
  conv_elementos_proteccion!: EntityTable<ConvElementoProteccion, "id">;
  conv_raysafe_setup!: EntityTable<ConvRaysafeSetup, "id">;
  conv_raysafe_mediciones!: EntityTable<ConvRaysafeMedicion, "id">;
  conv_cae_setup!: EntityTable<ConvCaeSetup, "id">;
  conv_cae_mediciones!: EntityTable<ConvCaeMedicion, "id">;
  conv_ddi_mediciones!: EntityTable<ConvDdiMedicion, "id">;
  conv_cassette_inspeccion!: EntityTable<ConvCassetteInspeccion, "id">;
  conv_uniformidad_cr!: EntityTable<ConvUniformidadCr, "id">;
  conv_colimacion!: EntityTable<ConvColimacion, "id">;
  conv_uniformidad_detector!: EntityTable<ConvUniformidadDetector, "id">;
  conv_resolucion!: EntityTable<ConvResolucion, "id">;
  conv_bajo_contraste!: EntityTable<ConvBajoContraste, "id">;
  conv_mtf!: EntityTable<ConvMtf, "id">;
  conv_informe_secciones!: EntityTable<ConvInformeSeccion, "id">;
  conv_resultados_prueba!: EntityTable<ConvResultadoPrueba, "id">;
  conv_evidencias!: EntityTable<ConvEvidencia, "id">;

  constructor() {
    super("SievertEyC");

    // ─────────────────────────────────────────────────────────────
    //  v1-v12: historial de versiones anteriores — NO MODIFICAR
    //  (Dexie requiere que todas las versiones previas estén presentes)
    // ─────────────────────────────────────────────────────────────

    this.version(1).stores({
      clientes: "++id, nit, nombre_cliente",
      contactos: "++id, cliente_id, cargo",
      sedes: "++id, cliente_id",
      ubicaciones_rx: "++id, sede_id",
      equipos: "++id, ubicacion_id, tipo_equipo",
      equipo_movimientos: "++id, equipo_id, fecha_movimiento",
      tubos: "++id, equipo_id",
      colimadores: "++id, equipo_id",
      gantry: "++id, equipo_id",
      sala_dimensiones: "++id, ubicacion_id",
      partes_equipo: "++id, equipo_id",
      valores_referencia: "++id, equipo_id",
      tecnicos: "++id, cedula, auth_uid, firebase_uid",
      cotizaciones: "++id, cliente_id, estado",
      solicitudes:
        "++id, cliente_id, ubicacion_id, tecnico_asignado_id, pipeline_estado, suitecrm_id",
      prueba_definiciones: "++id, &codigo, plantilla_informe",
      visitas:
        "++id, solicitud_id, equipo_id, ubicacion_id, tecnico_id, estado_visita, sync_status, [equipo_id+ubicacion_id]",
      prueba_resultados:
        "++id, visita_id, prueba_definicion_id, equipo_id, completado, sync_status",
      mediciones_radiometricas: "++id, visita_id, punto_numero, sync_status",
      evidencias: "++id, visita_id, prueba_resultado_id, sync_status",
      elementos_proteccion: "++id, visita_id",
      informes:
        "++id, visita_id, equipo_id, ubicacion_id, numero_informe, &qr_token, estado, fecha_vencimiento, [equipo_id+ubicacion_id]",
      informe_versiones: "++id, informe_id, numero_version, estado",
    });

    this.version(2).stores({
      change_logs: "++id, tabla, registro_id, modificado_por_id, fecha",
    });

    this.version(3).stores({
      grupo_pruebas: "++id, &codigo, tipo_equipo, orden",
      grupo_resultados: "++id, visita_id, grupo_id, equipo_id, completado, sync_status",
      prueba_definiciones: "++id, &codigo, grupo_id, plantilla_informe",
      prueba_resultados:
        "++id, visita_id, grupo_resultado_id, prueba_definicion_id, equipo_id, completado, sync_status",
    });

    this.version(4)
      .stores({
        tecnicos: null,
        usuarios: "++id, cedula, auth_uid, cargo",
        rol_permisos: "++id, [rol+modulo], rol",
      })
      .upgrade(async (tx) => {
        const oldRows = await (tx as unknown as { table: (name: string) => Dexie.Table })
          .table("tecnicos")
          .toArray();
        const usuariosTable = tx.table("usuarios");
        for (const row of oldRows) {
          const cargo =
            row.cargo === "fisico_tecnico" || row.cargo === "ingeniero" || row.cargo === "tecnologo"
              ? "tecnico"
              : (row.cargo ?? "tecnico");
          await usuariosTable.add({
            ...row,
            cargo,
            firebase_uid: undefined,
          });
        }
      });

    this.version(5).stores({
      sync_meta: "&table_name",
      clientes: "++id, nit, nombre_cliente, sync_status",
      contactos: "++id, cliente_id, cargo, sync_status",
      sedes: "++id, cliente_id, sync_status",
      ubicaciones_rx: "++id, sede_id, sync_status",
      equipos: "++id, ubicacion_id, tipo_equipo, sync_status",
      tubos: "++id, equipo_id, sync_status",
      colimadores: "++id, equipo_id, sync_status",
      gantry: "++id, equipo_id, sync_status",
      solicitudes:
        "++id, cliente_id, ubicacion_id, tecnico_asignado_id, pipeline_estado, suitecrm_id, sync_status",
    });

    this.version(6).stores({
      conv_levantamiento_setup: "++id, &visita_id",
      conv_mediciones: "++id, visita_id, punto_numero",
      conv_inspeccion_items: "++id, visita_id, [visita_id+seccion]",
      conv_elementos_proteccion: "++id, visita_id",
      conv_raysafe_mediciones: "++id, visita_id, grupo_medicion",
      conv_resultados_prueba: "++id, visita_id, prueba_codigo, [visita_id+prueba_codigo]",
      conv_evidencias: "++id, visita_id, prueba_codigo, [visita_id+prueba_codigo]",
    });

    this.version(7).stores({
      conv_raysafe_setup: "++id, &visita_id",
      conv_raysafe_mediciones: "++id, visita_id, tipo_medicion, [visita_id+tipo_medicion]",
      conv_cae_mediciones: "++id, visita_id, toma_numero",
    });

    this.version(8).stores({
      conv_ddi_mediciones: "++id, visita_id, grupo, toma_numero",
      conv_cassette_inspeccion: "++id, visita_id, item_numero",
      conv_uniformidad_cr: "++id, visita_id, item_numero",
    });

    this.version(9).stores({
      conv_colimacion: "++id, &visita_id",
      conv_uniformidad_detector: "++id, visita_id, item_numero",
      conv_resolucion: "++id, &visita_id",
      conv_bajo_contraste: "++id, &visita_id",
      conv_mtf: "++id, &visita_id",
    });

    this.version(10).stores({
      conv_informe_secciones: "++id, visita_id, prueba_codigo, [visita_id+prueba_codigo]",
    });

    this.version(11).stores({
      departamentos: "id",
      municipios: "id, departamento_id",
    });

    this.version(12).stores({
      conv_cae_setup: "++id, &visita_id",
    });

    // ─────────────────────────────────────────────────────────────
    //  v13: migración a UUID como clave primaria
    //
    //  Todos los id pasan de auto-increment numérico a string UUID
    //  generado en el cliente con crypto.randomUUID().
    //  Las tablas DIVIPOLA (departamentos, municipios) NO se migran
    //  porque sus IDs son códigos DANE estables.
    //
    //  IMPORTANTE: esta migración requiere que la DB esté vacía
    //  (ejecutar reset de datos antes de actualizar la app).
    // ─────────────────────────────────────────────────────────────
    this.version(13).stores({
      clientes: "id, nit, nombre_cliente, sync_status",
      contactos: "id, cliente_id, cargo, sync_status",
      sedes: "id, cliente_id, sync_status",
      ubicaciones_rx: "id, sede_id, sync_status",
      equipos: "id, ubicacion_id, tipo_equipo, sync_status",
      equipo_movimientos: "id, equipo_id",
      tubos: "id, equipo_id, sync_status",
      colimadores: "id, equipo_id, sync_status",
      gantry: "id, equipo_id, sync_status",
      sala_dimensiones: "id, ubicacion_id",
      partes_equipo: "id, equipo_id",
      valores_referencia: "id, equipo_id",
      usuarios: "id, cedula, auth_uid, cargo",
      rol_permisos: "id, [rol+modulo], rol",
      cotizaciones: "id, cliente_id",
      solicitudes:
        "id, cliente_id, ubicacion_id, tecnico_asignado_id, pipeline_estado, sync_status",
      prueba_definiciones: "id, &codigo, grupo_id, plantilla_informe",
      grupo_pruebas: "id, &codigo, tipo_equipo, orden",
      grupo_resultados: "id, visita_id, grupo_id, equipo_id, completado, sync_status",
      visitas: "id, solicitud_id, equipo_id, ubicacion_id, tecnico_id, estado_visita, sync_status",
      prueba_resultados:
        "id, visita_id, grupo_resultado_id, prueba_definicion_id, equipo_id, completado, sync_status",
      mediciones_radiometricas: "id, visita_id, punto_numero, sync_status",
      evidencias: "id, visita_id, sync_status",
      elementos_proteccion: "id, visita_id",
      informes: "id, visita_id, equipo_id, ubicacion_id, numero_informe, &qr_token, estado",
      informe_versiones: "id, informe_id, numero_version",
      change_logs: "id, tabla, registro_id, fecha",
      // Conv — ahora con sync_status
      conv_levantamiento_setup: "id, &visita_id, sync_status",
      conv_mediciones: "id, visita_id, punto_numero, sync_status",
      conv_inspeccion_items: "id, visita_id, [visita_id+seccion], sync_status",
      conv_elementos_proteccion: "id, visita_id, sync_status",
      conv_raysafe_setup: "id, &visita_id, sync_status",
      conv_raysafe_mediciones:
        "id, visita_id, tipo_medicion, [visita_id+tipo_medicion], sync_status",
      conv_cae_setup: "id, &visita_id, sync_status",
      conv_cae_mediciones: "id, visita_id, toma_numero, sync_status",
      conv_ddi_mediciones: "id, visita_id, grupo, toma_numero, sync_status",
      conv_cassette_inspeccion: "id, visita_id, item_numero, sync_status",
      conv_uniformidad_cr: "id, visita_id, item_numero, sync_status",
      conv_colimacion: "id, &visita_id, sync_status",
      conv_uniformidad_detector: "id, visita_id, item_numero, sync_status",
      conv_resolucion: "id, &visita_id, sync_status",
      conv_bajo_contraste: "id, &visita_id, sync_status",
      conv_mtf: "id, &visita_id, sync_status",
      conv_informe_secciones:
        "id, visita_id, prueba_codigo, [visita_id+prueba_codigo], sync_status",
      conv_resultados_prueba:
        "id, visita_id, prueba_codigo, [visita_id+prueba_codigo], sync_status",
      conv_evidencias: "id, visita_id, prueba_codigo, [visita_id+prueba_codigo], sync_status",
    });

    // ─────────────────────────────────────────────────────────────
    //  v14 — habilitar sync de traslados de equipo.
    //  Solo agrega el índice sync_status a equipo_movimientos para
    //  que el motor de sync pueda seleccionar filas pendientes.
    //  (agregar un índice no borra datos; Dexie migra en sitio)
    // ─────────────────────────────────────────────────────────────
    this.version(14).stores({
      equipo_movimientos: "id, equipo_id, ubicacion_nueva_id, sync_status",
    });

    // ─────────────────────────────────────────────────────────────
    //  v15 — retry con backoff exponencial para push fallido.
    //  Tabla nueva, aditiva — no migra ni toca tablas existentes.
    // ─────────────────────────────────────────────────────────────
    this.version(15).stores({
      sync_retry: "&[table_name+record_id], table_name, next_attempt_at",
    });

    // ─────────────────────────────────────────────────────────────
    //  v16 — "otras identificaciones" del equipo (#61). Tabla nueva,
    //  aditiva. Foto rotulada por equipo; sincroniza bidireccional y
    //  su blob va al bucket `evidencias` como las demás imágenes.
    // ─────────────────────────────────────────────────────────────
    this.version(16).stores({
      equipo_identificaciones: "id, equipo_id, sync_status",
    });
  }
}

export const db = new EyCDatabase();

db.on("blocked", () => {
  if (typeof window !== "undefined") {
    window.location.reload();
  }
});

db.on("versionchange", () => {
  db.close();
  if (typeof window !== "undefined") {
    window.location.reload();
  }
});
