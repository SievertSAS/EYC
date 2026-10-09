import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { db } from "@/lib/db";
import { randomUUID } from "@/lib/uuid";
import { resetTestDb } from "@/test/db-reset";
import { seedGraph } from "@/test/seed";
import { CATALOGO_SECCIONES } from "@/lib/equipos/convencional/informe-secciones";
import type { ConvInformeSeccion } from "@/lib/equipos/convencional/db/types";

// ============================================================
//  Motivo de "no aplica" editable en el pre-informe.
//
//  - SeccionCard: con la prueba apagada y la tarjeta expandida aparece el
//    campo "Metodología (motivo de no aplica)", precargado con el motivo
//    predeterminado del catálogo. Guarda al salir del campo y "Restaurar
//    predeterminado" limpia lo guardado.
//  - PreInformeModulo: persiste en `metodologia_no_aplica`.
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

const ETIQUETA = "Metodología (motivo de no aplica)";
const PLACEHOLDER = "Motivo por el que la prueba no aplica...";
const PLACEHOLDER_ANALISIS = "Análisis de los resultados de la prueba...";
const catalogo = (codigo: string) => CATALOGO_SECCIONES.find((c) => c.codigo === codigo)!;
const DEFAULT_28 = catalogo("2.8").metodologiaNoAplica;

afterEach(cleanup);

describe("SeccionCard — campo 'Metodología (motivo de no aplica)'", () => {
  function renderCard(
    opts: {
      incluida?: boolean;
      expanded?: boolean;
      metodologia_no_aplica?: string | null;
    } = {}
  ) {
    const onUpdateMetodologiaNoAplica = vi.fn();
    const onUpdateObservaciones = vi.fn();
    const seccion: ConvInformeSeccion = {
      id: "s-1",
      visita_id: "v-1",
      prueba_codigo: "2.8",
      orden: 8,
      incluida: opts.incluida ?? false,
      metodologia_no_aplica: opts.metodologia_no_aplica,
    };
    render(
      <SeccionCard
        seccion={seccion}
        catalogo={catalogo("2.8")}
        conceptoEfectivo={seccion.incluida ? "Conforme" : "No_aplica"}
        analisisDefault="Texto automático del análisis de la 2.8."
        expanded={opts.expanded ?? true}
        onToggleExpand={() => {}}
        onToggleIncluida={() => {}}
        onToggleNoEjecutada={() => {}}
        onUpdateAcciones={() => {}}
        onUpdateObservaciones={onUpdateObservaciones}
        onUpdateMetodologiaNoAplica={onUpdateMetodologiaNoAplica}
      />
    );
    return { onUpdateMetodologiaNoAplica, onUpdateObservaciones };
  }

  const campo = () => screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement;

  it("prueba apagada y expandida: aparece precargado con el motivo predeterminado", () => {
    renderCard();
    expect(screen.getByText(ETIQUETA)).toBeTruthy();
    expect(campo().value).toBe(DEFAULT_28);
  });

  it("es el único campo de la tarjeta: no se muestran Análisis ni los textos del informe", () => {
    renderCard();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByPlaceholderText(PLACEHOLDER_ANALISIS)).toBeNull();
    expect(screen.queryByText(/Ver textos del informe/)).toBeNull();
  });

  it("prueba apagada sin expandir: el campo no se muestra", () => {
    renderCard({ expanded: false });
    expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull();
  });

  it("prueba encendida: el campo no se muestra (y el Análisis sí)", () => {
    renderCard({ incluida: true, metodologia_no_aplica: "Motivo guardado." });
    expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull();
    expect(screen.queryByText(ETIQUETA)).toBeNull();
    expect(screen.getByPlaceholderText(PLACEHOLDER_ANALISIS)).toBeTruthy();
  });

  it("si hay un motivo guardado, se muestra ese y no el predeterminado", () => {
    renderCard({ metodologia_no_aplica: "Motivo del físico." });
    expect(campo().value).toBe("Motivo del físico.");
  });

  it("editar y salir del campo guarda el motivo", () => {
    const { onUpdateMetodologiaNoAplica, onUpdateObservaciones } = renderCard();
    fireEvent.change(campo(), { target: { value: "El equipo es portátil." } });
    fireEvent.blur(campo());
    expect(onUpdateMetodologiaNoAplica).toHaveBeenCalledTimes(1);
    expect(onUpdateMetodologiaNoAplica).toHaveBeenCalledWith("El equipo es portátil.");
    expect(onUpdateObservaciones).not.toHaveBeenCalled();
  });

  it("salir del campo sin cambiar el predeterminado no guarda nada", () => {
    const { onUpdateMetodologiaNoAplica } = renderCard();
    fireEvent.blur(campo());
    expect(onUpdateMetodologiaNoAplica).not.toHaveBeenCalled();
  });

  it("si el texto vuelve a ser igual al predeterminado, se guarda undefined", () => {
    const { onUpdateMetodologiaNoAplica } = renderCard({
      metodologia_no_aplica: "Motivo del físico.",
    });
    fireEvent.change(campo(), { target: { value: `  ${DEFAULT_28}\n` } });
    fireEvent.blur(campo());
    expect(onUpdateMetodologiaNoAplica).toHaveBeenCalledWith(undefined);
  });

  it("dejar el campo vacío guarda undefined y vuelve a mostrar el predeterminado", () => {
    const { onUpdateMetodologiaNoAplica } = renderCard({
      metodologia_no_aplica: "Motivo del físico.",
    });
    fireEvent.change(campo(), { target: { value: "   " } });
    fireEvent.blur(campo());
    expect(onUpdateMetodologiaNoAplica).toHaveBeenCalledWith(undefined);
    expect(campo().value).toBe(DEFAULT_28);
  });

  it("'Restaurar predeterminado' guarda undefined y repone el motivo predeterminado", () => {
    const { onUpdateMetodologiaNoAplica } = renderCard({
      metodologia_no_aplica: "Motivo del físico.",
    });
    fireEvent.click(screen.getByRole("button", { name: /Restaurar predeterminado/ }));
    expect(onUpdateMetodologiaNoAplica).toHaveBeenCalledWith(undefined);
    expect(campo().value).toBe(DEFAULT_28);
  });
});

