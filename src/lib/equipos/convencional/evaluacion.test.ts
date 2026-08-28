import { describe, it, expect } from "vitest";
import { evaluarConceptoPrueba, tieneCriterio, detalle213 } from "./evaluacion";
import type { DatosEvalConv } from "./evaluacion";

// evaluacion.ts es la ÚNICA fuente de verdad de "Conforme / No_conforme".
// Estos tests cubren los 20 evaluadores: pendiente (sin datos), un caso
// Conforme y uno No_conforme, y el hallazgo #13 (datos incompletos →
// "Conforme" falso). Los PIN marcados con BUG #13 fijan comportamiento que
// se revisa prueba por prueba en un issue aparte.

function datos(over: Partial<DatosEvalConv> = {}): DatosEvalConv {
  return {
    mediciones: [],
    inspeccion: [],
    elementos: [],
    raysafeMediciones: [],
    ddiMediciones: [],
    uniformidadDetector: [],
    cassettes: [],
    uniformidadCr: [],
    caeMediciones: [],
    ...over,
  } as DatosEvalConv;
}

const ev = (codigo: string, d: DatosEvalConv) => evaluarConceptoPrueba(codigo, d);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rs = (o: any) => o; // helper de tipado laxo para filas conv_*

describe("evaluacion — sin datos, todo pendiente (undefined)", () => {
  it("cada código con criterio devuelve undefined con DatosEvalConv vacío", () => {
    for (let i = 1; i <= 21; i++) {
      const c = `2.${i}`;
      if (!tieneCriterio(c)) continue;
      expect(ev(c, datos()), c).toBeUndefined();
    }
  });

  it("2.8 nunca tiene criterio", () => {
    expect(tieneCriterio("2.8")).toBe(false);
    expect(ev("2.8", datos())).toBeUndefined();
  });
});

// ─── 2.1 / 2.2 rollups ───

describe("2.1 — levantamiento (rollup de concepto por punto)", () => {
  it("todos Conforme → Conforme", () => {
    expect(ev("2.1", datos({ mediciones: [rs({ concepto: "Conforme" })] }))).toBe("Conforme");
  });
  it("un No_conforme → No_conforme", () => {
    expect(
      ev(
        "2.1",
        datos({ mediciones: [rs({ concepto: "Conforme" }), rs({ concepto: "No_conforme" })] })
      )
    ).toBe("No_conforme");
  });
});

describe("2.2 — inspección + elementos (rollup)", () => {
  it("sin nada iniciado → undefined", () => {
    expect(ev("2.2", datos({ inspeccion: [rs({ concepto: null })] }))).toBeUndefined();
  });
  it("inspección Conforme → Conforme", () => {
    expect(ev("2.2", datos({ inspeccion: [rs({ concepto: "Conforme" })] }))).toBe("Conforme");
  });
  it("un elemento No_conforme → No_conforme", () => {
    expect(ev("2.2", datos({ elementos: [rs({ concepto: "No_conforme" })] }))).toBe("No_conforme");
  });
});

// ─── 2.3 colimación ───

describe("2.3 — colimación", () => {
  it("dentro de tolerancia + esfera centrada → Conforme", () => {
    expect(
      ev(
        "2.3",
        datos({
          colimacion: rs({
            sid_cm: 100,
            anodo_nominal: 10,
            anodo_medido: 10,
            catodo_nominal: 10,
            catodo_medido: 10,
            izquierda_nominal: 10,
            izquierda_medido: 10,
            derecha_nominal: 10,
            derecha_medido: 10,
            posicion_esfera: "Centro",
          }),
        })
      )
    ).toBe("Conforme");
  });
  it("desviación grande → No_conforme", () => {
    expect(
      ev(
        "2.3",
        datos({
          colimacion: rs({
            sid_cm: 100,
            anodo_nominal: 10,
            anodo_medido: 20,
            posicion_esfera: "Centro",
          }),
        })
      )
    ).toBe("No_conforme");
  });
});

// ─── 2.4 / 2.5 RaySafe por grupo nominal ───

