import { expect, test } from "@playwright/test";
import { shiftMonth, todayIn } from "../../src/lib/workspace/format";

const company = "10000000-0000-4000-8000-000000000010";

test("agrega controles TEM al checklist del período y exporta el detalle de IVA", async ({ page }) => {
  await page.goto(`/control?empresa=${company}`);
  await expect(page.getByRole("heading", { name: "Control mensual", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Agregar control: Liquidación de TEM", exact: true }).click();
  await expect(page.getByRole("button", { name: "Agregar control: Liquidación de TEM", exact: true })).toHaveCount(0);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar detalle IVA" }).click();
  expect((await download).suggestedFilename()).toMatch(/sofia-30719990017-.*-iva-detalle.csv/);
  await page.reload();
  await expect(page.getByRole("button", { name: "Agregar control: Liquidación de TEM", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Cierre mensual", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: "Liquidación de TEM" })).toContainText("Pendiente");
});

test("permite consulta móvil y evita modificaciones en períodos cerrados", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/control?empresa=${company}`);
  await expect(page.getByRole("heading", { name: "Papel de trabajo de IVA · ARS" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.goto(`/control?empresa=${company}&mes=${shiftMonth(todayIn().slice(0, 7), -1)}`);
  await expect(page.getByRole("heading", { name: "Papel de trabajo de IVA · ARS" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Agregar control:/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Exportar checklist" })).toBeEnabled();
  await page.goto(`/control?empresa=${company}&mes=2020-01`);
  await expect(page.getByRole("heading", { name: "Período sin iniciar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Exportar detalle IVA" })).toHaveCount(0);
});
