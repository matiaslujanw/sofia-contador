import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmPasswordRecovery, requestPasswordRecovery, resetPassword, signIn } from "./auth-actions";

const mocks = vi.hoisted(() => {
  const auth = { signInWithPassword: vi.fn(), resetPasswordForEmail: vi.fn(), verifyOtp: vi.fn(),
    exchangeCodeForSession: vi.fn(), updateUser: vi.fn(), signOut: vi.fn() };

  return {
    auth,
    redirect: vi.fn((target: string) => { throw new Error(`redirect ${target}`); }),
    setRecoveryProof: vi.fn(),
    getRecoverySession: vi.fn(),
    clearRecoveryProof: vi.fn(),
    setCookie: vi.fn(),
  };
});

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: mocks.setCookie }) }));
vi.mock("./server", () => ({ createSupabaseServerClient: async () => ({ auth: mocks.auth }) }));
vi.mock("./config", () => ({
  authCookieName: "sofia-session",
  authCookieOptions: { path: "/" },
  getRecoveryConfig: () => ({ origin: "https://sofia.example", secret: "test-only" }),
}));
vi.mock("./recovery", () => ({
  setRecoveryProof: mocks.setRecoveryProof,
  clearRecoveryProof: mocks.clearRecoveryProof,
  getRecoverySession: mocks.getRecoverySession,
}));

function fields(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => vi.resetAllMocks());

describe("acciones de autenticación", () => {
  it("valida los datos de ingreso antes de consultar Supabase", async () => {
    const result = await signIn(null, fields({ email: "incorrecto", password: "ejemplo" }));
    expect(result?.kind).toBe("error");
    expect(mocks.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("usa el origen configurado y oculta diferencias según el correo", async () => {
    mocks.auth.resetPasswordForEmail.mockResolvedValueOnce({ error: new Error("unknown account") });
    const input = fields({ email: "prueba@example.com" });
    const failed = await requestPasswordRecovery(null, input);
    mocks.auth.resetPasswordForEmail.mockResolvedValueOnce({ error: null });
    const succeeded = await requestPasswordRecovery(null, input);

    expect(failed).toEqual(succeeded);
    expect(mocks.auth.resetPasswordForEmail).toHaveBeenCalledWith("prueba@example.com", {
      redirectTo: "https://sofia.example/auth/confirm",
    });
  });

  it("solo acredita un OTP verificado con propósito de recuperación", async () => {
    const tokenHash = "c".repeat(32);
    mocks.auth.verifyOtp.mockResolvedValue({ data: { session: { access_token: "access-test" } }, error: null });
    mocks.setRecoveryProof.mockResolvedValue(true);

    await expect(confirmPasswordRecovery(null, fields({ tokenHash }))).rejects.toThrow("redirect /restablecer-clave");
    expect(mocks.auth.verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: tokenHash });
    expect(mocks.setRecoveryProof).toHaveBeenCalledWith({ auth: mocks.auth }, "access-test");
  });

  it("descarta una sesión PKCE que no corresponde a recuperación", async () => {
    mocks.auth.exchangeCodeForSession.mockResolvedValue({ data: { session: { access_token: "access-test" }, redirectType: null }, error: null });

    const result = await confirmPasswordRecovery(null, fields({ code: "c".repeat(32), flowId: "flow-test" }));
    expect(result?.kind).toBe("error");
    expect(mocks.auth.exchangeCodeForSession).toHaveBeenCalledWith("c".repeat(32), { flowId: "flow-test" });
    expect(mocks.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.setRecoveryProof).not.toHaveBeenCalled();
  });

  it("exige una sesión de recuperación y revoca las sesiones después del cambio", async () => {
    const password = "una contraseña nueva";
    const input = fields({ password, confirmation: password });

    expect((await resetPassword(null, input))?.kind).toBe("error");
    expect(mocks.auth.updateUser).not.toHaveBeenCalled();

    mocks.getRecoverySession.mockResolvedValue({ auth: mocks.auth });
    mocks.auth.updateUser.mockResolvedValue({ error: null });
    await expect(resetPassword(null, input)).rejects.toThrow("redirect /ingresar?clave=actualizada");
    expect(mocks.auth.updateUser).toHaveBeenCalledWith({ password });
    expect(mocks.auth.signOut).toHaveBeenCalledWith({ scope: "global" });
  });
});
