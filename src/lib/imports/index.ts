import type { SourceRow, SourceTable } from "./source";

export { IMPORT_MAX_BYTES, IMPORT_MAX_ROWS, readSource } from "./source";
export type { SourceRow, SourceTable } from "./source";

export type ImportKind = "purchases" | "sales" | "accounts";
export type ColumnMapping = Record<string, number>;
export type DecimalFormat = "auto" | "comma" | "point";
export type AccountKind = "asset" | "liability" | "equity" | "revenue" | "cost" | "expense";

export type ImportVoucher = {
  direction: "purchase" | "sale";
  date: string;
  receipt_type: string;
  point_of_sale: number;
  receipt_number: number;
  counterparty_cuit: string;
  counterparty_name: string;
  currency: string;
  exchange_rate: string;
  taxable: string;
  untaxed: string;
  exempt: string;
  vat: string;
  other_taxes: string;
  total: string;
  vat_breakdown?: Record<string, string>;
};

export type ImportAccount = {
  code: string;
  name: string;
  kind: AccountKind;
  parent_code: string | null;
  category: string | null;
  status: "active" | "inactive";
};

type Field = { key: string; label: string; required: boolean; aliases?: string[] };
export type ImportIssue = { row: number; field: string; message: string; severity: "error" | "warning" };
export type ImportPreview = { vouchers: ImportVoucher[]; accounts: ImportAccount[]; issues: ImportIssue[]; duplicates: number };

const VAT_RATES = [
  ["0", "0"], ["2_5", "2.5"], ["5", "5"], ["10_5", "10.5"], ["21", "21"], ["27", "27"],
];

const VOUCHER_FIELDS: Field[] = [
  { key: "date", label: "Fecha", required: true, aliases: ["fecha comprobante", "fecha de emisión", "fecha de emision"] },
  { key: "receipt_type", label: "Tipo de comprobante", required: true, aliases: ["tipo comprobante", "tipo"] },
  { key: "point_of_sale", label: "Punto de venta", required: true, aliases: ["punto venta", "pto vta"] },
  { key: "receipt_number", label: "Número de comprobante", required: true, aliases: ["numero desde", "numero comprobante", "nro comprobante", "numero"] },
  { key: "receipt_number_to", label: "Número hasta", required: false, aliases: ["numero comprobante hasta", "nro hasta"] },
  { key: "counterparty_cuit", label: "CUIT de contraparte", required: true, aliases: ["cuit", "cuit contraparte"] },
  { key: "counterparty_name", label: "Nombre de contraparte", required: true, aliases: ["razon social", "denominacion", "denominacion contraparte"] },
  { key: "currency", label: "Moneda", required: true },
  { key: "exchange_rate", label: "Tipo de cambio", required: true, aliases: ["cotizacion", "tipo cambio"] },
  { key: "taxable", label: "Neto gravado", required: true, aliases: ["importe neto gravado", "imp neto gravado"] },
  { key: "untaxed", label: "Neto no gravado", required: true, aliases: ["importe neto no gravado", "imp neto no gravado"] },
  { key: "exempt", label: "Exento", required: true, aliases: ["importe exento", "operaciones exentas", "imp op exentas"] },
  { key: "vat", label: "IVA total", required: true, aliases: ["iva", "importe iva"] },
  { key: "other_taxes", label: "Otros tributos", required: true, aliases: ["importe otros tributos", "imp otros tributos"] },
  { key: "total", label: "Importe total", required: true, aliases: ["imp total", "total comprobante"] },
  ...VAT_RATES.map(([key, rate]): Field => ({
    key: `vat_rate_${key}`,
    label: `IVA ${rate.replace(".", ",")} %`,
    required: false,
    aliases: [`importe iva ${rate}%`],
  })),
];

const ACCOUNT_FIELDS: Field[] = [
  { key: "code", label: "Código", required: true, aliases: ["codigo cuenta", "codigo de cuenta"] },
  { key: "name", label: "Nombre", required: true, aliases: ["cuenta", "nombre cuenta", "nombre de cuenta", "denominacion"] },
  { key: "kind", label: "Rubro contable", required: true, aliases: ["tipo", "tipo de cuenta", "naturaleza", "rubro"] },
  { key: "parent_code", label: "Código de cuenta padre", required: false, aliases: ["codigo padre", "cuenta padre"] },
  { key: "category", label: "Categoría", required: false },
  { key: "status", label: "Estado", required: true },
];

