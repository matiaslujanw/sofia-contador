import { z } from "zod";
import { cents } from "@/lib/workspace/format";

const money = z.string().regex(/^\d{1,14}(?:\.\d{1,2})?$/, "Usá importes positivos con punto decimal");
const signedMoney = z.string().regex(/^-?\d{1,14}(?:\.\d{1,2})?$/, "Importe inválido");
const positive = money.refine((v) => cents(v) > 0n, "El importe debe ser mayor a cero");
const text = z.string().trim().min(1).max(180);
const id = z.uuid();
const cuit = z.string().regex(/^\d{11}$/, "Ingresá 11 dígitos de CUIT");
const base = { date: z.iso.date(), description: text, reference: text, currency: z.string().regex(/^[A-Z]{3}$/), document_id: id.nullable() };
export const bookKinds = { opening: "Saldo inicial de cuenta corriente", cash: "Cobro o pago", accrual: "Devengamiento", statement: "Movimiento de extracto", bank_balance: "Saldos bancarios del mes", asset: "Bien de uso", journal: "Asiento" } as const;
export const bankCategories = { commercial: "Cobro/pago comercial", commission: "Comisión bancaria", interest: "Intereses", vat: "IVA bancario", vat_withholding: "Retención IVA", vat_perception: "Percepción IVA", iibb_withholding: "Retención IIBB / SIRCREB", iibb_perception: "Percepción IIBB", transfer: "Transferencia propia", partners: "Socios / financiamiento", tax: "Pago fiscal o sueldos", other: "Otro movimiento" } as const;
const line = z.object({ account_id: id, debit: money, credit: money }).refine((v) => (cents(v.debit) > 0n) !== (cents(v.credit) > 0n), "Cada línea lleva Debe o Haber, nunca ambos");
export const bookSchema = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("opening"), role: z.enum(["customer", "supplier"]), cuit, name: text, amount: signedMoney.refine((v) => cents(v) !== 0n), control_account_id: id, offset_account_id: id }),
  z.object({ ...base, kind: z.literal("cash"), payment_method: z.enum(["Efectivo", "Transferencia", "Tarjeta", "Cheque", "Otro"]).optional(), flow: z.enum(["in", "out"]), amount: positive, cash_account_id: id, counterpart_account_id: id, category: z.enum(Object.keys(bankCategories) as [keyof typeof bankCategories, ...(keyof typeof bankCategories)[]]), role: z.enum(["customer", "supplier", "other"]), cuit: cuit.nullable(), name: z.string().trim().max(180), voucher_id: id.nullable(), settles_id: id.nullable() }).refine((v) => v.role === "other" || !!v.cuit, "Clientes y proveedores requieren CUIT").refine((v) => !(v.voucher_id && v.settles_id), "Elegí comprobante u obligación"),
  z.object({ ...base, kind: z.literal("accrual"), tax: z.enum(["IVA", "IIBB", "TEM", "Sueldos", "Cargas sociales"]), amount: positive, debit_account_id: id, credit_account_id: id, due_on: z.iso.date() }),
  z.object({ ...base, kind: z.literal("statement"), cash_account_id: id, amount: signedMoney.refine((v) => cents(v) !== 0n), match_id: id.nullable() }),
  z.object({ ...base, kind: z.literal("bank_balance"), cash_account_id: id, opening_balance: signedMoney, closing_balance: signedMoney }),
  z.object({ ...base, kind: z.literal("asset"), frequency: z.enum(["monthly","annual"]).optional(), annual_month: z.string().regex(/^(0[1-9]|1[0-2])$/).optional(), cost: positive, residual: money, life_months: z.number().int().min(1).max(1200), service_on: z.iso.date(), disposal_on: z.iso.date().nullable(), expense_account_id: id, accumulated_account_id: id }).refine((v) => v.frequency!=="annual" || !!v.annual_month, "Elegí el mes de registración anual").refine((v) => cents(v.residual) < cents(v.cost), "El residual debe ser menor al costo").refine((v) => !v.disposal_on || v.disposal_on >= v.service_on, "La baja no puede preceder al alta"),
  z.object({ ...base, kind: z.literal("journal"), source_key: z.string().min(1).max(200), lines: z.array(line).min(2).max(100) }).refine((v) => v.lines.reduce((s,l) => s+cents(l.debit)-cents(l.credit),0n) === 0n, "El asiento debe balancear"),
]);
export type BookValues = z.infer<typeof bookSchema>;
export type BookRecord = { id: string; organization_id: string; company_id: string; period_id: string; payload: BookValues };
export type JournalLine = { account_id: string; debit: string; credit: string };
