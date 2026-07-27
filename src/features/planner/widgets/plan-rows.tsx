import type {
  PlannerData,
  PlanItem,
} from "@/src/domain/planner/model/types";
import { itemFact, progress } from "@/src/domain/planner/lib/progress";
import { formatValue } from "@/app/lib/data";
import { Badge } from "@/src/shared/ui/badge/badge";
import { ProgressBar } from "@/src/shared/ui/progress-bar/progress-bar";
import type { ModalState } from "../model/modal-state";
import { Icon } from "@/src/shared/ui/icon/icon";
import { IconButton } from "@/src/shared/ui/icon-button/icon-button";

export function PlanRows({
  data,
  items,
  scope,
  planId,
  weekId,
  setModal,
}: {
  data: PlannerData;
  items: PlanItem[];
  scope: "month" | "week";
  planId: string;
  weekId?: string;
  setModal: (modal: ModalState) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="plan-list">
      {items.map((item) => {
        const direction = data.directions.find(
          (entry) => entry.id === item.directionId,
        );
        if (!direction) return null;
        const fact = itemFact(data, item, weekId);
        const percent = progress(fact, item.target, item.metric);
        return (
          <article className="plan-row" key={item.id}>
            <button
              className="row-main"
              onClick={() =>
                setModal({
                  kind: "details",
                  scope,
                  planId,
                  itemId: item.id,
                })
              }
            >
              <span
                className="direction-dot"
                style={{ background: direction.color }}
              />
              <span className="row-copy">
                <span className="row-title-line">
                  <strong>{direction.name}</strong>
                  {item.paused && (
                    <Badge tone="amber">{item.paused.reason}</Badge>
                  )}
                </span>
                <span className="row-progress">
                  <ProgressBar value={percent} color={direction.color} />
                </span>
              </span>
              <span className="row-value">
                <strong>{formatValue(fact, item.metric, item.unit)}</strong>
                <span>
                  из {formatValue(item.target, item.metric, item.unit)}
                </span>
              </span>
            </button>
            <div className="row-actions">
              {scope === "week" && (
                <button
                  className="small-action"
                  onClick={() =>
                    setModal({
                      kind: "fact",
                      weekId: planId,
                      directionId: item.directionId,
                    })
                  }
                >
                  <Icon name="plus" size={14} /> Факт
                </button>
              )}
              <IconButton
                icon="more"
                className="more-button"
                onClick={() =>
                  setModal({
                    kind: "edit-item",
                    scope,
                    planId,
                    itemId: item.id,
                  })
                }
                label={`Изменить ${direction.name}`}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}
