import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./format-relative-time";

describe("formatRelativeTime", () => {
  const now = new Date("2026-08-26T12:00:00.000Z");

  it("menos de un minuto → hace unos segundos", () => {
    expect(formatRelativeTime("2026-08-26T11:59:30.000Z", now)).toBe("hace unos segundos");
  });

  it("minutos → hace N min", () => {
    expect(formatRelativeTime("2026-08-26T11:58:00.000Z", now)).toBe("hace 2 min");
  });

  it("horas → hace N h", () => {
    expect(formatRelativeTime("2026-08-26T11:00:00.000Z", now)).toBe("hace 1 h");
  });

  it("días → hace N d", () => {
    expect(formatRelativeTime("2026-08-23T12:00:00.000Z", now)).toBe("hace 3 d");
  });
});
