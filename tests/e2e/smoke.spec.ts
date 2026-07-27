import { expect, test } from "@playwright/test";

test("opens Cadence and navigates to plans", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Обзор" })).toBeVisible();
  await page
    .getByRole("button", { name: /Планы$/ })
    .filter({ visible: true })
    .click();
  await expect(page.getByRole("heading", { name: "Планы" })).toBeVisible();
});
