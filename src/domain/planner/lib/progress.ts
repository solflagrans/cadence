import type { MetricType, PlannerData, PlanItem } from "../model/types";
import { monthIdForWeek } from "./dates";

export const itemFact = (
  data: PlannerData,
  item: PlanItem,
  weekId?: string,
) => {
  const monthId = data.months.find((month) =>
    month.items.some((candidate) => candidate.id === item.id),
  )?.id;
  const entries = data.completions.filter(
    (entry) =>
      entry.directionId === item.directionId &&
      (weekId
        ? entry.weekId === weekId
        : monthIdForWeek(entry.weekId) === monthId),
  );
  if (!entries.length) return 0;
  if (item.metric === "percent") {
    return [...entries].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.value ?? 0;
  }
  if (item.metric === "checkbox") {
    return entries.some((entry) => entry.value >= 1) ? 1 : 0;
  }
  return entries.reduce((sum, entry) => sum + entry.value, 0);
};

export const progress = (
  fact: number,
  target: number,
  metric: MetricType,
) => {
  if (metric === "checkbox") return fact >= 1 ? 100 : 0;
  return target > 0 ? Math.min(100, Math.round((fact / target) * 100)) : 0;
};

export const quickCompletionValue = (
  fact: number,
  target: number,
  metric: MetricType,
  increment: number,
) => {
  const remaining = Math.max(0, target - fact);
  const delta = Math.min(remaining || increment, increment);
  return {
    delta,
    value: metric === "percent" ? Math.min(target, fact + delta) : delta,
  };
};