const ACCOUNT_KINDS = new Map<string, AccountKind>([
  ["asset", "asset"], ["activo", "asset"],
  ["liability", "liability"], ["pasivo", "liability"],
  ["equity", "equity"], ["patrimonio neto", "equity"],
  ["revenue", "revenue"], ["ingresos", "revenue"], ["ingreso", "revenue"],
  ["cost", "cost"], ["costos", "cost"], ["costo", "cost"],
  ["expense", "expense"], ["gastos", "expense"], ["gasto", "expense"],
]);
const CURRENCY_CODES = new Map([["PES", "ARS"], ["DOL", "USD"]]);
const CREDIT_NOTE_CODES = new Set([3, 8, 13, 21, 38, 43, 44, 48, 53, 90, 110, 112, 113, 114, 119, 197, 203, 208, 213]);
const DEBIT_NOTE_CODES = new Set([2, 7, 12, 20, 37, 45, 46, 47, 52, 115, 116, 117, 120, 196, 202, 207, 212]);

function normalizeLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function fieldsFor(kind: ImportKind): Field[] {
  if (kind === "accounts") return ACCOUNT_FIELDS;
  const party = kind === "purchases" ? "emisor" : "receptor";
  return VOUCHER_FIELDS.map((field) => {
    if (field.key === "counterparty_cuit") {
      return {
        ...field,
        label: `CUIT del ${party}`,
        aliases: [...(field.aliases ?? []), `cuit ${party}`],
        required: kind === "purchases",
      };
    }
    if (field.key === "counterparty_name") {
      return {
        ...field,
        label: `Nombre del ${party}`,
        aliases: [...(field.aliases ?? []), `razon social ${party}`, `denominacion ${party}`],
      };
    }
    return field;
  });
}

export function suggestMapping(kind: ImportKind, headers: string[]): ColumnMapping {
  const normalized = headers.map(normalizeLabel);
  const hints = fieldsFor(kind).flatMap(({ key, label, aliases }) => {
    const allowed = [key, label, ...(aliases ?? [])].map(normalizeLabel);
    const matches = normalized.flatMap((header, index) => allowed.includes(header) ? [index] : []);
    return matches.length === 1 ? [[key, matches[0]] as const] : [];
  });
  return Object.fromEntries(hints.filter(([, column]) => hints.filter(([, other]) => other === column).length === 1));
}

export function templateCsv(kind: ImportKind): string {
  return `\uFEFF${fieldsFor(kind).map(({ key }) => key).join(";")}\r\n`;
}

