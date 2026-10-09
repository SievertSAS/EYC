import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { db } from "@/lib/db";
import { randomUUID } from "@/lib/uuid";
import { resetTestDb } from "@/test/db-reset";
import { seedGraph } from "@/test/seed";
import { CATALOGO_SECCIONES } from "@/lib/equipos/convencional/informe-secciones";
import type { ConvInformeSeccion } from "@/lib/equipos/convencional/db/types";

// ============================================================
//  "Análisis" editable en las 21 pruebas del pre-informe.
//
//  - SeccionCard: el campo aparece precargado con el predeterminado, guarda
//    al salir del campo y "Restaurar predeterminado" limpia lo guardado.
//  - PreInformeModulo: calcula el predeterminado al expandir la tarjeta y
//    persiste en `observaciones`.
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

import { updateAndSync } from "@/lib/supabase/sync-engine";
import { PreInformeModulo, SeccionCard } from "./pre-informe-modulo";

const PLACEHOLDER = "Análisis de los resultados de la prueba...";
const DEFAULT_24 = "Texto automático del análisis de la 2.4.";
const catalogo = (codigo: string) => CATALOGO_SECCIONES.find((c) => c.codigo === codigo)!;

// Las acciones correctivas tienen su propio "Restaurar predeterminado"; el
// del Análisis es el último de la tarjeta.
const restaurarAnalisis = () =>
  screen.getAllByRole("button", { name: /Restaurar predeterminado/ }).at(-1)!;

afterEach(cleanup);

describe("SeccionCard — campo 'Análisis'", () => {
  function renderCard(opts: {
    codigo?: string;
    observaciones?: string | null;
    analisisDefault?: string | null;
  }) {
    const codigo = opts.codigo ?? "2.4";
    const onUpdateObservaciones = vi.fn();
    const seccion: ConvInformeSeccion = {
      id: "s-1",
      visita_id: "v-1",
      prueba_codigo: codigo,
      orden: 4,
      incluida: true,
      observaciones: opts.observaciones,
    };
    render(
      <SeccionCard
        seccion={seccion}
        catalogo={catalogo(codigo)}
        conceptoEfectivo="Conforme"
        analisisDefault={opts.analisisDefault}
        expanded
        onToggleExpand={() => {}}
        onToggleIncluida={() => {}}
        onToggleNoEjecutada={() => {}}
        onUpdateAcciones={() => {}}
        onUpdateObservaciones={onUpdateObservaciones}
      />
    );
    return { onUpdateObservaciones };
  }

  const campo = () => screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement;

  it("aparece en una prueba sin análisis de catálogo (2.4), precargado con el predeterminado", () => {
    expect(catalogo("2.4").analisis).toBeUndefined();
    renderCard({ analisisDefault: DEFAULT_24 });
    expect(campo().value).toBe(DEFAULT_24);
  });

  it("si hay texto guardado, se muestra ese y no el predeterminado", () => {
    renderCard({ analisisDefault: DEFAULT_24, observaciones: "Texto del físico." });
    expect(campo().value).toBe("Texto del físico.");
  });

  it("sin predeterminado ni texto guardado, el campo no se muestra", () => {
    renderCard({ analisisDefault: null });
    expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull();
  });

  it("sin predeterminado pero con texto guardado, el campo se muestra", () => {
    renderCard({ analisisDefault: null, observaciones: "Texto del físico." });
    expect(campo().value).toBe("Texto del físico.");
  });

  it("editar y salir del campo guarda el texto en observaciones", () => {
    const { onUpdateObservaciones } = renderCard({ analisisDefault: DEFAULT_24 });
    fireEvent.change(campo(), { target: { value: "Análisis corregido por el físico." } });
    fireEvent.blur(campo());
    expect(onUpdateObservaciones).toHaveBeenCalledTimes(1);
    expect(onUpdateObservaciones).toHaveBeenCalledWith("Análisis corregido por el físico.");
  });

  it("salir del campo sin cambiar el predeterminado no guarda nada", () => {
    const { onUpdateObservaciones } = renderCard({ analisisDefault: DEFAULT_24 });
    fireEvent.blur(campo());
    expect(onUpdateObservaciones).not.toHaveBeenCalled();
  });

  it("si el texto vuelve a ser igual al predeterminado, se guarda undefined (sigue recalculándose)", () => {
    const { onUpdateObservaciones } = renderCard({
      analisisDefault: DEFAULT_24,
      observaciones: "Texto del físico.",
    });
    fireEvent.change(campo(), { target: { value: `  ${DEFAULT_24}\n` } });
    fireEvent.blur(campo());
    expect(onUpdateObservaciones).toHaveBeenCalledWith(undefined);
  });

  it("dejar el campo vacío guarda undefined y vuelve a mostrar el predeterminado", () => {
    const { onUpdateObservaciones } = renderCard({
      analisisDefault: DEFAULT_24,
      observaciones: "Texto del físico.",
    });
    fireEvent.change(campo(), { target: { value: "   " } });
    fireEvent.blur(campo());
    expect(onUpdateObservaciones).toHaveBeenCalledWith(undefined);
    expect(campo().value).toBe(DEFAULT_24);
  });

  it("'Restaurar predeterminado' guarda undefined y repone el texto predeterminado", () => {
    const { onUpdateObservaciones } = renderCard({
      analisisDefault: DEFAULT_24,
      observaciones: "Texto del físico.",
    });
    fireEvent.click(restaurarAnalisis());
    expect(onUpdateObservaciones).toHaveBeenCalledWith(undefined);
    expect(campo().value).toBe(DEFAULT_24);
  });

  it("2.2: usa el mismo campo con el predeterminado que recibe (texto del catálogo)", () => {
    renderCard({ codigo: "2.2", analisisDefault: catalogo("2.2").analisis });
    expect(campo().value).toBe(catalogo("2.2").analisis);
  });
});

