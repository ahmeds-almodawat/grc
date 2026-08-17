import { History, CheckCircle, Clock, FileText } from 'lucide-react';
import { DocumentStatusBadge } from './DocumentStatusBadge';
import { DocumentVersionBadge } from './DocumentVersionBadge';
import { useI18n } from '../../i18n/I18nContext';

interface VersionHistoryTimelineProps {
  versions: Array<{
    id: string;
    version_number: number;
    version_label: string;
    is_current_version: boolean;
    effective_date: string | null;
    expiry_date: string | null;
    approved_at: string | null;
    locked_at: string | null;
    prepared_by: string | null;
    revision_reason: string | null;
  }>;
  selectedVersionId: string;
  onSelectVersion: (versionId: string) => void;
}

export function VersionHistoryTimeline({
  versions,
  selectedVersionId,
  onSelectVersion
}: VersionHistoryTimelineProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <History size={16} className="text-indigo-600 dark:text-indigo-400" />
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t('policy.versionHistory.title', 'Governed Version History')}
        </h4>
        <span className="text-xs text-slate-500">({versions.length})</span>
      </div>

      <div className="relative pl-6 border-l-2 border-slate-200 dark:border-slate-800 space-y-6">
        {versions.map(ver => {
          const isSelected = ver.id === selectedVersionId;
          const status = ver.is_current_version
            ? 'active'
            : ver.approved_at
            ? 'superseded'
            : 'draft';

          return (
            <div
              key={ver.id}
              onClick={() => onSelectVersion(ver.id)}
              className={`relative cursor-pointer p-3.5 rounded-xl border transition-all duration-200 ${
                isSelected
                  ? 'border-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/30 dark:border-indigo-700 shadow-sm'
                  : 'border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              {/* Timeline Marker */}
              <div
                className={`absolute -left-[31px] top-4 w-3.5 h-3.5 rounded-full border-2 bg-white dark:bg-slate-900 ${
                  ver.is_current_version
                    ? 'border-emerald-500 bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-950'
                    : isSelected
                    ? 'border-indigo-500'
                    : 'border-slate-400'
                }`}
              />

              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <DocumentVersionBadge
                    versionLabel={ver.version_label}
                    versionNumber={ver.version_number}
                    isCurrent={ver.is_current_version}
                  />
                  <DocumentStatusBadge status={status} />
                </div>
                {ver.is_current_version && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                    {t('policy.currentPublished', 'Current Published')}
                  </span>
                )}
              </div>

              {ver.revision_reason && (
                <p className="text-xs text-slate-700 dark:text-slate-300 mb-2 italic">
                  &ldquo;{ver.revision_reason}&rdquo;
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                <div>
                  <span className="font-medium">{t('policy.effectiveInterval', 'Effective Interval')}: </span>
                  {ver.effective_date ? `${ver.effective_date} → ${ver.expiry_date || t('common.present', 'Present')}` : '—'}
                </div>
                <div>
                  <span className="font-medium">{t('policy.approvedAt', 'Approved')}: </span>
                  {ver.approved_at ? new Date(ver.approved_at).toLocaleDateString() : t('common.pending', 'Pending')}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
