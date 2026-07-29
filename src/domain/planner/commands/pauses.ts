import type { PlannerData } from "../model/types";
import { itemFact } from "../lib/progress";
import { pausePlanItem } from "./plan-items";

export const suggestedPauseTarget = (
  originalTarget: number,
  fact: number,
) => originalTarget - Math.max(originalTarget - fact, 0);

export const pauseWeekDirection = (
  state: PlannerData,
  {
    weekId,
    itemId,
    target,
    reason,
    details,
    date,
  }: {
    weekId: string;
    itemId: string;
    target: number;
    reason: string;
    details?: string;
    date: string;
  },
): PlannerData => {
  const week = state.weeks.find((entry) => entry.id === weekId);
  const item = week?.items.find((entry) => entry.id === itemId);
  if (!week || !item) return state;

  const previousExcluded = item.paused?.excluded ?? 0;
  const nextItem = pausePlanItem(item, {
    target,
    reason,
    details,
    date,
  });
  const excludedChange = nextItem.paused!.excluded - previousExcluded;

  return {
    ...state,
    weeks: state.weeks.map((entry) =>
      entry.id === weekId
        ? {
            ...entry,
            items: entry.items.map((candidate) =>
              candidate.id === itemId ? nextItem : candidate,
            ),
          }
        : entry,
    ),
    months: state.months.map((month) => {
      if (month.id !== week.monthId || excludedChange === 0) return month;
      return {
        ...month,
        items: month.items.map((monthItem) => {
          if (monthItem.directionId !== item.directionId) return monthItem;
          const nextTarget = Math.max(0, monthItem.target - excludedChange);
          return {
            ...monthItem,
            target: nextTarget,
            history: [
              ...monthItem.history,
              {
                date,
                from: monthItem.target,
                to: nextTarget,
                reason,
              },
            ],
          };
        }),
      };
    }),
  };
};

export const pauseMonthDirection = (
  state: PlannerData,
  {
    monthId,
    itemId,
    target,
    reason,
    details,
    date,
  }: {
    monthId: string;
    itemId: string;
    target: number;
    reason: string;
    details?: string;
    date: string;
  },
): PlannerData => ({
  ...state,
  months: state.months.map((month) =>
    month.id === monthId
      ? {
          ...month,
          items: month.items.map((item) =>
            item.id === itemId
              ? pausePlanItem(item, {
                  target,
                  reason,
                  details,
                  date,
                })
              : item,
          ),
        }
      : month,
  ),
});

export const defaultPauseTarget = (
  state: PlannerData,
  scope: "month" | "week",
  planId: string,
  itemId: string,
) => {
  const plan =
    scope === "month"
      ? state.months.find((entry) => entry.id === planId)
      : state.weeks.find((entry) => entry.id === planId);
  const item = plan?.items.find((entry) => entry.id === itemId);
  if (!item) return 0;
  const fact = itemFact(
    state,
    item,
    scope === "week" ? planId : undefined,
  );
  return suggestedPauseTarget(item.originalTarget, fact);
};
