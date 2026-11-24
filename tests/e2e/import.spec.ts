import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { utils, write } from "xlsx";

const company = "10000000-0000-4000-8000-000000000010";

test("asigna columnas, verifica el signo de una nota de crédito y reconoce un reintento", async ({ page }) => {
  const parts = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Tucuman", year: "numeric", month: "2-digit",
  }).formatToParts(new Date());
  const month = `${parts.find(({ type }) => type === "year")!.value}-${parts.find(({ type }) => type === "month")!.value}`;
  const scope = `empresa=${company}&mes=${month}`;
  const documentRoute = `/documentacion?${scope}&tipo=compras`;
  const file = (negative = false) => ({
    name: "compras-sinteticas.csv",
    mimeType: "text/csv",
    buffer: Buffer.from([
      "date;receipt_type;point_of_sale;receipt_number;counterparty_cuit;counterparty_name;currency;exchange_rate;taxable;untaxed;exempt;vat;other_taxes;Total fuente",
      `${month}-05;3;3;917;30712345671;Importador Sintético SRL;ARS;1;${negative ? "-100;0;0;-21;0;-121" : "100;0;0;21;0;121"}`,
    ].join("\r\n")),
  });
  await page.goto(documentRoute);
  const panel = page.getByRole("region", { name: "Importar datos" });
  const upload = panel.locator("input[type=file]");
  const assignTotal = panel.getByLabel("Importe total");
  const verify = panel.getByRole("checkbox", { name: "Verifiqué la asignación y los datos del archivo" });
  const confirm = panel.getByRole("button", { name: "Confirmar importación" });
  await upload.setInputFiles(file());
  await expect(panel.getByText("Asigná una columna para Importe total.")).toBeVisible();
  await expect(confirm).toBeDisabled();

  await assignTotal.selectOption({ label: "14 · Total fuente" });
  await expect(panel.getByText(/una nota de crédito se expresan con signo negativo/)).toBeVisible();
  await expect(confirm).toBeDisabled();

  const csv = file(true);
  await upload.setInputFiles(csv);
  await assignTotal.selectOption({ label: "14 · Total fuente" });
  await expect(panel.getByText("Importador Sintético SRL")).toBeVisible();
  await expect(panel.getByText("ARS -121,00")).toBeVisible();
  await verify.check();
  await confirm.click();
  await expect(panel.getByText("Se guardó 1 fila. Se omitieron 0 duplicados.")).toBeVisible();

  await page.getByRole("button", { name: "Archivos", exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: `Descargar ${csv.name}` }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(csv.name);
  expect(await readFile(await download.path())).toEqual(csv.buffer);

  await page.goto(`/comprobantes?${scope}`);
  const saved = page.getByRole("row", { name: /003 0003-00000917 Importador Sintético SRL/ });
  await expect(saved.getByRole("cell", { name: /^-.*121,00 ARS$/ })).toBeVisible();

  await page.goto(documentRoute);
  await upload.setInputFiles(csv);
  await assignTotal.selectOption({ label: "14 · Total fuente" });
  await verify.check();
  await confirm.click();
  await expect(panel.getByText("Este archivo ya se había importado para este tipo y período.")).toBeVisible();
});

test("lee un XLSX comprimido y conserva códigos de cuenta con ceros", async ({ page }) => {
  const workbook = utils.book_new();
  const sheet = utils.aoa_to_sheet([["Código", "Nombre", "Rubro contable", "Estado"], ["009819", "Caja de prueba XLSX", "Activo", "Activa"]]);
  utils.book_append_sheet(workbook, sheet, "Cuentas");
  const xlsx = {
    name: "cuentas-sinteticas.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: write(workbook, { type: "buffer", bookType: "xlsx", compression: true }) as Buffer,
  };
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(`/documentacion?empresa=${company}&tipo=cuentas`);
  const panel = page.getByRole("region", { name: "Importar datos" });
  await expect(panel.getByLabel("Tipo de importación")).toHaveValue("accounts");
  await panel.locator("input[type=file]").setInputFiles(xlsx);
  await expect(panel.getByRole("cell", { name: "009819", exact: true })).toBeVisible();
  await expect(panel.getByRole("cell", { name: "Caja de prueba XLSX", exact: true })).toBeVisible();
  await panel.getByRole("checkbox", { name: "Verifiqué la asignación y los datos del archivo" }).check();
  await panel.getByRole("button", { name: "Confirmar importación" }).click();
  await expect(panel.getByText("Se guardó 1 fila. Se omitieron 0 duplicados.")).toBeVisible();
});
