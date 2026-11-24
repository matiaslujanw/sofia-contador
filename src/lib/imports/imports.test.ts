import { describe, expect, test } from "vitest";
import { utils, write } from "xlsx";
import { fieldsFor, previewImport, readSource, suggestMapping, templateCsv, type ImportKind } from "./index";

const commonVoucher: Record<string, string> = {
  date: "04/11/2026",
  receipt_type: "Factura A",
  point_of_sale: "00005",
  receipt_number: "00001001",
  counterparty_cuit: "30-71234567-1",
  counterparty_name: 'Proveedor "Uno"; SAS',
  currency: "ARS",
  exchange_rate: "1",
  taxable: "1.234,56",
  untaxed: "0",
  exempt: "0",
  vat: "259,26",
  vat_rate_21: "259,26",
  other_taxes: "0",
  total: "1.493,82",
};

const account = { code: "01", name: "Caja", kind: "activo", status: "activa" };

function csvCell(value: string) {
  return /[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function csvContent(kind: ImportKind, records: Record<string, string>[]) {
  const fields = fieldsFor(kind);
  return templateCsv(kind) + records.map((row) =>
    fields.map(({ key }) => csvCell(row[key] ?? "")).join(";"),
  ).join("\r\n");
}

async function previewCsv(kind: ImportKind, records: Record<string, string>[]) {
  const table = await readSource(new TextEncoder().encode(csvContent(kind, records)).buffer, "datos.csv");
  return previewImport(kind, table, suggestMapping(kind, table.headers), { month: "2026-11" });
}

function workbookBytes(sheet: ReturnType<typeof utils.aoa_to_sheet>, bookType: "xlsx" | "biff8", multiple = false) {
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, sheet, "Datos");
  if (multiple) utils.book_append_sheet(workbook, utils.aoa_to_sheet([["otra"]]), "Otra");
  const bytes: ArrayBuffer = write(workbook, { type: "array", bookType, compression: true });
  return bytes;
}

describe("importación de comprobantes", () => {
  test("normaliza fechas, CUIT, identificadores e importes con desglose de IVA", async () => {
    const preview = await previewCsv("purchases", [commonVoucher]);
    expect(preview.issues).toEqual([]);
    expect(preview.vouchers).toEqual([expect.objectContaining({
      date: "2026-11-04",
      direction: "purchase",
      point_of_sale: 5,
      receipt_number: 1001,
      counterparty_cuit: "30712345671",
      counterparty_name: 'Proveedor "Uno"; SAS',
      exchange_rate: "1.000000",
      taxable: "1234.56",
      vat: "259.26",
      vat_breakdown: { "21": "259.26" },
      total: "1493.82",
    })]);
  });

  test("conserva el máximo monetario exacto leído como texto", async () => {
    const preview = await previewCsv("purchases", [{
      ...commonVoucher, taxable: "9999999999999999.99", vat: "0", vat_rate_21: "", total: "9999999999999999.99",
    }]);
    expect(preview.issues).toEqual([]);
    expect(preview.vouchers[0].total).toBe("9999999999999999.99");
  });

  test("colapsa réplicas idénticas y diferencia emisores de compra", async () => {
    const preview = await previewCsv("purchases", [
      commonVoucher, { ...commonVoucher, point_of_sale: "5", receipt_type: "factura a" },
      { ...commonVoucher, counterparty_cuit: "30712345672" },
    ]);
    expect(preview.duplicates).toBe(1);
    expect(preview.vouchers).toHaveLength(2);
    expect(preview.issues).toEqual([]);
  });

  test("marca un conflicto de venta aunque cambie el receptor", async () => {
    const preview = await previewCsv("sales", [
      { ...commonVoucher, counterparty_cuit: "" },
      { ...commonVoucher, counterparty_cuit: "30712345672" },
    ]);
    expect(preview.duplicates).toBe(0);
    expect(preview.vouchers).toHaveLength(1);
    expect(preview.issues).toContainEqual(expect.objectContaining({ row: 3, field: "receipt_number", severity: "error" }));
  });

  test("rechaza fechas imposibles, períodos ajenos y rangos de comprobantes", async () => {
    const preview = await previewCsv("purchases", [
      { ...commonVoucher, date: "29/02/2026" },
      { ...commonVoucher, date: "2026-10-31", receipt_number_to: "1002" },
    ]);
    expect(preview.vouchers).toEqual([]);
    expect(preview.issues.map(({ row, field }) => [row, field])).toEqual([
      [2, "date"], [3, "date"], [3, "receipt_number_to"],
    ]);
  });

  test("acepta notas de crédito con importes negativos y exige una suma consistente", async () => {
    const preview = await previewCsv("purchases", [
      { ...commonVoucher, receipt_type: "Nota de Crédito A", taxable: "-1.234,56", vat: "(259,26)",
        vat_rate_21: "-259,26", total: "-1.493,82" },
      { ...commonVoucher, receipt_type: "Nota de Crédito A", receipt_number: "1002" },
      { ...commonVoucher, receipt_number: "1003", total: "1493,81", vat_rate_21: "259,25" },
    ]);
    expect(preview.vouchers.map(({ total }) => total)).toEqual(["-1493.82"]);
    expect(preview.issues.map(({ row, field }) => [row, field])).toEqual([[3, "total"], [4, "total"], [4, "vat"]]);
  });

  test("valida signos de notas por códigos ARCA y detecta códigos con una descripción incompatible", async () => {
    const negative = { ...commonVoucher, taxable: "-1.234,56", vat: "-259,26", vat_rate_21: "-259,26", total: "-1.493,82" };
    const preview = await previewCsv("sales", [
      { ...negative, receipt_type: "3" },
      { ...negative, receipt_type: "003" },
      { ...commonVoucher, receipt_type: "008", receipt_number: "1002" },
      { ...negative, receipt_type: "207", receipt_number: "1003" },
      { ...commonVoucher, receipt_type: "002 - Nota crédito", receipt_number: "1004" },
    ]);
    expect(preview.vouchers.map(({ receipt_type }) => receipt_type)).toEqual(["003"]);
    expect(preview.duplicates).toBe(1);
    expect(preview.issues).toContainEqual(expect.objectContaining({ row: 4, message: expect.stringContaining("signo negativo") }));
    expect(preview.issues).toContainEqual(expect.objectContaining({ row: 5, message: expect.stringContaining("signo positivo") }));
    expect(preview.issues).toContainEqual(expect.objectContaining({ row: 6, field: "receipt_type" }));
  });

  test("pide formato explícito cuando un separador podría indicar miles o decimales", async () => {
    const record = { ...commonVoucher, taxable: "1.234", vat: "0", vat_rate_21: "", total: "1.234" };
    const table = await readSource(new TextEncoder().encode(csvContent("sales", [record])).buffer, "ventas.csv");
    const mapping = suggestMapping("sales", table.headers);
    expect(previewImport("sales", table, mapping).issues).toHaveLength(2);
    const explicit = previewImport("sales", table, mapping, { decimal: "comma" });
    expect(explicit.issues).toEqual([]);
    expect(explicit.vouchers[0].total).toBe("1234.00");
  });
});

describe("importación de cuentas", () => {
  test("preserva códigos textuales y valida jerarquías cíclicas", async () => {
    const normal = await previewCsv("accounts", [account, { ...account, code: "01.002", parent_code: "01" }]);
    expect(normal.issues).toEqual([]);
    expect(normal.accounts[1]).toEqual(expect.objectContaining({ kind: "asset", parent_code: "01" }));
    const cyclic = await previewCsv("accounts", [
      { ...account, parent_code: "02" }, { ...account, code: "02", parent_code: "01" },
    ]);
    expect(cyclic.issues).toContainEqual(expect.objectContaining({ field: "parent_code", severity: "error" }));
  });

  test("exige asignar columnas distintas a cada campo", async () => {
    const table = await readSource(new TextEncoder().encode("Código;Código;Nombre;Tipo;Estado\n01;02;Caja;Activo;Activa").buffer, "cuentas.csv");
    const suggested = suggestMapping("accounts", table.headers);
    expect(suggested.code).toBeUndefined();
    const duplicateMapping = previewImport("accounts", table, { ...suggested, code: suggested.name });
    expect(duplicateMapping.issues).toContainEqual(expect.objectContaining({ row: 0, field: "name", severity: "error" }));
    const corrected = previewImport("accounts", table, { ...suggested, code: 1 });
    expect(corrected.accounts[0].code).toBe("02");
  });
});

describe("lectura de archivos", () => {
  test("conserva líneas reales en CSV con campos entrecomillados multilínea", async () => {
    const source = 'sep=;\r\nCódigo;Nombre;Tipo;Estado\r\n01;"Caja\r\nprincipal";Activo;Activa\r\n\r\n02;Banco;Activo;Activa';
    const table = await readSource(new TextEncoder().encode(source).buffer, "cuentas.csv");
    expect(table.rows.map(({ row }) => row)).toEqual([3, 6]);
    expect(table.rows[0].cells[1]).toBe("Caja\nprincipal");
  });

  test("identifica la línea con comillas sin cerrar", async () => {
    const source = new TextEncoder().encode('Código;Nombre;Tipo;Estado\n01;"Caja;Activo;Activa');
    await expect(readSource(source.buffer, "cuentas.csv")).rejects.toThrow("línea 2");
  });

  test.each([["xlsx", "xlsx"], ["biff8", "xls"]] as const)("lee %s y conserva el formato de ceros", async (bookType, extension) => {
    const sheet = utils.aoa_to_sheet([["Código", "Nombre", "Tipo", "Estado"], [1, "Caja", "Activo", "Activa"]]);
    sheet.A2.z = "0000";
    const table = await readSource(workbookBytes(sheet, bookType), `libro.${extension}`);
    const preview = previewImport("accounts", table, suggestMapping("accounts", table.headers));
    expect(preview.issues).toEqual([]);
    expect(preview.accounts[0].code).toBe("0001");
  });

  test("lee fechas Excel y aplica formato decimal solo a valores de texto", async () => {
    const keys = fieldsFor("purchases").map(({ key }) => key);
    const row = { ...commonVoucher, date: 46_330, taxable: 1234.56, vat: 259.26, vat_rate_21: 259.26, total: 1493.82 };
    const sheet = utils.aoa_to_sheet([keys, keys.map((key) => row[key as keyof typeof row] ?? "")]);
    sheet.A2.z = "yyyy-mm-dd";
    const table = await readSource(workbookBytes(sheet, "xlsx"), "libro.xlsx");
    const preview = previewImport("purchases", table, suggestMapping("purchases", table.headers), { decimal: "comma" });
    expect(preview.issues).toEqual([]);
    expect(preview.vouchers[0]).toEqual(expect.objectContaining({ date: "2026-11-04", total: "1493.82" }));
  });

  test("rechaza fórmulas en columnas elegidas y libros con múltiples hojas", async () => {
    const sheet = utils.aoa_to_sheet([["Código", "Nombre", "Tipo", "Estado"], [1, "Caja", "Activo", "Activa"]]);
    sheet.A2.f = "1+0";
    const table = await readSource(workbookBytes(sheet, "xlsx"), "libro.xlsx");
    const preview = previewImport("accounts", table, suggestMapping("accounts", table.headers));
    expect(preview.issues).toContainEqual(expect.objectContaining({ row: 2, field: "code", severity: "error" }));
    await expect(readSource(workbookBytes(sheet, "xlsx", true), "libro.xlsx")).rejects.toThrow("una sola hoja");
  });

  test("rechaza un archivo Excel cuyos tamaños comprimidos declarados no coinciden", async () => {
    const sheet = utils.aoa_to_sheet([["Código", "Nombre"], ["01", "Caja"]]);
    const bytes = workbookBytes(sheet, "xlsx");
    const view = new DataView(bytes);
    const directory = view.getUint32(bytes.byteLength - 22 + 16, true);
    const local = view.getUint32(directory + 42, true);
    const fakeSize = view.getUint32(directory + 24, true) + 1;
    view.setUint32(directory + 24, fakeSize, true);
    view.setUint32(local + 22, fakeSize, true);
    await expect(readSource(bytes, "libro.xlsx")).rejects.toThrow("partes incompatibles");
  });
});
