import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import { db } from "@/lib/db";
import { resetTestDb } from "@/test/db-reset";
import { seedGraph } from "@/test/seed";

// ============================================================
//  Smoke tests de los 7 módulos de captura de visita.
//
//  No verifican el detalle de cada tabla — eso es Tier 3/4. Verifican el
//  CONTRATO común de los 3 estados de render:
//    - useDb no listo / data indefinida -> "Cargando…"
//    - data === null (visita inexistente) -> "Visita no encontrada"
//    - visita sembrada -> render completo sin throw ("Volver al workspace")
//
//  Con esta red, la re-escalada de `react-hooks/set-state-in-effect` a
//  "error" para src/components/visita-modulos/** deja de ser riesgosa.
// ============================================================

const useDb = vi.fn();
vi.mock("@/components/db-provider", () => ({ useDb: () => useDb() }));
vi.mock("@/components/role-provider", () => ({
  useRole: () => ({ role: "tecnico", cargo: "tecnico", usuarioId: "u1", nombre: "Tec" }),
}));
vi.mock("@/lib/supabase/sync-engine", () => ({
  pushSingle: vi.fn(),
  updateAndSync: vi.fn().mockResolvedValue(undefined),
  deleteAndSync: vi.fn().mockResolvedValue(undefined),
}));

import { pushSingle } from "@/lib/supabase/sync-engine";
import { GrupoAModulo } from "./grupo-a-modulo";
import { GrupoBModulo } from "./grupo-b-modulo";
import { GrupoCModulo } from "./grupo-c-modulo";
import { GrupoDModulo } from "./grupo-d-modulo";
import { GrupoEModulo } from "./grupo-e-modulo";
import { InfoModulo } from "./info-modulo";
import { PreInformeModulo } from "./pre-informe-modulo";

const MODULOS: Array<[string, ComponentType<{ visitaId: string }>]> = [
  ["InfoModulo", InfoModulo],
  ["GrupoAModulo", GrupoAModulo],
  ["GrupoBModulo", GrupoBModulo],
  ["GrupoCModulo", GrupoCModulo],
  ["GrupoDModulo", GrupoDModulo],
  ["GrupoEModulo", GrupoEModulo],
  ["PreInformeModulo", PreInformeModulo],
];

describe("visita-modulos — smoke", () => {
  beforeEach(async () => {
    await resetTestDb();
    useDb.mockReturnValue({ isReady: true });
  });

  afterEach(() => cleanup());

  describe.each(MODULOS)("%s", (_name, Modulo) => {
    it("muestra 'Cargando' mientras la DB no está lista", () => {
      useDb.mockReturnValue({ isReady: false });
      render(<Modulo visitaId="v-cualquiera" />);
      expect(screen.getByText(/Cargando/i)).toBeInTheDocument();
    });

    it("muestra 'Visita no encontrada' si el id no existe", async () => {
      render(<Modulo visitaId="v-inexistente" />);
      expect(await screen.findByText(/Visita no encontrada/i)).toBeInTheDocument();
    });

    it("renderiza el módulo completo con una visita sembrada, sin throw", async () => {
      const { visita } = await seedGraph();
      render(<Modulo visitaId={visita!.id!} />);
      expect(await screen.findByText(/Volver al workspace/i)).toBeInTheDocument();
    });
  });
});

describe("GrupoAModulo — capturar una foto dispara el push (#67)", () => {
  beforeEach(async () => {
    await resetTestDb();
    useDb.mockReturnValue({ isReady: true });
    vi.mocked(pushSingle).mockClear();
  });
  afterEach(() => cleanup());

  it("crea la evidencia pending con blob y llama pushSingle('conv_evidencias')", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    const { container } = render(<GrupoAModulo visitaId={visita!.id!} />);
    await screen.findByText(/Volver al workspace/i);

    // Primer slot de imagen del módulo = plano / croquis radiométrico (prueba 2.1).
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    const file = new File([new Uint8Array([1, 2, 3])], "plano.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(async () => {
      const filas = await db.conv_evidencias.where("visita_id").equals(visita!.id!).toArray();
      expect(filas.length).toBe(1);
      expect(filas[0].sync_status).toBe("pending");
      expect(filas[0].blob_local).not.toBeNull();
    });
    expect(vi.mocked(pushSingle)).toHaveBeenCalledWith("conv_evidencias", expect.any(String));
  });
});

