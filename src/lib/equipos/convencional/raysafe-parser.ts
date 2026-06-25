// ============================================================
//  Parser de archivos RaySafe X2
//  Soporta dos formatos:
//   - TSV exportado por el software RaySafe (cols fijas 4/6/8/10/12)
//   - XLSX de la plantilla Sievert (multi-hoja por paso)
// ============================================================

export interface RaysafeRow {
  numero: number;
  kv: number | null;
  dosis_mgy: number | null;
  tiempo_s: number | null;
  chr_mmal: number | null;
  rendimiento_mgy_min: number | null;
}

export interface RaysafePlantilla {
  principales: RaysafeRow[];
  conRejilla: RaysafeRow[];
  sinRejilla: RaysafeRow[];
  kerma: RaysafeRow[];
}

function toNum(s: string | number | null | undefined): number | null {
  if (s == null || s === "") return null;
  const str = String(s).trim().replace(",", ".");
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}

function wsToRows(ws: import("xlsx").WorkSheet): RaysafeRow[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require("xlsx") as typeof import("xlsx");
  const raw = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: "" });

  // Detectar si es la plantilla Sievert: col A = "Grupo" o número de grupo (1-8),
  // col G = No. RaySafe. En ese caso los datos empiezan en offset 6.
  const hasNominals =
    raw.length > 1 &&
    (String(raw[0]?.[0] ?? "").toLowerCase().includes("grupo") ||
      String(raw[1]?.[0] ?? "").toLowerCase().includes("grupo"));
  const off = hasNominals ? 6 : 0; // offset hacia col G en plantilla Sievert

  const rows: RaysafeRow[] = [];
  for (const row of raw) {
    const no = parseInt(String(row[off] ?? ""), 10);
    if (isNaN(no) || no <= 0) continue;
    rows.push({
      numero: no,
      kv: toNum(row[off + 4]),           // col K (kVp)
      dosis_mgy: toNum(row[off + 6]),     // col M (mGy)
      tiempo_s: toNum(row[off + 8]),      // col O (s)
      chr_mmal: toNum(row[off + 10]),     // col Q (mm Al HVL)
      rendimiento_mgy_min: toNum(row[off + 12]), // col S (mGy/min)
    });
  }
  return rows;
}

// ── TSV (exportación nativa RaySafe) ──────────────────────────
export function parseRaysafeTsv(text: string): RaysafeRow[] {
  const rows: RaysafeRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const cols = line.split("\t");
    const no = parseInt(cols[0], 10);
    if (isNaN(no) || no <= 0) continue;
    rows.push({
      numero: no,
      kv: toNum(cols[4] ?? ""),
      dosis_mgy: toNum(cols[6] ?? ""),
      tiempo_s: toNum(cols[8] ?? ""),
      chr_mmal: toNum(cols[10] ?? ""),
      rendimiento_mgy_min: toNum(cols[12] ?? ""),
    });
  }
  return rows;
}

// ── XLSX plantilla Sievert (multi-hoja) ───────────────────────
// Detecta si el archivo tiene la hoja "Paso2_Principales".
// Si sí, lee las 4 hojas y retorna RaysafePlantilla.
// Si no (archivo RaySafe nativo exportado como xlsx), lee solo hoja 0.
export async function parseRaysafeXlsx(
  file: File,
): Promise<{ tipo: "plantilla"; data: RaysafePlantilla } | { tipo: "simple"; data: RaysafeRow[] }> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });

  if (wb.SheetNames.includes("Paso2_Principales")) {
    return {
      tipo: "plantilla",
      data: {
        principales: wsToRows(wb.Sheets["Paso2_Principales"]),
        conRejilla: wsToRows(wb.Sheets["Paso3_ConRejilla"] ?? {}),
        sinRejilla: wsToRows(wb.Sheets["Paso4_SinRejilla"] ?? {}),
        kerma: wsToRows(wb.Sheets["Paso5_Kerma"] ?? {}),
      },
    };
  }

  // Archivo nativo RaySafe exportado como xlsx: leer primera hoja
  return { tipo: "simple", data: wsToRows(wb.Sheets[wb.SheetNames[0]]) };
}

// ── Entrada unificada para carga por paso individual ──────────
export async function parseRaysafeFile(file: File): Promise<RaysafeRow[]> {
  if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
    const result = await parseRaysafeXlsx(file);
    return result.tipo === "plantilla" ? result.data.principales : result.data;
  }
  const text = await file.text();
  return parseRaysafeTsv(text);
}
