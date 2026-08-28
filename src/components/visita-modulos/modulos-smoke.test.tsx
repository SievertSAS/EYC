import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
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