describe("GrupoAModulo — avisos de protección como lista dinámica (#66)", () => {
  beforeEach(async () => {
    await resetTestDb();
    useDb.mockReturnValue({ isReady: true });
    vi.mocked(pushSingle).mockClear();
  });
  afterEach(() => cleanup());

  it("'Agregar aviso' crea una evidencia 2.2 con slot 'aviso_*' pending y dispara el push", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    render(<GrupoAModulo visitaId={visita!.id!} />);
    await screen.findByText(/Volver al workspace/i);

    fireEvent.click(screen.getByRole("button", { name: /Agregar aviso/i }));

    await waitFor(async () => {
      const filas = await db.conv_evidencias.where("visita_id").equals(visita!.id!).toArray();
      const aviso = filas.find((f) => f.slot?.startsWith("aviso_"));
      expect(aviso).toBeTruthy();
      expect(aviso!.prueba_codigo).toBe("2.2");
      expect(aviso!.sync_status).toBe("pending");
    });
    expect(vi.mocked(pushSingle)).toHaveBeenCalledWith("conv_evidencias", expect.any(String));
  });
});

describe("GrupoAModulo — elemento de protección con Combobox + 'Otro' (#69)", () => {
  beforeEach(async () => {
    await resetTestDb();
    useDb.mockReturnValue({ isReady: true });
  });
  afterEach(() => cleanup());

  it("un elemento con descripción fuera del catálogo abre el input de texto libre pre-cargado", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    const now = new Date().toISOString();
    await db.conv_elementos_proteccion.add({
      id: "elem-otro-69",
      visita_id: visita!.id!,
      descripcion: "Mandil pediátrico especial",
      creado_en: now,
      sync_status: "pending",
      last_modified: now,
    });
    render(<GrupoAModulo visitaId={visita!.id!} />);
    await screen.findByText(/Volver al workspace/i);

    const libre = await screen.findByPlaceholderText("Especificar elemento");
    expect(libre).toHaveValue("Mandil pediátrico especial");
  });
});

describe("InfoModulo — no se puede dejar en blanco una columna NOT NULL (23502)", () => {
  beforeEach(async () => {
    await resetTestDb();
    useDb.mockReturnValue({ isReady: true });
  });
  afterEach(() => cleanup());

  it("borrar 'Nombre del Servicio' no persiste undefined y el campo revierte", async () => {
    const { visita, ubicacion } = await seedGraph();
    render(<InfoModulo visitaId={visita!.id!} />);
    await screen.findByText(/Volver al workspace/i);

    const input = screen.getByDisplayValue("Radiología Convencional") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });

    // Pasado el debounce (800 ms) el guard revierte y NO guarda.
    await new Promise((r) => setTimeout(r, 950));

    const row = await db.ubicaciones_rx.get(ubicacion.id!);
    expect(row?.nombre_servicio).toBe("Radiología Convencional");
    expect(input.value).toBe("Radiología Convencional");
  });

  it("un valor nuevo no vacío sí se guarda", async () => {
    const { visita, ubicacion } = await seedGraph();
    render(<InfoModulo visitaId={visita!.id!} />);
    await screen.findByText(/Volver al workspace/i);

    const input = screen.getByDisplayValue("Radiología Convencional");
    fireEvent.change(input, { target: { value: "Mamografía" } });
    await new Promise((r) => setTimeout(r, 950));

    const row = await db.ubicaciones_rx.get(ubicacion.id!);
    expect(row?.nombre_servicio).toBe("Mamografía");
  });
});

