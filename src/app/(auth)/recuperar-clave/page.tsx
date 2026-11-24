import type { Metadata } from "next";
import Link from "next/link";
import { getRecoveryConfig, getSupabaseConfig } from "@/lib/supabase/config";
import { AuthForm } from "../auth-form";
import styles from "../auth.module.css";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function RecoveryRequestPage() {
  const configured = Boolean(getRecoveryConfig() && getSupabaseConfig());

  return (
    <div className={styles.card}>
      <h1>Recuperá tu contraseña</h1>
      {configured ? <>
        <p>Te enviaremos un enlace para que puedas cambiarla.</p>
        <AuthForm mode="request" />
      </> : <p role="status">La recuperación de contraseña todavía está pendiente de configuración.</p>}
      <Link href="/ingresar" className={styles.textLink}>Volver al ingreso</Link>
    </div>
  );
}
