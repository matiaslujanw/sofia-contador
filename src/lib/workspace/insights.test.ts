import { describe, expect, it } from "vitest";
import { createDemoWorkspace } from "./demo";
import { cents, money, taskProgress, todayIn } from "./format";
import { companyInsights } from "./insights";
import { validCuit } from "./validation";

describe("indicadores del espacio de trabajo", () => {
  const month = "2026-11";

  it("separa los bienes de uso de los costos y gastos, y presenta el IVA informado", () => {
    const state = createDemoWorkspace(month);
    const metrics = companyInsights(state, state.companies[0], month);
    expect(metrics.sales).toBe(0n);
    expect(metrics.purchases).toBe(61935000n);
    expect(metrics.classifiedExpenses).toBe(8645000n);
    expect(metrics.vatCreditReported).toBe(13006350n);
  });

  it("distingue ausencia de datos de cero y evita sumar otra moneda", () => {
    const state = createDemoWorkspace(month);
    expect(companyInsights(state, state.companies[1], month).sales).toBeNull();
    state.vouchers.push({ ...state.vouchers[0], direction: "sale", currency: "USD" });
    const metrics = companyInsights(state, state.companies[0], month);
    expect(metrics.sales).toBeNull();
    expect(metrics.series.at(-1)?.sales).toBeNull();
    expect(metrics.otherCurrencies).toBe(1);
  });

  it("mantiene importes exactos aun cuando superan la precisión de Number", () => {
    expect(cents("90071992547409.99")).toBe(9007199254740999n);
    expect(money("90071992547409.99")).toContain("90.071.992.547.409,99");
    expect(money("-0.01")).toMatch(/-.*0,01/);
  });

  it("excluye tareas no aplicables, usa la zona del estudio y valida CUIT", () => {
    const state = createDemoWorkspace(month);
    const tasks = state.tasks.filter((task) => task.period_id === state.periods[0].id);
    expect(taskProgress(tasks)).toEqual({ total: 15, complete: 10, pending: 5, percent: 67 });
    expect(todayIn("America/Argentina/Tucuman", new Date("2026-12-01T01:30:00Z"))).toBe("2026-11-30");
    expect(validCuit("30719990017")).toBe(true);
    expect(validCuit("30719990018")).toBe(false);
  });
});
