import type { ReactNode } from 'react';
import {
  AlertTriangle,
  Ban,
  FileQuestion,
  FolderOpen,
  SearchX,
  WifiOff,
} from 'lucide-react';

export type SystemStateVariant = 'empty' | 'no-results' | 'error' | 'forbidden' | 'not-found' | 'network';

const ICONS = {
  empty: FolderOpen,
  'no-results': SearchX,
  error: AlertTriangle,
  forbidden: Ban,
  'not-found': FileQuestion,
  network: WifiOff,
} as const;

export function LoadingState({ label = 'Loading', rows = 4 }: { label?: string; rows?: number }) {
  return (
    <div className="platform-loading-state" role="status" aria-label={label} aria-busy="true">
      <span className="platform-loading-state__spinner" aria-hidden="true" />
      <strong>{label}</strong>
      <div className="platform-loading-state__rows" aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => <span className="platform-skeleton" key={index} />)}
      </div>
    </div>
  );
}

export function SystemState({
  variant = 'empty',
  title,
  message,
  action,
}: {
  variant?: SystemStateVariant;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  const Icon = ICONS[variant];
  return (
    <div className={`platform-system-state is-${variant}`} role={variant === 'error' || variant === 'network' ? 'alert' : 'status'}>
      <span className="platform-system-state__icon" aria-hidden="true"><Icon size={28} /></span>
      <strong>{title}</strong>
      {message ? <p>{message}</p> : null}
      {action ? <div className="platform-system-state__action">{action}</div> : null}
    </div>
  );
}
