import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

export function Breadcrumbs({ items, label = 'Breadcrumbs' }: { items: BreadcrumbItem[]; label?: string }) {
  if (items.length === 0) return null;

  return (
    <nav className="platform-breadcrumbs" aria-label={label}>
      <ol>
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`}>
              {index > 0 ? <ChevronRight className="directional-icon" size={13} aria-hidden="true" /> : null}
              {item.onClick && !current ? (
                <button type="button" onClick={item.onClick}>{item.label}</button>
              ) : (
                <span aria-current={current ? 'page' : undefined}>{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  breadcrumbs = [],
  breadcrumbLabel,
  actions,
  metadata,
  icon,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  breadcrumbLabel?: string;
  actions?: ReactNode;
  metadata?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <header className="platform-page-header">
      {breadcrumbs.length > 0 ? <Breadcrumbs items={breadcrumbs} label={breadcrumbLabel} /> : null}
      <div className="platform-page-header__row">
        <div className="platform-page-header__identity">
          {icon ? <span className="platform-page-header__icon" aria-hidden="true">{icon}</span> : null}
          <div>
            {eyebrow ? <p className="platform-page-header__eyebrow">{eyebrow}</p> : null}
            <h1>{title}</h1>
            {subtitle ? <p className="platform-page-header__subtitle">{subtitle}</p> : null}
            {metadata ? <div className="platform-page-header__metadata">{metadata}</div> : null}
          </div>
        </div>
        {actions ? <div className="platform-page-header__actions">{actions}</div> : null}
      </div>
    </header>
  );
}
