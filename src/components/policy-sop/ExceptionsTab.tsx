import { AlertTriangle, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { PolicySopException } from '../../lib/policySopApi';
import { useI18n } from '../../i18n/I18nContext';

interface ExceptionsTabProps {
  exceptions: PolicySopException[];
  loading?: boolean;
}

export function ExceptionsTab({ exceptions, loading = false }: ExceptionsTabProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-500" />
          {t('policy.exceptions.registerTitle', 'Policy & SOP Exceptions / Waivers Register')}
        </h4>
        <p className="text-xs text-slate-500">{t('policy.exceptions.registerSubtitle', 'Governed operational waivers with compensating controls and risk assessments.')}</p>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400">{t('policy.exceptions.loading', 'Loading exceptions...')}</div>
      ) : exceptions.length === 0 ? (
        <div className="p-8 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 text-center text-xs text-slate-500 shadow-sm">
          <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
          <p className="font-semibold text-slate-700 dark:text-slate-300">{t('policy.exceptions.emptyAll', 'No active policy exceptions')}</p>
          <p className="text-slate-400 mt-1">{t('policy.exceptions.emptyAllDesc', 'All operational units are currently complying with standard governed policies and SOPs.')}</p>
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4 w-32">{t('policy.exceptions.code', 'Exception Code')}</th>
                <th className="py-3 px-4">{t('policy.exceptions.reason', 'Justification / Reason')}</th>
                <th className="py-3 px-4 w-44">{t('policy.exceptions.validity', 'Validity Period')}</th>
                <th className="py-3 px-4 w-32">{t('common.status', 'Status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {exceptions.map(ex => (
                <tr key={ex.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">{ex.exception_code}</td>
                  <td className="py-3 px-4">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{ex.exception_reason}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{ex.scope_description}</p>
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                    {ex.effective_start_date} → {ex.effective_end_date}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                      ex.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : ex.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {ex.status}
                    </span>
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
