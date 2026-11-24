import { afterEach, describe, expect, it, vi } from "vitest";
import { getRecoveryConfig, getSupabaseConfig, isLocalDemoEnabled } from "./config";

afterEach(() => vi.unstubAllEnvs());

describe("modo de demostración", () => {
  it("requiere habilitación expresa, desarrollo y localhost", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SOFIA_DEMO_MODE", "1");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    expect(isLocalDemoEnabled("localhost:3000")).toBe(true);
    expect(isLocalDemoEnabled("127.0.0.1:3000")).toBe(true);
    expect(isLocalDemoEnabled("[::1]:3000")).toBe(true);
    expect(isLocalDemoEnabled("sofia.example.com")).toBe(false);
    expect(isLocalDemoEnabled(null)).toBe(false);

    vi.stubEnv("NODE_ENV", "production");
    expect(isLocalDemoEnabled("localhost:3000")).toBe(false);

    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SOFIA_DEMO_MODE", "0");
    expect(isLocalDemoEnabled("localhost:3000")).toBe(false);
  });

  it("bloquea la demostración si hay credenciales incompletas o incorrectas", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SOFIA_DEMO_MODE", "1");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://sofia.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    expect(isLocalDemoEnabled("localhost:3000")).toBe(false);
    expect(getSupabaseConfig()).toBeNull();
  });
});

describe("configuración privada", () => {
  it("solo usa claves publicables o JWT con rol anon", () => {
    const jwt = (role: string) => `header.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://sofia.supabase.co");

    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_secret_ejemplo");
    expect(getSupabaseConfig()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", jwt("service_role"));
    expect(getSupabaseConfig()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", jwt("anon"));
    expect(getSupabaseConfig()?.key).toBe(jwt("anon"));
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_ejemplo");
    expect(getSupabaseConfig()?.url).toBe("https://sofia.supabase.co");
  });

  it("requiere un origen canónico HTTPS en producción y un secreto de recuperación", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SOFIA_AUTH_SECRET", "a".repeat(32));
    vi.stubEnv("SOFIA_SITE_URL", "http://localhost:3000");
    expect(getRecoveryConfig()).toBeNull();

    vi.stubEnv("SOFIA_SITE_URL", "https://sofia.example.com/redireccion");
    expect(getRecoveryConfig()).toBeNull();
    vi.stubEnv("SOFIA_SITE_URL", "https://sofia.example.com");
    expect(getRecoveryConfig()?.origin).toBe("https://sofia.example.com");

    vi.stubEnv("SOFIA_AUTH_SECRET", "corto");
    expect(getRecoveryConfig()).toBeNull();
  });
});
