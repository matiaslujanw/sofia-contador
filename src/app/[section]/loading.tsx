import { LoaderCircle } from "lucide-react";

export default function Loading() {
  return <main className="route-state" aria-busy="true"><LoaderCircle className="spin" /> Cargando el espacio de trabajo…</main>;
}
