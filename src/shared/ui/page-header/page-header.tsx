import type { ReactNode } from "react";
import { Icon } from "../icon/icon";

export function PageHeader({
  title,
  meta,
  actions,
  back,
  eyebrow,
  description,
}: {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
  back?: () => void;
  eyebrow?: string;
  description?: string;
}) {
  return (
    <header className="page-header">
      <div className="page-heading">
        {back && (
          <button className="back-button" onClick={back} aria-label="Назад">
            <Icon name="chevron-left" size={18} />
          </button>
        )}
        <div>
          {eyebrow && <span className="page-eyebrow">{eyebrow}</span>}
          <h1>{title}</h1>
          {description && <p className="page-description">{description}</p>}
          {meta && <div className="page-meta">{meta}</div>}
        </div>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
