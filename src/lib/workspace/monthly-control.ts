import { cents, decimalFromCents } from "./format";
import { taskStatuses, type Company, type Voucher, type WorkspaceState } from "./model";
import type { Section } from "./routes";

// These are review requirements, not automatic accounting or tax postings.
export const monthlySteps: { id: string; title: string; description: string; section: Section; tasks: string[] }[] = [
  { id: "calendar", title: "1. Vencimientos", description: "Verificar CUIT, período, régimen y calendario vigente de ARCA, DGR Tucumán y municipio. Conservar la fuente de cada fecha.", section: "calendario", tasks: ["Verificación de vencimientos ARCA, IIBB y TEM"] },
  { id: "balances", title: "2. Clientes y proveedores", description: "Revisar saldo inicial, comprobantes, notas de crédito, anticipos, cobros y pagos. Contrastar los saldos finales con Xubio.", section: "comprobantes", tasks: ["Control de cuentas corrientes de clientes y proveedores", "Verificación de pagos y cobros"] },
  { id: "taxes", title: "3. Documentación e impuestos", description: "Completar compras y ventas, incluidas las ausentes en ARCA. Separar comisiones, IVA bancario, retenciones y percepciones de IVA e IIBB, sin duplicar comprobantes.", section: "documentacion", tasks: ["Recepción de comprobantes emitidos", "Recepción de comprobantes recibidos", "Recepción de extractos bancarios", "Control de IVA, retenciones y percepciones bancarias", "Liquidación de IVA", "Liquidación de Ingresos Brutos", "Liquidación de TEM"] },
  { id: "classification", title: "4. Clasificación y asientos", description: "Distinguir contado, crédito, cobros y pagos parciales. Revisar transferencias entre cuentas, socios, préstamos y movimientos sin comprobante antes de generar asientos balanceados.", section: "comprobantes", tasks: ["Clasificación contable de compras y ventas", "Control de movimientos bancarios", "Control de cuentas de socios", "Generación de asientos contables"] },
  { id: "accruals", title: "5. Devengamientos y pagos", description: "Devengar IVA, IIBB, TEM, sueldos y cargas sociales por separado. Generar la deuda y registrar luego su cancelación, con fecha y respaldo del pago.", section: "calendario", tasks: ["Devengamiento de IVA, IIBB y TEM", "Devengamiento de sueldos y cargas sociales", "Control de pagos fiscales"] },
  { id: "bank", title: "6. Conciliación bancaria", description: "Conciliar por cuenta y moneda: saldo inicial, movimientos, saldo final y partidas pendientes. Arrastrar diferencias del mes anterior y revisar reversos y rechazos.", section: "documentacion", tasks: ["Conciliación bancaria"] },
  { id: "assets", title: "7. Bienes de uso", description: "Verificar altas, bajas, costo, fecha de puesta en uso, vida útil y valor residual. Calcular y registrar la amortización mensual sin superar el valor amortizable.", section: "cuentas", tasks: ["Control de bienes de uso y amortización mensual"] },
  { id: "reports", title: "8. Informes por empresa", description: "Separar ingresos y egresos efectivos del resultado devengado. Incluir sueldos, impuestos y amortizaciones antes de evaluar rentabilidad y distribuciones de gastos.", section: "informes", tasks: ["Estado de resultados", "Control de ingresos, egresos y rentabilidad"] },
  { id: "closing", title: "9. Revisión y Xubio", description: "Comprobar asientos balanceados, saldos y respaldos. Validar el archivo con la plantilla vigente de Xubio y verificar la importación antes de cerrar el mes.", section: "cierre", tasks: ["Control de declaraciones juradas", "Registración en Xubio", "Validación de importación y saldos en Xubio", "Cierre mensual"] },
];

export function monthlyControl(state: WorkspaceState, company: Company, month: string) {
  const orgId = company.organization_id;
  const period = state.periods.find((p) => p.organization_id === orgId && p.company_id === company.id && p.month.slice(0, 7) === month);
  const tasks = state.tasks.filter((t) => t.organization_id === orgId && t.company_id === company.id && t.period_id === period?.id);
  const vouchers = state.vouchers.filter((v) => v.organization_id === orgId && v.company_id === company.id && v.period_id === period?.id);
  const has = (title: string) => tasks.some((t) => t.title === title);
  return {
    period, tasks, vouchers,
    steps: monthlySteps.map((step) => ({ ...step, tasks: step.tasks.map((title) => ({ title, record: tasks.find((t) => t.title === title) })) })),
    missingTitles: [...new Set(monthlySteps.flatMap((step) => step.tasks))].filter((title) => !has(title)),
    unreviewed: vouchers.filter((v) => v.review_status !== "approved").length,
    unclassified: vouchers.filter((v) => !v.account_id).length,
    pendingXubio: vouchers.filter((v) => v.xubio_status !== "registered").length,
  };
}

