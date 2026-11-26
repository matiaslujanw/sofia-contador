import "server-only";
import type { BookRecord } from "@/lib/accounting/model";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  emptyWorkspace, type Account, type AuditEvent, type ClassificationRule, type Company,
  type Document, type ImportRecord, type Member, type Obligation, type Organization, type Period, type Task,
  type Voucher, type WorkspaceState,
} from "./model";

const voucherColumns = "id,organization_id,company_id,period_id,direction,date,receipt_type,point_of_sale,receipt_number,counterparty_cuit,counterparty_name,currency,exchange_rate::text,taxable::text,untaxed::text,exempt::text,vat::text,other_taxes::text,total::text,vat_breakdown,account_id,category,concept,cost_center,payment_status,payment_method,deductible_vat::text,notes,review_status,xubio_status,document_id";
const pageSize = 500;

async function rows<T>(client: SupabaseClient, table: string, org: string, columns = "*") {
  const records: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from(table).select(columns).eq("organization_id", org).order("id").range(offset, offset + pageSize - 1);
    if (error) throw new Error("No se pudo consultar el espacio de trabajo.");
    records.push(...(data as unknown as T[]));
    if (data.length < pageSize) return records;
  }
}

function normalizeCompany(company: Company): Company {
  return {
    ...company, trade_name: company.trade_name ?? "", entity_type: company.entity_type ?? "",
    activity: company.activity ?? "", tax_address: company.tax_address ?? "", province: company.province ?? "",
    vat_status: company.vat_status ?? "", gross_income_regime: company.gross_income_regime ?? "",
    fiscal_year_end: company.fiscal_year_end ?? "", tax_obligations: company.tax_obligations ?? "", notes: company.notes ?? "",
  };
}

export async function loadWorkspace(client: SupabaseClient, userId: string, orgId?: string): Promise<WorkspaceState> {
  const membership = await client.from("organization_members").select("organization_id,role,organizations(id,name,locale,currency,timezone)").eq("user_id", userId);
  if (membership.error) throw new Error("No se pudieron consultar tus organizaciones.");
  const orgRows = membership.data as unknown as { role: Organization["role"]; organizations: Omit<Organization, "role"> | null }[];
  const organizations = orgRows.flatMap((entry) => entry.organizations ? [{ ...entry.organizations, role: entry.role }] : [])
    .sort((a, b) => a.name.localeCompare(b.name));
  const organization = organizations.find((entry) => entry.id === orgId) ?? organizations[0] ?? null;
  if (!organization) return { ...emptyWorkspace, organizations };
  const id = organization.id;
  const [companies, periods, tasks, documents, accounts, vouchers, rules, imports, activity, obligations, members] = await Promise.all([
    rows<Company>(client, "companies", id), rows<Period>(client, "periods", id),
    rows<Task>(client, "close_tasks", id), rows<Document>(client, "documents", id),
    rows<Account>(client, "accounts", id), rows<Voucher>(client, "vouchers", id, voucherColumns),
    rows<ClassificationRule>(client, "classification_rules", id), rows<ImportRecord>(client, "imports", id),
    client.from("audit_events").select("*").eq("organization_id", id).order("created_at", { ascending: false }).limit(75),
    rows<Obligation>(client, "tax_obligations", id, "id,company_id,period_id,title,due_on,amount::text,status,filed_on,paid_on,document_id,notes"),
    organization.role === "owner"
      ? client.from("organization_members").select("organization_id,user_id,role").eq("organization_id", id)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const bookRecords: BookRecord[] = [];
  let accountingReady = true;
  // An unapplied migration must not break the existing workspace.
  for (let offset = 0; ; offset += pageSize) {
    const result = await client.from("book_records").select("id,organization_id,company_id,period_id,payload").eq("organization_id", id).eq("voided", false).order("id").range(offset, offset + pageSize - 1);
    if (result.error) {
      if (["42P01", "PGRST205"].includes(result.error.code)) { accountingReady = false; break; }
      throw new Error("No se pudo consultar el libro operativo.");
    }
    bookRecords.push(...result.data as unknown as BookRecord[]);
    if (result.data.length < pageSize) break;
  }
  if (activity.error || members.error) throw new Error("No se pudo consultar la actividad o membresía.");
  return {
    organizations, organization, companies: companies.map(normalizeCompany).sort((a, b) => a.legal_name.localeCompare(b.legal_name)),
    periods, tasks, documents, accounts, vouchers, rules, imports, bookRecords, accountingReady,
    activity: activity.data as AuditEvent[], members: members.data as Member[], obligations,
  };
}
