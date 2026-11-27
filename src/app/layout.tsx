import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import {brand} from "@/lib/brand";

export const metadata: Metadata = {
  title: { default: brand.title, template: "%s | Contabilidad - Sofía Luján" },
  description: "Espacio privado para organizar y controlar el cierre contable mensual.",
  applicationName: "Contabilidad - Sofía Luján",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#11131C", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es-AR"><body>{children}</body></html>;
}
