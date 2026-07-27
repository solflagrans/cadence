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

test("settings sections use the full width and omit planning options", async ({
  page,
}) => {
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "Настройки", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Планирование" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Региональные настройки" }),
  ).toHaveCount(0);

  const widths = await page.locator(".settings-section").evaluateAll((items) =>
    items.map((item) => item.getBoundingClientRect().width),
  );

  expect(widths.length).toBeGreaterThan(1);
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
});

test("primary pages render without runtime errors or horizontal overflow", async ({
  page,
}) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  const routes = [
    ["/", "Обзор"],
    ["/today", "Сегодня"],
    ["/plans", "Планы"],
    ["/schedule", "График"],
    ["/directions", "Направления"],
    ["/settings", "Настройки"],
  ] as const;

  for (const [path, heading] of routes) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `${path} has horizontal overflow`).toBeLessThanOrEqual(1);
  }

  expect(runtimeErrors).toEqual([]);
});

test("schedule interactions and activity types panel stay visually stable", async ({
  page,
}) => {
  await page.goto("/schedule");
  const day = page.locator(".calendar-day").first();
  await day.click();
  await page
    .locator(".modal-header")
    .getByRole("button", { name: "Закрыть" })
    .click();
  await expect(day).not.toBeFocused();

  await page.getByRole("button", { name: "Типы деятельности" }).click();
  await expect(
    page.getByRole("heading", { name: "Типы деятельности", exact: true }),
  ).toBeVisible();

  const emptyAction = page
    .locator(".type-list .empty-state")
    .getByRole("button", { name: "Создать тип" });
  const [panelBox, actionBox] = await Promise.all([
    page.locator(".type-list").boundingBox(),
    emptyAction.boundingBox(),
  ]);
  expect(panelBox).not.toBeNull();
  expect(actionBox).not.toBeNull();
  const panelCenter = panelBox!.x + panelBox!.width / 2;
  const actionCenter = actionBox!.x + actionBox!.width / 2;
  expect(Math.abs(panelCenter - actionCenter)).toBeLessThanOrEqual(2);
});

test("current week is highlighted in the month and desktop sections have no icons", async ({
  page,
}) => {
  const today = new Date();
  const monthId = `${today.getFullYear()}-${String(
    today.getMonth() + 1,
  ).padStart(2, "0")}`;
  await page.goto(`/plans/${monthId}`);
  await expect(page.locator(".week-tabs .current-week")).toHaveCount(1);
  await expect(page.locator(".sidebar-nav svg")).toHaveCount(0);
});
