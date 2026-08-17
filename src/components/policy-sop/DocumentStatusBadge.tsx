import { useI18n } from '../../i18n/I18nContext';

interface DocumentStatusBadgeProps {
  status: string;
  effectiveDate?: string | null;
  className?: string;
}

export function DocumentStatusBadge({ status, effectiveDate, className = '' }: DocumentStatusBadgeProps) {
  const { t } = useI18n();

  const getStatusConfig = () => {
    switch (status?.toLowerCase()) {
      case 'draft':
        return { label: t('policy.status.draft', 'Draft'), style: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700' };
      case 'under_review':
        return { label: t('policy.status.under_review', 'Under Review'), style: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700' };
      case 'pending_approval':
        return { label: t('policy.status.pending_approval', 'Pending Approval'), style: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700' };
      case 'approved':
        return {
          label: effectiveDate ? `${t('policy.status.approved', 'Approved')} — ${t('policy.effectiveFrom', 'Effective')} ${effectiveDate}` : t('policy.status.approved', 'Approved'),
          style: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700'
        };
      case 'active':
        return { label: t('policy.status.active', 'Active / Effective'), style: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700' };
      case 'under_revision':
        return { label: t('policy.status.under_revision', 'Under Revision'), style: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700' };
      case 'superseded':
        return { label: t('policy.status.superseded', 'Superseded'), style: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700' };
      case 'retired':
        return { label: t('policy.status.retired', 'Retired'), style: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700' };
      default:
        return { label: status || 'Unknown', style: 'bg-gray-100 text-gray-800 border-gray-300' };
    }
  };

  const config = getStatusConfig();

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.style} ${className}`}>
      {config.label}
    </span>
  );
}
