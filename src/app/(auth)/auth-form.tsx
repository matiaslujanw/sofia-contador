"use client";

import { useActionState, useState } from "react";
import {
  confirmPasswordRecovery, requestPasswordRecovery, resetPassword, signIn,
} from "@/lib/supabase/auth-actions";
import styles from "./auth.module.css";

type AuthFormProps =
  | { mode: "signin" | "request" | "reset" }
  | { mode: "confirm"; tokenHash: string; code: string; flowId: string };

const actions = { signin: signIn, request: requestPasswordRecovery, reset: resetPassword, confirm: confirmPasswordRecovery };
const labels = { signin: "Ingresar", request: "Enviar enlace", reset: "Guardar contraseña", confirm: "Continuar" };
const pendingLabels = { signin: "Ingresando…", request: "Enviando…", reset: "Guardando…", confirm: "Verificando…" };

export function AuthForm(props: AuthFormProps) {
  const { mode } = props;
  const [state, action, pending] = useActionState(actions[mode], null);
  const [identifier, setIdentifier] = useState("");

  return (
    <form className={styles.form} action={action}>
      {mode === "confirm" && <>
        <input type="hidden" name="tokenHash" value={props.tokenHash} />
        <input type="hidden" name="code" value={props.code} />
        <input type="hidden" name="flowId" value={props.flowId} />
      </>}
      {(mode === "signin" || mode === "request") && (
        <label className={styles.field}>
          {mode === "signin" ? "Usuario o correo electrónico" : "Correo electrónico"}
          <input
            type={mode === "signin" ? "text" : "email"} name={mode === "signin" ? "identifier" : "email"}
            autoComplete={mode === "signin" ? "username" : "email"} autoCapitalize="none" spellCheck={false}
            required maxLength={254} placeholder={mode === "signin" ? "Usuario o correo" : "nombre@estudio.com.ar"}
            value={identifier} onChange={(event) => setIdentifier(event.target.value)}
          />
        </label>
      )}
      {(mode === "signin" || mode === "reset") && (
        <label className={styles.field}>
          {mode === "reset" ? "Nueva contraseña" : "Contraseña"}
          <input
            type="password" name="password" autoComplete={mode === "reset" ? "new-password" : "current-password"}
            required minLength={mode === "reset" ? 12 : undefined} maxLength={mode === "reset" ? 72 : 512}
            aria-describedby={mode === "reset" ? "password-description" : undefined}
          />
        </label>
      )}
      {mode === "reset" && <>
        <p id="password-description" className={styles.fieldHint}>Usá al menos 12 caracteres.</p>
        <label className={styles.field}>
          Repetí la nueva contraseña
          <input type="password" name="confirmation" autoComplete="new-password" required minLength={12} maxLength={72} />
        </label>
      </>}
      {state && (
        <p className={state.kind === "error" ? styles.error : styles.success} role={state.kind === "error" ? "alert" : "status"}>
          {state.message}
        </p>
      )}
      <button className={styles.submit} type="submit" disabled={pending}>{pending ? pendingLabels[mode] : labels[mode]}</button>
    </form>
  );
}
