import { expect, test } from "@playwright/test";

test("guarda las preferencias regionales de la organización en la demo", async ({ page }) => {
  await page.goto("/configuracion");
  await page.getByRole("button", { name: "Editar organización" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombre", { exact: true }).fill("Estudio de prueba del calendario");
  await dialog.getByLabel("Zona horaria").selectOption("America/Argentina/Cordoba");
  await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Configuración" })).toBeVisible();
  await expect(page.locator("dd").filter({ hasText: /^Estudio de prueba del calendario$/ })).toBeVisible();
  await expect(page.locator("dd").filter({ hasText: /^Córdoba$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Agregar integrante" })).toHaveCount(0);
});

test("registra un vencimiento manual y deja actividad de auditoría en el período", async ({ page }) => {
  await page.goto("/calendario?mes=2025-03");
  await page.getByRole("button", { name: "Nuevo vencimiento" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Vencimiento", { exact: true })).toHaveValue("");
  await dialog.getByLabel("Impuesto u obligación").fill("Obligación sintética de marzo");
  await dialog.getByLabel("Vencimiento", { exact: true }).fill("2025-04-17");
  await dialog.getByLabel("Importe").fill("1400,25");
  await dialog.getByRole("button", { name: "Crear vencimiento" }).click();
  const row = page.getByRole("row").filter({ hasText: "Obligación sintética de marzo" });
  await expect(row).toContainText("1.400,25");

  await row.getByRole("button", { name: "Editar" }).click();
  await dialog.getByLabel("Estado").selectOption("paid");
  await dialog.getByLabel("Fecha de pago").fill("2025-04-16");
  await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(row).toContainText("Pagado");

  await page.goto("/auditoria?mes=2025-03");
  await expect(page.getByRole("row").filter({ hasText: "Vencimiento · Alta" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Vencimiento · Actualización" })).toBeVisible();
});
