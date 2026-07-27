import { Button } from "../button/button";
import { Icon, type IconName } from "../icon/icon";

export function EmptyState({
  text,
  action,
  onAction,
  icon = "spark",
  title,
}: {
  text: string;
  action: string;
  onAction: () => void;
  icon?: IconName;
  title?: string;
}) {
  return (
    <div className="empty-state">
      <span className="empty-mark"><Icon name={icon} size={21} /></span>
      {title && <strong className="empty-title">{title}</strong>}
      <p>{text}</p>
      <Button size="small" onClick={onAction}>{action}</Button>
    </div>
  );
}
