import type { ReactNode } from 'react';

export function ModernShell({
  title,
  subtitle,
  eyebrow,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="modern-page">
      <section className="modern-hero">
        <div>
          {eyebrow && <div className="modern-hero__eyebrow">{eyebrow}</div>}
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions && <div className="modern-hero__actions">{actions}</div>}
      </section>
      {children}
    </main>
  );
}
