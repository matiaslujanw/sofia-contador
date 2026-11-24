"use client";

import { CircleAlert } from "lucide-react";

export default function WorkspaceError({ reset }: { reset: () => void }) {
  return <main className="route-state">
    <CircleAlert />
    <h1>No se pudo cargar el espacio de trabajo</h1>
    <p className="muted">Verificá la conexión e intentá de nuevo.</p>
    <button type="button" className="button button-primary" onClick={reset}>Reintentar</button>
  </main>;
}