describe("InfoModulo — Sistema de Adquisición de Imágenes (#62)", () => {
  beforeEach(async () => {
    await resetTestDb();
    useDb.mockReturnValue({ isReady: true });
  });
  afterEach(() => cleanup());

  it("es una lista desplegable con el vocabulario cerrado del informe, no texto libre", async () => {
    const { visita } = await seedGraph();
    render(<InfoModulo visitaId={visita!.id!} />);
    await screen.findByText(/Volver al workspace/i);

    // Las 6 opciones de SISTEMAS_ADQUISICION quedan como <option> del <select>.
    expect(screen.getByRole("option", { name: "Digitalizado" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Análogo: Revelado manual" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Monitor análogo" })).toBeInTheDocument();
  });
});

describe("InfoModulo — Características del Generador (#61)", () => {
  beforeEach(async () => {
    await resetTestDb();
    useDb.mockReturnValue({ isReady: true });
  });
  afterEach(() => cleanup());

  it("la sección del generador incluye el campo de energía fotones/electrones (MeV)", async () => {
    const { visita } = await seedGraph();
    render(<InfoModulo visitaId={visita!.id!} />);
    await screen.findByText(/Volver al workspace/i);

    expect(screen.getByText("Características del Generador")).toBeInTheDocument();
    expect(screen.getByText(/Energía Fotones \/ Electrones/i)).toBeInTheDocument();
  });
});

describe("InfoModulo — tubos desde Información General (#61 D2b)", () => {
  beforeEach(async () => {
    await resetTestDb();
    useDb.mockReturnValue({ isReady: true });
  });
  afterEach(() => cleanup());

  it("agrega un tubo al equipo desde el botón 'Agregar tubo'", async () => {
    const { visita, equipo } = await seedGraph({ conTubo: false });
    render(<InfoModulo visitaId={visita!.id!} />);
    await screen.findByText(/Volver al workspace/i);

    expect(await db.tubos.where("equipo_id").equals(equipo.id!).count()).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: /agregar tubo/i }));
    await waitFor(async () =>
      expect(await db.tubos.where("equipo_id").equals(equipo.id!).count()).toBe(1)
    );
  });

  it("soft-borra un tubo desde su botón de eliminar", async () => {
    const { visita, equipo } = await seedGraph({ conTubo: true });
    render(<InfoModulo visitaId={visita!.id!} />);
    await screen.findByText(/Volver al workspace/i);

    fireEvent.click(await screen.findByRole("button", { name: /eliminar tubo 1/i }));
    await waitFor(async () => {
      const t = await db.tubos.where("equipo_id").equals(equipo.id!).first();
      expect(t?.deleted_at).toBeTruthy();
    });
  });

  it("#61 (D2c): agrega una identificación del equipo desde su botón", async () => {
    const { visita, equipo } = await seedGraph();
    render(<InfoModulo visitaId={visita!.id!} />);
    await screen.findByText(/Volver al workspace/i);

    expect(await db.equipo_identificaciones.where("equipo_id").equals(equipo.id!).count()).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: /agregar identificación/i }));
    await waitFor(async () =>
      expect(await db.equipo_identificaciones.where("equipo_id").equals(equipo.id!).count()).toBe(1)
    );
  });
});

describe("PreInformeModulo — panel de datos faltantes (#65)", () => {
  beforeEach(async () => {
    await resetTestDb();
    useDb.mockReturnValue({ isReady: true });
  });
  afterEach(() => cleanup());

  it("indica los datos de Info sin completar y su sección al expandir", async () => {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    render(<PreInformeModulo visitaId={visita!.id!} />);
    await screen.findByText(/Volver al workspace/i);

    const toggle = await screen.findByText(/sin completar en Información General/i);
    fireEvent.click(toggle);
    expect(await screen.findByText("Datos de la Instalación")).toBeInTheDocument();
  });
});
