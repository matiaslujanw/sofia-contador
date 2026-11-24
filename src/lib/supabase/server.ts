import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { authCookieOptions, getSupabaseConfig } from "./config";

export async function createSupabaseServerClient() {
  const config = getSupabaseConfig();
  if (!config) return null;

  const cookieStore = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Los Server Components reciben la sesión renovada del proxy.
        }
      },
    },
  });
}

export type WorkspaceSupabaseClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
