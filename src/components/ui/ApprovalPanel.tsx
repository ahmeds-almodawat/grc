import type { ReactNode } from 'react';
import { CheckCircle2, Clock3, ShieldCheck, XCircle } from 'lucide-react';

export type ApprovalStatus = 'pending' | 'approved' | 'changes-requested' | 'rejected';

const APPROVAL_ICONS = {
  pending: Clock3,
  approved: CheckCircle2,
  'changes-requested': ShieldCheck,
  rejected: XCircle,
} as const;

export function ApprovalPanel({
  title,
  status,
  statusLabel,
  description,
  reviewers = [],
  actions,
}: {
  title: string;
  status: ApprovalStatus;
  statusLabel: string;
  description?: string;
  reviewers?: Array<{ id: string; name: string; role?: string; state?: string }>;
  actions?: ReactNode;
}) {
  const Icon = APPROVAL_ICONS[status];
  return (
    <section className={`platform-approval-panel is-${status}`}>
      <header>
        <span aria-hidden="true"><Icon size={19} /></span>
        <div><h3>{title}</h3>{description ? <p>{description}</p> : null}</div>
        <strong>{statusLabel}</strong>
      </header>
      {reviewers.length > 0 ? (
        <ul>
          {reviewers.map((reviewer) => (
            <li key={reviewer.id}>
              <span aria-hidden="true">{reviewer.name.slice(0, 2).toUpperCase()}</span>
              <div><strong>{reviewer.name}</strong>{reviewer.role ? <small>{reviewer.role}</small> : null}</div>
              {reviewer.state ? <em>{reviewer.state}</em> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {actions ? <footer>{actions}</footer> : null}
    </section>
  );
}
