import type { ReactNode } from 'react';
import { useI18n } from '../i18n/I18nContext';

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
  emptyTitle,
  emptyMessage,
  emptyAction,
  children,
}: DataStateProps) {
  const { t } = useI18n();
  if (loading) return <div className="panel muted-panel">{t('dataState.loading')}</div>;
  if (error) return <div className="panel error-panel">{error}</div>;
  if (empty) {
    return (
      <div className="panel muted-panel professional-empty-state">
        <strong>{emptyTitle ?? t('dataState.emptyTitle')}</strong>
        <p>{emptyMessage ?? t('dataState.emptyMessage')}</p>
        {emptyAction ? <div className="professional-empty-state__action">{emptyAction}</div> : null}
      </div>
    );
  }
  return <>{children}</>;
}
