import type { ReactNode } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { LoadingState, SystemState } from './ui/SystemState';

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
  if (loading) return <LoadingState label={t('dataState.loading', 'Loading data')} />;
  if (error) return <SystemState variant="error" title={t('dataState.errorTitle', 'Something went wrong')} message={error} />;
  if (empty) {
    return (
      <SystemState
        variant="empty"
        title={emptyTitle ?? t('dataState.emptyTitle')}
        message={emptyMessage ?? t('dataState.emptyMessage')}
        action={emptyAction}
      />
    );
  }
  return <>{children}</>;
}
