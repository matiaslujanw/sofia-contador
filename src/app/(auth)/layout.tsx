import type { ReactNode } from "react";
import Image from "next/image";
import { LockKeyhole } from "lucide-react";
import styles from "./auth.module.css";

export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className={styles.shell}>
      <div className={styles.brandPanel}>
        <div className={styles.brand}>
          <Image className={styles.brandMark} src="/sofia-mark.svg" alt="" width={44} height={44} unoptimized />
          <div><strong>SOFÍA</strong><span>Gestión Contable</span></div>
        </div>
        <p className={styles.tagline}>Organizá.<br />Controlá.<br />Simplificá.</p>
        <p className={styles.privateLabel}><LockKeyhole size={15} aria-hidden="true" /> Espacio privado de tu estudio</p>
      </div>
      <section className={styles.content}>{children}</section>
    </main>
  );
}