export function vatTreatment(voucher: Voucher) {
  if (voucher.currency !== "ARS") return "Moneda extranjera: convertir y revisar por separado";
  if (voucher.review_status !== "approved") return "Pendiente de aprobación";
  if (voucher.direction === "purchase" && voucher.deductible_vat === null) return "Crédito computable sin definir";
  return "Incluido en subtotal revisado";
}

export function vatWorksheet(vouchers: Voucher[]) {
  const ars = vouchers.filter((v) => v.currency === "ARS");
  const sales = ars.filter((v) => v.direction === "sale");
  const purchases = ars.filter((v) => v.direction === "purchase");
  const sum = (entries: Voucher[], amount: (v: Voucher) => string) => entries.reduce((total, v) => total + cents(amount(v)), 0n);
  const debit = sum(sales.filter((v) => v.review_status === "approved"), (v) => v.vat);
  const credit = sum(purchases.filter((v) => v.review_status === "approved" && v.deductible_vat !== null), (v) => v.deductible_vat!);
  return {
    reportedDebit: sum(sales, (v) => v.vat), reportedCredit: sum(purchases, (v) => v.vat),
    debit, credit, difference: debit - credit,
    missingCredit: purchases.filter((v) => v.deductible_vat === null).length,
    unreviewed: ars.filter((v) => v.review_status !== "approved").length,
    foreignCurrency: vouchers.length - ars.length,
    hasSales: sales.length > 0, hasPurchases: purchases.length > 0,
  };
}

// All cells are quoted; user text is neutralized for spreadsheet formula execution.
export function worksheetCsv(rows: (string | null)[][]) {
  return "\uFEFF" + rows.map((row) => row.map((value) => {
    const text = value ?? "";
    const safe = /^[\s\uFEFF]*[=+@-]/.test(text) && !/^-\d+(\.\d+)?$/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  }).join(";")).join("\r\n") + "\r\n";
}

export function vatDetailCsv(company: Company, month: string, vouchers: Voucher[]) {
  return worksheetCsv([
    ["empresa", "cuit_empresa", "periodo", "id_comprobante", "fecha", "operacion", "tipo", "punto_venta", "numero", "cuit_contraparte", "contraparte", "moneda", "cotizacion", "neto_gravado", "no_gravado", "exento", "iva_informado", "iva_computable_definido", "iva_en_subtotal_revisado_ars", "otros_tributos_sin_desglosar", "total", "tratamiento", "revision", "formato"],
    ...vouchers.map((v) => [company.legal_name, company.cuit, month, v.id, v.date, v.direction === "purchase" ? "Compra" : "Venta", v.receipt_type, String(v.point_of_sale), String(v.receipt_number), v.counterparty_cuit, v.counterparty_name, v.currency, v.exchange_rate, v.taxable, v.untaxed, v.exempt, v.vat, v.direction === "purchase" ? v.deductible_vat : null, vatTreatment(v) === "Incluido en subtotal revisado" ? (v.direction === "purchase" ? v.deductible_vat : v.vat) : null, v.other_taxes, v.total, vatTreatment(v), v.review_status, "Papel de trabajo Sofía; no es archivo de importación Xubio"]),
  ]);
}

export function monthlyChecklistCsv(company: Company, month: string, control: ReturnType<typeof monthlyControl>) {
  return worksheetCsv([
    ["empresa", "cuit", "periodo", "etapa", "tarea", "estado", "observaciones"],
    ...control.steps.flatMap((step) => step.tasks.map(({ title, record }) => [company.legal_name, company.cuit, month, step.title, title, record ? taskStatuses[record.status] : "Sin agregar al checklist", record?.notes ?? ""])),
  ]);
}

export function vatSummaryCsv(company: Company, month: string, vouchers: Voucher[]) {
  const sheet = vatWorksheet(vouchers);
  return worksheetCsv([
    ["empresa", "cuit", "periodo", "moneda", "concepto", "importe", "comprobantes_ars_sin_aprobar", "compras_ars_sin_credito_definido", "comprobantes_otras_monedas_excluidos", "alcance"],
    ...([ ["IVA ventas informado", sheet.reportedDebit], ["IVA compras informado", sheet.reportedCredit], ["Débito aprobado", sheet.debit], ["Crédito computable aprobado y definido", sheet.credit], ["Diferencia de subtotales revisados", sheet.difference] ] as const)
      .map(([title, amount]) => [company.legal_name, company.cuit, month, "ARS", title, decimalFromCents(amount), String(sheet.unreviewed), String(sheet.missingCredit), String(sheet.foreignCurrency), `Ventas ARS: ${sheet.hasSales ? "cargadas" : "sin comprobantes"}. Compras ARS: ${sheet.hasPurchases ? "cargadas" : "sin comprobantes"}. Parcial: sin saldos anteriores, retenciones, percepciones, ajustes ni IVA bancario no documentado. No es DDJJ ni importación Xubio.`]),
  ]);
}
