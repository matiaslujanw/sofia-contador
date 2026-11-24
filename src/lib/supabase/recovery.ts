import { cookies } from "next/headers";
import { authCookieOptions, getRecoveryConfig } from "./config";
import { createRecoveryProof, recoveryLifetimeSeconds, verifyRecoveryProof } from "./recovery-proof";
import { createSupabaseServerClient, type WorkspaceSupabaseClient } from "./server";

const recoveryCookieName = "sofia-clave";
const recoveryCookieOptions = {
  path: "/restablecer-clave",
  httpOnly: authCookieOptions.httpOnly,
  secure: authCookieOptions.secure,
  sameSite: "strict" as const,
};

export async function setRecoveryProof(supabase: WorkspaceSupabaseClient, accessToken: string) {
  const config = getRecoveryConfig();
  if (!config) return false;

  const { data, error } = await supabase.auth.getClaims(accessToken);
  if (error || typeof data?.claims.session_id !== "string") return false;

  (await cookies()).set(recoveryCookieName, createRecoveryProof(data.claims.session_id, config.secret), {
    ...recoveryCookieOptions,
    maxAge: recoveryLifetimeSeconds,
  });
  return true;
}

export async function clearRecoveryProof() {
  (await cookies()).set(recoveryCookieName, "", { ...recoveryCookieOptions, maxAge: 0 });
}

export async function getRecoverySession() {
  const config = getRecoveryConfig();
  const proof = (await cookies()).get(recoveryCookieName)?.value;
  if (!config || !proof) return null;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getClaims();
  const sessionId = data?.claims.session_id;
  if (error || typeof sessionId !== "string" || !verifyRecoveryProof(proof, sessionId, config.secret)) return null;

  return supabase;
}
