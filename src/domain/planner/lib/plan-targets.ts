import type { MetricType } from "../model/types";

export const suggestedPlanTarget = ({
  metric,
  scope,
  previousTarget,
  monthTarget,
}: {
  metric: MetricType | undefined;
  scope: "month" | "week";
  previousTarget?: number;
  monthTarget?: number;
}): number => {
  if (metric === "checkbox") return 1;
  if (previousTarget !== undefined && previousTarget > 0) return previousTarget;
  if (scope === "week" && monthTarget !== undefined) {
    return Math.max(1, Number((monthTarget / 4).toFixed(1)));
  }
  return metric === "percent" ? 100 : 1;
};
