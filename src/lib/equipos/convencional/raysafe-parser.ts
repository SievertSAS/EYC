// ============================================================
//  Parser de archivos RaySafe X2
//  Soporta dos formatos:
//   - TSV exportado por el software RaySafe (cols fijas 4/6/8/10/12)
//   - XLSX de la plantilla Sievert (cols: kVp medido, Dosis, Tiempo, CHR, Rend)
// ============================================================

export interface RaysafeRow {
  numero: number;
  kv: number | null;
  dosis_mgy: number | null;
  tiempo_s: number | null;
  chr_mmal: number | null;
  rendimiento_mgy_min: number | null;
}

function toNum(s: string | number | null | undefined): number | null {
  if (s == null || s === "") return null;
  const str = String(s).trim().replace(",", ".");
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
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

// ── XLSX (plantilla Sievert) ───────────────────────────────────
// Columnas: A=No, B=Sensor, C=Fecha, D=Hora,
//           E=kVp medido, F=(kVp), G=Dosis(mGy), H=(mGy),
//           I=Tiempo(s), J=(s), K=CHR(mmAl), L=(mmAlHVL),
//           M=Rend(mGy/min), N=(mGy/min)
export async function parseRaysafeXlsx(file: File): Promise<RaysafeRow[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  const rows: RaysafeRow[] = [];
  for (const row of raw as (string | number)[][]) {
    const no = parseInt(String(row[0]), 10);
    if (isNaN(no) || no <= 0) continue;
    rows.push({
      numero: no,
      kv: toNum(row[4]),
      dosis_mgy: toNum(row[6]),
      tiempo_s: toNum(row[8]),
      chr_mmal: toNum(row[10]),
      rendimiento_mgy_min: toNum(row[12]),
    });
  }
  return rows;
}

// ── Entrada unificada ─────────────────────────────────────────
export async function parseRaysafeFile(file: File): Promise<RaysafeRow[]> {
  if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
    return parseRaysafeXlsx(file);
  }
  const text = await file.text();
  return parseRaysafeTsv(text);
}
