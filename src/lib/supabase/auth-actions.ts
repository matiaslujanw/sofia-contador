"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authCookieName, authCookieOptions, getRecoveryConfig } from "./config";
import { clearRecoveryProof, getRecoverySession, setRecoveryProof } from "./recovery";
import { createSupabaseServerClient } from "./server";

export type AuthFormState = {
  message: string;
  kind: "error" | "success";
} | null;

const emailSchema = z.string().trim().email().max(254);
const aliasDomain = "cuentas.sofia.invalid";
const userNameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_-]{2,31}$/)
  .transform((name) => `${name}@${aliasDomain}`);
const signInSchema = z.object({
  identifier: z.union([emailSchema, userNameSchema]),
  password: z.string().min(1).max(512),
});
const newPasswordSchema = z.object({
  password: z.string().min(12).refine((value) => Buffer.byteLength(value, "utf8") <= 72),
  confirmation: z.string(),
}).refine(({ password, confirmation }) => password === confirmation);

export async function signIn(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const input = signInSchema.safeParse({ identifier: formData.get("identifier"), password: formData.get("password") });
  if (!input.success) return { kind: "error", message: "Revisá tu usuario o correo electrónico y contraseña." };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { kind: "error", message: "El acceso todavía no está configurado." };

  const { error, data } = await supabase.auth.signInWithPassword({ email: input.data.identifier, password: input.data.password });
  if (error || !data.session) return { kind: "error", message: "No pudimos ingresar. Revisá tus datos e intentá de nuevo." };

  await clearRecoveryProof();
  redirect("/inicio");
}

export async function requestPasswordRecovery(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return { kind: "error", message: "Ingresá un correo electrónico válido." };

  const config = getRecoveryConfig();
  const supabase = await createSupabaseServerClient();
  if (!supabase || !config) return { kind: "error", message: "La recuperación de contraseña todavía no está configurada." };

  if (!email.data.toLowerCase().endsWith(`@${aliasDomain}`)) {
    await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${config.origin}/auth/confirm` });
  }

  return { kind: "success", message: "Si el correo está habilitado, vas a recibir un enlace para cambiar la contraseña." };
}

export async function confirmPasswordRecovery(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const invalidLink = { kind: "error", message: "El enlace venció o ya se usó. Pedí un enlace nuevo." } as const;
  const tokenHash = formData.get("tokenHash");
  const code = formData.get("code");
  const flowId = formData.get("flowId");
  const config = getRecoveryConfig();
  const supabase = await createSupabaseServerClient();
  if (!supabase || !config) return { kind: "error", message: "La recuperación de contraseña todavía no está configurada." };

  if (typeof tokenHash === "string" && /^[A-Za-z0-9_\-]{20,300}$/.test(tokenHash)) {
    const { data, error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
    if (error || !data.session) return invalidLink;
    if (await setRecoveryProof(supabase, data.session.access_token)) redirect("/restablecer-clave");
  } else if (typeof code === "string" && /^[A-Za-z0-9_\-]{20,300}$/.test(code)) {
    const options = typeof flowId === "string" && flowId ? { flowId } : undefined;
    const { data, error } = await supabase.auth.exchangeCodeForSession(code, options);
    if (error || !data.session) return invalidLink;
    if ("redirectType" in data && data.redirectType === "recovery" && await setRecoveryProof(supabase, data.session.access_token)) {
      redirect("/restablecer-clave");
    }
  } else {
    return invalidLink;
  }

  await supabase.auth.signOut({ scope: "local" });
  await clearSessionCookies();
  await clearRecoveryProof();
  return invalidLink;
}

export async function resetPassword(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const input = newPasswordSchema.safeParse({ password: formData.get("password"), confirmation: formData.get("confirmation") });
  if (!input.success) {
    return { kind: "error", message: "Las contraseñas deben coincidir y tener entre 12 y 72 caracteres. Los caracteres especiales pueden reducir el máximo." };
  }

  const supabase = await getRecoverySession();
  if (!supabase) return { kind: "error", message: "La sesión de recuperación venció. Pedí un enlace nuevo." };

  const { error } = await supabase.auth.updateUser({ password: input.data.password });
  if (error) return { kind: "error", message: "No pudimos cambiar la contraseña. Probá con una contraseña nueva que no hayas usado antes." };

  await supabase.auth.signOut({ scope: "global" });
  await clearSessionCookies();
  await clearRecoveryProof();
  redirect("/ingresar?clave=actualizada");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut({ scope: "local" });
  await clearSessionCookies();
  await clearRecoveryProof();
  redirect("/ingresar");
}

async function clearSessionCookies() {
  const cookieStore = await cookies();
  const options = { path: authCookieOptions.path, maxAge: 0 };
  for (const { name } of cookieStore.getAll()) {
    if (name === authCookieName || name.startsWith(`${authCookieName}.`) || name.startsWith(`${authCookieName}-`)) {
      cookieStore.set(name, "", options);
    }
  }
}
