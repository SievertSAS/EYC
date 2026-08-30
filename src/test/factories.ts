// Fábricas de entidades para tests.
//
// Cada `makeX(overrides?)` devuelve un objeto de dominio VÁLIDO con
// defaults sensatos y un `id` nuevo (crypto.randomUUID). NO tocan la base:
// son objetos puros. Para escribir un grafo conectado a Dexie usá
// `seedGraph()` de ./seed.
//
// Convención: por defecto las filas nacen `sync_status: "synced"` (estado
// "ya sincronizado con el servidor"). Para simular una edición local sin
// subir todavía, pasá `{ sync_status: "pending" }` en overrides.

import { randomUUID } from "@/lib/uuid";
import type {
  Cliente,
  Sede,
  UbicacionRx,
  Equipo,
  Solicitud,
  VisitaEjecucion,
  Tubo,
  TipoEquipo,
  EstadoVisita,
  SyncStatus,
} from "@/lib/db/types";

const now = () => new Date().toISOString();
const sync = (s: SyncStatus = "synced") => ({ sync_status: s, last_modified: now() });

export function makeCliente(overrides: Partial<Cliente> = {}): Cliente {
  return {
    id: randomUUID(),
    nombre_cliente: "Clínica de Prueba S.A.S.",
    nit: "900123456",
    ...sync(),
    ...overrides,
  };
}

export function makeSede(cliente_id: string, overrides: Partial<Sede> = {}): Sede {
  return {
    id: randomUUID(),
    cliente_id,
    nombre_sede: "Sede Principal",
    ciudad: "Bogotá",
    departamento: "Cundinamarca",
    ...sync(),
    ...overrides,
  };
}

export function makeUbicacion(sede_id: string, overrides: Partial<UbicacionRx> = {}): UbicacionRx {
  return {
    id: randomUUID(),
    sede_id,
    nombre_servicio: "Radiología Convencional",
    ancho_m: 4,
    largo_m: 5,
    alto_m: 3,
    area_m2: 20,
    ...sync(),
    ...overrides,
  };
}

export function makeEquipo(ubicacion_id: string, overrides: Partial<Equipo> = {}): Equipo {
  return {
    id: randomUUID(),
    ubicacion_id,
    tipo_equipo: "CONVENCIONAL" as TipoEquipo,
    planilla_espacial: false,
    gen_marca: "Siemens",
    gen_modelo: "Multix",
    gen_numero_serie: "SN-0001",
    ...sync(),
    ...overrides,
  };
}

export function makeTubo(equipo_id: string, overrides: Partial<Tubo> = {}): Tubo {
  return {
    id: randomUUID(),
    equipo_id,
    marca: "Siemens",
    modelo: "Opti 150",
    numero_serie: "TUBO-0001",
    ...sync(),
    ...overrides,
  };
}

export function makeSolicitud(cliente_id: string, overrides: Partial<Solicitud> = {}): Solicitud {
  return {
    id: randomUUID(),
    cliente_id,
    pago_recibido: false,
    pipeline_estado: "programacion",
    tipo_servicio: "control_calidad",
    fecha_solicitud: now(),
    ...sync(),
    ...overrides,
  };
}

export function makeVisita(
  solicitud_id: string,
  overrides: Partial<VisitaEjecucion> = {}
): VisitaEjecucion {
  return {
    id: randomUUID(),
    solicitud_id,
    estado_visita: "asignada" as EstadoVisita,
    ...sync(),
    ...overrides,
  };
}
