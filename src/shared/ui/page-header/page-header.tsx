import type { ReactNode } from "react";
import { Icon } from "../icon/icon";

export function PageHeader({
  title,
  meta,
  actions,
  back,
  eyebrow,
  description,
  breadcrumbs,
}: {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
  back?: () => void;
  eyebrow?: string;
  description?: string;
  breadcrumbs?: {
    label: string;
    onClick?: () => void;
  }[];
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
          {breadcrumbs && (
            <nav className="page-breadcrumbs" aria-label="Путь">
              {breadcrumbs.map((item, index) => (
                <span key={`${item.label}-${index}`}>
                  {index > 0 && <i aria-hidden="true">/</i>}
                  {item.onClick ? (
                    <button onClick={item.onClick}>{item.label}</button>
                  ) : (
                    <strong aria-current="page">{item.label}</strong>
                  )}
                </span>
              ))}
            </nav>
          )}
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
