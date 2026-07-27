"use client";

import { useState } from "react";
import type { PlannerData } from "@/src/domain/planner/model/types";
import { iso, monthIdForWeek } from "@/src/domain/planner/lib/dates";
import { itemFact, progress } from "@/src/domain/planner/lib/progress";
import { dateLabel, pluralize } from "@/app/lib/data";
import { navigate } from "@/src/application/navigation/routes";
import { Badge } from "@/src/shared/ui/badge/badge";
import { PageHeader } from "@/src/shared/ui/page-header/page-header";
import { IconButton } from "@/src/shared/ui/icon-button/icon-button";
import { ProgressBar } from "@/src/shared/ui/progress-bar/progress-bar";
import { PlanSummary } from "../widgets/plan-summary";

export function PlansPage({ data }: { data: PlannerData }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const currentMonth = iso(new Date()).slice(0, 7);
  const months = Array.from(
    { length: 12 },
    (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`,
  );
  return (
    <>
      <PageHeader
        title="Планы"
        eyebrow="Годовой ритм"
        description="Планируйте направления по месяцам и отслеживайте общий прогресс."
        actions={
          <div className="year-switcher">
            <IconButton
              icon="chevron-left"
              label="Предыдущий год"
              onClick={() => setYear((value) => value - 1)}
            />
            <strong>{year}</strong>
            <IconButton
              icon="chevron-right"
              label="Следующий год"
              onClick={() => setYear((value) => value + 1)}
            />
          </div>
        }
      />
      <section className="month-grid">
        {months.map((id) => {
          const month = data.months.find((entry) => entry.id === id);
          const extras = data.extraResults.filter(
            (entry) => monthIdForWeek(entry.weekId) === id,
          ).length;
          const completion = month?.items.length
            ? Math.round(
                month.items.reduce(
                  (sum, item) =>
                    sum + progress(itemFact(data, item), item.target, item.metric),
                  0,
                ) / month.items.length,
              )
            : 0;
          return (
            <button
              key={id}
              className={`month-card card ${id === currentMonth ? "current" : ""}`}
              onClick={() => navigate({ page: "month", id })}
            >
              <div className="month-card-head">
                <h2>{dateLabel(`${id}-01`, { month: "long" })}</h2>
                {id === currentMonth && <Badge tone="blue">Текущий</Badge>}
              </div>
              {month ? (
                <>
                  <strong className="month-count">{month.items.length}</strong>
                  <span>
                    {pluralize(month.items.length, [
                      "направление",
                      "направления",
                      "направлений",
                    ])}
                  </span>
                  <div className="month-card-metric">
                    <span>Общий прогресс</span>
                    <strong>{completion}%</strong>
                    <ProgressBar value={completion} />
                  </div>
                  <PlanSummary data={data} month={month} />
                  {extras > 0 && (
                    <span className="month-extra">
                      +{extras} {pluralize(extras, ["результат", "результата", "результатов"])}
                    </span>
                  )}
                </>
              ) : (
                <span className="month-empty">Нет плана</span>
              )}
            </button>
          );
        })}
      </section>
    </>
  );
}
