import type { ReactNode } from "react";

export function PageHeader({
  title,
  meta,
  actions,
  back,
}: {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
  back?: () => void;
}) {
  return (
    <header className="page-header">
      <div className="page-heading">
        {back && (
          <button className="back-button" onClick={back} aria-label="Назад">
            ←
          </button>
        )}
        <div>
          <h1>{title}</h1>
          {meta && <div className="page-meta">{meta}</div>}
        </div>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
