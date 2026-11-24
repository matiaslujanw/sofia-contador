import { readDemoStorage, writeDemoStorage } from "./demo-storage";
import { workspaceHref, type Section, type Selection } from "./routes";

export const tourSteps = [
  { section: "inicio", title: "Ubicate en una empresa" },
  { section: "cierre", title: "Actualizá el checklist" },
  { section: "comprobantes", title: "Revisá una compra" },
  { section: "documentacion", title: "Importá una planilla" },
] as const;

const key = "sofia-demo-tour-v1";
const changed = "sofia-demo-tour-change";

export function parseTourStep(value: unknown) {
  if (typeof value !== "string" || !/^[0-5]$/.test(value)) return null;
  return Number(value);
}

export function tourHref(step: number, selection: Selection, example = false) {
  const destination: Section = tourSteps[step - 1]?.section ?? "inicio";
  const extra: Record<string, string> = { recorrido: String(step) };
  if (step === 4) extra.tipo = "compras";
  if (example && (step === 2 || step === 3)) extra.tipo = "ejemplo";
  return workspaceHref(destination, { ...selection, companyId: step === 0 || step === 5 ? undefined : selection.companyId }, extra);
}

export function readTourProgress() {
  return parseTourStep(readDemoStorage(key)) ?? 0;
}

export const emptyTourProgress = () => 0;

export function subscribeTourProgress(callback: () => void) {
  window.addEventListener(changed, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(changed, callback);
    window.removeEventListener("storage", callback);
  };
}

export function saveTourProgress(step: number) {
  if (readTourProgress() === step) return;
  try { writeDemoStorage(key, String(step)); }
  catch { return; }
  window.dispatchEvent(new Event(changed));
}

export function sampleTourCsv(month: string) {
  return [
    "date;receipt_type;point_of_sale;receipt_number;counterparty_cuit;counterparty_name;currency;exchange_rate;taxable;untaxed;exempt;vat;other_taxes;total",
    `${month}-09;Factura A;1;90901;30719990076;Insumos de muestra;ARS;1;12000;0;0;2520;0;14520`,
  ].join("\r\n");
}
