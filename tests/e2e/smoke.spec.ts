import { expect, test, type Page } from "@playwright/test";
import type { PlannerData } from "@/src/domain/planner/model/types";

const emptyState = (): PlannerData => ({
  version: 2,
  activityTypes: [],
  directions: [],
  days: [],
  months: [],
  weeks: [],
  completions: [],
  extraResults: [],
  reviews: [],
  settings: {
    timezone: "Europe/Moscow",
    weekStartsOn: "monday",
    timeFormat: "24",
    language: "ru",
    scheduleRange: 14,
    weekReminder: true,
    monthReminder: true,
    theme: "light",
  },
});

const installState = async (page: Page, state: PlannerData) => {
  await page.addInitScript((data) => {
    localStorage.setItem("cadence-planner-v2:guest", JSON.stringify(data));
  }, state);
};

const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

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

test("archived directions are separated and used metrics are locked", async ({
  page,
}) => {
  const state = emptyState();
  state.directions = [{
    id: "active",
    name: "Активное направление",
    metric: "count",
    unit: "раз",
    valueFormat: "integer",
    decimalPlaces: 0,
    color: "#336699",
    availability: "active",
    metricHistory: [],
  }, {
    id: "archived",
    name: "Архивное направление",
    metric: "duration",
    unit: "ч.",
    valueFormat: "decimal",
    decimalPlaces: 2,
    color: "#663399",
    availability: "archived",
    metricHistory: [],
  }];
  state.months = [{
    id: "2026-07",
    month: "2026-07",
    items: [{
      id: "used",
      directionId: "active",
      originalTarget: 10,
      target: 10,
      metric: "count",
      unit: "раз",
      history: [],
    }],
  }];
  await installState(page, state);
  await page.goto("/directions");

  await expect(page.getByText("Активное направление", { exact: true }))
    .toBeVisible();
  await expect(page.getByText("Архивное направление", { exact: true }))
    .toHaveCount(0);
  await page.getByRole("tab", { name: "Архив" }).click();
  await expect(page.getByText("Архивное направление", { exact: true }))
    .toBeVisible();
  await expect(page.getByRole("button", { name: "Восстановить" }))
    .toBeVisible();

  await page.getByRole("tab", { name: "Активные" }).click();
  await page.getByRole("button", { name: "Изменить" }).click();
  await expect(page.getByLabel("Метрика")).toBeDisabled();
  await expect(page.getByText(/Метрику нельзя изменить/)).toBeVisible();
});

test("schedule truncates long activity names and shows hidden count", async ({
  page,
}) => {
  const state = emptyState();
  state.activityTypes = Array.from({ length: 5 }, (_, index) => ({
    id: `activity-${index}`,
    name: `Очень длинное название типа деятельности номер ${index + 1}`,
    color: ["#335544", "#446688", "#775588", "#996644", "#667744"][index],
    icon: "circle",
    order: index,
    archived: false,
  }));
  state.days = [{
    date: localDate(),
    breaks: [],
    segments: state.activityTypes.map((activity) => ({
      activityId: activity.id,
      percent: 20,
    })),
  }];
  await installState(page, state);
  await page.goto("/schedule");

  const today = page.locator(".calendar-day.today");
  await expect(today.locator(".calendar-hidden-count")).toHaveText("+3");
  await expect(today.locator(".calendar-activity-name")).toHaveCount(2);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("work period can be removed without deleting the day composition", async ({
  page,
}) => {
  const state = emptyState();
  state.activityTypes = [{
    id: "work",
    name: "Работа",
    color: "#335544",
    icon: "circle",
    order: 0,
    archived: false,
  }];
  state.days = [{
    date: localDate(),
    segments: [{ activityId: "work", percent: 100 }],
    workStart: "09:00",
    workEnd: "18:00",
    breaks: [],
  }];
  await installState(page, state);
  await page.goto("/today");
  await page.getByRole("button", { name: "Изменить", exact: true }).click();
  await page.getByRole("button", { name: "Убрать рабочий период" }).click();
  await expect(page.getByText("09:00", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Работа", { exact: true })).toBeVisible();
});

test("mobile week page shows only the nearest breadcrumb parent", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto("/weeks/2026-07-27");
  const visibleCrumbs = page.locator(".page-breadcrumbs span:visible");
  await expect(visibleCrumbs).toHaveCount(1);
  await expect(visibleCrumbs).toContainText("Июль 2026");
  await expect(
    page.getByRole("heading", { name: /27 июля.*2 августа/i }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
});

test("paused zero plan is displayed as fully completed actual plan", async ({
  page,
}) => {
  const state = emptyState();
  state.directions = [{
    id: "paused",
    name: "Приостановленное направление",
    metric: "count",
    unit: "раз",
    valueFormat: "integer",
    decimalPlaces: 0,
    color: "#335544",
    availability: "active",
    metricHistory: [],
  }];
  state.weeks = [{
    id: "2026-07-27",
    start: "2026-07-27",
    monthId: "2026-07",
    items: [{
      id: "paused-item",
      directionId: "paused",
      originalTarget: 3,
      target: 0,
      metric: "count",
      unit: "раз",
      paused: {
        reason: "Болезнь",
        date: "2026-07-29",
        excluded: 3,
      },
      history: [],
    }],
  }];
  await installState(page, state);
  await page.goto("/weeks/2026-07-27");
  await expect(page.locator(".plan-row .row-value")).toContainText(
    "из 0 раз · 100%",
  );
  await expect(page.getByText("Болезнь", { exact: true })).toBeVisible();
});