describe("PreInformeModulo — el motivo se persiste en `metodologia_no_aplica`", () => {
  beforeEach(async () => {
    await resetTestDb();
    useDb.mockReturnValue({ isReady: true });
    vi.mocked(updateAndSync).mockClear();
  });

  async function seedVisitaCon28(campos: Partial<ConvInformeSeccion> = {}) {
    const { visita } = await seedGraph({ tipoEquipo: "CONVENCIONAL" });
    const seccionId = randomUUID();
    await db.conv_informe_secciones.add({
      id: seccionId,
      visita_id: visita!.id!,
      prueba_codigo: "2.8",
      orden: 8,
      incluida: false,
      sync_status: "synced",
      last_modified: new Date().toISOString(),
      ...campos,
    });
    return { visitaId: visita!.id!, seccionId };
  }

  async function expandir28() {
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalle de la prueba 2.8" }));
  }

  it("prueba apagada: precarga el motivo predeterminado del catálogo", async () => {
    const { visitaId } = await seedVisitaCon28();
    render(<PreInformeModulo visitaId={visitaId} />);
    await expandir28();
    const campo = (await screen.findByPlaceholderText(PLACEHOLDER)) as HTMLTextAreaElement;
    expect(campo.value).toBe(DEFAULT_28);
  });

  it("editar guarda `metodologia_no_aplica` en la sección", async () => {
    const { visitaId, seccionId } = await seedVisitaCon28();
    render(<PreInformeModulo visitaId={visitaId} />);
    await expandir28();
    const campo = await screen.findByPlaceholderText(PLACEHOLDER);
    fireEvent.change(campo, { target: { value: "El equipo es portátil." } });
    fireEvent.blur(campo);
    expect(updateAndSync).toHaveBeenCalledWith("conv_informe_secciones", seccionId, {
      metodologia_no_aplica: "El equipo es portátil.",
    });
  });

  it("restaurar limpia `metodologia_no_aplica` con null (un undefined no llega al servidor)", async () => {
    const { visitaId, seccionId } = await seedVisitaCon28({
      metodologia_no_aplica: "Motivo del físico.",
    });
    render(<PreInformeModulo visitaId={visitaId} />);
    await expandir28();
    const campo = (await screen.findByPlaceholderText(PLACEHOLDER)) as HTMLTextAreaElement;
    expect(campo.value).toBe("Motivo del físico.");
    fireEvent.click(screen.getByRole("button", { name: /Restaurar predeterminado/ }));
    expect(updateAndSync).toHaveBeenCalledWith("conv_informe_secciones", seccionId, {
      metodologia_no_aplica: null,
    });
  });

  it("prueba encendida: el campo no aparece al expandir", async () => {
    const { visitaId } = await seedVisitaCon28({ incluida: true });
    render(<PreInformeModulo visitaId={visitaId} />);
    await expandir28();
    await screen.findByText(/Ver textos del informe/);
    expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull();
  });
});
