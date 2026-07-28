import type { PlanItem } from "../model/types";

export const pausePlanItem = (
  item: PlanItem,
  {
    target,
    reason,
    details,
    date,
  }: {
    target: number;
    reason: string;
    details?: string;
    date: string;
  },
): PlanItem => ({
  ...item,
  target,
  paused: {
    reason,
    ...(details ? { details } : {}),
    date,
    excluded: Math.max(0, item.originalTarget - target),
  },
  history:
    item.target !== target
      ? [...item.history, { date, from: item.target, to: target, reason }]
      : item.history,
});

export const resumePlanItem = (item: PlanItem, date: string): PlanItem => {
  const target = item.originalTarget;
  return {
    ...item,
    target,
    paused: undefined,
    history:
      item.target !== target
        ? [
            ...item.history,
            {
              date,
              from: item.target,
              to: target,
              reason: "Возобновление",
            },
          ]
        : item.history,
  };
};
