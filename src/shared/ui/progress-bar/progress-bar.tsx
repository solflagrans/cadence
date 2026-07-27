export function ProgressBar({
  value,
  color,
}: {
  value: number;
  color?: string;
}) {
  return (
    <div className="progress-track" aria-label={`Выполнено ${value}%`}>
      <span style={{ width: `${value}%`, background: color }} />
    </div>
  );
}
