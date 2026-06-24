import type { ReactNode } from 'react';

interface DataStateProps {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyAction?: ReactNode;
  children: ReactNode;
}

export function DataState({
  loading,
  error,
  empty,
  emptyTitle = 'No records yet',
  emptyMessage = 'Add records when you are authorized, or return after setup is complete.',
  emptyAction,
  children,
}: DataStateProps) {
  if (loading) return <div className="panel muted-panel">Loading data…</div>;
  if (error) return <div className="panel error-panel">{error}</div>;
  if (empty) {
    return (
      <div className="panel muted-panel professional-empty-state">
        <strong>{emptyTitle}</strong>
        <p>{emptyMessage}</p>
        {emptyAction ? <div className="professional-empty-state__action">{emptyAction}</div> : null}
      </div>
    );
  }
  return <>{children}</>;
}
