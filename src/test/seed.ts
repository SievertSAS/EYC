// Siembra un grafo de dominio CONECTADO en Dexie para tests de integración.
//
//   cliente → sede → ubicación → equipo (→ tubo) → solicitud → visita
//
// Todas las filas quedan enlazadas por sus FKs reales. Devuelve los objetos
// creados para que el test pueda referenciar ids sin volver a leerlos.
//
// Requiere una base ya reseteada (`await resetTestDb()` en beforeEach).
//
// NO auto-genera grupo_resultados / prueba_resultados: eso depende del
// catálogo sembrado (grupo_pruebas / prueba_definiciones) y se arma en los
// tests de Tier 4 (visita-service / module-completeness), no acá.

import { db } from "@/lib/db";
import type { SyncStatus, TipoEquipo, EstadoVisita } from "@/lib/db/types";
import {
  makeCliente,
  makeSede,
  makeUbicacion,
  makeEquipo,
  makeTubo,
  makeSolicitud,
  makeVisita,
} from "./factories";

export interface SeedGraphOptions {
  /** Tipo de equipo. Default: CONVENCIONAL (el único con paquete implementado). */
  tipoEquipo?: TipoEquipo;
  /** Estado inicial de la visita. Default: "asignada". */
  estadoVisita?: EstadoVisita;
  /** sync_status con el que nacen TODAS las filas. Default: "synced". */
  syncStatus?: SyncStatus;
  /** Crear también una fila en `tubos` para el equipo. Default: true. */
  conTubo?: boolean;
  /** Crear la solicitud. Default: true. */
  conSolicitud?: boolean;
  /** Crear la visita (implica conSolicitud). Default: true. */
  conVisita?: boolean;
}

export async function seedGraph(opts: SeedGraphOptions = {}) {
  const {
    tipoEquipo = "CONVENCIONAL",
    estadoVisita = "asignada",
    syncStatus = "synced",
    conTubo = true,
    conSolicitud = true,
    conVisita = true,
  } = opts;

  const s = { sync_status: syncStatus };

  const cliente = makeCliente(s);
  const sede = makeSede(cliente.id!, s);
  const ubicacion = makeUbicacion(sede.id!, s);
  const equipo = makeEquipo(ubicacion.id!, { tipo_equipo: tipoEquipo, ...s });

  await db.clientes.add(cliente);
  await db.sedes.add(sede);
  await db.ubicaciones_rx.add(ubicacion);
  await db.equipos.add(equipo);

  const tubo = conTubo ? makeTubo(equipo.id!, s) : undefined;
  if (tubo) await db.tubos.add(tubo);

  const necesitaSolicitud = conSolicitud || conVisita;
  const solicitud = necesitaSolicitud
    ? makeSolicitud(cliente.id!, { ubicacion_id: ubicacion.id, ...s })
    : undefined;
  if (solicitud) await db.solicitudes.add(solicitud);

  const visita =
    conVisita && solicitud
      ? makeVisita(solicitud.id!, {
          equipo_id: equipo.id,
          ubicacion_id: ubicacion.id,
          estado_visita: estadoVisita,
          ...s,
        })
      : undefined;
  if (visita) await db.visitas.add(visita);

  return { cliente, sede, ubicacion, equipo, tubo, solicitud, visita };
}

export type SeededGraph = Awaited<ReturnType<typeof seedGraph>>;
