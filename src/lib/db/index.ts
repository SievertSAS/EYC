import Dexie, { type EntityTable } from "dexie";
import type {
  Cliente,
  Contacto,
  Sede,
  UbicacionRx,
  Equipo,
  EquipoMovimiento,
  Tubo,
  Colimador,
  Gantry,
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
} from "./types";

class EyCDatabase extends Dexie {
  clientes!: EntityTable<Cliente, "id">;
  contactos!: EntityTable<Contacto, "id">;
  sedes!: EntityTable<Sede, "id">;
  ubicaciones_rx!: EntityTable<UbicacionRx, "id">;
  equipos!: EntityTable<Equipo, "id">;
  equipo_movimientos!: EntityTable<EquipoMovimiento, "id">;
  tubos!: EntityTable<Tubo, "id">;
  colimadores!: EntityTable<Colimador, "id">;
  gantry!: EntityTable<Gantry, "id">;
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

  constructor() {
    super("SievertEyC");

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

    // v4: renombrar tecnicos → usuarios + tabla rol_permisos
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

    // v5: agregar sync_status a tablas maestras editables localmente
    this.version(5).stores({
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
  }
}

export const db = new EyCDatabase();

db.on("blocked", () => {
  // Otra pestaña tiene la DB abierta en una versión anterior.
  // Recargar para que todas las pestañas usen la misma versión.
  if (typeof window !== "undefined") {
    window.location.reload();
  }
});

db.on("versionchange", () => {
  // Otra pestaña necesita actualizar la DB — cerrar nuestra conexión.
  db.close();
  if (typeof window !== "undefined") {
    window.location.reload();
  }
});
