import type { ReactNode } from 'react';

export function ModernCard({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`modern-card ${className}`.trim()}>
      {(title || subtitle || action) && (
        <header className="modern-card__header">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action && <div className="modern-card__action">{action}</div>}
        </header>
      )}
      <div className="modern-card__body">{children}</div>
    </section>
  );
}

export function KpiTile({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'neutral' | 'good' | 'warning' | 'danger';
}) {
  return (
    <div className={`kpi-tile kpi-tile--${tone}`}>
      <div className="kpi-tile__label">{label}</div>
      <div className="kpi-tile__value">{value}</div>
      {hint && <div className="kpi-tile__hint">{hint}</div>}
    </div>
  );
}

export function StatusPill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'good' | 'warning' | 'danger';
}) {
  return <span className={`status-pill status-pill--${tone}`}>{children}</span>;
}
