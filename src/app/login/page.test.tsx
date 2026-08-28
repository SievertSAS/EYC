import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// ============================================================
//  /login — sanitización del parámetro `redirect` (open-redirect).
// ============================================================

const push = vi.fn();
const refresh = vi.fn();
let redirectParam: string | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => ({ get: (k: string) => (k === "redirect" ? redirectParam : null) }),
}));

const signInWithPassword = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithPassword } }),
}));
vi.mock("@/lib/supabase/sync-engine", () => ({
  fullSync: vi.fn().mockResolvedValue({ errors: [] }),
}));
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...(props as Record<string, string>)} />;
  },
}));

import LoginPage, { safeRedirect } from "./page";

describe("safeRedirect", () => {
  it.each([
    ["/dashboard/visitas", "/dashboard/visitas"],
    ["/informes/abc", "/informes/abc"],
    [null, "/dashboard"],
    ["", "/dashboard"],
    ["https://evil.com", "/dashboard"],
    ["//evil.com", "/dashboard"],
    ["/\\evil.com", "/dashboard"],
    ["http://evil.com/path", "/dashboard"],
    ["javascript:alert(1)", "/dashboard"],
  ])("safeRedirect(%j) === %j", (input, expected) => {
    expect(safeRedirect(input as string | null)).toBe(expected);
  });
});

describe("LoginForm — redirect tras autenticar", () => {
  beforeEach(() => {
    push.mockClear();
    signInWithPassword.mockClear();
  });
  afterEach(cleanup);

  async function submit() {
    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText(/email|correo/i), {
      target: { value: "user@sievert.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/contraseña|password|•/i), {
      target: { value: "clave1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: /ingresar|entrar|iniciar/i }));
  }

  it("ignora un redirect externo y navega a /dashboard", async () => {
    redirectParam = "https://evil.com";
    await submit();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
  });

  it("respeta un redirect interno", async () => {
    redirectParam = "/dashboard/visitas";
    await submit();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard/visitas"));
  });
});