const shot = (over: Record<string, unknown>) =>
  rs({ tipo_medicion: "principal", grupo_numero: 1, ...over });

describe("2.4 — tiempo (desv ≤10%, CV ≤10%)", () => {
  it("2 disparos exactos → Conforme", () => {
    expect(
      ev(
        "2.4",
        datos({
          raysafeMediciones: [
            shot({ tiempo_nominal_s: 0.1, tiempo_medido_s: 0.1 }),
            shot({ tiempo_nominal_s: 0.1, tiempo_medido_s: 0.1 }),
          ],
        })
      )
    ).toBe("Conforme");
  });
  it("desviación >10% → No_conforme", () => {
    expect(
      ev(
        "2.4",
        datos({
          raysafeMediciones: [
            shot({ tiempo_nominal_s: 0.1, tiempo_medido_s: 0.2 }),
            shot({ tiempo_nominal_s: 0.1, tiempo_medido_s: 0.2 }),
          ],
        })
      )
    ).toBe("No_conforme");
  });

  it("PIN BUG #13 — un solo disparo por grupo: CV=0 pasa el criterio de repetibilidad", () => {
    // Con n=1 en el grupo, cvPct=0 <= 10 → el criterio de repetibilidad no
    // discrimina nada. Se revisa prueba por prueba (issue).
    expect(
      ev(
        "2.4",
        datos({ raysafeMediciones: [shot({ tiempo_nominal_s: 0.1, tiempo_medido_s: 0.1 })] })
      )
    ).toBe("Conforme");
  });
});

describe("2.5 — kV (desv ≤10%, CV ≤5%)", () => {
  it("2 disparos exactos → Conforme", () => {
    expect(
      ev(
        "2.5",
        datos({
          raysafeMediciones: [
            shot({ kv_nominal: 80, kv_medido: 80 }),
            shot({ kv_nominal: 80, kv_medido: 80 }),
          ],
        })
      )
    ).toBe("Conforme");
  });
});

// ─── 2.6 CHR ───

describe("2.6 — capa hemirreductora", () => {
  it("CHR promedio ≥ mínimo por kV → Conforme", () => {
    expect(
      ev("2.6", datos({ raysafeMediciones: [shot({ kv_nominal: 80, chr_medido_mmal: 3.0 })] }))
    ).toBe("Conforme");
  });
  it("CHR bajo el mínimo → No_conforme", () => {
    expect(
      ev("2.6", datos({ raysafeMediciones: [shot({ kv_nominal: 80, chr_medido_mmal: 1.0 })] }))
    ).toBe("No_conforme");
  });
});

// ─── 2.9 / 2.10 DDI/EI ───

describe("2.9 — DDI/EI desviación vs base ≤ ±20%", () => {
  it("dentro de ±20% → Conforme", () => {
    expect(
      ev("2.9", datos({ ddiMediciones: [rs({ grupo: 1, toma_numero: 1, ei: 100, ei_base: 100 })] }))
    ).toBe("Conforme");
  });
  it(">20% → No_conforme", () => {
    expect(
      ev("2.9", datos({ ddiMediciones: [rs({ grupo: 1, toma_numero: 1, ei: 200, ei_base: 100 })] }))
    ).toBe("No_conforme");
  });
});

describe("2.10 — DDI/EI CV ≤ 20% (necesita ≥2)", () => {
  it("una sola medición → undefined (no evalúa CV con n<2)", () => {
    expect(ev("2.10", datos({ ddiMediciones: [rs({ grupo: 1, ei: 100 })] }))).toBeUndefined();
  });
  it("2 mediciones iguales → Conforme", () => {
    expect(
      ev("2.10", datos({ ddiMediciones: [rs({ grupo: 1, ei: 100 }), rs({ grupo: 1, ei: 100 })] }))
    ).toBe("Conforme");
  });
});

// ─── 2.12 resolución, 2.13 bajo contraste ───

describe("2.12 — resolución ≥ 2.4 pl/mm", () => {
  it("2.5 → Conforme; 2.0 → No_conforme", () => {
    expect(ev("2.12", datos({ resolucion: rs({ pares_lineas_plmm: 2.5 }) }))).toBe("Conforme");
    expect(ev("2.12", datos({ resolucion: rs({ pares_lineas_plmm: 2.0 }) }))).toBe("No_conforme");
  });
});

