export const sections = {
  inicio: "Inicio",
  empresas: "Empresas",
  cierre: "Cierre mensual",
  control: "Control mensual",
  preparacion: "Preparar mes",
  contabilidad: "Contabilidad",
  comprobantes: "Compras y ventas",
  cuentas: "Plan de cuentas",
  documentacion: "Documentación",
  calendario: "Calendario fiscal",
  informes: "Informes financieros",
  auditoria: "Auditoría",
  xubio: "Auditoría de Xubio",
  configuracion: "Configuración",
} as const;

export type Section = keyof typeof sections;
export type Selection = { organizationId?: string; companyId?: string; month: string };

export function workspaceHref(section: Section, selection: Selection, extra?: Record<string, string>) {
  const query = new URLSearchParams(extra);
  if (selection.organizationId) query.set("organizacion", selection.organizationId);
  if (selection.companyId) query.set("empresa", selection.companyId);
  query.set("mes", selection.month);
  return `/${section}?${query.toString()}`;
}

export function isSection(raw: string): raw is Section {
  return Object.hasOwn(sections, raw);
}
