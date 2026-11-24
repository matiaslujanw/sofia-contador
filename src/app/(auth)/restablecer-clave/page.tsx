import type { Metadata } from "next";
import Link from "next/link";
import { getRecoverySession } from "@/lib/supabase/recovery";
import { AuthForm } from "../auth-form";
import styles from "../auth.module.css";

export const metadata: Metadata = { title: "Restablecer contraseña" };

export default async function ResetPasswordPage() {
  const supabase = await getRecoverySession();

  return (
    <div className={styles.card}>
      <h1>Elegí una contraseña nueva</h1>
      {supabase ? <AuthForm mode="reset" /> : <>
        <p>La sesión de recuperación venció o todavía no fue confirmada.</p>
        <Link href="/recuperar-clave" className={styles.textLink}>Pedir un enlace nuevo</Link>
      </>}
      <Link href="/ingresar" className={styles.textLink}>Volver al ingreso</Link>
    </div>
  );
}
