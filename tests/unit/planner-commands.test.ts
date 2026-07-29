import { describe, expect, it } from "vitest";
import { createInitialData } from "@/src/domain/planner/model/defaults";
import type {
  Direction,
  PlanItem,
  PlannerData,
} from "@/src/domain/planner/model/types";
import {
  archiveDirection,
  deleteDirection,
  isDirectionMetricUsed,
  restoreDirection,
} from "@/src/domain/planner/commands/directions";
import {
  itemProgress,
  progress,
  quickCompletionValue,
} from "@/src/domain/planner/lib/progress";
import {
  hasPlannerContent,
  mergePlannerData,
} from "@/src/domain/planner/lib/state";
import { normalizePlannerData } from "@/src/domain/planner/validation/normalize-planner-state";
import { deleteActivityType } from "@/src/domain/planner/commands/activity-types";
import { normalizePercentValues } from "@/src/domain/planner/lib/percentages";
import {
  numericValue,
  sanitizeNumericInput,
} from "@/src/shared/ui/numeric-input/numeric-input";
import {
  pausePlanItem,
  resumePlanItem,
} from "@/src/domain/planner/commands/plan-items";
import {
  pauseWeekDirection,
  suggestedPauseTarget,
} from "@/src/domain/planner/commands/pauses";
import { suggestedPlanTarget } from "@/src/domain/planner/lib/plan-targets";
import { selectPlanCandidates } from "@/src/domain/planner/selectors/planner-selectors";
import { clearWorkPeriod } from "@/src/domain/planner/commands/days";
import { defaultMetricFormat } from "@/src/domain/planner/lib/metric-format";

const direction = (
  overrides: Partial<Direction> = {},
): Direction => ({
  id: "direction-1",
  name: "Reading",
  metric: "count",
  unit: "pages",
  valueFormat: "integer",
  decimalPlaces: 0,
  color: "#000000",
  availability: "active",
  metricHistory: [],
  ...overrides,
});

const planItem = (
  overrides: Partial<PlanItem> = {},
): PlanItem => ({
  id: "plan-item",
  directionId: "direction-1",
  originalTarget: 10,
  target: 10,
  metric: "count",
  unit: "pages",
  history: [],
  ...overrides,
});

const stateWithPlans = (): PlannerData => {
  const state = createInitialData();
  state.directions = [direction()];
  state.months = [{
    id: "2026-07",
    month: "2026-07",
    items: [planItem({ id: "month-item", originalTarget: 15, target: 15 })],
  }];
  state.weeks = [
    {
      id: "2026-07-27",
      start: "2026-07-27",
      monthId: "2026-07",
      items: [planItem({ id: "week-item", originalTarget: 3, target: 3 })],
    },
    {
      id: "2026-08-03",
      start: "2026-08-03",
      monthId: "2026-07",
      items: [planItem({ id: "other-week", originalTarget: 4, target: 4 })],
    },
  ];
  return state;
};

