import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isLocalDemoEnabled } from "./config";
import { createSupabaseServerClient, type WorkspaceSupabaseClient } from "./server";

type WorkspaceAccess = {
  mode: "auth";
  userId: string;
  email: string | null;
  supabase: WorkspaceSupabaseClient;
} | { mode: "demo" };

export async function getWorkspaceAccess(): Promise<WorkspaceAccess | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const host = (await headers()).get("host");
    return isLocalDemoEnabled(host) ? { mode: "demo" } : null;
  }

  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub || claims.is_anonymous === true) return null;

  return {
    mode: "auth",
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    supabase,
  };
}

export async function requireWorkspaceAccess(): Promise<WorkspaceAccess> {
  const access = await getWorkspaceAccess();
  if (!access) redirect("/ingresar");
  return access;
}
