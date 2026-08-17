import { FileText, Download, CheckCircle, Clock } from 'lucide-react';
import { GovernedPolicyCatalogRow } from '../../lib/policySopApi';
import { DocumentStatusBadge } from './DocumentStatusBadge';
import { useI18n } from '../../i18n/I18nContext';

interface LegacyDocsTabProps {
  policies: GovernedPolicyCatalogRow[];
  onSelectPolicy: (documentId: string, versionId?: string) => void;
}

export function LegacyDocsTab({ policies, onSelectPolicy }: LegacyDocsTabProps) {
  const { t } = useI18n();

  const legacyList = policies.filter(
    p => p.content_mode === 'legacy_controlled_document' || p.transcription_status === 'pending'
  );

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <FileText size={16} className="text-indigo-600 dark:text-indigo-400" />
          {t('policy.legacy.title', 'Legacy Controlled Documents & Transcriptions')}
        </h4>
        <p className="text-xs text-slate-500">
          {t('policy.legacy.subtitle', 'Historical controlled PDF policies undergoing structured digital transcription.')}
        </p>
      </div>

      {legacyList.length === 0 ? (
        <div className="p-8 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 text-center text-xs text-slate-500 shadow-sm">
          <CheckCircle size={32} className="mx-auto text-emerald-500 mb-2" />
          <p className="font-semibold text-slate-700 dark:text-slate-300">
            {t('policy.legacy.allTranscribed', 'All institutional policies are fully transcribed')}
          </p>
          <p className="text-slate-400 mt-1">
            {t('policy.legacy.noPendingTranscriptions', 'No legacy documents pending conversion to structured governance format.')}
          </p>
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4 w-32">{t('policy.code', 'Policy Number')}</th>
                <th className="py-3 px-4">{t('policy.title', 'Document Title')}</th>
                <th className="py-3 px-4 w-36">{t('policy.legacy.transcription', 'Transcription Status')}</th>
                <th className="py-3 px-4 w-28">{t('common.status', 'Status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {legacyList.map(p => (
                <tr
                  key={p.document_id}
                  onClick={() => onSelectPolicy(p.document_id, p.version_id || undefined)}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer"
                >
                  <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">{p.document_code}</td>
                  <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">{p.document_title}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-300 px-2 py-0.5 rounded">
                      <Clock size={12} />
                      {p.transcription_status === 'pending' ? 'Transcription Pending' : 'Structured'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <DocumentStatusBadge status={p.document_status} effectiveDate={p.effective_date} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