describe("PreInformeModulo — 'Análisis' calculado al expandir la tarjeta", () => {
  beforeEach(async () => {
    await resetTestDb();
    useDb.mockReturnValue({ isReady: true });
    vi.mocked(updateAndSync).mockClear();
  });

  async function seedVisitaCon24(observaciones?: string) {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    const now = new Date().toISOString();
    await db.conv_raysafe_mediciones.bulkAdd(
      [0.79, 0.795, 0.8].map((tiempo_medido_s, i) => ({
        id: randomUUID(),
        visita_id: visita!.id!,
        tipo_medicion: "principal" as const,
        grupo_numero: 1,
        toma_numero: i + 1,
        tiempo_nominal_s: 0.8,
        tiempo_medido_s,
        sync_status: "synced" as const,
        last_modified: now,
      }))
    );
    const seccionId = randomUUID();
    await db.conv_informe_secciones.add({
      id: seccionId,
      visita_id: visita!.id!,
      prueba_codigo: "2.4",
      orden: 4,
      incluida: true,
      observaciones,
      sync_status: "synced",
      last_modified: now,
    });
    return { visitaId: visita!.id!, seccionId };
  }

  async function expandir24() {
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalle de la prueba 2.4" }));
    return (await screen.findByPlaceholderText(PLACEHOLDER)) as HTMLTextAreaElement;
  }

  it("precarga el texto automático de la prueba (el mismo que imprime el PDF)", async () => {
    const { visitaId } = await seedVisitaCon24();
    render(<PreInformeModulo visitaId={visitaId} />);
    const campo = await expandir24();
    expect(campo.value).toMatch(
      /^Los resultados obtenidos evidencian que el tiempo de exposición medido/
    );
  });

  it("editar guarda `observaciones` en la sección", async () => {
    const { visitaId, seccionId } = await seedVisitaCon24();
    render(<PreInformeModulo visitaId={visitaId} />);
    const campo = await expandir24();
    fireEvent.change(campo, { target: { value: "Análisis corregido por el físico." } });
    fireEvent.blur(campo);
    expect(updateAndSync).toHaveBeenCalledWith("conv_informe_secciones", seccionId, {
      observaciones: "Análisis corregido por el físico.",
    });
  });

  it("restaurar limpia `observaciones` con null (un undefined no llega al servidor)", async () => {
    const { visitaId, seccionId } = await seedVisitaCon24("Texto del físico.");
    render(<PreInformeModulo visitaId={visitaId} />);
    const campo = await expandir24();
    expect(campo.value).toBe("Texto del físico.");
    fireEvent.click(restaurarAnalisis());
    expect(updateAndSync).toHaveBeenCalledWith("conv_informe_secciones", seccionId, {
      observaciones: null,
    });
  });
});
