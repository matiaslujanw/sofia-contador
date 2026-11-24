import { execFile } from "node:child_process";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { expect, test, type Page } from "@playwright/test";

const run = promisify(execFile);
const demoCompanyId = "10000000-0000-4000-8000-000000000010";

async function completeTour(page: Page) {
  await page.getByRole("link", { name: "Empezar recorrido" }).click();
  const guide = page.getByRole("region", { name: "Recorrido guiado" });
  await expect(guide.getByText("Paso 1 de 4")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Empresa", exact: true })).toHaveValue(demoCompanyId);
  await guide.getByRole("link", { name: "Siguiente" }).click();

  await expect(guide.getByText("Paso 2 de 4")).toBeVisible();
  await guide.getByRole("link", { name: "Abrir tarea de ejemplo" }).click();
  const task = page.getByRole("dialog", { name: "Control de pagos fiscales" });
  await task.getByRole("combobox", { name: "Estado", exact: true }).selectOption("completed");
  await task.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(task).toHaveCount(0);
  await expect(page.getByRole("row").filter({ hasText: "Control de pagos fiscales" })).toContainText("Completado");
  await expect(page.getByRole("progressbar", { name: "Avance de cierre mensual" })).toHaveAttribute("aria-valuenow", "73");
  await guide.getByRole("link", { name: "Siguiente" }).click();

  await expect(guide.getByText("Paso 3 de 4")).toBeVisible();
  await guide.getByRole("link", { name: "Abrir comprobante de ejemplo" }).click();
  const voucher = page.getByRole("dialog", { name: "Revisar comprobante" });
  await expect(voucher.getByText("Equipamientos Norte", { exact: false })).toBeVisible();
  await voucher.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(voucher).toHaveCount(0);
  await guide.getByRole("link", { name: "Siguiente" }).click();

  await expect(guide.getByText("Paso 4 de 4")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await guide.getByRole("link", { name: "Descargar CSV de muestra" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("sofia-compra-de-prueba.csv");
  const panel = page.getByRole("region", { name: "Importar datos" });
  const stream = await download.createReadStream();
  const bytes: Uint8Array[] = [];
  for await (const chunk of stream) bytes.push(chunk);
  await panel.locator("input[type=file]").setInputFiles({
    name: download.suggestedFilename(), mimeType: "text/csv", buffer: Buffer.concat(bytes),
  });
  await expect(panel.getByText("Insumos de muestra", { exact: true })).toBeVisible();
  await panel.getByRole("checkbox", { name: "Verifiqué la asignación y los datos del archivo" }).check();
  await panel.getByRole("button", { name: "Confirmar importación" }).click();
  await expect(panel.getByText("Se guardó 1 fila. Se omitieron 0 duplicados.")).toBeVisible();
  await guide.getByRole("link", { name: "Finalizar recorrido" }).click();
  const finish = page.getByRole("dialog", { name: "Recorrido completado" });
  await finish.getByRole("link", { name: "Volver al resumen" }).click();
  await expect(page.getByRole("heading", { name: "Resumen del estudio" })).toBeVisible();
}

test("guía la edición del cierre, la revisión y una importación real en tablet", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("/inicio");
  await page.getByRole("link", { name: "Recorrido guiado" }).click();
  await expect(page.getByRole("dialog", { name: "Conocé Sofía" })).toBeVisible();
  await completeTour(page);
  await expect(page.getByRole("img", { name: "Avance general del cierre: 66%" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(820);
});

test("retoma el paso guardado después de salir y recargar", async ({ page }) => {
  await page.goto("/inicio?recorrido=0");
  await page.getByRole("link", { name: "Empezar recorrido" }).click();
  await page.getByRole("link", { name: "Siguiente" }).click();
  await page.getByRole("link", { name: "Salir del recorrido" }).click();
  await expect(page.getByRole("region", { name: "Recorrido guiado" })).toHaveCount(0);
  await page.reload();
  await page.getByRole("link", { name: "Retomar recorrido" }).click();
  await expect(page.getByText("Paso 2 de 4")).toBeVisible();
});

test("completa el recorrido en el archivo portable sin conexión", async ({ page, context }, testInfo) => {
  const builtFile = testInfo.outputPath("Sofia-demo.html");
  await run(process.execPath, ["portable/build.mjs", builtFile]);
  const external: string[] = [];
  page.on("request", (request) => {
    if (/^https?:/.test(request.url())) external.push(request.url());
  });
  await context.setOffline(true);
  await page.goto(pathToFileURL(builtFile).href);
  await expect(page.getByRole("dialog", { name: "Conocé Sofía" })).toBeVisible();
  await completeTour(page);
  expect(external).toEqual([]);
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Conocé Sofía" })).toBeVisible();
});
