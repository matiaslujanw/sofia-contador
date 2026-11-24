/// <reference types="vite/client" />

import "@fontsource-variable/inter";
import "@/app/globals.css";
import { Workspace } from "@/components/workspace";
import { createDemoWorkspace } from "@/lib/workspace/demo";
import { todayIn } from "@/lib/workspace/format";
import { isSection } from "@/lib/workspace/routes";
import { parseTourStep } from "@/lib/workspace/tour";
import { monthSchema } from "@/lib/workspace/validation";
import { useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";

const today = todayIn();
const initial = createDemoWorkspace(today.slice(0, 7));
const defaultPage = "/inicio?recorrido=0";
if (window.location.protocol === "file:" && window.location.hash) {
  window.history.replaceState(null, "", window.location.href.split("#")[0]);
}

function subscribe(callback: () => void) {
  const handleRoute = () => {
    window.scrollTo(0, 0);
    callback();
  };
  window.addEventListener("hashchange", handleRoute);
  return () => window.removeEventListener("hashchange", handleRoute);
}

function locationKey() {
  return window.location.hash.slice(1) || defaultPage;
}

function PortableWorkspace() {
  const url = useSyncExternalStore(subscribe, locationKey);
  const [path, parameters] = url.split("?", 2);
  const query = new URLSearchParams(parameters);
  const route = path.slice(1);
  const section = isSection(route) ? route : "inicio";
  const month = monthSchema.safeParse(query.get("mes")).data ?? today.slice(0, 7);

  return <Workspace initial={initial} section={section} mode="demo" portable email={null} month={month} today={today}
    companyId={query.get("empresa") ?? undefined} purpose={query.get("tipo") ?? undefined} tourStep={parseTourStep(query.get("recorrido"))} />;
}

createRoot(document.getElementById("demo")!).render(<PortableWorkspace />);
