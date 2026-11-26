import { z } from "zod";
import { bookSchema } from "@/lib/accounting/model";
import { accountKinds, documentCategories, paymentStatuses, reviewStatuses, taskStatuses, xubioStatuses } from "./model";

const uuid = z.uuid();
const text = (max: number) => z.string().trim().max(max);
const nullableText = (max: number) => text(max).nullable();
export const monthSchema = z.string().regex(/^(?:20\d{2})-(?:0[1-9]|1[0-2])$/, "Ingresá un mes válido");
const currency = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Ingresá un código ISO de 3 letras");

export function validCuit(value: string) {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const remainder = (11 - weights.reduce((total, weight, index) => total + weight * Number(value[index]), 0) % 11) % 11;
  return remainder === Number(value[10]);
}

export const companySchema = z.object({
  legal_name: text(160).min(2, "Ingresá la razón social"),
  trade_name: text(100),
  cuit: z.string().transform((value) => value.replace(/[\s-]/g, "")).refine(validCuit, "Ingresá un CUIT válido"),
  entity_type: text(60), activity: text(180), tax_address: text(200), province: text(60),
  vat_status: text(60), gross_income_regime: text(80), start_date: z.iso.date().nullable(),
  fiscal_year_end: z.string().regex(/^(?:(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))?$/, "Usá el formato MM-DD")
    .refine((value) => !value || new Date(`2000-${value}T00:00:00Z`).getUTCDate() === Number(value.slice(3)), "Fecha de cierre inválida"),
  employee_count: z.number().int().min(0).max(1000000), currency, tax_obligations: text(2000), notes: text(4000),
});

export const accountSchema = z.object({
  code: text(45).min(1, "Ingresá el código"), name: text(180).min(1, "Ingresá el nombre"),
  kind: z.enum(["asset", "liability", "equity", "revenue", "cost", "expense"] satisfies (keyof typeof accountKinds)[]),
  parent_code: nullableText(45), category: nullableText(90), status: z.enum(["active", "inactive"]),
}).refine((account) => account.code !== account.parent_code, "La cuenta no puede ser su propia cuenta superior");

const monetary = z.string().trim().regex(/^\d{1,14}(?:\.\d{1,2})?$/, "Ingresá un importe válido");
const classificationSchema = z.object({
  account_id: uuid.nullable(), category: nullableText(90), concept: nullableText(220), cost_center: nullableText(100),
  payment_status: z.enum(["pending", "partial", "settled"] satisfies (keyof typeof paymentStatuses)[]),
  payment_method: nullableText(80), deductible_vat: z.string().trim().regex(/^-?\d{1,14}(?:\.\d{1,2})?$/, "Ingresá un importe válido").nullable(), notes: nullableText(4000),
  review_status: z.enum(["pending", "review", "approved"] satisfies (keyof typeof reviewStatuses)[]),
  xubio_status: z.enum(["pending", "registered"] satisfies (keyof typeof xubioStatuses)[]), document_id: uuid.nullable(),
});

export const organizationSettingsSchema = z.object({
  name: text(120).min(2), locale: z.enum(["es-AR", "es-UY", "es-ES"]), currency,
  timezone: z.enum(["America/Argentina/Tucuman", "America/Argentina/Buenos_Aires", "America/Argentina/Cordoba", "America/Argentina/Mendoza", "America/Montevideo", "UTC"]),
});

export const documentContextSchema = z.object({
  companyId: uuid, periodId: uuid, category: z.enum(documentCategories),
});

export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("book.import"), periodId: uuid, values: z.array(bookSchema).min(1).max(500) }),
  z.object({ type: z.literal("book.save"), periodId: uuid, id: uuid.optional(), values: bookSchema }),
  z.object({ type: z.literal("book.void"), id: uuid }),
  z.object({ type: z.literal("company.save"), organizationId: uuid, id: uuid.optional(), values: companySchema }),
  z.object({ type: z.literal("company.status"), id: uuid, status: z.enum(["active", "archived"]) }),
  z.object({ type: z.literal("period.ensure"), companyId: uuid, month: monthSchema }),
  z.object({ type: z.literal("period.status"), id: uuid, status: z.enum(["open", "closed"]), reason: text(1200) }),
  z.object({ type: z.literal("task.save"), periodId: uuid, id: uuid.optional(), title: text(180).min(2), status: z.enum(["pending", "in_progress", "waiting", "review", "completed", "not_applicable"] satisfies (keyof typeof taskStatuses)[]), notes: text(4000), documentId: uuid.nullable() }),
  z.object({ type: z.literal("account.save"), companyId: uuid, id: uuid.optional(), values: accountSchema }),
  z.object({ type: z.literal("voucher.classify"), id: uuid, values: classificationSchema, saveRule: z.boolean() }),
  z.object({ type: z.literal("organization.create"), name: text(120).min(2) }),
  z.object({ type: z.literal("organization.member"), organizationId: uuid, userId: uuid, role: z.enum(["owner", "editor", "viewer"]).nullable() }),
  z.object({ type: z.literal("organization.settings"), id: uuid, values: organizationSettingsSchema }),
  z.object({ type: z.literal("obligation.save"), periodId: uuid, id: uuid.optional(), title: text(160).min(2), dueOn: z.iso.date(), amount: monetary.nullable(), status: z.enum(["pending", "filed", "paid", "not_applicable"]), filedOn: z.iso.date().nullable(), paidOn: z.iso.date().nullable(), documentId: uuid.nullable(), notes: text(4000) }),
]);
export type Command = z.input<typeof commandSchema>;
export type ParsedCommand = z.output<typeof commandSchema>;

export const importOptionsSchema = documentContextSchema.omit({ category: true }).extend({
  kind: z.enum(["purchases", "sales", "accounts"]),
  decimal: z.enum(["auto", "comma", "point"]),
  mapping: z.record(z.string().max(50), z.number().int().min(0).max(399)),
});
