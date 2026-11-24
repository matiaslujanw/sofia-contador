import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Sofía | Gestión Contable", template: "%s | Sofía" },
  description: "Espacio privado para organizar y controlar el cierre contable mensual.",
  applicationName: "Sofía",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#10141C", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es-AR"><body>{children}</body></html>;
}
