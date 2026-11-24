import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getWorkspaceAccess } from "@/lib/supabase/access";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { AuthForm } from "../auth-form";
import styles from "../auth.module.css";

export const metadata: Metadata = { title: "Ingresar" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ clave?: string }> }) {
  const access = await getWorkspaceAccess();
  if (access?.mode === "auth") redirect("/inicio");

  const configured = getSupabaseConfig() !== null;
  const { clave } = await searchParams;

  return (
    <div className={styles.card}>
      <h1>Ingresá a Sofía</h1>
      {access?.mode === "demo" ? <>
        <p>Explorá el espacio de trabajo con empresas y movimientos de ejemplo.</p>
        <Link href="/inicio" className={styles.submit}>Abrir demostración</Link>
      </> : configured ? <>
        <p>Ingresá con el correo habilitado para tu estudio.</p>
        {clave === "actualizada" && <p role="status" className={styles.success}>Contraseña actualizada. Ya podés ingresar.</p>}
        <AuthForm mode="signin" />
        <Link href="/recuperar-clave" className={styles.textLink}>¿Olvidaste tu contraseña?</Link>
      </> : (
        <p role="status">El acceso privado todavía está pendiente de configuración.</p>
      )}
    </div>
  );
}
