import { describe, expect, it } from "vitest";
import { createInitialData } from "@/src/domain/planner/model/defaults";
import {
  deleteDirection,
  moveDirectionToTrash,
  restoreDirection,
} from "@/src/domain/planner/commands/directions";
import {
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
import { suggestedPlanTarget } from "@/src/domain/planner/lib/plan-targets";

describe("planner domain", () => {
  it("removes a direction and all references to it", () => {
    const state = createInitialData();
    state.directions.push({
      id: "direction-1",
      name: "Reading",
      metric: "count",
      unit: "pages",
      color: "#000000",
      availability: "active",
      metricHistory: [],
    });
    state.months.push({
      id: "2026-07",
      month: "2026-07",
      items: [{
        id: "month-item",
        directionId: "direction-1",
        originalTarget: 10,
        target: 10,
        metric: "count",
        unit: "pages",
        history: [],
      }],
    });
    state.weeks.push({
      id: "2026-07-27",
      start: "2026-07-27",
      monthId: "2026-07",
      items: [{
        id: "week-item",
        directionId: "direction-1",
        originalTarget: 3,
        target: 3,
        metric: "count",
        unit: "pages",
        history: [],
      }],
    });
    state.completions.push({
      id: "completion-1",
      directionId: "direction-1",
      weekId: "2026-07-27",
      date: "2026-07-27",
      value: 1,
    });

    const next = deleteDirection(state, "direction-1");

    expect(next.directions).toEqual([]);
    expect(next.months[0].items).toEqual([]);
    expect(next.weeks[0].items).toEqual([]);
    expect(next.completions).toEqual([]);
  });

  it("calculates bounded progress", () => {
    expect(progress(5, 10, "count")).toBe(50);
    expect(progress(15, 10, "count")).toBe(100);
    expect(progress(1, 1, "checkbox")).toBe(100);
    expect(progress(0, 1, "checkbox")).toBe(0);
  });

  it("increments percent snapshots without resetting existing progress", () => {
    expect(quickCompletionValue(40, 100, "percent", 10)).toEqual({
      delta: 10,
      value: 50,
    });
    expect(quickCompletionValue(95, 100, "percent", 10)).toEqual({
      delta: 5,
      value: 100,
    });
    expect(quickCompletionValue(4, 10, "count", 1)).toEqual({
      delta: 1,
      value: 1,
    });
  });

  it("moves a direction to trash without losing history and restores it", () => {
    const state = createInitialData();
    state.directions.push({
      id: "direction-1",
      name: "Reading",
      metric: "count",
      unit: "pages",
      color: "#000000",
      availability: "active",
      metricHistory: [],
    });

    const trashed = moveDirectionToTrash(state, "direction-1", "2026-07-28");
    expect(trashed.directions[0].deletedAt).toBe("2026-07-28");
    expect(trashed.directions).toHaveLength(1);

    const restored = restoreDirection(trashed, "direction-1");
    expect(restored.directions[0].deletedAt).toBeUndefined();
  });

  it("merges guest and account data without dropping either source", () => {
    const guest = createInitialData();
    const account = createInitialData();
    guest.directions.push({
      id: "guest-direction",
      name: "Guest",
      metric: "checkbox",
      unit: "",
      color: "#111111",
      availability: "active",
      metricHistory: [],
    });
    account.directions.push({
      id: "account-direction",
      name: "Account",
      metric: "checkbox",
      unit: "",
      color: "#222222",
      availability: "active",
      metricHistory: [],
    });

    const merged = mergePlannerData(account, guest);

    expect(merged.directions.map((item) => item.id).sort()).toEqual([
      "account-direction",
      "guest-direction",
    ]);
    expect(hasPlannerContent(merged)).toBe(true);
  });

  it("normalizes older version-two states without review records", () => {
    const legacy = createInitialData() as unknown as Record<string, unknown>;
    delete legacy.reviews;

    expect(normalizePlannerData(legacy)?.reviews).toEqual([]);
  });

  it("normalizes non-zero percentages to exactly 100 percent", () => {
    expect(normalizePercentValues([10, 20, 30])).toEqual([16.7, 33.3, 50]);
    expect(normalizePercentValues([0, 1, 1])).toEqual([0, 50, 50]);
    expect(normalizePercentValues([0, 0])).toEqual([0, 0]);
    expect(normalizePercentValues([1, 1, 1]).reduce((sum, item) => sum + item, 0))
      .toBe(100);
  });

  it("removes an archived activity from history and rebalances each day", () => {
    const state = createInitialData();
    state.activityTypes = [
      { id: "deleted", name: "Deleted", color: "#111111", icon: "", order: 0, archived: true },
      { id: "work", name: "Work", color: "#222222", icon: "", order: 1, archived: false },
      { id: "rest", name: "Rest", color: "#333333", icon: "", order: 2, archived: false },
    ];
    state.days = [
      {
        date: "2026-07-28",
        breaks: [],
        segments: [
          { activityId: "deleted", percent: 50 },
          { activityId: "work", percent: 20 },
          { activityId: "rest", percent: 30 },
        ],
      },
      {
        date: "2026-07-29",
        breaks: [],
        segments: [{ activityId: "deleted", percent: 100 }],
      },
    ];

    const next = deleteActivityType(state, "deleted");

    expect(next.activityTypes.map((item) => item.id)).toEqual(["work", "rest"]);
    expect(next.days[0].segments).toEqual([
      { activityId: "work", percent: 40 },
      { activityId: "rest", percent: 60 },
    ]);
    expect(next.days[1].segments).toEqual([]);
  });

  it("keeps numeric drafts editable and ignores invalid characters", () => {
    expect(sanitizeNumericInput("", "5")).toBe("");
    expect(sanitizeNumericInput("12,5", "12")).toBe("12.5");
    expect(sanitizeNumericInput("12a", "12")).toBe("12");
    expect(sanitizeNumericInput("1.2.3", "1.2")).toBe("1.2");
    expect(sanitizeNumericInput("2,5", "2", false)).toBe("2");
    expect(numericValue("")).toBeNull();
    expect(numericValue("12.5")).toBe(12.5);
  });

  it("records and reverses a weekly pause without losing plan history", () => {
    const item = {
      id: "week-item",
      directionId: "direction-1",
      originalTarget: 10,
      target: 10,
      metric: "count" as const,
      unit: "раз",
      history: [],
    };

    const paused = pausePlanItem(item, {
      target: 0,
      reason: "Болезнь",
      date: "2026-07-28",
    });
    expect(paused.target).toBe(0);
    expect(paused.paused?.excluded).toBe(10);
    expect(paused.history.at(-1)).toMatchObject({ from: 10, to: 0 });

    const resumed = resumePlanItem(paused, "2026-08-03");
    expect(resumed.target).toBe(10);
    expect(resumed.paused).toBeUndefined();
    expect(resumed.history.at(-1)?.reason).toBe("Возобновление");
  });

  it("does not reuse a zero paused target for the following week", () => {
    expect(suggestedPlanTarget({
      metric: "count",
      scope: "week",
      previousTarget: 0,
      monthTarget: 20,
    })).toBe(5);
    expect(suggestedPlanTarget({
      metric: "checkbox",
      scope: "week",
      previousTarget: 0,
      monthTarget: 1,
    })).toBe(1);
  });
});
