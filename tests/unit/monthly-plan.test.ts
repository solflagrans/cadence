import { describe, expect, it } from "vitest";

import {
  archivePriority, createPriority, renamePriority, restorePriority,
} from "@/src/modules/priorities/domain/priority";
import {
  changeMonthlyTarget, createMonthlyPlan, monthSchema, quantitySchema, volumeSchema,
} from "@/src/modules/monthly-plans/domain/monthly-plan";

const priorityId = "11111111-1111-4111-8111-111111111111";
const planId = "22222222-2222-4222-8222-222222222222";
const timePriority = () => createPriority(priorityId, "user-1", {
  name: "Английский", metric: { kind: "time" },
});

describe("priority rules", () => {
  it("normalizes names and requires a unit only for quantity", () => {
    const priority = createPriority(priorityId, "user-1", {
      name: "  Чтение  ", metric: { kind: "quantity", unit: " страниц " },
    });
    expect(priority.name).toBe("Чтение");
    expect(priority.metric).toEqual({ kind: "quantity", unit: "страниц" });
    expect(() => createPriority(priorityId, "user-1", {
      name: "Чтение", metric: { kind: "quantity", unit: " " },
    })).toThrow();
    expect(() => createPriority(priorityId, "user-1", {
      name: "Чтение", metric: { kind: "time", unit: "страниц" },
    })).toThrow();
  });

  it("rejects blank names and ownership fields in user input", () => {
    expect(() => renamePriority(timePriority(), "  ")).toThrow();
    expect(() => createPriority(priorityId, "user-1", {
      name: "Английский", metric: { kind: "time" }, ownerId: "user-2",
    })).toThrow();
  });

  it("renames without changing metric or the original value", () => {
    const priority = timePriority();
    const renamed = renamePriority(priority, "  Разговорный английский  ");
    expect(renamed.name).toBe("Разговорный английский");
    expect(renamed.metric).toEqual(priority.metric);
    expect(priority.name).toBe("Английский");
  });
});

