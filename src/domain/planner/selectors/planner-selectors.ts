import type { PlannerData } from "../model/types";
import { itemFact, progress } from "../lib/progress";

export const selectMonth = (state: PlannerData, monthId: string) =>
  state.months.find((month) => month.id === monthId);

export const selectWeek = (state: PlannerData, weekId: string) =>
  state.weeks.find((week) => week.id === weekId);

export const selectDirection = (state: PlannerData, directionId: string) =>
  state.directions.find((direction) => direction.id === directionId);

export const selectPlanItemProgress = (
  state: PlannerData,
  itemId: string,
  weekId?: string,
) => {
  const item = [...state.months, ...state.weeks]
    .flatMap((plan) => plan.items)
    .find((candidate) => candidate.id === itemId);
  if (!item) return null;
  const fact = itemFact(state, item, weekId);
  return {
    fact,
    percent: progress(fact, item.target, item.metric),
  };
};
