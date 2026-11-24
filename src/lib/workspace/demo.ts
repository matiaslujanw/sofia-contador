import { shiftMonth } from "./format";
import { defaultClassification, defaultTaskTitles, emptyWorkspace, type Company, type Obligation, type Organization, type Period, type Task, type WorkspaceState } from "./model";

const id = (number: number) => `10000000-0000-4000-8000-${String(number).padStart(12, "0")}`;

export const demoTourCompanyId = id(10);
export const demoTourPeriodId = id(100);
export const demoTourTaskId = id(1013);
export const demoTourVoucherId = id(500);

export function createDemoWorkspace(month: string): WorkspaceState {
  const organization: Organization = { id: id(1), name: "Estudio Sofía", locale: "es-AR", currency: "ARS", timezone: "America/Argentina/Tucuman", role: "owner" };
  const companyData = [
    { legal_name: "Nexo Custodia S.A.S.", trade_name: "Nexo Custodia", cuit: "30719990017", activity: "Seguridad privada", entity_type: "S.A.S.", employee_count: 0 },
    { legal_name: "Lumen Estudio S.R.L.", trade_name: "Lumen Estudio", cuit: "30719990025", activity: "Diseño y servicios creativos", entity_type: "S.R.L.", employee_count: 4 },
    { legal_name: "Andina Logística S.A.", trade_name: "Andina Logística", cuit: "30719990033", activity: "Transporte y logística", entity_type: "S.A.", employee_count: 12 },
  ];
  const companies: Company[] = companyData.map((company, index) => ({
    id: id(10 + index), organization_id: organization.id, tax_address: "", province: "Tucumán", vat_status: "Responsable inscripto",
    gross_income_regime: "Local", start_date: null, fiscal_year_end: "12-31", currency: "ARS",
    tax_obligations: "IVA · Ingresos Brutos", notes: index === 0 ? "Caso de demostración sin ventas ni empleados. Cuenta operativa de referencia en Banco Comafi." : "",
    status: "active", ...company,
  }));
  const periods: Period[] = companies.flatMap((company, index) => [month, shiftMonth(month, -1)].map((value, offset) => ({
    id: id(100 + index * 2 + offset), organization_id: organization.id, company_id: company.id,
    month: `${value}-01`, status: offset ? "closed" : "open",
  })));
  const tasks: Task[] = periods.flatMap((period, index) => defaultTaskTitles.map((title, position) => ({
    id: id(1000 + index * 20 + position), organization_id: organization.id, company_id: period.company_id,
    period_id: period.id, title, position: position + 1, notes: "", document_id: null,
    status: index === 0 && position === 0 ? "not_applicable"
      : period.status === "closed" || position < [11, 16, 14, 16, 6, 16][index] ? "completed"
      : position === [11, 16, 14, 16, 6, 16][index] ? "waiting"
      : position === [12, 16, 15, 16, 7, 16][index] ? "review" : "pending",
  })));
  const vouchers: WorkspaceState["vouchers"] = [
    { direction: "purchase", counterparty_name: "Equipamientos Norte", counterparty_cuit: "30719990041", taxable: "480000.00", vat: "100800.00", total: "580800.00", account_id: id(300), category: "Bienes de uso", review_status: "approved" },
    { direction: "purchase", counterparty_name: "Conexión Regional", counterparty_cuit: "30719990068", taxable: "86450.00", vat: "18154.50", total: "104604.50", account_id: id(301), category: "Servicios", review_status: "approved" },
    { direction: "purchase", counterparty_name: "Suministros del Valle", counterparty_cuit: "30719990076", taxable: "52900.00", vat: "11109.00", total: "64009.00", review_status: "review" },
  ].map((values, index) => ({
    ...defaultClassification, id: id(500 + index), organization_id: organization.id, company_id: companies[0].id,
    period_id: periods[0].id, date: `${month}-0${index + 3}`, receipt_type: "Factura A", point_of_sale: 1,
    receipt_number: 870 + index, currency: "ARS", exchange_rate: "1.000000", untaxed: "0.00",
    exempt: "0.00", other_taxes: "0.00", vat_breakdown: {}, ...values,
  } as WorkspaceState["vouchers"][number]));
  const obligations: Obligation[] = [
    { id: id(700), company_id: companies[0].id, period_id: periods[0].id, title: "IVA mensual", due_on: `${shiftMonth(month, 1)}-18`, status: "pending", amount: null, notes: "Fecha ficticia para la demostración.", filed_on: null, paid_on: null, document_id: null },
    { id: id(701), company_id: companies[1].id, period_id: periods[2].id, title: "Ingresos Brutos", due_on: `${shiftMonth(month, 1)}-21`, status: "pending", amount: null, notes: "Fecha ficticia para la demostración.", filed_on: null, paid_on: null, document_id: null },
    { id: id(702), company_id: companies[2].id, period_id: periods[4].id, title: "IVA mensual", due_on: `${shiftMonth(month, 1)}-22`, status: "pending", amount: null, notes: "Fecha ficticia para la demostración.", filed_on: null, paid_on: null, document_id: null },
  ];
  return {
    ...emptyWorkspace, organizations: [organization], organization, companies, periods, tasks, vouchers, obligations,
    accounts: [
      { id: id(300), code: "1.3.01", name: "Equipamiento operativo", kind: "asset", category: "Bienes de uso" },
      { id: id(301), code: "5.1.02", name: "Servicios contratados", kind: "expense", category: "Servicios" },
      { id: id(302), code: "2.1.01", name: "Proveedores", kind: "liability", category: "Deudas comerciales" },
    ].map((account) => ({ ...account, organization_id: organization.id, company_id: companies[0].id, parent_code: null, status: "active" } as WorkspaceState["accounts"][number])),
    activity: [
      { id: id(800), company_id: companies[0].id, period_id: periods[0].id, action: "INSERT", entity: "vouchers", entity_id: id(500), details: {}, created_at: `${month}-08T12:00:00Z` },
      { id: id(801), company_id: companies[1].id, period_id: periods[2].id, action: "UPDATE", entity: "close_tasks", entity_id: id(1048), details: {}, created_at: `${month}-07T10:30:00Z` },
    ],
  };
}
