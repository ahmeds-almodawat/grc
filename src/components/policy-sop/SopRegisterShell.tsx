import { Layers, Info } from 'lucide-react';
import { GovernedSopCatalogRow } from '../../lib/policySopApi';
import { DocumentStatusBadge } from './DocumentStatusBadge';
import { DocumentVersionBadge } from './DocumentVersionBadge';
import { useI18n } from '../../i18n/I18nContext';

interface SopRegisterShellProps {
  sops: GovernedSopCatalogRow[];
  loading?: boolean;
}

export function SopRegisterShell({ sops, loading = false }: SopRegisterShellProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      {/* Information Banner */}
      <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/60 dark:bg-indigo-950/30 dark:border-indigo-900/60 flex items-start gap-3">
        <Info size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-900 dark:text-indigo-200">
          <span className="font-bold">{t('sop.hubNotice.title', 'SOP Builder Architecture — Reserved for Gate v1.4-E1')}: </span>
          {t(
            'sop.hubNotice.desc',
            'Standard Operating Procedures (SOPs) share the document control, versioning, and approval engine with Policies, but use a dedicated Step Matrix Builder with SLA and Criticality controls. The active SOP Builder is activated in v1.4-E1.'
          )}
        </div>
      </div>

      {/* SOP Catalog Table */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t('sop.register.title', 'Standard Operating Procedures Register')}
            </h4>
            <p className="text-xs text-slate-500">{t('sop.register.subtitle', 'Governed institutional procedure workflows.')}</p>
          </div>
          <span className="text-xs font-medium text-slate-500">
            {sops.length} {t('sop.register.registered', 'SOPs in catalog')}
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">{t('sop.register.loading', 'Loading SOP catalog...')}</div>
        ) : sops.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            <Layers size={32} className="mx-auto text-slate-400 mb-2" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              {t('sop.register.emptyTitle', 'No SOPs currently cataloged')}
            </p>
            <p className="text-slate-400 mt-1">
              {t('sop.register.emptyDesc', 'SOP creation and step matrix workflows will be enabled in release gate v1.4-E1.')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 w-36">{t('sop.code', 'SOP Code')}</th>
                  <th className="py-3 px-4">{t('sop.title', 'Procedure Title')}</th>
                  <th className="py-3 px-4 w-40">{t('common.department', 'Department')}</th>
                  <th className="py-3 px-4 w-32">{t('common.status', 'Status')}</th>
                  <th className="py-3 px-4 w-32">{t('sop.steps', 'Step Count')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {sops.map(row => (
                  <tr key={row.document_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-semibold text-indigo-700 dark:text-indigo-400">
                      {row.document_code}
                      <div className="mt-0.5">
                        <DocumentVersionBadge versionLabel={row.version_label} isCurrent={row.is_current_version ?? false} />
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                      {row.document_title || row.version_title_en}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{row.department_name || '—'}</td>
                    <td className="py-3 px-4">
                      <DocumentStatusBadge status={row.document_status} effectiveDate={row.effective_date} />
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{row.step_count} {t('sop.register.stepsLabel', 'steps')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
