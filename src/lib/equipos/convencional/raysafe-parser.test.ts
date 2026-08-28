import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseRaysafeTsv, parseRaysafeXlsx, parseRaysafeFile } from "./raysafe-parser";

// El parser convierte exports de RaySafe X2 en filas normalizadas. Es una
// vía de ENTRADA de datos numéricos al informe — si parsea mal, los números
// del PDF salen mal sin ningún error visible.

// Columnas leídas por el parser TSV: 0=No, 4=kV, 6=mGy, 8=s, 10=mmAl, 12=mGy/min
function tsvLine(cols: (string | number)[]): string {
  const row = Array(13).fill("");
  cols.forEach((v, i) => (row[i] = String(v)));
  return row.join("\t");
}

describe("parseRaysafeTsv", () => {
  it("parsea una fila completa", () => {
    const tsv = tsvLine([1, "", "", "", "80.5", "", "1.23", "", "0.100", "", "2.35", "", "45.6"]);
    expect(parseRaysafeTsv(tsv)).toEqual([
      {
        numero: 1,
        kv: 80.5,
        dosis_mgy: 1.23,
        tiempo_s: 0.1,
        chr_mmal: 2.35,
        rendimiento_mgy_min: 45.6,
      },
    ]);
  });

  it("acepta coma decimal (formato es-CO)", () => {
    const [row] = parseRaysafeTsv(tsvLine([2, "", "", "", "70,25", "", "0,98"]));
    expect(row.kv).toBe(70.25);
    expect(row.dosis_mgy).toBe(0.98);
  });

  it("celda vacía o no numérica → null", () => {
    const [row] = parseRaysafeTsv(tsvLine([3, "", "", "", "", "", "N/A", "", "0.1"]));
    expect(row.kv).toBeNull();
    expect(row.dosis_mgy).toBeNull();
    expect(row.tiempo_s).toBe(0.1);
  });

  it("descarta líneas cuya col 0 no es entero positivo (headers, blancos)", () => {
    const tsv = [
      "No\tCol1\tCol2\tkV",
      "",
      tsvLine([1, "", "", "", "80"]),
      "   ",
      tsvLine([0, "", "", "", "80"]), // 0 no es válido
      tsvLine([-1, "", "", "", "80"]),
      tsvLine([2, "", "", "", "81"]),
    ].join("\n");
    const rows = parseRaysafeTsv(tsv);
    expect(rows.map((r) => r.numero)).toEqual([1, 2]);
  });

  it("archivo con layout inesperado → filas con todo null, SIN error (finding)", () => {
    // Si las columnas están corridas, el parser no se queja: devuelve la
    // fila con numero correcto y el resto null. → issue de validación.
    const [row] = parseRaysafeTsv("5\tvalor_en_col_1\totro\tmas");
    expect(row).toEqual({
      numero: 5,
      kv: null,
      dosis_mgy: null,
      tiempo_s: null,
      chr_mmal: null,
      rendimiento_mgy_min: null,
    });
  });

  it("TSV vacío → []", () => {
    expect(parseRaysafeTsv("")).toEqual([]);
  });
});

describe("parseRaysafeXlsx", () => {
  function xlsxFile(sheets: Record<string, (string | number)[][]>): File {
    const wb = XLSX.utils.book_new();
    for (const [name, rows] of Object.entries(sheets)) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
    }
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    return new File([buf], "test.xlsx");
  }

  it("plantilla Sievert (hoja Paso2_Principales) → tipo 'plantilla'", async () => {
    // Fila 0: header con "Grupo" en col A → offset 6 (datos desde col G).
    const header = [
      "Grupo",
      "",
      "",
      "",
      "",
      "",
      "No",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ];
    const dataRow = Array(19).fill("");
    dataRow[6] = 1; // No RaySafe
    dataRow[10] = 80; // col G+4 = kV
    dataRow[12] = 1.5; // col G+6 = mGy
    const file = xlsxFile({
      Paso2_Principales: [header, dataRow],
      Paso3_ConRejilla: [header],
      Paso4_SinRejilla: [header],
      Paso5_Kerma: [header],
    });

    const res = await parseRaysafeXlsx(file);
    expect(res.tipo).toBe("plantilla");
    if (res.tipo === "plantilla") {
      expect(res.data.principales).toEqual([
        {
          numero: 1,
          kv: 80,
          dosis_mgy: 1.5,
          tiempo_s: null,
          chr_mmal: null,
          rendimiento_mgy_min: null,
        },
      ]);
    }
  });

  it("xlsx sin hoja de plantilla → tipo 'simple' (lee hoja 0, offset 0)", async () => {
    const file = xlsxFile({ Hoja1: [[1, "", "", "", 75, "", 2.0]] });
    const res = await parseRaysafeXlsx(file);
    expect(res.tipo).toBe("simple");
    if (res.tipo === "simple") {
      expect(res.data[0]).toMatchObject({ numero: 1, kv: 75, dosis_mgy: 2.0 });
    }
  });
});

describe("parseRaysafeFile — dispatch por extensión", () => {
  it(".tsv / sin extensión xlsx → parsea como TSV", async () => {
    const file = new File(["1\t\t\t\t80\t\t1.5"], "export.txt");
    const rows = await parseRaysafeFile(file);
    expect(rows).toEqual([
      {
        numero: 1,
        kv: 80,
        dosis_mgy: 1.5,
        tiempo_s: null,
        chr_mmal: null,
        rendimiento_mgy_min: null,
      },
    ]);
  });

  it(".xlsx plantilla → devuelve principales", async () => {
    const header = Array(19).fill("");
    header[0] = "Grupo";
    const dataRow = Array(19).fill("");
    dataRow[6] = 1;
    dataRow[10] = 90;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([header, dataRow]),
      "Paso2_Principales"
    );
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const file = new File([buf], "plantilla.xlsx");

    const rows = await parseRaysafeFile(file);
    expect(rows[0]).toMatchObject({ numero: 1, kv: 90 });
  });
});
