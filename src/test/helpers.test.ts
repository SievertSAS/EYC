// Smoke tests de los helpers compartidos (factories / seed / net / roles).
// Si esto falla, los tests de módulos que dependen de estos helpers están
// en riesgo.

import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { resetTestDb } from "@/test/db-reset";
import { makeCliente, makeEquipo, makeVisita } from "@/test/factories";
import { seedGraph } from "@/test/seed";
import { withOffline, withOnline, withClockSkew } from "@/test/net";
import { makeRole } from "@/test/roles";

describe("factories", () => {
  it("makeCliente da un objeto válido con id y sync_status", () => {
    const c = makeCliente();
    expect(c.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(c.nombre_cliente).toBeTruthy();
    expect(c.sync_status).toBe("synced");
  });

  it("los overrides pisan los defaults", () => {
    expect(makeCliente({ nombre_cliente: "X" }).nombre_cliente).toBe("X");
    expect(makeEquipo("ubi-1", { tipo_equipo: "MAMOGRAFO" }).tipo_equipo).toBe("MAMOGRAFO");
    expect(makeVisita("sol-1", { estado_visita: "en_revision" }).estado_visita).toBe("en_revision");
  });

  it("ids distintos en cada llamada", () => {
    expect(makeCliente().id).not.toBe(makeCliente().id);
  });
});

describe("seedGraph", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it("escribe la cadena completa enlazada por FKs", async () => {
    const g = await seedGraph();

    expect(await db.clientes.get(g.cliente.id!)).toBeDefined();
    expect((await db.sedes.get(g.sede.id!))?.cliente_id).toBe(g.cliente.id);
    expect((await db.ubicaciones_rx.get(g.ubicacion.id!))?.sede_id).toBe(g.sede.id);
    expect((await db.equipos.get(g.equipo.id!))?.ubicacion_id).toBe(g.ubicacion.id);
    expect((await db.tubos.get(g.tubo!.id!))?.equipo_id).toBe(g.equipo.id);
    expect((await db.solicitudes.get(g.solicitud!.id!))?.cliente_id).toBe(g.cliente.id);
    expect((await db.visitas.get(g.visita!.id!))?.solicitud_id).toBe(g.solicitud!.id);
    expect((await db.visitas.get(g.visita!.id!))?.equipo_id).toBe(g.equipo.id);
  });

  it("respeta las opciones (sin visita, sync_status pending, tipo de equipo)", async () => {
    const g = await seedGraph({ conVisita: false, syncStatus: "pending", tipoEquipo: "CT" });
    expect(g.visita).toBeUndefined();
    expect((await db.equipos.get(g.equipo.id!))?.tipo_equipo).toBe("CT");
    expect((await db.equipos.get(g.equipo.id!))?.sync_status).toBe("pending");
  });
});

describe("net", () => {
  it("withOffline / withOnline fijan navigator.onLine y restauran", async () => {
    const before = navigator.onLine;
    await withOffline(async () => {
      expect(navigator.onLine).toBe(false);
    });
    await withOnline(async () => {
      expect(navigator.onLine).toBe(true);
    });
    expect(navigator.onLine).toBe(before);
  });

  it("withClockSkew desplaza el reloj y lo restaura", async () => {
    const real = Date.now();
    await withClockSkew(60 * 60 * 1000, async () => {
      expect(Date.now()).toBeGreaterThan(real + 59 * 60 * 1000);
    });
    expect(Date.now()).toBeGreaterThanOrEqual(real);
    expect(Date.now()).toBeLessThan(real + 60 * 1000);
  });
});

describe("roles", () => {
  it("coordinador es admin y puede todo", () => {
    const r = makeRole("coordinador");
    expect(r.isAdmin).toBe(true);
    expect(r.hasPermission("clientes", "eliminar")).toBe(true);
  });

  it("tecnico no ve clientes pero ejecuta visitas", () => {
    const r = makeRole("tecnico");
    expect(r.isAdmin).toBe(false);
    expect(r.hasPermission("clientes")).toBe(false);
    expect(r.hasPermission("visitas", "editar")).toBe(true);
    expect(r.hasPermission("visitas", "eliminar")).toBe(false);
  });

  it("deny/allow pisan el default", () => {
    expect(
      makeRole("coordinador", { deny: [["clientes", "eliminar"]] }).hasPermission(
        "clientes",
        "eliminar"
      )
    ).toBe(false);
    expect(makeRole("tecnico", { allow: [["clientes", "ver"]] }).hasPermission("clientes")).toBe(
      true
    );
  });
});
