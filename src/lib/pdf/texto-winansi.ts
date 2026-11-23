import type { jsPDF } from "jspdf";

/**
 * Las fuentes estándar de jsPDF (Helvetica) solo cubren WinAnsi (cp1252). Si
 * una cadena trae UN carácter fuera de ese juego (≤, −, μ, espacio fino…),
 * jsPDF codifica la cadena ENTERA a 2 bytes por carácter: el carácter sale
 * como basura (≤ → `"d`) y cada letra arrastra un byte nulo que se dibuja como
 * hueco (`i n d i c a n d o`). Todo texto que llega al PDF pasa por acá, así
 * que un texto de plantilla nuevo no puede volver a romper la maquetación.
 */

/** Caracteres de cp1252 fuera de Latin-1 (0x80–0x9F) que Helvetica sí dibuja. */
const EXTRAS_CP1252 = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

const REEMPLAZOS: Record<string, string> = {
  "≤": "<=",
  "≥": ">=",
  "≠": "!=",
  "≈": "~",
  "−": "-",
  "‐": "-",
  "‑": "-",
  "‒": "-",
  "→": "->",
  "←": "<-",
  "′": "'",
  "″": '"',
  μ: "µ",
};

const ESPACIOS = /[ -   　]/g;
const ANCHO_CERO = /[​-‍⁠﻿]/g;

function esWinAnsi(c: string): boolean {
  const code = c.codePointAt(0)!;
  return (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || EXTRAS_CP1252.has(c);
}

export function aWinAnsi(texto: string): string {
  const limpio = texto.replace(ESPACIOS, " ").replace(ANCHO_CERO, "");
  let out = "";
  for (const c of limpio) {
    if (esWinAnsi(c) || c === "\n" || c === "\r" || c === "\t") {
      out += c;
    } else if (c in REEMPLAZOS) {
      out += REEMPLAZOS[c];
    } else {
      // ź → z + acento combinante → z. Si no se descompone a WinAnsi, "?".
      const base = c.normalize("NFD").replace(/[̀-ͯ]/g, "");
      out += base && [...base].every(esWinAnsi) ? base : "?";
    }
  }
  return out;
}

function convertir<T>(texto: T): T {
  if (typeof texto === "string") return aWinAnsi(texto) as T;
  if (Array.isArray(texto)) return texto.map((t) => convertir(t)) as T;
  return texto;
}

/**
 * Envuelve los métodos de texto del `doc` (dibujo y medición) para que todo
 * pase por `aWinAnsi`. Cubre también autoTable, que usa estos mismos métodos.
 */
export function protegerTextoWinAnsi(doc: jsPDF): jsPDF {
  const text = doc.text.bind(doc);
  const splitTextToSize = doc.splitTextToSize.bind(doc);
  const getTextWidth = doc.getTextWidth.bind(doc);
  const getStringUnitWidth = doc.getStringUnitWidth.bind(doc);

  doc.text = ((t: string | string[], ...rest: unknown[]) =>
    (text as (...a: unknown[]) => jsPDF)(convertir(t), ...rest)) as jsPDF["text"];
  doc.splitTextToSize = ((t: string, ...rest: unknown[]) =>
    (splitTextToSize as (...a: unknown[]) => string[])(
      convertir(t),
      ...rest
    )) as jsPDF["splitTextToSize"];
  doc.getTextWidth = (t: string) => getTextWidth(aWinAnsi(t));
  doc.getStringUnitWidth = ((t: string, ...rest: unknown[]) =>
    (getStringUnitWidth as (...a: unknown[]) => number)(
      aWinAnsi(t),
      ...rest
    )) as jsPDF["getStringUnitWidth"];
  return doc;
}