describe("planner domain", () => {
  it("migrates old trash entries to archive and assigns metric formats", () => {
    const legacy = createInitialData() as unknown as Record<string, unknown>;
    legacy.directions = [{
      id: "old",
      name: "Old",
      metric: "duration",
      unit: "ч.",
      color: "#000000",
      availability: "active",
      deletedAt: "2026-07-01",
      metricHistory: [],
    }];
    legacy.completions = [{
      id: "fraction",
      directionId: "old",
      weekId: "2026-07-27",
      date: "2026-07-28",
      value: 1.25,
    }];

    const migrated = normalizePlannerData(legacy)!;

    expect(migrated.directions[0]).toMatchObject({
      availability: "archived",
      valueFormat: "decimal",
      decimalPlaces: 2,
    });
    expect(migrated.completions[0].value).toBe(1.25);
    expect("deletedAt" in migrated.directions[0]).toBe(false);
  });

  it("removes empty legacy periods while keeping additional results", () => {
    const legacy = createInitialData() as unknown as Record<string, unknown>;
    legacy.months = [{ id: "2026-07", month: "2026-07", items: [] }];
    legacy.weeks = [{
      id: "2026-07-27",
      start: "2026-07-27",
      monthId: "2026-07",
      items: [],
    }];
    legacy.extraResults = [{
      id: "extra",
      weekId: "2026-07-27",
      title: "Result",
      metric: "checkbox",
      unit: "",
      value: 1,
      date: "2026-07-28",
    }];

    const migrated = normalizePlannerData(legacy)!;
    expect(migrated.months).toEqual([]);
    expect(migrated.weeks).toEqual([]);
    expect(migrated.extraResults).toHaveLength(1);
  });

  it("archives and restores a direction without changing existing plans", () => {
    const state = stateWithPlans();
    const archived = archiveDirection(state, "direction-1");
    expect(archived.directions[0].availability).toBe("archived");
    expect(archived.months).toEqual(state.months);
    expect(archived.weeks).toEqual(state.weeks);

    const restored = restoreDirection(archived, "direction-1");
    expect(restored.directions[0].availability).toBe("active");
  });

  it("excludes archived directions from new months but keeps them eligible in their existing month", () => {
    const state = archiveDirection(stateWithPlans(), "direction-1");
    expect(selectPlanCandidates(state, "month", "2026-08")).toEqual([]);
    expect(selectPlanCandidates(state, "week", "2026-07").map((item) => item.id))
      .toEqual(["direction-1"]);
  });

  it("permanently deletes all references and makes empty periods unplanned", () => {
    const state = stateWithPlans();
    state.completions = [{
      id: "completion",
      directionId: "direction-1",
      weekId: "2026-07-27",
      date: "2026-07-28",
      value: 1,
    }];

    const next = deleteDirection(state, "direction-1");

    expect(next.directions).toEqual([]);
    expect(next.months).toEqual([]);
    expect(next.weeks).toEqual([]);
    expect(next.completions).toEqual([]);
  });

  it.each([
    [1, 1, 2],
    [0, 0, 3],
    [3, 3, 0],
    [5, 3, 0],
  ])(
    "calculates weekly pause for fact %s",
    (fact, expectedTarget, expectedExcluded) => {
      expect(suggestedPauseTarget(3, fact)).toBe(expectedTarget);
      const item = pausePlanItem(
        planItem({ originalTarget: 3, target: 3 }),
        {
          target: expectedTarget,
          reason: "Болезнь",
          date: "2026-07-29",
        },
      );
      expect(item.target).toBe(expectedTarget);
      expect(item.paused?.excluded).toBe(expectedExcluded);
    },
  );

  it("reduces the month by the weekly exclusion and leaves other weeks unchanged", () => {
    const state = stateWithPlans();
    state.completions = [{
      id: "completion",
      directionId: "direction-1",
      weekId: "2026-07-27",
      date: "2026-07-28",
      value: 1,
    }];

    const next = pauseWeekDirection(state, {
      weekId: "2026-07-27",
      itemId: "week-item",
      target: 1,
      reason: "Болезнь",
      date: "2026-07-29",
    });

    expect(next.weeks[0].items[0].target).toBe(1);
    expect(next.weeks[1]).toEqual(state.weeks[1]);
    expect(next.months[0].items[0].target).toBe(13);
    expect(next.months[0].items[0].history.at(-1)).toMatchObject({
      from: 15,
      to: 13,
    });
  });

  it("resumes without restoring excluded target", () => {
    const paused = pausePlanItem(planItem(), {
      target: 4,
      reason: "Болезнь",
      date: "2026-07-29",
    });
    const resumed = resumePlanItem(paused, "2026-08-01");
    expect(resumed.target).toBe(4);
    expect(resumed.paused).toBeUndefined();
  });

  it("allows planning after a previous zero paused target", () => {
    expect(suggestedPlanTarget({
      metric: "count",
      scope: "week",
      previousTarget: 0,
      monthTarget: 20,
    })).toBe(5);
  });

  it("calculates partial, overfulfilled and paused zero progress", () => {
    expect(progress(5, 10, "count")).toBe(50);
    expect(progress(15, 10, "count")).toBe(150);
    expect(progress(0, 0, "count", true)).toBe(100);
    expect(progress(0, 0, "count")).toBe(0);
    expect(progress(1, 1, "checkbox")).toBe(100);
  });

  it("switches between actual and original plan progress", () => {
    const item = planItem({ originalTarget: 15, target: 12 });
    expect(itemProgress(12, item, "actual")).toBe(100);
    expect(itemProgress(12, item, "original")).toBe(80);
  });

  it("uses and validates integer and decimal metric formats", () => {
    expect(defaultMetricFormat("duration", "мин.")).toEqual({
      valueFormat: "integer",
      decimalPlaces: 0,
    });
    expect(defaultMetricFormat("duration", "ч.")).toEqual({
      valueFormat: "decimal",
      decimalPlaces: 2,
    });
    expect(defaultMetricFormat("percent", "")).toEqual({
      valueFormat: "decimal",
      decimalPlaces: 1,
    });
    expect(sanitizeNumericInput("2,5", "2", false)).toBe("2");
    expect(sanitizeNumericInput("2,55", "2.5", true, 1)).toBe("2.5");
    expect(sanitizeNumericInput("2,55", "2", true, 2)).toBe("2.55");
  });

  it("locks a used metric and unlocks it after all references are removed", () => {
    const state = stateWithPlans();
    expect(isDirectionMetricUsed(state, "direction-1")).toBe(true);
    state.months = [];
    state.weeks = [];
    expect(isDirectionMetricUsed(state, "direction-1")).toBe(false);
  });

  it("clears a work period without touching the day composition", () => {
    const state = createInitialData();
    state.days = [{
      date: "2026-07-29",
      segments: [{ activityId: "work", percent: 100 }],
      workStart: "09:00",
      workEnd: "18:00",
      breaks: [],
    }];
    const next = clearWorkPeriod(state, "2026-07-29", false);
    expect(next.days[0].workStart).toBeUndefined();
    expect(next.days[0].workEnd).toBeUndefined();
    expect(next.days[0].segments).toEqual(state.days[0].segments);
  });

  it("clears dependent breaks only after the caller confirms it", () => {
    const state = createInitialData();
    state.days = [{
      date: "2026-07-29",
      segments: [],
      workStart: "09:00",
      workEnd: "18:00",
      breaks: [{ id: "break", start: "12:00", end: "12:30" }],
    }];
    expect(clearWorkPeriod(state, "2026-07-29", false).days[0].breaks)
      .toHaveLength(1);
    expect(clearWorkPeriod(state, "2026-07-29", true).days[0].breaks)
      .toEqual([]);
  });

  it("normalizes percentages and removes archived activities from history", () => {
    expect(normalizePercentValues([10, 20, 30])).toEqual([16.7, 33.3, 50]);
    const state = createInitialData();
    state.activityTypes = [
      { id: "deleted", name: "Deleted", color: "#111111", icon: "", order: 0, archived: true },
      { id: "work", name: "Work", color: "#222222", icon: "", order: 1, archived: false },
    ];
    state.days = [{
      date: "2026-07-29",
      breaks: [],
      segments: [
        { activityId: "deleted", percent: 50 },
        { activityId: "work", percent: 50 },
      ],
    }];
    expect(deleteActivityType(state, "deleted").days[0].segments)
      .toEqual([{ activityId: "work", percent: 100 }]);
  });

  it("keeps numeric drafts editable and ignores invalid characters", () => {
    expect(sanitizeNumericInput("", "5")).toBe("");
    expect(sanitizeNumericInput("12,5", "12")).toBe("12.5");
    expect(sanitizeNumericInput("12a", "12")).toBe("12");
    expect(numericValue("")).toBeNull();
    expect(numericValue("12.5")).toBe(12.5);
  });

  it("increments percent snapshots without resetting existing progress", () => {
    expect(quickCompletionValue(40, 100, "percent", 10)).toEqual({
      delta: 10,
      value: 50,
    });
  });

  it("merges guest and account data without dropping either source", () => {
    const guest = createInitialData();
    const account = createInitialData();
    guest.directions = [direction({ id: "guest" })];
    account.directions = [direction({ id: "account" })];
    const merged = mergePlannerData(account, guest);
    expect(merged.directions.map((item) => item.id).sort())
      .toEqual(["account", "guest"]);
    expect(hasPlannerContent(merged)).toBe(true);
  });
});
