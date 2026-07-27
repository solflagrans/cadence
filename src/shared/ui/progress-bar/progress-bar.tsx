export function ProgressBar({
  value,
  color,
}: {
  value: number;
  color?: string;
}) {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-label={`Выполнено ${safeValue}%`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safeValue}
    >
      <span style={{ width: `${safeValue}%`, background: color }} />
    </div>
  );
}
