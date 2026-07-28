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
  await expect(day).toHaveClass(/editing/);
  await page
    .locator(".modal-header")
    .getByRole("button", { name: "Закрыть" })
    .click();
  await expect(day).not.toBeFocused();
  await expect(day).not.toHaveClass(/editing|selected/);

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

test("schedule can navigate through history and jump to a month", async ({
  page,
}) => {
  await page.goto("/schedule");
  const title = page.locator(".schedule-period-title strong");
  const initialTitle = await title.textContent();

  await page.getByRole("button", { name: "Предыдущий период" }).click();
  await expect(title).not.toHaveText(initialTitle ?? "");
  await expect(page).toHaveURL(/date=/);

  await page.getByLabel("Месяц графика").selectOption("0");
  await expect(page.getByLabel("Месяц графика")).toHaveValue("0");
  await page
    .getByRole("main")
    .getByRole("button", { name: "Сегодня", exact: true })
    .click();
  await expect(page.getByLabel("Месяц графика")).toHaveValue(
    String(new Date().getMonth()),
  );
});

test("custom color picker validates HEX without using a native picker", async ({
  page,
}) => {
  await page.goto("/schedule");
  await page.getByRole("button", { name: "Типы деятельности" }).click();
  await page.getByRole("button", { name: "Создать тип" }).first().click();
  await page.getByLabel("Название").fill("Работа");
  await expect(page.locator('input[type="color"]')).toHaveCount(0);

  await page.getByRole("button", { name: /#4F7BD8/i }).click();
  const hex = page.getByLabel("HEX");
  await hex.fill("xyz");
  await expect(hex).toHaveAttribute("aria-invalid", "true");
  await expect(
    page
      .getByRole("dialog", { name: "Выбор цвета" })
      .getByRole("button", { name: "Выбрать", exact: true }),
  ).toBeDisabled();
  await hex.fill("#336699");
  await page
    .getByRole("dialog", { name: "Выбор цвета" })
    .getByRole("button", { name: "Выбрать", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Новый тип деятельности" })
    .getByRole("button", { name: "Сохранить" })
    .click();
  await expect(page.getByText("Работа", { exact: true })).toBeVisible();
});

test("directions page does not overflow at narrow mobile widths", async ({
  page,
}) => {
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 780 });
    await page.goto("/directions");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    const offenders = overflow > 1
      ? await page.locator("body *").evaluateAll((items) =>
          items
            .map((item) => {
              const rect = item.getBoundingClientRect();
              return {
                className: item.className,
                right: Math.round(rect.right),
                width: Math.round(rect.width),
              };
            })
            .filter((item) => item.right > window.innerWidth + 1)
            .slice(0, 8),
        )
      : [];
    expect(
      overflow,
      `${width}px viewport has horizontal overflow: ${JSON.stringify(offenders)}`,
    )
      .toBeLessThanOrEqual(1);
  }
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
