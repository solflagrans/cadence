import { Button } from "../button/button";

export function EmptyState({
  text,
  action,
  onAction,
}: {
  text: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="empty-state">
      <span className="empty-mark">○</span>
      <p>{text}</p>
      <Button onClick={onAction}>{action}</Button>
    </div>
  );
}
