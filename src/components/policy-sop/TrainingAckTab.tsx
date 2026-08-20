import { ArrowUpRight, Award, BookOpenCheck, FileCheck2, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';
import { DataState } from '../DataState';
import { StatusPill } from '../ModernCard';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useI18n } from '../../i18n/I18nContext';
import {
  getSopTrainingComplianceMatrix,
  type SopTrainingComplianceMatrixRow,
} from '../../lib/trainingGovernanceApi';
import { PAGE_LOCATION_REGISTRY, PAGE_QUERY_PARAMETER } from '../../routes/pageLocation';

const emptySummary = {
  training_target_count: 0,
  acknowledgment_target_count: 0,
  competency_target_count: 0,
  assigned_count: 0,
  in_progress_count: 0,
  completed_count: 0,
  overdue_count: 0,
  acknowledged_count: 0,
  acknowledgment_gap_count: 0,
  competency_pending_count: 0,
};

function summarize(rows: SopTrainingComplianceMatrixRow[]) {
  return rows.reduce((acc, row) => ({
    training_target_count: acc.training_target_count + row.training_target_count,
    acknowledgment_target_count: acc.acknowledgment_target_count + row.acknowledgment_target_count,
    competency_target_count: acc.competency_target_count + row.competency_target_count,
    assigned_count: acc.assigned_count + row.assigned_count,
    in_progress_count: acc.in_progress_count + row.in_progress_count,
    completed_count: acc.completed_count + row.completed_count,
    overdue_count: acc.overdue_count + row.overdue_count,
    acknowledged_count: acc.acknowledged_count + row.acknowledged_count,
    acknowledgment_gap_count: acc.acknowledgment_gap_count + row.acknowledgment_gap_count,
    competency_pending_count: acc.competency_pending_count + row.competency_pending_count,
  }), emptySummary);
}

export function TrainingAckTab() {
  const { language, t } = useI18n();
  const text = language === 'ar' ? ar : en;
  const matrix = useAsyncData(getSopTrainingComplianceMatrix, []);
  const rows = matrix.data ?? [];
  const summary = useMemo(() => summarize(rows), [rows]);
  const trainingCenterUrl = `?${PAGE_QUERY_PARAMETER}=${PAGE_LOCATION_REGISTRY.trainingGovernance}`;

  return (
    <div className="space-y-4" data-e2b2-training-tab="v_sop_training_compliance_matrix">
      <div>
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Award size={16} className="text-indigo-600 dark:text-indigo-400" />
          {t('policy.trainingTab.title', text.title)}
        </h4>
        <p className="text-xs text-slate-500">
          {t('policy.trainingTab.subtitle', text.subtitle)}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-xs text-slate-500 flex items-center gap-2"><BookOpenCheck size={14} />{text.trainingRequired}</span>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{summary.training_target_count}</div>
          <span className="text-[11px] text-slate-500 mt-0.5 inline-block">{text.assigned}: {summary.assigned_count}</span>
        </div>
        <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-xs text-slate-500 flex items-center gap-2"><FileCheck2 size={14} />{text.acknowledgmentRequired}</span>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{summary.acknowledgment_target_count}</div>
          <span className="text-[11px] text-slate-500 mt-0.5 inline-block">{text.gap}: {summary.acknowledgment_gap_count}</span>
        </div>
        <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-xs text-slate-500 flex items-center gap-2"><ShieldCheck size={14} />{text.competencyRequired}</span>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{summary.competency_target_count}</div>
          <span className="text-[11px] text-slate-500 mt-0.5 inline-block">{text.pending}: {summary.competency_pending_count}</span>
        </div>
      </div>

      <DataState
        loading={matrix.loading}
        error={matrix.error}
        empty={rows.length === 0}
        emptyTitle={text.empty}
        emptyMessage={text.empty}
      >
        <div className="table-wrap">
          <table className="entity-table">
            <thead>
              <tr>
                <th>{text.sopVersion}</th>
                <th>{text.requirements}</th>
                <th>{text.population}</th>
                <th>{text.status}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.sop_version_id}>
                  <td>
                    <strong>{row.document_code || '-'}</strong>
                    <div>{row.document_title}</div>
                    <small>{row.version_label} / {row.document_status}</small>
                  </td>
                  <td>
                    <StatusPill tone={row.training_required ? 'warning' : 'neutral'}>{text.trainingRequired}: {row.training_required ? text.yes : text.no}</StatusPill>
                    <StatusPill tone={row.acknowledgment_required ? 'warning' : 'neutral'}>{text.acknowledgmentRequired}: {row.acknowledgment_required ? text.yes : text.no}</StatusPill>
                    <StatusPill tone={row.competency_assessment_required ? 'warning' : 'neutral'}>{text.competencyRequired}: {row.competency_assessment_required ? text.yes : text.no}</StatusPill>
                  </td>
                  <td>
                    {text.targetPopulation}: {row.target_population_count}<br />
                    {text.trainingRequired}: {row.training_target_count}<br />
                    {text.acknowledgmentRequired}: {row.acknowledgment_target_count}<br />
                    {text.competencyRequired}: {row.competency_target_count}
                  </td>
                  <td>
                    {text.assigned}: {row.assigned_count}<br />
                    {text.inProgress}: {row.in_progress_count}<br />
                    {text.completed}: {row.completed_count}<br />
                    {text.overdue}: {row.overdue_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>

      <a href={trainingCenterUrl} className="btn-secondary inline-flex items-center gap-2">
        {text.openCenter}
        <ArrowUpRight size={14} />
      </a>
    </div>
  );
}

const en = {
  title: 'Policy & SOP Training & Compliance',
  subtitle: 'Live governed SOP training, acknowledgment, and competency obligations from DB208.',
  trainingRequired: 'Training Required',
  acknowledgmentRequired: 'Acknowledgment Required',
  competencyRequired: 'Competency Required',
  assigned: 'Assigned',
  inProgress: 'In Progress',
  completed: 'Completed',
  overdue: 'Overdue',
  pending: 'Pending',
  gap: 'Gap',
  sopVersion: 'SOP / Version',
  requirements: 'Requirements',
  population: 'Population',
  status: 'Status',
  targetPopulation: 'Target Population',
  yes: 'Yes',
  no: 'No',
  empty: 'No governed SOP training obligations have been published yet.',
  openCenter: 'Open Training Governance Center',
};

const ar: typeof en = {
  title: 'التدريب والامتثال للسياسات والإجراءات',
  subtitle: 'التزامات التدريب والإقرار والكفاءة الحية لإجراءات التشغيل المحكومة من DB208.',
  trainingRequired: 'التدريب مطلوب',
  acknowledgmentRequired: 'الإقرار مطلوب',
  competencyRequired: 'الكفاءة مطلوبة',
  assigned: 'معين',
  inProgress: 'قيد التنفيذ',
  completed: 'مكتمل',
  overdue: 'متأخر',
  pending: 'معلق',
  gap: 'الفجوة',
  sopVersion: 'الإجراء / النسخة',
  requirements: 'المتطلبات',
  population: 'الفئة المستهدفة',
  status: 'الحالة',
  targetPopulation: 'الفئة المستهدفة',
  yes: 'نعم',
  no: 'لا',
  empty: 'لم يتم نشر التزامات تدريب لإجراءات تشغيل محكومة بعد.',
  openCenter: 'فتح مركز حوكمة التدريب',
};
