import { Award, Info, ArrowUpRight } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

export function TrainingAckTab() {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Award size={16} className="text-indigo-600 dark:text-indigo-400" />
          {t('policy.trainingTab.title', 'Policy & SOP Training & Acknowledgments')}
        </h4>
        <p className="text-xs text-slate-500">
          {t('policy.trainingTab.subtitle', 'Mandatory staff policy attestations, annual refreshers, and competency tracking.')}
        </p>
      </div>

      <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/60 dark:bg-indigo-950/30 dark:border-indigo-900/60 flex items-start gap-3">
        <Info size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-900 dark:text-indigo-200 space-y-1">
          <p className="font-bold">{t('policy.trainingTab.noticeTitle', 'Training Governance Integration — Active in Gate v1.4-E2')}</p>
          <p>
            {t(
              'policy.trainingTab.noticeDesc',
              'Governed policies and SOPs configure acknowledgment requirements here. Automated employee curriculum assignment, completion tracking, and reminder workflows are orchestrated in the Training Governance Center.'
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-xs text-slate-500">{t('policy.training.activeCurricula', 'Active Policy Curricula')}</span>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">12</div>
          <span className="text-[11px] text-emerald-600 font-medium mt-0.5 inline-block">100% compliant</span>
        </div>
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-xs text-slate-500">{t('policy.training.pendingAttestations', 'Pending Attestations')}</span>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">0</div>
          <span className="text-[11px] text-slate-400 mt-0.5 inline-block">Within 30-day SLA</span>
        </div>
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-xs text-slate-500">{t('policy.training.avgCompletion', 'Average Attestation Time')}</span>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">4.2 days</div>
          <span className="text-[11px] text-slate-400 mt-0.5 inline-block">Target &lt; 14 days</span>
        </div>
      </div>
    </div>
  );
}
