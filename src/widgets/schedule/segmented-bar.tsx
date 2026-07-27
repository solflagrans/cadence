import type {
  DayPlan,
  PlannerData,
} from "@/src/domain/planner/model/types";

export function SegmentedBar({
  segments,
  data,
  compact = false,
}: {
  segments: DayPlan["segments"];
  data: PlannerData;
  compact?: boolean;
}) {
  const label = segments.length
    ? segments
        .map((segment) => {
          const activity = data.activityTypes.find(
            (item) => item.id === segment.activityId,
          );
          return `${activity?.name ?? "Без типа"} ${segment.percent}%`;
        })
        .join(", ")
    : "Состав дня не задан";

  return (
    <div
      className={`segment-bar ${compact ? "segment-bar-compact" : ""}`}
      role="img"
      aria-label={label}
    >
      {segments.map((segment, index) => {
        const activity = data.activityTypes.find(
          (item) => item.id === segment.activityId,
        );
        return (
          <span
            key={`${segment.activityId}-${index}`}
            style={{
              width: `${segment.percent}%`,
              background: activity?.color ?? "#d6d3cc",
            }}
            title={`${activity?.name ?? "Без типа"} — ${segment.percent}%`}
          />
        );
      })}
    </div>
  );
}
