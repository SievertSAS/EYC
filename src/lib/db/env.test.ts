// Escenario de entorno db-S25: crypto.randomUUID no disponible (contexto
// inseguro / HTTP fuera de localhost). db-S26 (guards typeof window en los
// handlers blocked/versionchange) queda como verificación por inspección de
// código — el guard está inline en index.ts y todos los demás tests importan
// el módulo sin romper.

import { describe, it, expect, afterEach } from "vitest";
import { randomUUID } from "@/lib/uuid";

describe("db-S25: crypto.randomUUID no disponible (contexto inseguro)", () => {
  const cryptoObj = globalThis.crypto as { randomUUID?: () => string };
  const original = cryptoObj.randomUUID;

  afterEach(() => {
    cryptoObj.randomUUID = original;
  });

  it("randomUUID() lanza si el runtime no lo expone", () => {
    cryptoObj.randomUUID = undefined;
    expect(() => randomUUID()).toThrow();
  });

  it("con randomUUID disponible devuelve un UUID v4 válido", () => {
    expect(randomUUID()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });
});
