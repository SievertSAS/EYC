import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

// ============================================================
//  /verificar/[token] — página pública (service-role, sin sesión).
//
//  Contrato de seguridad: expone SOLO datos del informe/equipo. No debe
//  tocar `clientes`, `sedes`, `contactos`, `solicitudes`, `ubicaciones_rx`
//  ni `visitas` — nada de PII del cliente sale por el QR (el PDF firmado
//  sí la contiene, pero ese es el documento oficial que el QR publica).
// ============================================================

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => adminClient }));

const tablasConsultadas: string[] = [];
const state = {
  informe: null as Record<string, unknown> | null,
  version: null as Record<string, unknown> | null,
  equipo: null as Record<string, unknown> | null,
  signedUrl: null as string | null,
};

const adminClient = {
  from(table: string) {
    tablasConsultadas.push(table);
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      maybeSingle: async () => {
        if (table === "informes") return { data: state.informe };
        if (table === "informe_versiones") return { data: state.version };
        if (table === "equipos") return { data: state.equipo };
        return { data: null };
      },
    };
    return builder;
  },
  storage: {
    from: () => ({
      createSignedUrl: async () => ({
        data: state.signedUrl ? { signedUrl: state.signedUrl } : null,
      }),
    }),
  },
};

import VerificarPage from "./page";

beforeEach(() => {
  tablasConsultadas.length = 0;
  state.informe = {
    id: "inf-1",
    equipo_id: "eq-1",
    numero_informe: "INF-2026-001",
    version_actual: 1,
    concepto_general: "FAVORABLE",
    fecha_emision: "2026-01-10",
    fecha_vencimiento: "2027-01-10",
    estado: "aprobado",
  };
  state.version = { numero_version: 1, pdf_url: "informes/inf-1-v1.pdf" };
  state.equipo = {
    marca: "Siemens",
    modelo: "Multix",
    gen_marca: null,
    gen_modelo: null,
    tipo_equipo: "CONVENCIONAL",
  };
  state.signedUrl = "https://test.supabase.co/storage/signed/abc";
});
afterEach(cleanup);

describe("VerificarPage", () => {
  it("muestra 'Informe no encontrado' si el token no matchea", async () => {
    state.informe = null;
    render(await VerificarPage({ params: Promise.resolve({ token: "no-existe" }) }));
    expect(screen.getByText(/Informe no encontrado/i)).toBeInTheDocument();
  });

  it("renderiza número, concepto, fechas y equipo del informe", async () => {
    render(await VerificarPage({ params: Promise.resolve({ token: "tok-1" }) }));
    expect(screen.getByText("INF-2026-001")).toBeInTheDocument();
    expect(screen.getByText("FAVORABLE")).toBeInTheDocument();
    expect(screen.getByText("2026-01-10")).toBeInTheDocument();
    expect(screen.getByText("2027-01-10")).toBeInTheDocument();
    expect(screen.getByText(/Siemens/)).toBeInTheDocument();
  });

  it("SOLO consulta informes / informe_versiones / equipos (sin PII del cliente)", async () => {
    render(await VerificarPage({ params: Promise.resolve({ token: "tok-1" }) }));
    expect(new Set(tablasConsultadas)).toEqual(
      new Set(["informes", "informe_versiones", "equipos"])
    );
    for (const prohibida of [
      "clientes",
      "sedes",
      "contactos",
      "solicitudes",
      "ubicaciones_rx",
      "visitas",
    ]) {
      expect(tablasConsultadas).not.toContain(prohibida);
    }
  });

  it("publica el enlace al PDF firmado cuando hay pdf_url", async () => {
    render(await VerificarPage({ params: Promise.resolve({ token: "tok-1" }) }));
    const link = screen.getByRole("link", { name: /Ver PDF oficial/i });
    expect(link).toHaveAttribute("href", "https://test.supabase.co/storage/signed/abc");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("no ofrece PDF si la versión aún no tiene documento", async () => {
    state.version = { numero_version: 1, pdf_url: null };
    render(await VerificarPage({ params: Promise.resolve({ token: "tok-1" }) }));
    expect(screen.queryByRole("link", { name: /Ver PDF oficial/i })).toBeNull();
    expect(screen.getByText(/aún no publicado/i)).toBeInTheDocument();
  });
});
