"use client";

import { useState } from "react";
import type { PlannerUpdate } from "@/src/application/planner/planner-provider";
import { itemFact, itemProgress } from "@/src/domain/planner/lib/progress";
import type {
  PlannerData,
  PlanItem,
} from "@/src/domain/planner/model/types";
import { iso, monthIdForWeek } from "@/src/domain/planner/lib/dates";
import { Button } from "@/src/shared/ui/button/button";
import { Icon } from "@/src/shared/ui/icon/icon";

export function PeriodReview({
  data,
  scope,
  periodId,
  items,
  weekId,
  status,
  update,
  onPlanNext,
  canPlanNext,
}: {
  data: PlannerData;
  scope: "month" | "week";
  periodId: string;
  items: PlanItem[];
  weekId?: string;
  status: string;
  update: PlannerUpdate;
  onPlanNext: () => void;
  canPlanNext: boolean;
}) {
  const [progressMode, setProgressMode] = useState<"actual" | "original">(
    "actual",
  );
  const existing = data.reviews.find(
    (item) => item.scope === scope && item.periodId === periodId,
  );
  const results = items.map((item) => {
    const fact = itemFact(data, item, weekId);
    return { item, fact, pct: itemProgress(fact, item, progressMode) };
  });
  const counts = {
    done: results.filter((item) => item.pct >= 100).length,
    partial: results.filter((item) => item.pct > 0 && item.pct < 100).length,
    untouched: results.filter((item) => item.pct === 0).length,
  };
  const extras = data.extraResults.filter((item) =>
    scope === "week"
      ? item.weekId === periodId
      : monthIdForWeek(item.weekId) === periodId,
  ).length;
  const isPast = status.startsWith("Прош");

  const saveNote = (note: string) => {
    if (note === (existing?.note ?? "")) return;
    update(
      (current) => {
        const review = {
          id: `${scope}:${periodId}`,
          scope,
          periodId,
          note: note.trim(),
          updatedAt: iso(new Date()),
        } as const;
        return {
          ...current,
          reviews: current.reviews.some((item) => item.id === review.id)
            ? current.reviews.map((item) =>
                item.id === review.id ? review : item,
              )
            : [...current.reviews, review],
        };
      },
    );
  };

  return (
    <section className="card period-review-card">
      <div className="section-head">
        <div>
          <span className="eyebrow">
            {isPast ? "Завершённый период" : "Текущий результат"}
          </span>
          <h2>{isPast ? "Итоги периода" : "Как идёт план"}</h2>
        </div>
        <div className="range-switcher" aria-label="Основа расчёта">
          <button
            className={progressMode === "actual" ? "active" : ""}
            onClick={() => setProgressMode("actual")}
          >
            По актуальному плану
          </button>
          <button
            className={progressMode === "original" ? "active" : ""}
            onClick={() => setProgressMode("original")}
          >
            По первоначальному плану
          </button>
        </div>
      </div>
      <div className="review-stats">
        <span><strong>{counts.done}</strong> выполнено</span>
        <span><strong>{counts.partial}</strong> в процессе</span>
        <span><strong>{counts.untouched}</strong> не начато</span>
        <span><strong>{extras}</strong> сверх плана</span>
      </div>
      <label className="review-note">
        <span>
          <Icon name="spark" size={16} />
          {isPast ? "Что стоит учесть дальше?" : "Заметка о периоде"}
        </span>
        <textarea
          value={existing?.note ?? ""}
          onChange={(event) => saveNote(event.target.value)}
          placeholder="Что сработало, что мешало, что изменить в следующем плане…"
          rows={3}
        />
      </label>
      {canPlanNext && (
        <div className="review-actions">
          <Button
            size="small"
            variant="secondary"
            trailingIcon="arrow-right"
            onClick={onPlanNext}
          >
            Запланировать следующий {scope === "month" ? "месяц" : "период"}
          </Button>
        </div>
      )}
    </section>
  );
}
