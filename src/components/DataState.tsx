import type { ReactNode } from 'react';

interface DataStateProps {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyMessage?: string;
  children: ReactNode;
}

export function DataState({ loading, error, empty, emptyMessage = 'No records found.', children }: DataStateProps) {
  if (loading) return <div className="panel muted-panel">Loading data…</div>;
  if (error) return <div className="panel error-panel">{error}</div>;
  if (empty) return <div className="panel muted-panel">{emptyMessage}</div>;
  return <>{children}</>;
}
