// ============================================================
//  Parser del archivo de exportación RaySafe X2
//  Formato: TSV con encabezado, números con coma decimal (ES)
//  Columnas de datos (0-indexed):
//    4  = kVp medido
//    6  = Dosis (mGy)
//    8  = Tiempo (s)
//    10 = CHR — mm Al HVL
//    12 = Rendimiento (mGy/min)
// ============================================================

export interface RaysafeRow {
  numero: number;
  kv: number | null;
  dosis_mgy: number | null;
  tiempo_s: number | null;
  chr_mmal: number | null;
  rendimiento_mgy_min: number | null;
}

function toNum(s: string): number | null {
  if (!s || s.trim() === "") return null;
  const n = parseFloat(s.trim().replace(",", "."));
  return isNaN(n) ? null : n;
}

export function parseRaysafeTsv(text: string): RaysafeRow[] {
  const rows: RaysafeRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const cols = line.split("\t");
    const no = parseInt(cols[0], 10);
    if (isNaN(no) || no <= 0) continue; // fila de encabezado o vacía
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
