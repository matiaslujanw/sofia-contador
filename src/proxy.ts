import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authCookieOptions, getSupabaseConfig } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = getSupabaseConfig();

  if (config) {
    const supabase = createServerClient(config.url, config.key, {
      cookieOptions: authCookieOptions,
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, cacheHeaders) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(cacheHeaders).forEach(([name, value]) => response.headers.set(name, value));
        },
      },
    });

    await supabase.auth.getClaims();
  }

  response.headers.set("Cache-Control", "private, no-store");
  if (request.nextUrl.pathname.startsWith("/auth/")) response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2)$).*)"],
};
