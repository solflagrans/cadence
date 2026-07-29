import type {
  MonthPlan,
  PlannerData,
} from "@/src/domain/planner/model/types";
import { monthIdForWeek } from "@/src/domain/planner/lib/dates";
import { itemFact, itemProgress } from "@/src/domain/planner/lib/progress";

export function PlanSummary({
  data,
  month,
}: {
  data: PlannerData;
  month: MonthPlan;
}) {
  const counts = month.items.reduce(
    (acc, item) => {
      if (item.paused) acc.paused += 1;
      else {
        const fact = itemFact(data, item);
        const pct = itemProgress(fact, item);
        if (pct >= 100) acc.done += 1;
        else if (pct > 0) acc.partial += 1;
        else acc.empty += 1;
      }
      return acc;
    },
    { done: 0, partial: 0, empty: 0, paused: 0 },
  );
  const extras = data.extraResults.filter(
    (item) => monthIdForWeek(item.weekId) === month.id,
  ).length;
  return (
    <div className="summary-pills">
      <span><strong>{counts.done}</strong> выполнено</span>
      <span><strong>{counts.partial}</strong> частично</span>
      <span><strong>{counts.empty}</strong> не начато</span>
      {counts.paused > 0 && (
        <span><strong>{counts.paused}</strong> приостановлено</span>
      )}
      <span><strong>{extras}</strong> дополнительных</span>
    </div>
  );
}
