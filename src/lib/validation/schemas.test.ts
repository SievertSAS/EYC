import { describe, it, expect } from "vitest";
import { createUsuarioSchema } from "./schemas";

describe("createUsuarioSchema", () => {
  const valid = {
    email: "tecnico@sievert.co",
    password: "Segura123",
    nombre: "Juan Pérez",
    cedula: "1234567890",
    cargo: "tecnico" as const,
  };

  it("accepts valid input", () => {
    const result = createUsuarioSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("accepts valid input with optional telefono", () => {
    const result = createUsuarioSchema.safeParse({
      ...valid,
      telefono: "+573001234567",
    });
    expect(result.success).toBe(true);
  });

  it("trims and normalizes nombre whitespace", () => {
    const result = createUsuarioSchema.safeParse({
      ...valid,
      nombre: "  Juan   Pérez  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nombre).toBe("Juan Pérez");
    }
  });

  it("rejects invalid email", () => {
    const result = createUsuarioSchema.safeParse({
      ...valid,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = createUsuarioSchema.safeParse({
      ...valid,
      password: "Ab1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password without digits", () => {
    const result = createUsuarioSchema.safeParse({
      ...valid,
      password: "SoloLetras",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password without letters", () => {
    const result = createUsuarioSchema.safeParse({
      ...valid,
      password: "12345678",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid cedula format", () => {
    const result = createUsuarioSchema.safeParse({
      ...valid,
      cedula: "123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects cedula with letters", () => {
    const result = createUsuarioSchema.safeParse({
      ...valid,
      cedula: "123abc456",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid cargo", () => {
    const result = createUsuarioSchema.safeParse({
      ...valid,
      cargo: "superadmin",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid cargos", () => {
    for (const cargo of ["tecnico", "comercial", "coordinador", "programador"]) {
      const result = createUsuarioSchema.safeParse({ ...valid, cargo });
      expect(result.success, `cargo "${cargo}" should be valid`).toBe(true);
    }
  });

  it("rejects invalid telefono format", () => {
    const result = createUsuarioSchema.safeParse({
      ...valid,
      telefono: "abc123",
    });
    expect(result.success).toBe(false);
  });

  it("allows empty string for telefono", () => {
    const result = createUsuarioSchema.safeParse({
      ...valid,
      telefono: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects nombre that is too short", () => {
    const result = createUsuarioSchema.safeParse({
      ...valid,
      nombre: "J",
    });
    expect(result.success).toBe(false);
  });
});
