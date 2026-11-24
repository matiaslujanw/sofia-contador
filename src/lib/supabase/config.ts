const loopbackHost = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i;

function parseHttpUrl(value: string | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value);
    const isLocalHttp = process.env.NODE_ENV !== "production" &&
      url.protocol === "http:" && loopbackHost.test(url.host);

    if ((url.protocol !== "https:" && !isLocalHttp) || url.username || url.password) return null;
    if (url.pathname !== "/" || url.search || url.hash) return null;
    return url;
  } catch {
    return null;
  }
}

function isPublishableKey(key: string) {
  if (key.startsWith("sb_publishable_")) return true;

  // Las claves JWT heredadas son válidas únicamente con el rol anónimo.
  try {
    const parts = key.split(".");
    if (parts.length !== 3) return false;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString()) as { role?: unknown };
    return payload.role === "anon";
  } catch {
    return false;
  }
}

export function getSupabaseConfig() {
  const url = parseHttpUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  return url && key && isPublishableKey(key) ? { url: url.origin, key } : null;
}

export function isLocalDemoEnabled(host: string | null) {
  return process.env.NODE_ENV === "development" &&
    process.env.SOFIA_DEMO_MODE === "1" &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() &&
    host !== null && loopbackHost.test(host);
}

export function getRecoveryConfig() {
  const origin = parseHttpUrl(process.env.SOFIA_SITE_URL);
  const secret = process.env.SOFIA_AUTH_SECRET;
  return origin && secret && secret.length >= 32 ? { origin: origin.origin, secret } : null;
}

export const authCookieName = "sofia-session";
export const authCookieOptions = {
  name: authCookieName,
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};
