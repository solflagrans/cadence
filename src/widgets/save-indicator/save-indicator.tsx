import type { SaveStatus } from "@/src/application/planner/planner-provider";

export function SaveIndicator({
  status,
  localOnly,
}: {
  status: SaveStatus;
  localOnly: boolean;
}) {
  const label = {
    saving: localOnly ? "Сохранение локально…" : "Сохранение…",
    saved: localOnly ? "Сохранено локально" : "Сохранено",
    error: "Ошибка сохранения",
  }[status];

  return (
    <span
      className={`save-indicator save-indicator-${status}`}
      role="status"
      aria-live="polite"
    >
      <span aria-hidden="true" />
      {label}
    </span>
  );
}
