import { expect, test } from "@playwright/test";
import { shiftMonth, todayIn } from "../../src/lib/workspace/format";

const demoCompany = "10000000-0000-4000-8000-000000000010";

test("crea una empresa, guarda un checklist y registra cierre y reapertura", async ({ page }) => {
  await page.goto("/inicio");
  await expect(page.getByRole("heading", { name: "Empresas", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Nueva empresa" }).click();
  const newCompany = page.getByRole("dialog", { name: "Nueva empresa" });
  await newCompany.getByLabel("Razón social").fill("Sur Ejemplo S.A.S.");
  await newCompany.getByLabel("CUIT").fill("30-71999004-1");
  await newCompany.getByRole("button", { name: "Crear empresa" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Sur Ejemplo S.A.S." })).toBeVisible();
  await page.getByRole("row").filter({ hasText: "Sur Ejemplo S.A.S." }).getByRole("link", { name: "Abrir" }).click();
  await page.getByRole("link", { name: "Abrir cierre" }).click();
  await page.getByRole("button", { name: "Iniciar período" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Recepción de comprobantes emitidos" })).toBeVisible();
  await page.getByRole("button", { name: "Nueva tarea" }).click();
  const task = page.getByRole("dialog", { name: "Nueva tarea" });
  await task.getByLabel("Nombre de la tarea").fill("Verificar respaldo de prueba");
  await task.getByRole("combobox", { name: "Estado", exact: true }).selectOption("completed");
  await task.getByLabel("Observaciones").fill("Confirmación de prueba");
  await task.getByRole("button", { name: "Guardar cambios" }).click();
  await page.reload();
  await expect(page.getByRole("row").filter({ hasText: "Verificar respaldo de prueba" })).toContainText("Completado");
  await page.getByRole("button", { name: "Cerrar período" }).click();
  const closing = page.getByRole("dialog", { name: "Cerrar período" });
  await closing.getByLabel("Motivo (obligatorio)").fill("Cierre de prueba con pendientes.");
  await closing.getByRole("button", { name: "Confirmar cierre" }).click();
  await expect(page.getByText("Período cerrado", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Nueva tarea" })).toHaveCount(0);
  await page.getByRole("button", { name: "Reabrir período" }).click();
  const reopen = page.getByRole("dialog", { name: "Reabrir período" });
  await reopen.getByLabel("Motivo (obligatorio)").fill("Revisión de documentación.");
  await reopen.getByRole("button", { name: "Confirmar reapertura" }).click();
  await expect(page.getByText("Período abierto", { exact: true })).toBeVisible();

  const next = shiftMonth(todayIn().slice(0, 7), 1);
  await page.getByRole("combobox", { name: "Período", exact: true }).selectOption(next);
  await page.getByRole("button", { name: "Iniciar período" }).click();
  const inherited = page.getByRole("row").filter({ hasText: "Verificar respaldo de prueba" });
  await expect(inherited).toContainText("Pendiente");
  await expect(inherited).not.toContainText("Confirmación de prueba");
});

test("enlaza un respaldo y conserva la descarga después de recargar", async ({ page }) => {
  await page.goto(`/documentacion?empresa=${demoCompany}`);
  await page.getByRole("button", { name: "Subir documento" }).click();
  const upload = page.getByRole("dialog", { name: "Subir documento" });
  await upload.locator("input[type=file]").setInputFiles({
    name: "respaldo-sintetico.csv", mimeType: "text/csv", buffer: Buffer.from("documento;estado\r\nprueba;correcto\r\n"),
  });
  await upload.getByRole("button", { name: "Subir documento" }).click();
  await expect(page.getByText("respaldo-sintetico.csv", { exact: true })).toBeVisible();
  await page.reload();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar respaldo-sintetico.csv" }).click();
  expect((await downloaded).suggestedFilename()).toBe("respaldo-sintetico.csv");

  await page.getByRole("link", { name: "Cierre mensual", exact: true }).click();
  await page.getByRole("button", { name: "Editar tarea Recepción de extractos bancarios" }).click();
  const task = page.getByRole("dialog", { name: "Recepción de extractos bancarios" });
  await task.getByLabel("Documento vinculado").selectOption({ label: "respaldo-sintetico.csv" });
  await task.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Recepción de extractos bancarios" })).toContainText("respaldo-sintetico.csv");
});

test("mantiene la navegación operable en tablet y móvil", async ({ page }) => {
  for (const viewport of [{ width: 820, height: 1180 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/inicio");
    await expect(page.getByRole("heading", { name: "Empresas", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Abrir menú" })).toBeVisible();
    await page.getByRole("button", { name: "Abrir menú" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Empresas", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Empresas", exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  }
});

test("guarda una imputación aprobada y permite reutilizarla en otro comprobante", async ({ page }) => {
  await page.goto(`/comprobantes?empresa=${demoCompany}`);
  const equipment = page.getByRole("row").filter({ hasText: "Equipamientos Norte" });
  await equipment.getByRole("button", { name: "Revisar" }).click();
  let review = page.getByRole("dialog", { name: "Revisar comprobante" });
  await review.getByRole("textbox", { name: "Concepto" }).fill("Compra de equipamiento");
  await review.getByRole("checkbox", { name: /guardar la imputación aprobada/i }).check();
  await review.getByRole("button", { name: "Guardar revisión" }).click();
  await expect(page.getByText("Revisión guardada.", { exact: true })).toBeVisible();

  const month = todayIn().slice(0, 7);
  await page.goto(`/documentacion?empresa=${demoCompany}&mes=${month}&tipo=compras`);
  const importPanel = page.getByRole("region", { name: "Importar datos" });
  await importPanel.locator("input[type=file]").setInputFiles({
    name: "repeticion-proveedor.csv", mimeType: "text/csv",
    buffer: Buffer.from([
      "date;receipt_type;point_of_sale;receipt_number;counterparty_cuit;counterparty_name;currency;exchange_rate;taxable;untaxed;exempt;vat;other_taxes;total",
      `${month}-08;Factura A;1;930;30719990041;Equipamientos Norte;ARS;1;100;0;0;21;0;121`,
    ].join("\r\n")),
  });
  await importPanel.getByRole("checkbox", { name: "Verifiqué la asignación y los datos del archivo" }).check();
  await importPanel.getByRole("button", { name: "Confirmar importación" }).click();
  await expect(importPanel.getByText("Se guardó 1 fila. Se omitieron 0 duplicados.")).toBeVisible();
  await page.goto(`/comprobantes?empresa=${demoCompany}&mes=${month}`);
  const fresh = page.getByRole("row").filter({ hasText: "00000930" });
  await fresh.getByRole("button", { name: "Revisar" }).click();
  review = page.getByRole("dialog", { name: "Revisar comprobante" });
  await review.getByRole("button", { name: "Aplicar sugerencia" }).click();
  await expect(review.getByRole("textbox", { name: "Concepto" })).toHaveValue("Compra de equipamiento");
  await expect(review.getByRole("combobox", { name: "Cuenta contable" })).toHaveValue("10000000-0000-4000-8000-000000000300");
  await review.getByRole("button", { name: "Guardar revisión" }).click();
  await expect(fresh).toContainText("Pendiente");
});