describe("monthly planning", () => {
  it.each([0, -1, 1.5, NaN, Infinity, 2_147_483_648, "12", "12.5"])(
    "rejects invalid discrete quantity %s", (input) => {
      expect(quantitySchema.safeParse(input).success).toBe(false);
    },
  );

  it.each([1, 12, 2_147_483_647])("accepts discrete quantity %s", (input) => {
    expect(quantitySchema.parse(input)).toBe(input);
  });

  it.each(["quantity", "volume"] as const)("requires a unit for %s", (kind) => {
    for (const unit of [undefined, "", "  "]) {
      expect(() => createPriority(priorityId, "user-1", { name: "Бег", metric: { kind, unit } })).toThrow();
    }
  });

  it("keeps integer and decimal metrics distinct on creation and editing", () => {
    const count = createPriority(priorityId, "user-1", {
      name: "Тренировки", metric: { kind: "quantity", unit: "занятий" },
    });
    const volume = createPriority(priorityId, "user-1", {
      name: "Бег", metric: { kind: "volume", unit: "км" },
    });
    const countTarget = { kind: "quantity", amount: 12 };
    const volumeTarget = { kind: "volume", amount: "12,500" };
    const countPlan = createMonthlyPlan(planId, count, "2026-09", countTarget);
    const volumePlan = createMonthlyPlan(planId, volume, "2026-09", volumeTarget);
    expect(volumePlan.target).toEqual({ kind: "volume", amount: "12.5" });
    expect(createMonthlyPlan(planId, volume, "2026-10", { kind: "volume", amount: "12" }).target)
      .toEqual({ kind: "volume", amount: "12" });
    expect(() => createMonthlyPlan(planId, count, "2026-10", { kind: "quantity", amount: 1.5 })).toThrow();
    expect(() => createMonthlyPlan(planId, count, "2026-10", volumeTarget)).toThrow(/Метрика/);
    expect(() => createMonthlyPlan(planId, volume, "2026-10", countTarget)).toThrow(/Метрика/);
    expect(() => changeMonthlyTarget(countPlan, count, volumeTarget)).toThrow(/Метрика/);
    expect(() => changeMonthlyTarget(volumePlan, volume, countTarget)).toThrow(/Метрика/);
  });

  it.each(["2026-00", "2026-13", "2026-9", "0000-01", "2026-09-01"])(
    "rejects invalid month %s", (month) => expect(monthSchema.safeParse(month).success).toBe(false),
  );

  it.each(["2026-01", "2026-12", "2027-01"])(
    "accepts calendar month %s", (month) => expect(monthSchema.parse(month)).toBe(month),
  );

  it.each([["12,500", "12.5"], ["0.001", "0.001"], ["300.000", "300"], ["999999999.999", "999999999.999"]])(
    "normalizes %s without losing decimal precision", (input, expected) => {
      expect(volumeSchema.parse(input)).toBe(expected);
    },
  );

  it.each(["0", "0.000", "-1", "1.0001", "1e3", "01", "1000000000", "Infinity", "", 12.5])(
    "rejects invalid volume %s", (input) => expect(volumeSchema.safeParse(input).success).toBe(false),
  );

  it.each([0, -1, 1.5, Infinity, NaN, 2_147_483_648, "60"])(
    "rejects invalid minutes %s", (minutes) => {
      expect(() => createMonthlyPlan(planId, timePriority(), "2026-09", { kind: "time", minutes })).toThrow();
    },
  );

  it("keeps monthly targets independent and derives ownership from the priority", () => {
    const priority = timePriority();
    const september = createMonthlyPlan(planId, priority, "2026-09", { kind: "time", minutes: 720 });
    const october = createMonthlyPlan("33333333-3333-4333-8333-333333333333", priority, "2026-10", {
      kind: "time", minutes: 900,
    });
    const changed = changeMonthlyTarget(september, priority, { kind: "time", minutes: 600 });
    expect(changed.target).toEqual({ kind: "time", minutes: 600 });
    expect(september.target).toEqual({ kind: "time", minutes: 720 });
    expect(october.target).toEqual({ kind: "time", minutes: 900 });
    expect(changed.ownerId).toBe("user-1");
  });

  it("rejects incompatible metrics on creation and editing", () => {
    const priority = timePriority();
    const target = { kind: "quantity", amount: 12 };
    expect(() => createMonthlyPlan(planId, priority, "2026-09", target)).toThrow(/Метрика/);
    const plan = createMonthlyPlan(planId, priority, "2026-09", { kind: "time", minutes: 60 });
    expect(() => changeMonthlyTarget(plan, priority, target)).toThrow(/Метрика/);
  });

  it("rejects a priority belonging to another user or another priority ID", () => {
    const priority = timePriority();
    const target = { kind: "time", minutes: 60 };
    const plan = createMonthlyPlan(planId, priority, "2026-09", target);
    expect(() => changeMonthlyTarget(plan, { ...priority, ownerId: "user-2" }, target)).toThrow();
    expect(() => changeMonthlyTarget(plan, { ...priority, id: planId }, target)).toThrow();
  });

  it("archiving preserves editable plans but prevents adding new ones until restoration", () => {
    const priority = timePriority();
    const target = { kind: "time", minutes: 60 };
    const plan = createMonthlyPlan(planId, priority, "2026-09", target);
    const archived = archivePriority(priority);
    expect(() => createMonthlyPlan(planId, archived, "2026-10", target)).toThrow(/архива/);
    expect(changeMonthlyTarget(plan, archived, { kind: "time", minutes: 120 }).target)
      .toEqual({ kind: "time", minutes: 120 });
    expect(createMonthlyPlan(planId, restorePriority(archived), "2026-10", target).month).toBe("2026-10");
    expect(priority.archived).toBe(false);
    expect(plan.target).toEqual(target);
  });
});
