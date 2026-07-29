import type { PlannerUpdate } from "@/src/application/planner/planner-provider";
import { recordCompletion } from "@/src/domain/planner/commands/plans";
import { iso } from "@/src/domain/planner/lib/dates";
import {
  itemFact,
  progress,
  quickCompletionValue,
} from "@/src/domain/planner/lib/progress";
import type { PlannerData } from "@/src/domain/planner/model/types";
import { formatValue, uid } from "@/app/lib/data";
import { Button } from "@/src/shared/ui/button/button";
import { Icon } from "@/src/shared/ui/icon/icon";
import { ProgressBar } from "@/src/shared/ui/progress-bar/progress-bar";
import type { ModalState } from "../model/modal-state";

export function TodayPlan({
  data,
  weekId,
  update,
  setModal,
}: {
  data: PlannerData;
  weekId: string;
  update: PlannerUpdate;
  setModal: (modal: ModalState) => void;
}) {
  const week = data.weeks.find((item) => item.id === weekId);
  if (!week) return null;

  const add = (
    directionId: string,
    value: number,
    directionName: string,
  ) => {
    if (value <= 0) return;
    update(
      (current) =>
        recordCompletion(current, {
          id: uid("completion"),
          directionId,
          weekId,
          date: iso(new Date()),
          value,
        }),
      `Добавлено: ${directionName}`,
    );
  };

  return (
    <div className="today-plan-list">
      {week.items.map((item) => {
        const direction = data.directions.find(
          (entry) => entry.id === item.directionId,
        );
        if (!direction) return null;
        const fact = itemFact(data, item, weekId);
        const percent = progress(
          fact,
          item.target,
          item.metric,
          Boolean(item.paused),
        );
        const quickValue =
          item.metric === "duration"
            ? item.unit === "мин."
              ? 15
              : 0.5
            : item.metric === "percent"
              ? 10
              : 1;
        const { delta, value } = quickCompletionValue(
          fact,
          item.target,
          item.metric,
          quickValue,
        );
        const completed = percent >= 100;

        return (
          <article className="today-plan-row" key={item.id}>
            <div className="today-plan-main">
              <span
                className="direction-dot"
                style={{ background: direction.color }}
              />
              <div>
                <strong>{direction.name}</strong>
                <span>
                  {formatValue(fact, item.metric, item.unit)} из{" "}
                  {formatValue(item.target, item.metric, item.unit)}
                </span>
              </div>
              <strong className="today-plan-percent">{percent}%</strong>
              <ProgressBar value={percent} color={direction.color} />
            </div>
            <div className="today-plan-actions">
              <Button
                size="small"
                variant={completed ? "secondary" : "primary"}
                icon={completed ? "check" : "plus"}
                disabled={completed}
                onClick={() =>
                  add(item.directionId, value, direction.name)
                }
              >
                {completed
                  ? "Выполнено"
                  : item.metric === "checkbox"
                    ? "Отметить"
                    : item.metric === "percent"
                      ? `+${formatValue(delta, item.metric, item.unit)}`
                      : formatValue(value, item.metric, item.unit)}
              </Button>
              {item.metric !== "checkbox" && (
                <button
                  className="quick-custom"
                  onClick={() =>
                    setModal({
                      kind: "fact",
                      weekId,
                      directionId: item.directionId,
                    })
                  }
                >
                  Другое <Icon name="arrow-right" size={14} />
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
