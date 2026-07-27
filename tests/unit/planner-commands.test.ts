import { describe, expect, it } from "vitest";
import { createInitialData } from "@/src/domain/planner/model/defaults";
import { deleteDirection } from "@/src/domain/planner/commands/directions";
import { progress } from "@/src/domain/planner/lib/progress";

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
});
