import type { MetadataRoute } from "next";
import {brand} from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.title, short_name: brand.shortName, lang: "es-AR", start_url: "/", scope: "/",
    description: "Cargas, auditoría y cierre contable de empresas, mes a mes.", display: "standalone", background_color: "#11131C",
    theme_color: "#11131C", icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/sofia-mark.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
