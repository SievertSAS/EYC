import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// ============================================================
//  /login — sanitización del parámetro `redirect` (open-redirect).
// ============================================================

const push = vi.fn();
const refresh = vi.fn();
let redirectParam: string | null = null;
let disabledParam: string | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => ({
    get: (k: string) =>
      k === "redirect" ? redirectParam : k === "disabled" ? disabledParam : null,
  }),
}));

const signInWithPassword = vi
  .fn()
  .mockResolvedValue({ data: { user: { id: "auth-1" } }, error: null });
const signOut = vi.fn().mockResolvedValue({ error: null });
// Perfil devuelto por .from("usuarios").select("activo").eq(...).single()
let perfilResult: { data: unknown; error: unknown } = { data: { activo: true }, error: null };
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithPassword, signOut },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => perfilResult }) }),
    }),
  }),
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
    signOut.mockClear();
    redirectParam = null;
    disabledParam = null;
    perfilResult = { data: { activo: true }, error: null };
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

describe("LoginForm — gate de usuario deshabilitado (#58)", () => {
  beforeEach(() => {
    push.mockClear();
    signInWithPassword.mockClear();
    signOut.mockClear();
    redirectParam = null;
    disabledParam = null;
    perfilResult = { data: { activo: true }, error: null };
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

  it("un usuario activo=false no entra: signOut + mensaje, sin navegar", async () => {
    perfilResult = { data: { activo: false }, error: null };
    await submit();
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByText(/deshabilitado/i)).toBeInTheDocument();
  });

  it("un usuario sin perfil (PGRST116) tampoco entra", async () => {
    perfilResult = { data: null, error: { code: "PGRST116" } };
    await submit();
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByText(/perfil/i)).toBeInTheDocument();
  });

  it("un error transitorio al verificar NO bloquea el login", async () => {
    perfilResult = { data: null, error: { code: "500", message: "boom" } };
    await submit();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(signOut).not.toHaveBeenCalled();
  });

  it("con ?disabled=1 muestra el mensaje al abrir el login", () => {
    disabledParam = "1";
    render(<LoginPage />);
    expect(screen.getByText(/deshabilitado/i)).toBeInTheDocument();
  });
});
