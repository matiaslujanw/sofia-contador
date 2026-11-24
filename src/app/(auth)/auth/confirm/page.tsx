import type { Metadata } from "next";
import Link from "next/link";
import { getRecoveryConfig, getSupabaseConfig } from "@/lib/supabase/config";
import { AuthForm } from "../../auth-form";
import styles from "../../auth.module.css";

export const metadata: Metadata = { title: "Confirmar recuperación", referrer: "no-referrer" };

type ConfirmSearchParams = Promise<{ code?: string; sb_flow_id?: string; token_hash?: string; type?: string }>;

export default async function ConfirmRecoveryPage({ searchParams }: { searchParams: ConfirmSearchParams }) {
  const { code, sb_flow_id: flowId, token_hash: tokenHash, type } = await searchParams;
  const configured = getRecoveryConfig() && getSupabaseConfig();
  const recoveryToken = type === "recovery" && typeof tokenHash === "string" && tokenHash.length <= 300 ? tokenHash : "";
  const recoveryCode = typeof code === "string" && code.length <= 300 ? code : "";
  const recoveryFlow = typeof flowId === "string" && flowId.length <= 80 ? flowId : "";

  return (
    <div className={styles.card}>
      <h1>Confirmá la recuperación</h1>
      {configured && (recoveryToken || recoveryCode) ? <>
        <p>Continuá para confirmar el enlace y elegir una nueva contraseña.</p>
        <AuthForm mode="confirm" tokenHash={recoveryToken} code={recoveryCode} flowId={recoveryFlow} />
      </> : <p>No encontramos un enlace de recuperación válido.</p>}
      <Link href="/recuperar-clave" className={styles.textLink}>Pedir un enlace nuevo</Link>
    </div>
  );
}
