// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { MonthScreen } from "@/src/modules/monthly-plans/ui/month-screen";
import { createDemoClient } from "@/src/modules/monthly-plans/ui/demo-client";
import type { PlanningClient } from "@/src/modules/monthly-plans/ui/client";

async function setup(client: PlanningClient = createDemoClient()) {
  const user = userEvent.setup();
  render(<MonthScreen client={client} initialMonth="2026-09" />);
  await screen.findByRole("heading", { name: "Пока нет приоритетов" });
  return { user, client };
}
async function addTime(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Добавить приоритет" }));
  await user.type(screen.getByLabelText("Название"), "Английский");
  await user.type(screen.getByLabelText("Часы"), "12");
  await user.click(screen.getByRole("button", { name: "Добавить" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
}

it("creates and edits a plan and keeps monthly targets independent", async () => {
  const { user } = await setup();
  await addTime(user);
  expect(screen.getByRole("button", { name: "Изменить план: Английский" })).toHaveTextContent("12 ч");
  await user.click(screen.getByRole("button", { name: "Изменить план: Английский" }));
  await user.clear(screen.getByLabelText("Часы"));
  await user.type(screen.getByLabelText("Часы"), "8");
  await user.click(screen.getByRole("button", { name: "Сохранить" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Изменить план: Английский" })).toHaveTextContent("8 ч");
  await user.click(screen.getByRole("button", { name: "Следующий месяц" }));
  await screen.findByRole("heading", { name: "Пока нет приоритетов" });
  await user.click(screen.getByRole("button", { name: "Добавить приоритет" }));
  await user.selectOptions(screen.getByLabelText("Приоритет"), screen.getByRole("option", { name: "Английский" }));
  await user.type(screen.getByLabelText("Часы"), "10");
  await user.click(screen.getByRole("button", { name: "Добавить" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Изменить план: Английский" })).toHaveTextContent("10 ч");
  await user.click(screen.getByRole("button", { name: "Предыдущий месяц" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Изменить план: Английский" })).toHaveTextContent("8 ч"));
});

it("rejects fractional quantity without discarding the form", async () => {
  const { user, client } = await setup();
  await user.click(screen.getByRole("button", { name: "Добавить приоритет" }));
  await user.type(screen.getByLabelText("Название"), "Тренировки");
  await user.selectOptions(screen.getByLabelText("Метрика"), "quantity");
  await user.type(screen.getByLabelText("Единица"), "занятий");
  await user.type(screen.getByLabelText("Количество, занятий"), "1,5");
  await user.click(screen.getByRole("button", { name: "Добавить" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Введите целое число");
  expect(screen.getByLabelText("Название")).toHaveValue("Тренировки");
  expect((await client.load("2026-09")).plans).toHaveLength(0);
});

it("accepts decimal volume and shows its unit", async () => {
  const { user } = await setup();
  await user.click(screen.getByRole("button", { name: "Добавить приоритет" }));
  await user.type(screen.getByLabelText("Название"), "Бег");
  await user.selectOptions(screen.getByLabelText("Метрика"), "volume");
  await user.type(screen.getByLabelText("Единица"), "км");
  await user.type(screen.getByLabelText("Объём, км"), "12,5");
  await user.click(screen.getByRole("button", { name: "Добавить" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Изменить план: Бег" })).toHaveTextContent("12,5 км");
});

it("retries an uncertain response with the same key and preserves input", async () => {
  const base = createDemoClient();
  let first = true;
  const execute = vi.fn(async (...args: Parameters<PlanningClient["execute"]>) => {
    const result = await base.execute(...args);
    if (first) { first = false; throw new Error("Connection lost after commit"); }
    return result;
  });
  const { user } = await setup({ load: base.load, execute });
  await user.click(screen.getByRole("button", { name: "Добавить приоритет" }));
  await user.type(screen.getByLabelText("Название"), "Английский");
  await user.type(screen.getByLabelText("Часы"), "12");
  await user.click(screen.getByRole("button", { name: "Добавить" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось сохранить");
  expect(screen.getByLabelText("Часы")).toHaveValue("12");
  await user.click(screen.getByRole("button", { name: "Добавить" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(execute.mock.calls[0][0]).toBe(execute.mock.calls[1][0]);
  expect((await base.load("2026-09")).plans).toHaveLength(1);
});

it("refreshes conflicting versions without clearing unsaved fields", async () => {
  const { user, client } = await setup();
  await addTime(user);
  const original = (await client.load("2026-09")).plans[0];
  await user.click(screen.getByRole("button", { name: "Изменить план: Английский" }));
  await user.clear(screen.getByLabelText("Часы"));
  await user.type(screen.getByLabelText("Часы"), "15");
  await client.execute(crypto.randomUUID(), { action: "target", planId: original.id, expectedVersion: 1, target: { kind: "time", minutes: 60 } });
  await user.click(screen.getByRole("button", { name: "Сохранить" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("План изменился");
  await user.click(screen.getByRole("button", { name: "Обновить данные" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Сохранить" })).toBeEnabled());
  expect(screen.getByLabelText("Часы")).toHaveValue("15");
  await user.click(screen.getByRole("button", { name: "Сохранить" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect((await client.load("2026-09")).plans[0].target).toEqual({ kind: "time", minutes: 900 });
});

it("restores archived priorities without removing their monthly plan", async () => {
  const client = createDemoClient();
  const created = await client.execute(crypto.randomUUID(), { action: "create", month: "2026-09", priority: { name: "Чтение", metric: { kind: "quantity", unit: "страниц" } }, target: { kind: "quantity", amount: 300 } });
  await client.execute(crypto.randomUUID(), { action: "archive", priorityId: created.priority!.id, expectedVersion: 1, archived: true });
  const user = userEvent.setup();
  render(<MonthScreen client={client} initialMonth="2026-09" />);
  await screen.findByRole("button", { name: "Изменить план: Чтение" });
  await user.click(screen.getByRole("button", { name: "Архив" }));
  await user.click(screen.getByRole("button", { name: "Восстановить" }));
  await screen.findByRole("heading", { name: "Архив пуст" });
  await user.click(screen.getByRole("button", { name: "Месяц" }));
  expect(within(screen.getByRole("region", { name: "План месяца" })).getByText("Чтение")).toBeInTheDocument();
  expect((await client.load("2026-09")).priorities[0].archived).toBe(false);
});

it("renames, archives and removes a plan through the row menu", async () => {
  const { user, client } = await setup();
  await addTime(user);
  async function menu(name: string) {
    screen.getByRole("button", { name: `Действия: ${name}` }).focus();
    await user.keyboard("{Enter}");
  }
  await menu("Английский");
  await user.click(await screen.findByRole("menuitem", { name: "Переименовать" }));
  await user.clear(await screen.findByLabelText("Название"));
  await user.type(screen.getByLabelText("Название"), "Разговорный английский");
  await user.click(screen.getByRole("button", { name: "Сохранить" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await menu("Разговорный английский");
  await user.click(await screen.findByRole("menuitem", { name: "В архив" }));
  await user.click(await screen.findByRole("button", { name: "В архив" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect((await client.load("2026-09")).priorities[0].archived).toBe(true);
  await menu("Разговорный английский");
  await user.click(await screen.findByRole("menuitem", { name: "Убрать из месяца" }));
  await user.click(await screen.findByRole("button", { name: "Убрать" }));
  await screen.findByRole("heading", { name: "Пока нет приоритетов" });
  expect((await client.load("2026-09")).plans).toHaveLength(0);
  expect((await client.load("2026-09")).priorities).toHaveLength(1);
});
