import { companyName, monthLabel } from "./format";
import type { WorkspaceState } from "./model";
import type { Section, Selection } from "./routes";

type GuideDestination = {
  section: Section;
  companyId?: string;
  month?: string;
  purpose?: "compras" | "ventas";
  anchor?: string;
};

export type OnboardingStep = {
  id: "studio" | "company" | "period" | "import" | "review";
  title: string;
  description: string;
  instruction: string;
  action: string;
  done: boolean;
  destination: GuideDestination;
};

export const sectionGuide = {
  inicio: "Elegí una empresa y entrá en sus tareas del mes.",
  preparacion: "Prepará el mes en orden: cuentas, compras, ventas, resumen bancario y papel impositivo.",
  empresas: "Creá y actualizá la ficha de cada cliente. Podés archivar empresas y conservar su historial.",
  cierre: "Abrí un mes para una empresa y actualizá las tareas del checklist a medida que trabajás.",
  contabilidad: "Registrá aperturas, cobros, pagos, obligaciones, extractos, activos y asientos. Consultá saldos y resultados por mes.",
  control: "Revisá los nueve pasos del circuito mensual, agregá controles al checklist y exportá el papel preliminar de IVA.",
  comprobantes: "Buscá las compras y ventas importadas, revisá sus importes y asignales una cuenta contable.",
  documentacion: "Subí respaldos o importá planillas. Revisá las columnas y la vista previa antes de confirmar.",
  calendario: "Cargá vencimientos de forma manual y registrá sus fechas de presentación o pago.",
  cuentas: "Consultá, cargá o importá el plan de cuentas que usás para clasificar los comprobantes de cada empresa.",
  informes: "Consultá compras, ventas, IVA y avance del cierre de la empresa y el período seleccionados.",
  auditoria: "Revisá alertas, registros que requieren atención y la actividad que dejó cada cambio.",
  configuracion: "Administrá el estudio, sus preferencias y los permisos de acceso de sus integrantes.",
} satisfies Record<Section, string>;

export function getOnboarding(state: WorkspaceState, selection: Selection): OnboardingStep[] {
  if (state.organization?.role === "viewer") return [];

  const companies = state.companies.filter((company) => company.status === "active");
  const activeCompanies = new Set(companies.map((company) => company.id));
  const periods = state.periods.filter((period) => activeCompanies.has(period.company_id));
  const periodById = new Map(periods.map((period) => [period.id, period]));
  const openCompanyIds = new Set(periods.filter((period) => period.status === "open").map((period) => period.company_id));
  const preferred = companies.find((company) => company.id === selection.companyId)
    ?? companies.find((company) => openCompanyIds.has(company.id))
    ?? companies[0];
  const companyPeriod = { companyId: preferred?.id, month: selection.month };
  const selectedPeriod = periods.find((period) => period.company_id === preferred?.id && period.month.slice(0, 7) === selection.month);
  const openPeriods = periods.filter((period) => period.status === "open" && period.company_id === preferred?.id);
  const open = openPeriods.find((period) => period.month.slice(0, 7) === selection.month)
    ?? [...openPeriods].sort((left, right) => right.month.localeCompare(left.month))[0];
  const vouchers = state.vouchers.filter((voucher) => periodById.has(voucher.period_id));
  const reviewable = vouchers.filter((voucher) => periodById.get(voucher.period_id)?.status === "open");
  const candidate = reviewable.find((voucher) => voucher.period_id === open?.id) ?? reviewable[0];
  const reviewPeriod = candidate && periodById.get(candidate.period_id);
  const reviewCompany = reviewPeriod && companies.find((company) => company.id === reviewPeriod.company_id);
  const importContext = open && preferred
    ? `${companyName(preferred)} · ${monthLabel(open.month.slice(0, 7), state.organization?.locale)}.`
    : "";
  const reviewContext = reviewPeriod && reviewCompany
    ? `${companyName(reviewCompany)} · ${monthLabel(reviewPeriod.month.slice(0, 7), state.organization?.locale)}.`
    : "";
  const closeDestination = { section: "cierre", ...companyPeriod } as const;
  const importDestination = open
    ? { section: "documentacion", companyId: open.company_id, month: open.month.slice(0, 7), purpose: "compras" } as const
    : closeDestination;
  const importAction = open ? "Ir a Importaciones" : "Ir al cierre mensual";

  return [
    {
      id: "studio", title: "Creá tu estudio", done: !!state.organization,
      description: "La organización reúne tus empresas y el acceso de tu equipo.",
      instruction: "Tocá Crear organización y escribí el nombre de tu estudio.",
      action: "Ir a crear mi estudio", destination: { section: "configuracion", anchor: "crear-organizacion" },
    },
    {
      id: "company", title: "Agregá tu primera empresa", done: companies.length > 0,
      description: "Cada empresa tiene su ficha, sus comprobantes y sus cierres.",
      instruction: "Entrá en Empresas, elegí Nueva empresa y completá la razón social y el CUIT.",
      action: "Ir a Empresas", destination: { section: "empresas" },
    },
    {
      id: "period", title: "Iniciá el mes que vas a trabajar", done: periods.length > 0,
      description: "El Cierre mensual te da un checklist para seguir el trabajo de ese mes.",
      instruction: "Confirmá la empresa y el mes arriba. Después elegí Iniciar período para crear el checklist.",
      action: "Ir al cierre mensual", destination: closeDestination,
    },
    {
      id: "import", title: "Importá tus comprobantes", done: vouchers.length > 0,
      description: "Documentación recibe las planillas y guarda una copia del archivo original.",
      instruction: open
        ? `En Importaciones, elegí Compras o Ventas, cargá el CSV o Excel y revisá la vista previa antes de confirmar. ${importContext}`
        : selectedPeriod?.status === "closed"
          ? "Este mes está cerrado. Elegí otro período o reabrí este si corresponde antes de importar."
          : "Primero iniciá un período para la empresa que vas a trabajar. Después podés importar desde Documentación.",
      action: importAction, destination: importDestination,
    },
    {
      id: "review", title: "Revisá un comprobante", done: vouchers.some((voucher) => voucher.review_status === "approved"),
      description: "En Compras y ventas podés revisar los importes y asignar la cuenta contable.",
      instruction: candidate
        ? `Buscá el comprobante en la pestaña ${candidate.direction === "sale" ? "Ventas" : "Compras"}, tocá Revisar, marcá Aprobado en el estado de revisión y guardá. ${reviewContext}`
        : "Importá comprobantes en un período abierto y después revisalos desde Compras y ventas.",
      action: reviewPeriod ? "Ir a Compras y ventas" : importAction,
      destination: reviewPeriod
        ? { section: "comprobantes", companyId: reviewPeriod.company_id, month: reviewPeriod.month.slice(0, 7) }
        : importDestination,
    },
  ];
}