describe("2.13 — bajo contraste (detalle213)", () => {
  it("detalle213 sin datos → undefined", () => {
    expect(detalle213({})).toBeUndefined();
  });
  it(">3 niveles visibles → Conforme", () => {
    const bc = rs({
      contraste_9_4: true,
      contraste_8_0: true,
      contraste_5_6: true,
      contraste_4_0: true,
    });
    expect(ev("2.13", datos({ bajoContraste: bc }))).toBe("Conforme");
    expect(detalle213({ bajoContraste: bc })?.visibles).toBe(4);
  });
  it("≤3 y sin alcanzar umbral bajo → No_conforme", () => {
    const bc = rs({ contraste_9_4: true, contraste_8_0: true });
    expect(ev("2.13", datos({ bajoContraste: bc }))).toBe("No_conforme");
  });
});

// ─── 2.15 uniformidad CR ───

describe("2.15 — uniformidad IP CR: CV(EI) ≤ 10% (necesita ≥2)", () => {
  it("n<2 → undefined", () => {
    expect(ev("2.15", datos({ uniformidadCr: [rs({ ei: 100 })] }))).toBeUndefined();
  });
  it("2 EI iguales → Conforme", () => {
    expect(ev("2.15", datos({ uniformidadCr: [rs({ ei: 100 }), rs({ ei: 100 })] }))).toBe(
      "Conforme"
    );
  });
});

// ─── #13: 2.16-2.21 con setup/base pero SIN mediciones → undefined (fix) ───

describe("#13 — base/setup presente pero mediciones incompletas → undefined (no 'Conforme')", () => {
  it("2.16 MTF: base pero sin desviación comparable → undefined", () => {
    expect(
      ev("2.16", datos({ mtf: rs({ mtf50_horizontal: 5, mtf50_base_vertical: 5 }) }))
    ).toBeUndefined();
  });

  it("2.17 CAE sensibilidad: base pero toma 9 sin valores → undefined", () => {
    expect(
      ev(
        "2.17",
        datos({
          caeSetup: rs({ mas_base_217: 10 }),
          caeMediciones: [rs({ toma_numero: 9, carga_mas: null, ei: null, di: null })],
        })
      )
    ).toBeUndefined();
  });

  it("2.18 CAE consistencia: tomas presentes pero sin valores → undefined", () => {
    expect(
      ev("2.18", datos({ caeMediciones: [rs({ toma_numero: 2, carga_mas: null, ei: null })] }))
    ).toBeUndefined();
  });

  it("2.19 CAE repetibilidad: ≥2 tomas pero sin valores → undefined", () => {
    expect(
      ev(
        "2.19",
        datos({
          caeMediciones: [
            rs({ toma_numero: 9, carga_mas: null, ei: null }),
            rs({ toma_numero: 10, carga_mas: null, ei: null }),
          ],
        })
      )
    ).toBeUndefined();
  });

  it("2.20 CAE compensación: base pero sin tomas comparables → undefined", () => {
    expect(ev("2.20", datos({ caeSetup: rs({ mas_base_60kv: 10 }) }))).toBeUndefined();
  });

  it("2.21 dosis: base pero sin dosis medida → undefined", () => {
    expect(
      ev(
        "2.21",
        datos({
          raysafeMediciones: [
            rs({ tipo_medicion: "sin_rejilla", dosis_base_mgy: 0.5, dosis_medida_mgy: null }),
          ],
        })
      )
    ).toBeUndefined();
  });
});

// ─── PIN: "primera medición = línea base" (semántica a revisar, issue) ───

describe("PIN — sin línea base previa (a revisar prueba por prueba, issue)", () => {
  it("2.16 MTF sin base → 'Conforme' (comportamiento actual)", () => {
    expect(ev("2.16", datos({ mtf: rs({ mtf50_horizontal: 5 }) }))).toBe("Conforme");
  });
});
