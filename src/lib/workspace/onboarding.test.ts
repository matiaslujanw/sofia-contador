import { describe, expect, it } from "vitest";
import { createDemoWorkspace } from "./demo";
import { emptyWorkspace } from "./model";
import { getOnboarding, sectionGuide } from "./onboarding";
import { sections } from "./routes";

const selection = { month: "2026-11" };
const fixture = createDemoWorkspace(selection.month);
const organization = fixture.organizations[0];
const company = fixture.companies[0];
const period = fixture.periods.find((entry) => entry.company_id === company.id && entry.status === "open")!;
const newStudio = { ...emptyWorkspace, organization };
const withCompany = { ...newStudio, companies: [company] };
const withPeriod = { ...withCompany, periods: [period] };
const voucher = { ...fixture.vouchers[0], review_status: "pending" as const };

const next = (state: typeof emptyWorkspace) => getOnboarding(state, selection).find((step) => !step.done);

describe("primeros pasos de Sofía", () => {
  it("avanza con el estudio, la empresa, el período, la importación y la aprobación", () => {
    expect(next(emptyWorkspace)?.id).toBe("studio");
    expect(next(newStudio)?.id).toBe("company");
    expect(next(withCompany)).toMatchObject({ id: "period", destination: { section: "cierre", companyId: company.id } });
    expect(next(withPeriod)).toMatchObject({ id: "import", destination: { section: "documentacion", companyId: company.id, month: selection.month } });
    expect(next({ ...withPeriod, vouchers: [voucher] })).toMatchObject({ id: "review", destination: { section: "comprobantes", companyId: company.id, month: selection.month } });
    expect(next({ ...withPeriod, vouchers: [{ ...voucher, review_status: "approved" }] })).toBeUndefined();
  });

  it("guía a un cierre cuando el mes está cerrado", () => {
    const closed = { ...withCompany, periods: [{ ...period, status: "closed" as const }] };
    expect(next(closed)).toMatchObject({ id: "import", destination: { section: "cierre", companyId: company.id } });
    expect(next(closed)?.instruction).toContain("cerrado");
    expect(next({ ...closed, vouchers: [voucher] })).toMatchObject({ id: "review", destination: { section: "cierre", companyId: company.id } });
  });

  it("mantiene las secciones explicadas para una persona de solo consulta", () => {
    expect(getOnboarding({ ...withPeriod, organization: { ...organization, role: "viewer" } }, selection)).toEqual([]);
    expect(Object.keys(sectionGuide).sort()).toEqual(Object.keys(sections).sort());
  });
});
