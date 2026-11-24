import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sofía | Gestión Contable", short_name: "Sofía", lang: "es-AR", start_url: "/", scope: "/",
    description: "Organizá. Controlá. Simplificá.", display: "standalone", background_color: "#11131C",
    theme_color: "#11131C", icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/sofia-mark.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
