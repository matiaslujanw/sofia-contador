import { expect, test } from "@playwright/test";

test("ofrece el acceso a la demostración únicamente en el entorno local habilitado", async ({ page, request }) => {
  await page.goto("/ingresar");
  await expect(page.getByRole("heading", { name: "Ingresá a Sofía" })).toBeVisible();
  await page.getByRole("link", { name: "Abrir demostración" }).click();
  await expect(page).toHaveURL(/\/inicio(?:[?#]|$)/);

  const privateResponse = await request.get("/inicio", {
    headers: { Host: "sofia.example" },
    maxRedirects: 0,
  });
  if (privateResponse.status() === 307) {
    expect(privateResponse.headers().location).toBe("/ingresar");
  } else {
    expect(privateResponse.status()).toBe(200);
    expect(await privateResponse.text()).toMatch(/(?:NEXT_REDIRECT|__next-page-redirect)[^<]*\/ingresar/);
  }
});

test("requiere un enlace verificado y una sesión para cambiar la contraseña", async ({ page }) => {
  await page.goto("/auth/confirm?type=recovery&token_hash=ejemplo-sintetico-para-pruebas");
  await expect(page.getByRole("heading", { name: "Confirmá la recuperación" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar" })).toHaveCount(0);

  await page.goto("/restablecer-clave");
  await expect(page.getByText("La sesión de recuperación venció o todavía no fue confirmada.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Guardar contraseña" })).toHaveCount(0);
});
