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
});
