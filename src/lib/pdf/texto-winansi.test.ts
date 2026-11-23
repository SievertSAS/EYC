import { describe, it, expect } from "vitest";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { aWinAnsi, protegerTextoWinAnsi } from "./texto-winansi";

/** Cadenas de los operadores Tj del contenido de la página (sin comprimir). */
function cadenasTj(doc: jsPDF): string[] {
  return doc
    .output()
    .split("\n")
    .filter((l) => l.endsWith("Tj"));
}

describe("aWinAnsi", () => {
  it("reemplaza los símbolos matemáticos fuera de WinAnsi por equivalentes legibles", () => {
    expect(aWinAnsi("desviación ≤ 10 %, CV ≥ 5 %")).toBe("desviación <= 10 %, CV >= 5 %");
    expect(aWinAnsi("−3 ≈ 2 ≠ 1")).toBe("-3 ~ 2 != 1");
    expect(aWinAnsi("10 μGy")).toBe("10 µGy");
  });

  it("normaliza espacios especiales y quita los de ancho cero", () => {
    expect(aWinAnsi("10 % a​b﻿")).toBe("10 % ab");
  });

  it("deja intactos Latin-1 y los extras de cp1252 (tildes, ±, °, comillas, rayas)", () => {
    const texto = "Tensión ±10 % a 25 °C, “nominal” – ñ … € • ²³ ×";
    expect(aWinAnsi(texto)).toBe(texto);
  });

  it("descompone letras con diacríticos fuera de Latin-1 y marca lo irrepresentable", () => {
    expect(aWinAnsi("Łódź")).toBe("?ódz");
    expect(aWinAnsi("Δ")).toBe("?");
  });
});

describe("protegerTextoWinAnsi", () => {
  it("una línea con ≤ se codifica en 1 byte por carácter (sin letras espaciadas)", () => {
    const doc = protegerTextoWinAnsi(new jsPDF({ compress: false }));
    doc.text("indicando inestabilidad (CV ≤ 5 %)", 10, 10);
    const [tj] = cadenasTj(doc);
    expect(tj).toBe("(indicando inestabilidad \\(CV <= 5 %\\)) Tj");
    expect(tj).not.toContain("\u0000");
  });

  it("mide y parte el texto ya convertido (el ancho coincide con lo que se dibuja)", () => {
    const doc = protegerTextoWinAnsi(new jsPDF());
    expect(doc.getTextWidth("a ≤ b")).toBeCloseTo(doc.getTextWidth("a <= b"), 5);
    expect(doc.splitTextToSize("a ≤ b", 100)).toEqual(["a <= b"]);
  });

  it("también cubre las celdas de autoTable", () => {
    const doc = protegerTextoWinAnsi(new jsPDF({ compress: false }));
    autoTable(doc, { head: [["Criterio"]], body: [["CV ≤ 5 %"]] });
    const tjs = cadenasTj(doc).join("\n");
    expect(tjs).toContain("(CV <= 5 %) Tj");
    expect(tjs).not.toContain("\u0000");
  });
});