function fullDate(input: string): string | null {
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(input);
  const argentine = /^(\d{1,2})([/-])(\d{1,2})\2(\d{4})$/.exec(input);
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(input);
  if (!iso && !argentine && !compact) return null;
  const [, year, month, day] = iso ?? compact ?? [null, argentine![4], argentine![3], argentine![1]];
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const calendar = new Date(Date.UTC(y, m - 1, d));
  return y >= 1900 && calendar.getUTCFullYear() === y && calendar.getUTCMonth() === m - 1 && calendar.getUTCDate() === d
    ? `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    : null;
}

function decimalValue(input: string, format: DecimalFormat, scale: number, numeric: boolean): string {
  let text = input.replace(/[\u00a0\u202f]/g, " ").trim();
  let negative = false;
  if (text.startsWith("(") && text.endsWith(")")) {
    negative = true;
    text = text.slice(1, -1).trim();
  } else if (text.startsWith("-") || text.startsWith("−") || text.startsWith("+")) {
    negative = !text.startsWith("+");
    text = text.slice(1);
  }
  if (!text || /[^\d., ]/.test(text)) throw new Error("Indicá un importe numérico sin símbolos de moneda.");
  let separator = numeric ? "." : format === "comma" ? "," : ".";
  if (!numeric && format === "auto") {
    const comma = text.lastIndexOf(",");
    const point = text.lastIndexOf(".");
    separator = comma > point ? "," : ".";
    const candidate = Math.max(comma, point);
    if (candidate !== -1 && Math.min(comma, point) === -1 &&
      text.indexOf(separator) === candidate && text.length - candidate === 4 && candidate > 0 && candidate <= 3) {
      throw new Error("El separador es ambiguo. Elegí el formato decimal del archivo.");
    }
    if (candidate > text.indexOf(separator) && Math.min(comma, point) === -1) {
      separator = separator === "," ? "." : ",";
    }
  }

  const [integer, fraction = "", extra] = text.split(separator);
  const grouped = separator === "," ? "." : ",";
  const grouping = integer.includes(" ") ? " " : grouped;
  const blocks = integer.split(grouping);
  const validInteger = blocks.length === 1
    ? /^\d+$/.test(integer)
    : /^\d{1,3}$/.test(blocks[0]) && blocks.slice(1).every((part) => /^\d{3}$/.test(part));
  if (!validInteger || extra !== undefined || !/^\d*$/.test(fraction) ||
    (text.includes(separator) && !fraction)) {
    throw new Error("Los separadores del importe no coinciden con el formato decimal.");
  }
  if (fraction.length > scale) throw new Error(`Se admiten hasta ${scale} decimales.`);
  const whole = blocks.join("").replace(/^0+(?=\d)/, "");
  if (whole.length > 16) throw new Error("El importe supera el máximo permitido.");
  const decimals = fraction.padEnd(scale, "0");
  const isZero = whole === "0" && /^0+$/.test(decimals);
  return `${negative && !isZero ? "-" : ""}${whole}.${decimals}`;
}

const asUnits = (value: string) => BigInt(value.replace(".", ""));
const cleanDigits = (value: string) => value.replace(/^0+(?=\d)/, "");
const MONEY_FIELDS = ["taxable", "untaxed", "exempt", "vat", "other_taxes", "total"] as const;
type MoneyField = (typeof MONEY_FIELDS)[number];

function metaValue(mapping: ColumnMapping, key: string): number | undefined {
  return Object.hasOwn(mapping, key) ? mapping[key] : undefined;
}

function cellText(row: SourceRow, mapping: ColumnMapping, key: string): string {
  const column = metaValue(mapping, key);
  return column === undefined ? "" : (row.cells[column] ?? "").trim();
}

type Issue = (field: string, message: string, severity?: ImportIssue["severity"]) => void;

function adjustmentType(receiptType: string, issue: Issue): "credit" | "debit" | null {
  const label = normalizeLabel(receiptType);
  const credit = /\bnotas? (?:de )?credito\b/.test(label);
  const debit = /\bnotas? (?:de )?debito\b/.test(label);
  const code = Number(label.match(/^\d{1,3}(?= |$)/)?.[0]);
  const coded = CREDIT_NOTE_CODES.has(code) ? "credit" : DEBIT_NOTE_CODES.has(code) ? "debit" : null;
  const named = credit ? "credit" : debit ? "debit" : null;
  if ((credit && debit) || (coded && named && coded !== named)) {
    issue("receipt_type", "El código y la descripción del tipo de comprobante deben corresponder al mismo ajuste.");
  }
  return named ?? coded;
}

function parseVoucher(
  kind: "purchases" | "sales",
  row: SourceRow,
  mapping: ColumnMapping,
  issue: Issue,
  options: { month?: string; decimal?: DecimalFormat }
): ImportVoucher {
  const pick = (key: string) => cellText(row, mapping, key);
  const date = fullDate(pick("date")) ?? "";
  if (!date) issue("date", "Indicá una fecha válida en formato DD/MM/AAAA o AAAA-MM-DD.");
  else if (options.month && !date.startsWith(`${options.month}-`)) {
    issue("date", "La fecha del comprobante está fuera del período seleccionado.");
  }
  const pointOfSale = cleanDigits(pick("point_of_sale"));
  const receiptNumber = cleanDigits(pick("receipt_number"));
  const receiptNumberTo = cleanDigits(pick("receipt_number_to"));
  if (!/^[1-9]\d{0,4}$/.test(pointOfSale)) issue("point_of_sale", "El punto de venta debe tener de 1 a 5 dígitos y ser mayor que cero.");
  if (!/^[1-9]\d{0,7}$/.test(receiptNumber)) issue("receipt_number", "El número debe tener de 1 a 8 dígitos y ser mayor que cero.");
  if (receiptNumberTo && receiptNumberTo !== receiptNumber) {
    issue("receipt_number_to", "Cargá cada comprobante por separado. El campo número hasta debe coincidir con el número de comprobante.");
  }

  const sourceType = pick("receipt_type");
  const receiptType = /^\d{1,3}$/.test(sourceType) ? sourceType.padStart(3, "0") : sourceType;
  const counterpartyName = pick("counterparty_name");
  if (!receiptType || receiptType.length > 120) issue("receipt_type", "Indicá un tipo de comprobante de hasta 120 caracteres.");
  if (!counterpartyName || counterpartyName.length > 250) issue("counterparty_name", "Indicá un nombre de hasta 250 caracteres.");
  const cuit = pick("counterparty_cuit").replace(/[ -]/g, "");
  if ((cuit || kind === "purchases") && !/^\d{11}$/.test(cuit)) {
    issue("counterparty_cuit", "Indicá un CUIT de 11 dígitos.");
  }

  const currencyInput = pick("currency").toUpperCase();
  const currency = CURRENCY_CODES.get(currencyInput) ?? currencyInput;
  if (!/^[A-Z]{3}$/.test(currency)) issue("currency", "Indicá el código de moneda de tres letras, por ejemplo ARS o USD.");
  const amount = (key: string, scale = 2): string | null => {
    const column = metaValue(mapping, key);
    try {
      return decimalValue(pick(key), options.decimal ?? "auto", scale, column !== undefined && !!row.numericCells?.includes(column));
    } catch (error) {
      issue(key, error instanceof Error ? error.message : "Importe inválido.");
      return null;
    }
  };
  const exchangeRate = amount("exchange_rate", 6);
  if (exchangeRate && (asUnits(exchangeRate) <= 0n || (currency === "ARS" && exchangeRate !== "1.000000"))) {
    issue("exchange_rate", currency === "ARS" ? "El tipo de cambio en ARS debe ser 1." : "El tipo de cambio debe ser mayor que cero.");
  }

  const money = Object.fromEntries(MONEY_FIELDS.map((field) => [field, amount(field)])) as Record<MoneyField, string | null>;
  const vatBreakdown = Object.fromEntries(VAT_RATES.flatMap(([key, rate]) => {
    const field = `vat_rate_${key}`;
    if (!pick(field)) return [];
    const value = amount(field);
    return value ? [[rate, value]] : [];
  }));

  if (MONEY_FIELDS.every((field) => money[field] !== null)) {
    const sum = MONEY_FIELDS.slice(0, -1).reduce((net, field) => net + asUnits(money[field]!), 0n);
    if (sum !== asUnits(money.total!)) issue("total", "El total debe coincidir con netos, exento, IVA y otros tributos.");
  }
  if (money.vat && Object.keys(vatBreakdown).length &&
    Object.values(vatBreakdown).reduce((total, value) => total + asUnits(value), 0n) !== asUnits(money.vat)) {
    issue("vat", "La suma de los importes por alícuota debe coincidir con el IVA total.");
  }
  const adjustment = adjustmentType(receiptType, issue);
  if (adjustment) {
    const amounts = [...Object.values(money), ...Object.values(vatBreakdown)].filter((value) => value !== null).map(asUnits);
    if (adjustment === "credit" && amounts.some((amount) => amount > 0n)) {
      issue("total", "En la plantilla de Sofía los importes de una nota de crédito se expresan con signo negativo.");
    } else if (adjustment === "debit" && amounts.some((amount) => amount < 0n)) {
      issue("total", "En la plantilla de Sofía los importes de una nota de débito se expresan con signo positivo.");
    }
  }

  return {
    direction: kind === "purchases" ? "purchase" : "sale", date,
    receipt_type: receiptType, point_of_sale: Number(pointOfSale), receipt_number: Number(receiptNumber),
    counterparty_cuit: cuit, counterparty_name: counterpartyName, currency,
    exchange_rate: exchangeRate ?? "",
    taxable: money.taxable ?? "", untaxed: money.untaxed ?? "", exempt: money.exempt ?? "",
    vat: money.vat ?? "", other_taxes: money.other_taxes ?? "", total: money.total ?? "",
    ...(Object.keys(vatBreakdown).length ? { vat_breakdown: vatBreakdown } : {}),
  };
}

function parseAccount(row: SourceRow, mapping: ColumnMapping, issue: Issue): ImportAccount {
  const pick = (key: string) => cellText(row, mapping, key);
  const code = pick("code");
  const name = pick("name");
  const kind = ACCOUNT_KINDS.get(normalizeLabel(pick("kind")));
  const parentCode = pick("parent_code");
  const category = pick("category");
  const state = normalizeLabel(pick("status"));
  const status = ["activo", "activa", "active"].includes(state) ? "active"
    : ["inactivo", "inactiva", "inactive"].includes(state) ? "inactive" : null;
  if (!code || code.length > 80) issue("code", "Indicá un código de hasta 80 caracteres.");
  if (!name || name.length > 180) issue("name", "Indicá un nombre de hasta 180 caracteres.");
  if (!kind) issue("kind", "Elegí activo, pasivo, patrimonio neto, ingresos, costos o gastos.");
  if (!status) issue("status", "Indicá activo o inactivo.");
  if (parentCode === code && code) issue("parent_code", "Una cuenta no puede ser su propia cuenta padre.");
  if (parentCode.length > 80) issue("parent_code", "El código de cuenta padre admite hasta 80 caracteres.");
  if (category.length > 150) issue("category", "La categoría admite hasta 150 caracteres.");
  return { code, name, kind: kind ?? "asset", parent_code: parentCode || null, category: category || null, status: status ?? "active" };
}

export function voucherIdentity(voucher: Pick<ImportVoucher, "direction" | "receipt_type" | "point_of_sale" | "receipt_number" | "counterparty_cuit">): string {
  return JSON.stringify([
    voucher.direction,
    voucher.receipt_type.trim().toLowerCase(),
    voucher.point_of_sale,
    voucher.receipt_number,
    voucher.direction === "purchase" ? voucher.counterparty_cuit : null,
  ]);
}

function accountCycles(accounts: Map<string, { account: ImportAccount; row: number }>, issues: ImportIssue[]) {
  const visited = new Set<string>();
  for (const code of accounts.keys()) {
    if (visited.has(code)) continue;
    const path = new Set<string>();
    let key: string | null = code;
    while (key && !visited.has(key)) {
      if (path.has(key)) {
        issues.push({
          row: accounts.get(key)!.row, field: "parent_code", severity: "error",
          message: "La jerarquía de cuentas forma un ciclo. Revisá los códigos padre.",
        });
        break;
      }
      path.add(key);
      key = accounts.get(key)?.account.parent_code ?? null;
    }
    for (const key of path) visited.add(key);
  }
}

export function previewImport(
  kind: ImportKind,
  table: SourceTable,
  mapping: ColumnMapping,
  options: { month?: string; decimal?: DecimalFormat } = {}
): ImportPreview {
  const result: ImportPreview = { accounts: [], vouchers: [], issues: [], duplicates: 0 };
  const fields = fieldsFor(kind);
  const assigned = new Set<number>();
  for (const field of fields) {
    const column = metaValue(mapping, field.key);
    if (column === undefined && !field.required) continue;
    if (column === undefined || !Number.isInteger(column) || column < 0 || column >= table.headers.length) {
      result.issues.push({ row: 0, field: field.key, severity: "error", message: `Asigná una columna para ${field.label}.` });
    } else if (assigned.has(column)) {
      result.issues.push({ row: 0, field: field.key, severity: "error", message: `La columna de ${field.label} ya está asignada a otro campo.` });
    } else {
      assigned.add(column);
    }
  }
  if (result.issues.length) return result;

  const seen = new Map<string, { payload: string; row: number }>();
  const accounts = new Map<string, { account: ImportAccount; row: number }>();
  for (const row of table.rows) {
    const issue: Issue = (field, message, severity = "error") => result.issues.push({ row: row.row, field, severity, message });
    const before = result.issues.length;
    for (const field of fields) {
      const column = metaValue(mapping, field.key);
      if (column !== undefined && row.invalidCells?.includes(column)) {
        issue(field.key, "Reemplazá las fórmulas o errores de Excel por el valor verificado.");
      }
    }
    if (result.issues.length > before) continue;
    const account = kind === "accounts" ? parseAccount(row, mapping, issue) : null;
    const voucher = kind === "accounts" ? null : parseVoucher(kind, row, mapping, issue, options);
    if (result.issues.slice(before).some(({ severity }) => severity === "error")) continue;

    const identity = account ? account.code : voucherIdentity(voucher!);
    const payload = JSON.stringify(account ?? { ...voucher!, receipt_type: voucher!.receipt_type.toLowerCase() });
    const duplicate = seen.get(identity);
    if (duplicate) {
      if (payload !== duplicate.payload) {
        issue(account ? "code" : "receipt_number", `La misma clave aparece en la fila ${duplicate.row} con otros datos.`);
      } else {
        result.duplicates += 1;
      }
      continue;
    }

    seen.set(identity, { payload, row: row.row });
    if (account) {
      result.accounts.push(account);
      accounts.set(account.code, { account, row: row.row });
    } else if (voucher) {
      result.vouchers.push(voucher);
    }
  }
  accountCycles(accounts, result.issues);
  return result;
}
