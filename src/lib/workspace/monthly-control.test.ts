import { describe, expect, it } from "vitest";
import { createDemoWorkspace } from "./demo";
import { monthlyChecklistCsv, monthlyControl, vatDetailCsv, vatSummaryCsv, vatWorksheet, worksheetCsv } from "./monthly-control";

describe("control mensual y papel preliminar de IVA", () => {
  const month = "2026-11";

  it("aísla organización, empresa y período, conservando los estados del checklist", () => {
    const state = createDemoWorkspace(month);
    const company = state.companies[0];
    const control = monthlyControl(state, company, month);
    expect(control.steps).toHaveLength(9);
    expect(control.missingTitles).toContain("Liquidación de TEM");
    expect(control.steps[2].tasks[0].record?.status).toBe("not_applicable");
    state.vouchers.push({ ...state.vouchers[0], organization_id: "otro-estudio" });
    state.vouchers.push({ ...state.vouchers[0], company_id: state.companies[1].id });
    state.vouchers.push({ ...state.vouchers[0], period_id: state.periods[1].id });
    expect(monthlyControl(state, company, month).vouchers).toHaveLength(3);
    expect(monthlyControl(state, company, "2027-01").vouchers).toHaveLength(0);
    expect(monthlyChecklistCsv(company, month, control)).toContain('"Liquidación de TEM";"Sin agregar al checklist"');
  });

  it("no presume crédito computable, conserva cero explícito y respeta notas de crédito", () => {
    const state = createDemoWorkspace(month);
    const purchase = state.vouchers[0];
    const entries = [
      { ...purchase, deductible_vat: "100800.00" },
      { ...purchase, vat: "21.00", deductible_vat: "0.00" },
      { ...purchase, vat: "-210.00", deductible_vat: "-210.00" },
      { ...purchase, vat: "35.00", deductible_vat: null },
      { ...purchase, vat: "99.00", deductible_vat: "99.00", review_status: "pending" as const },
      { ...purchase, direction: "sale" as const, vat: "210000.00" },
      { ...purchase, direction: "sale" as const, vat: "-2100.00" },
      { ...purchase, currency: "USD", vat: "1000000.00" },
    ];
    const sheet = vatWorksheet(entries);
    expect(sheet.credit).toBe(10059000n);
    expect(sheet.debit).toBe(20790000n);
    expect(sheet.difference).toBe(10731000n);
    expect(sheet.missingCredit).toBe(1);
    expect(sheet.unreviewed).toBe(1);
    expect(sheet.foreignCurrency).toBe(1);
  });

  it("distingue meses sin datos y no pierde centavos grandes en los CSV", () => {
    expect(vatWorksheet([])).toMatchObject({ hasSales: false, hasPurchases: false });
    const state = createDemoWorkspace(month);
    const company = state.companies[0];
    const vouchers = [{ ...state.vouchers[0], deductible_vat: "90071992547409.99", vat: "90071992547409.99" }];
    expect(vatWorksheet(vouchers).credit).toBe(9007199254740999n);
    expect(vatSummaryCsv(company, month, vouchers)).toContain('"-90071992547409.99"');
    expect(vatDetailCsv(company, month, vouchers)).toContain('"90071992547409.99"');
    expect(vatDetailCsv(company, month, [{ ...vouchers[0], currency: "USD" }])).toContain("Moneda extranjera: convertir");
    expect(vatSummaryCsv(company, month, vouchers)).toContain("No es DDJJ ni importación Xubio");
  });

  it("escapa celdas, saltos de línea y fórmulas sin alterar importes negativos", () => {
    const csv = worksheetCsv([['=HYPERLINK("https://ejemplo.test")', '  +SUM(1)', '@formula', '-cmd', '-0.01', 'Una;"celda"\ncon salto']]);
    expect(csv).toContain(`"'=HYPERLINK(""https://ejemplo.test"")"`);
    expect(csv).toContain(`"'  +SUM(1)"`);
    expect(csv).toContain(`"'@formula"`);
    expect(csv).toContain(`"'-cmd"`);
    expect(csv).toContain('"-0.01"');
    expect(csv).toContain('"Una;""celda""\ncon salto"');
  });
});
