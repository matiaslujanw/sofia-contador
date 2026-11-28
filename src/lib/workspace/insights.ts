import { cents, shiftMonth, taskProgress } from "./format";
import type { Company, Voucher, WorkspaceState } from "./model";

export function periodRows(state: WorkspaceState, month: string) {
  return state.companies.filter((company) => company.status === "active").map((company) => {
    const period = state.periods.find((entry) => entry.company_id === company.id && entry.month.slice(0, 7) === month);
    const tasks = period ? state.tasks.filter((task) => task.period_id === period.id) : [];
    return { company, period, tasks, progress: taskProgress(tasks) };
  });
}

function voucherBase(voucher: Voucher) {
  return cents(voucher.taxable) + cents(voucher.untaxed) + cents(voucher.exempt);
}

export function companyInsights(state: WorkspaceState, company: Company, month: string) {
  const period = state.periods.find((entry) => entry.company_id === company.id && entry.month.slice(0, 7) === month);
  const periodVouchers = period ? state.vouchers.filter((voucher) => voucher.period_id === period.id) : [];
  const comparable = periodVouchers.filter((voucher) => voucher.currency === company.currency);
  const sale = comparable.filter((voucher) => voucher.direction === "sale");
  const purchase = comparable.filter((voucher) => voucher.direction === "purchase");
  const tasks = period ? state.tasks.filter((task) => task.period_id === period.id) : [];
  const noSales = tasks.some((task) => task.title === "Recepción de comprobantes emitidos" && task.status === "not_applicable");
  const noPurchases = tasks.some((task) => task.title === "Recepción de comprobantes recibidos" && task.status === "not_applicable") && !periodVouchers.some((voucher) => voucher.direction === "purchase");
  const reviewedPurchases = purchase.filter((voucher) => voucher.review_status === "approved");
  const costAccounts = new Set(state.accounts.filter((account) => account.company_id === company.id && ["expense", "cost"].includes(account.kind)).map((account) => account.id));
  const expenses = reviewedPurchases.filter((voucher) => voucher.account_id && costAccounts.has(voucher.account_id));
  const sumBase = (vouchers: Voucher[]) => vouchers.reduce((total, voucher) => total + voucherBase(voucher), 0n);
  const series = Array.from({ length: 6 }, (_, index) => {
    const entryMonth = shiftMonth(month, index - 5);
    const entry = state.periods.find((item) => item.company_id === company.id && item.month.slice(0, 7) === entryMonth);
    const allEntries = entry ? state.vouchers.filter((voucher) => voucher.period_id === entry.id) : [];
    const entries = allEntries.filter((voucher) => voucher.currency === company.currency);
    const sales = entries.filter((voucher) => voucher.direction === "sale");
    const purchases = entries.filter((voucher) => voucher.direction === "purchase");
    const absentSales = entry && state.tasks.some((task) => task.period_id === entry.id && task.title === "Recepción de comprobantes emitidos" && task.status === "not_applicable");
    return { month: entryMonth, sales: sales.length || (absentSales && !allEntries.some((voucher) => voucher.direction === "sale")) ? sumBase(sales) : null, purchases: purchases.length || (entry && !allEntries.some(v=>v.direction==="purchase") && state.tasks.some(t=>t.period_id===entry.id && t.title==="Recepción de comprobantes recibidos" && t.status==="not_applicable")) ? sumBase(purchases) : null };
  });
  return {
    sales: sale.length || (noSales && !periodVouchers.some((voucher) => voucher.direction === "sale")) ? sumBase(sale) : null,
    purchases: purchase.length || noPurchases ? sumBase(purchase) : null,
    vatDebit: sale.length || (noSales && !periodVouchers.some((voucher) => voucher.direction === "sale")) ? sale.reduce((total, voucher) => total + cents(voucher.vat), 0n) : null,
    vatCreditReported: purchase.length || noPurchases ? purchase.reduce((total, voucher) => total + cents(voucher.vat), 0n) : null,
    classifiedExpenses: expenses.length ? sumBase(expenses) : null,
    otherCurrencies: periodVouchers.length - comparable.length,
    reviewCount: periodVouchers.filter((voucher) => voucher.review_status !== "approved").length,
    progress: taskProgress(tasks),
    series,
  };
}

export function activityLabel(entity: string, action: string) {
  const labels: Record<string, string> = {
    companies: "Empresa", periods: "Período", close_tasks: "Tarea de cierre",
    vouchers: "Comprobante", accounts: "Cuenta contable", documents: "Documento",
    accounting_journal_entries:'Asiento confirmado',accounting_journal_lines:'Detalle de asiento',accounting_exercises:'Ejercicio contable',accounting_account_profiles:'Propiedades de cuenta',accounting_equivalences:'Equivalencia Xubio',accounting_core:'Núcleo contable',company_deletion:'Eliminación de empresa',
    imports: "Importación", tax_obligations: "Vencimiento", classification_rules: "Regla de imputación",
    organizations: "Organización", organization_members: "Membresía",
  };
  const verbs: Record<string, string> = { INSERT: "Alta", UPDATE: "Actualización", DELETE: "Baja", CONFIRM: "Confirmación", CLOSE: "Cierre", REOPEN: "Reapertura" };
  return `${labels[entity] ?? entity} · ${verbs[action.toUpperCase()] ?? action}`;
}

export function scopeAlerts(state: WorkspaceState, month: string, companyId?: string) {
  const periods = new Set(state.periods.filter((period) => period.month.slice(0, 7) === month && (!companyId || period.company_id === companyId)).map((period) => period.id));
  const pendingDocuments = state.tasks.filter((task) => periods.has(task.period_id) && task.status === "waiting");
  const vouchers = state.vouchers.filter((voucher) => periods.has(voucher.period_id));
  return [
    ...pendingDocuments.map((task) => ({ id: task.id, companyId: task.company_id, type: "Pendiente confirmado", title: task.title, description: "La tarea espera documentación. Revisá el respaldo y actualizá el checklist.", section: "cierre" as const })),
    ...vouchers.filter((voucher) => voucher.review_status === "review").map((voucher) => ({
      id: voucher.id, companyId: voucher.company_id, type: "Requiere revisión", title: voucher.counterparty_name || `Comprobante ${voucher.receipt_number}`,
      description: "El comprobante quedó marcado para revisión. Verificá la imputación y el respaldo.", section: "comprobantes" as const,
    })),
    ...vouchers.filter((voucher) => voucher.category?.toLowerCase() === "bienes de uso" && state.accounts.some((account) => account.id === voucher.account_id && ["expense", "cost"].includes(account.kind))).map((voucher) => ({
      id: `asset-${voucher.id}`, companyId: voucher.company_id, type: "Hipótesis", title: voucher.counterparty_name || `Comprobante ${voucher.receipt_number}`,
      description: "La categoría Bienes de uso tiene asociada una cuenta de costos o gastos. Verificá la naturaleza de la compra.", section: "comprobantes" as const,
    })),
  ];
}
