import {emptyCore,type CoreState} from "@/lib/accounting/core/model";
import type { BookRecord } from "@/lib/accounting/model";

export const taskStatuses = {
  pending: "Pendiente",
  in_progress: "En proceso",
  waiting: "Esperando documentación",
  review: "Requiere revisión",
  completed: "Completado",
  not_applicable: "No aplica",
} as const;

export const accountKinds = {
  asset: "Activo",
  liability: "Pasivo",
  equity: "Patrimonio neto",
  revenue: "Ingresos",
  cost: "Costos",
  expense: "Gastos",
} as const;

export const paymentStatuses = { pending: "Pendiente", partial: "Parcial", settled: "Cancelado" } as const;
export const reviewStatuses = { pending: "Pendiente", review: "En revisión", approved: "Aprobado" } as const;
export const xubioStatuses = { pending: "Pendiente", registered: "Registrado" } as const;
export const documentCategories = ["Comprobantes", "Extractos bancarios", "Plan de cuentas", "Papeles de trabajo", "Respaldos", "Otros"] as const;
export const defaultTaskTitles = [
  "Recepción de comprobantes emitidos",
  "Recepción de comprobantes recibidos",
  "Recepción de extractos bancarios",
  "Control de movimientos bancarios",
  "Clasificación contable de compras y ventas",
  "Verificación de pagos y cobros",
  "Conciliación bancaria",
  "Control de cuentas de socios",
  "Liquidación de IVA",
  "Liquidación de Ingresos Brutos",
  "Generación de asientos contables",
  "Registración en Xubio",
  "Control de declaraciones juradas",
  "Control de pagos fiscales",
  "Estado de resultados",
  "Cierre mensual",
] as const;

export type Role = "owner" | "editor" | "viewer";
export type Member = { organization_id: string; user_id: string; role: Role };
export type Organization = { id: string; name: string; locale: string; currency: string; timezone: string; role: Role };
export type CompanyValues = {
  legal_name: string; trade_name: string; cuit: string; entity_type: string; activity: string;
  tax_address: string; province: string; vat_status: string; gross_income_regime: string;
  start_date: string | null; fiscal_year_end: string; employee_count: number; currency: string;
  tax_obligations: string; notes: string;
};
export type Company = CompanyValues & { id: string; organization_id: string; status: "active" | "archived" };
export type Period = { id: string; organization_id: string; company_id: string; month: string; status: "open" | "closed" };
export type Task = {
  id: string; organization_id: string; company_id: string; period_id: string; title: string;
  position: number; status: keyof typeof taskStatuses; notes: string; document_id: string | null;
};
export type Document = {
  id: string; organization_id: string; company_id: string; period_id: string; name: string;
  category: string; storage_path: string; mime_type: string; size_bytes: number; created_at: string;
};
export type AccountValues = {
  code: string; name: string; kind: keyof typeof accountKinds; parent_code: string | null;
  category: string | null; status: "active" | "inactive";
};
export type Account = AccountValues & { id: string; organization_id: string; company_id: string };
export type VoucherClassification = {
  account_id: string | null; category: string | null; concept: string | null; cost_center: string | null;
  payment_status: keyof typeof paymentStatuses; payment_method: string | null; deductible_vat: string | null;
  notes: string | null; review_status: keyof typeof reviewStatuses; xubio_status: keyof typeof xubioStatuses; document_id: string | null;
};
export type Voucher = VoucherClassification & {
  id: string; organization_id: string; company_id: string; period_id: string; direction: "purchase" | "sale";
  date: string; receipt_type: string; point_of_sale: number; receipt_number: number; counterparty_cuit: string | null;
  counterparty_name: string | null; currency: string; exchange_rate: string; taxable: string; untaxed: string;
  exempt: string; vat: string; other_taxes: string; total: string; vat_breakdown: Record<string, string>;
};
export type ClassificationRule = {
  id: string; company_id: string; direction: Voucher["direction"]; counterparty_cuit: string;
} & Pick<VoucherClassification,"account_id" | "category" | "concept" | "cost_center">;
export type ImportRecord = {
  id: string; company_id: string; period_id: string; document_id: string; kind: "purchase" | "sale" | "accounts";
  file_sha256: string; row_count: number; duplicate_count: number; created_at: string;
};
export type AuditEvent = {
  id: string; company_id: string | null; period_id: string | null; action: string; entity: string;
  entity_id: string; details: Record<string, unknown>; created_at: string;
};
export type Obligation = {
  id: string; company_id: string; period_id: string; title: string; due_on: string;
  amount: string | null; status: "pending" | "filed" | "paid" | "not_applicable";
  filed_on: string | null; paid_on: string | null; document_id: string | null; notes: string;
};
export type WorkspaceState = {
  organizations: Organization[]; members: Member[]; organization: Organization | null; companies: Company[]; periods: Period[];
  tasks: Task[]; documents: Document[]; accounts: Account[]; vouchers: Voucher[]; rules: ClassificationRule[];
  imports: ImportRecord[]; activity: AuditEvent[]; obligations: Obligation[];
  bookRecords: BookRecord[]; accountingReady: boolean; core?:CoreState;
};

export const emptyWorkspace: WorkspaceState = {
  organizations: [], members: [], organization: null, companies: [], periods: [], tasks: [], documents: [],
  accounts: [], vouchers: [], rules: [], imports: [], activity: [], obligations: [], bookRecords: [], accountingReady: true, core:emptyCore,
};

export const defaultClassification: VoucherClassification = {
  account_id: null, category: null, concept: null, cost_center: null, payment_status: "pending",
  payment_method: null, deductible_vat: null, notes: null, review_status: "pending",
  xubio_status: "pending", document_id: null,
};
