import { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { useAsyncData } from '../hooks/useAsyncData';
import { DataState } from '../components/DataState';
import { StatusPill } from '../components/ModernCard';
import {
  cancelTrainingAssignment,
  completeTrainingAssignment,
  decideSopRolloutRequirements,
  getE2B2CompetencyGapsStrict,
  getE2B2SopAcknowledgmentGapsStrict,
  getE2B2SopTrainingComplianceMatrixStrict,
  getE2B2TrainingAssignmentQueueStrict,
  getTrainingPrograms,
  publishSopTrainingObligations,
  reconcileSopTrainingPopulation,
  recordCompetencyAssessment,
  recordDocumentAcknowledgment,
  reopenTrainingAssignment,
  startOwnTrainingAssignment,
  waiveTrainingAssignment,
  type CompetencyGapRow,
  type SopAcknowledgmentGapRow,
  type SopTrainingComplianceMatrixRow,
  type TrainingAssignmentQueueRow,
  type TrainingProgramRow,
  type TrainingPopulationReconciliationResult,
} from '../lib/trainingGovernanceApi';
import {
  canShowEmployeeStart,
  formatCompetencyScore,
  formatLiveMetric,
  getAssignmentRowActionEligibility,
  getTrainingCompliancePersona,
  isMyObligationsLoading,
  isReasonLengthValid,
  isRolloutRationaleValid,
  type CompetencyAssessmentResult,
  type LiveReadStatus,
} from '../lib/trainingComplianceModel';
import {
  AlertTriangle,
  Award,
  BarChart3,
  BookOpenCheck,
  ChevronRight,
  CheckCircle2,
  ClipboardCheck,
  FileBarChart,
  FileCheck2,
  Gauge,
  GraduationCap,
  History,
  LayoutDashboard,
  Library,
  ListChecks,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  UserCheck,
} from 'lucide-react';

type TabKey = 'dashboard' | 'register' | 'detail' | 'catalog' | 'my' | 'framework' | 'assessments' | 'profile' | 'reports' | 'review';
type AdminAction = 'certify' | 'competency' | 'waive' | 'cancel' | 'reopen';

interface AdminActionState {
  type: AdminAction;
  row: TrainingAssignmentQueueRow;
}

interface RolloutState {
  row: SopTrainingComplianceMatrixRow;
  retraining_required: boolean;
  reacknowledgment_required: boolean;
  competency_reassessment_required: boolean;
  rationale: string;
}

const emptySummary: SopTrainingComplianceMatrixRow = {
  sop_version_id: 'summary',
  document_id: 'summary',
  organization_id: 'summary',
  document_code: null,
  document_title: '',
  version_number: 0,
  version_label: '',
  document_status: '',
  training_required: false,
  acknowledgment_required: false,
  competency_assessment_required: false,
  target_population_count: 0,
  training_target_count: 0,
  acknowledgment_target_count: 0,
  competency_target_count: 0,
  assigned_count: 0,
  in_progress_count: 0,
  completed_count: 0,
  overdue_count: 0,
  waived_count: 0,
  cancelled_count: 0,
  acknowledged_count: 0,
  acknowledgment_gap_count: 0,
  competency_passed_count: 0,
  competency_failed_count: 0,
  competency_pending_count: 0,
  renewal_due_count: 0,
};

function localizedName(language: 'en' | 'ar', en?: string | null, ar?: string | null): string {
  return language === 'ar' ? ar || en || '-' : en || ar || '-';
}

function statusTone(status: string): 'neutral' | 'good' | 'warning' | 'danger' {
  if (status === 'completed' || status === 'passed') return 'good';
  if (status === 'overdue' || status === 'failed' || status === 'needs_retraining') return 'danger';
  if (status === 'in_progress' || status === 'pending') return 'warning';
  return 'neutral';
}

function actionErrorMessage(error: unknown, text: typeof en): string {
  const message = error instanceof Error ? error.message : String(error || '');
  if (/AUTHORIZATION_DENIED|UNAUTHORIZED|FORBIDDEN|permission/i.test(message)) {
    return text.errorAuthorizationDenied;
  }
  if (/INVALID_LIFECYCLE_STATE|INVALID_ASSIGNMENT_STATUS|CANNOT_|TRAINING_NOT_REQUIRED|COMPETENCY_NOT_REQUIRED/i.test(message)) {
    return text.errorInvalidLifecycle;
  }
  if (/NOT_FOUND|DOCUMENT_VERSION_NOT_FOUND|ASSIGNMENT_NOT_FOUND|OBJECT_NOT_FOUND/i.test(message)) {
    return text.errorObjectNotFound;
  }
  if (/E2B2_MIGRATION_208_REQUIRED|E2B3_MIGRATION_209_REQUIRED|migration 209|SCHEMA|PGRST|42703|E2B2_LIVE_READ_UNAVAILABLE/i.test(message)) {
    return text.errorSchemaMismatch;
  }
  return text.errorActionFailed;
}

function liveReadErrorMessage(error: string | null, text: typeof en): string | null {
  return error ? text.errorLiveReadUnavailable : null;
}

function sumMatrix(rows: SopTrainingComplianceMatrixRow[]): SopTrainingComplianceMatrixRow {
  return rows.reduce((acc, row) => ({
    ...acc,
    target_population_count: acc.target_population_count + row.target_population_count,
    training_target_count: acc.training_target_count + row.training_target_count,
    acknowledgment_target_count: acc.acknowledgment_target_count + row.acknowledgment_target_count,
    competency_target_count: acc.competency_target_count + row.competency_target_count,
    assigned_count: acc.assigned_count + row.assigned_count,
    in_progress_count: acc.in_progress_count + row.in_progress_count,
    completed_count: acc.completed_count + row.completed_count,
    overdue_count: acc.overdue_count + row.overdue_count,
    waived_count: acc.waived_count + row.waived_count,
    cancelled_count: acc.cancelled_count + row.cancelled_count,
    acknowledged_count: acc.acknowledged_count + row.acknowledged_count,
    acknowledgment_gap_count: acc.acknowledgment_gap_count + row.acknowledgment_gap_count,
    competency_passed_count: acc.competency_passed_count + row.competency_passed_count,
    competency_failed_count: acc.competency_failed_count + row.competency_failed_count,
    competency_pending_count: acc.competency_pending_count + row.competency_pending_count,
    renewal_due_count: acc.renewal_due_count + row.renewal_due_count,
  }), emptySummary);
}

export function TrainingGovernanceCenter() {
  const auth = useAuth();
  const { language } = useI18n();
  const text = language === 'ar' ? ar : en;
  const persona = useMemo(() => getTrainingCompliancePersona(auth.roles), [auth.roles]);
  const defaultTab: TabKey = persona.canViewGovernanceCompliance ? 'dashboard' : 'my';
  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab);
  const [search, setSearch] = useState('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [ackNotes, setAckNotes] = useState<Record<string, string>>({});
  const [adminAction, setAdminAction] = useState<AdminActionState | null>(null);
  const [reason, setReason] = useState('');
  const [evidenceId, setEvidenceId] = useState('');
  const [competencyArea, setCompetencyArea] = useState('');
  const [competencyResult, setCompetencyResult] = useState<CompetencyAssessmentResult>('passed');
  const [competencyScore, setCompetencyScore] = useState('');
  const [competencyNotes, setCompetencyNotes] = useState('');
  const [rollout, setRollout] = useState<RolloutState | null>(null);
  const [reconcileTarget, setReconcileTarget] = useState<SopTrainingComplianceMatrixRow | null>(null);
  const [reconcileConfirmed, setReconcileConfirmed] = useState(false);
  const [reconciliationResult, setReconciliationResult] = useState<TrainingPopulationReconciliationResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const assignments = useAsyncData(getE2B2TrainingAssignmentQueueStrict, []);
  const programs = useAsyncData(getTrainingPrograms, []);
  const ackGaps = useAsyncData(getE2B2SopAcknowledgmentGapsStrict, []);
  const competencyGaps = useAsyncData(getE2B2CompetencyGapsStrict, []);
  const matrix = useAsyncData(getE2B2SopTrainingComplianceMatrixStrict, []);

  const profileId = auth.profile?.id ?? null;
  const assignmentRows = assignments.data ?? [];
  const programRows = programs.data ?? [];
  const ackRows = ackGaps.data ?? [];
  const competencyRows = competencyGaps.data ?? [];
  const matrixRows = matrix.data ?? [];
  const matrixStatus: LiveReadStatus = matrix.loading ? 'loading' : matrix.error ? 'error' : 'success';
  const matrixSummary = useMemo(
    () => (matrixStatus === 'success' ? sumMatrix(matrixRows) : null),
    [matrixRows, matrixStatus],
  );
  const myObligationsLoading = isMyObligationsLoading({
    assignmentsLoading: assignments.loading,
    acknowledgmentGapsLoading: ackGaps.loading,
    competencyGapsLoading: competencyGaps.loading,
  });
  const myAssignments = profileId
    ? assignmentRows.filter((row) => row.assigned_to_user_id === profileId)
    : assignmentRows;
  const myAckRows = profileId
    ? ackRows.filter((row) => row.user_id === profileId)
    : ackRows;
  const myCompetencyRows = profileId
    ? competencyRows.filter((row) => row.user_id === profileId)
    : competencyRows;

  const copy = (enValue: string, arValue: string) => language === 'ar' ? arValue : enValue;
  const filteredAssignments = assignmentRows.filter((row) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [row.program_title, row.program_title_ar, row.assigned_user_name_en, row.assigned_user_name_ar, row.department_name_en, row.department_name_ar, row.status]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query);
  });
  const selectedAssignment = assignmentRows.find((row) => row.id === selectedAssignmentId) ?? assignmentRows[0] ?? null;
  const programById = useMemo(
    () => new Map(programRows.map((row) => [row.id, row] as const)),
    [programRows],
  );
  const selectedProgram = selectedAssignment ? programById.get(selectedAssignment.program_id) ?? null : null;
  const selectedMatrixVersion = selectedProgram?.linked_sop_id
    ? matrixRows.find((row) => row.document_id === selectedProgram.linked_sop_id) ?? null
    : null;
  const selectedSubjectId = selectedAssignment?.assigned_to_user_id ?? profileId;
  const selectedAcknowledgments = selectedSubjectId ? ackRows.filter((row) => row.user_id === selectedSubjectId) : [];
  const selectedCompetencies = selectedSubjectId ? competencyRows.filter((row) => row.user_id === selectedSubjectId) : [];
  const selectedEligibility = selectedAssignment ? getAssignmentRowActionEligibility({
    persona,
    actorUserId: profileId,
    subjectUserId: selectedAssignment.assigned_to_user_id,
    status: selectedAssignment.status,
  }) : null;
  const completionRate = matrixSummary?.training_target_count
    ? Math.round(((matrixSummary.completed_count ?? 0) / matrixSummary.training_target_count) * 100)
    : 0;
  const acknowledgmentRate = matrixSummary?.acknowledgment_target_count
    ? Math.round(((matrixSummary.acknowledged_count ?? 0) / matrixSummary.acknowledgment_target_count) * 100)
    : 0;
  const competencyRate = matrixSummary?.competency_target_count
    ? Math.round(((matrixSummary.competency_passed_count ?? 0) / matrixSummary.competency_target_count) * 100)
    : 0;
  const activeProgramCount = new Set(assignmentRows.map((row) => row.program_id)).size;
  const overdueCount = assignmentRows.filter((row) => row.status === 'overdue').length;
  const competencyAreas = Array.from(new Set(competencyRows.map((row) => row.competency_area || copy('General competency', 'الكفاءة العامة'))));
  const departmentSummary = Array.from(new Set(assignmentRows.map((row) => localizedName(language, row.department_name_en, row.department_name_ar))))
    .filter((name) => name !== '-')
    .map((name) => {
      const rows = assignmentRows.filter((row) => localizedName(language, row.department_name_en, row.department_name_ar) === name);
      return { name, total: rows.length, completed: rows.filter((row) => row.status === 'completed').length };
    });

  const refreshLiveData = async () => {
    await Promise.all([
      assignments.refresh(),
      programs.refresh(),
      ackGaps.refresh(),
      competencyGaps.refresh(),
      matrix.refresh(),
    ]);
  };

  const runAction = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    setFeedback(null);
    try {
      await action();
      setFeedback(text.actionCompleted);
      setAdminAction(null);
      setRollout(null);
      setReason('');
      setEvidenceId('');
      setCompetencyArea('');
      setCompetencyScore('');
      setCompetencyNotes('');
      await refreshLiveData();
    } catch (error) {
      setFeedback(actionErrorMessage(error, text));
    } finally {
      setBusy(null);
    }
  };

  const submitAdminAction = async () => {
    if (!adminAction) return;
    const row = adminAction.row;
    if (adminAction.type === 'certify') {
      await runAction(`certify:${row.id}`, () => completeTrainingAssignment({
        assignment_id: row.id,
        evidence_id: evidenceId.trim() || null,
      }));
      return;
    }
    if (adminAction.type === 'competency') {
      await runAction(`competency:${row.id}`, () => recordCompetencyAssessment({
        assignment_id: row.id,
        user_id: row.assigned_to_user_id || '',
        competency_area: competencyArea.trim(),
        result: competencyResult,
        score: competencyScore.trim() ? Number(competencyScore) : null,
        evidence_id: evidenceId.trim() || null,
        notes: competencyNotes.trim() || null,
      }));
      return;
    }
    if (!isReasonLengthValid(reason)) {
      setFeedback(text.reasonInvalid);
      return;
    }
    if (adminAction.type === 'waive') {
      await runAction(`waive:${row.id}`, () => waiveTrainingAssignment({ assignment_id: row.id, reason }));
    } else if (adminAction.type === 'cancel') {
      await runAction(`cancel:${row.id}`, () => cancelTrainingAssignment({ assignment_id: row.id, reason }));
    } else {
      await runAction(`reopen:${row.id}`, () => reopenTrainingAssignment({ assignment_id: row.id, reason }));
    }
  };

  const submitRollout = async () => {
    if (!rollout) return;
    if (!isRolloutRationaleValid(rollout.rationale)) {
      setFeedback(text.rationaleInvalid);
      return;
    }
    await runAction(`rollout:${rollout.row.sop_version_id}`, () => decideSopRolloutRequirements({
      version_id: rollout.row.sop_version_id,
      retraining_required: rollout.retraining_required,
      reacknowledgment_required: rollout.reacknowledgment_required,
      competency_reassessment_required: rollout.competency_reassessment_required,
      rationale: rollout.rationale,
    }));
  };

  const submitReconciliation = async () => {
    if (!reconcileTarget || !reconcileConfirmed) return;
    const key = `reconcile:${reconcileTarget.sop_version_id}`;
    setBusy(key);
    setFeedback(null);
    try {
      const result = await reconcileSopTrainingPopulation(reconcileTarget.sop_version_id);
      setReconciliationResult(result);
      setReconcileTarget(null);
      setReconcileConfirmed(false);
      setFeedback(text.reconciliationCompleted);
      await refreshLiveData();
    } catch (error) {
      setFeedback(actionErrorMessage(error, text));
    } finally {
      setBusy(null);
    }
  };

  const tabs: Array<{ id: TabKey; label: string; icon: typeof UserCheck; enabled: boolean }> = [
    { id: 'dashboard', label: copy('Dashboard', 'لوحة المعلومات'), icon: LayoutDashboard, enabled: persona.canViewGovernanceCompliance },
    { id: 'register', label: copy('Training Register', 'سجل التدريب'), icon: ListChecks, enabled: persona.canViewTeamCompliance },
    { id: 'detail', label: copy('Training Details', 'تفاصيل التدريب'), icon: BookOpenCheck, enabled: persona.canViewTeamCompliance },
    { id: 'catalog', label: copy('Learning Catalog', 'كتالوج التعلم'), icon: Library, enabled: persona.canViewGovernanceCompliance },
    { id: 'my', label: text.myObligations, icon: UserCheck, enabled: persona.canViewMyObligations },
    { id: 'framework', label: copy('Competency Framework', 'إطار الكفاءات'), icon: Target, enabled: persona.canViewTeamCompliance },
    { id: 'assessments', label: copy('Assessments', 'التقييمات'), icon: ClipboardCheck, enabled: persona.canViewTeamCompliance },
    { id: 'profile', label: copy('Competency Profile', 'ملف الكفاءة'), icon: GraduationCap, enabled: persona.canViewTeamCompliance },
    { id: 'reports', label: copy('Reports', 'التقارير'), icon: BarChart3, enabled: persona.canViewGovernanceCompliance },
    { id: 'review', label: copy('Governance Review', 'مراجعة الحوكمة'), icon: ShieldCheck, enabled: persona.canViewGovernanceCompliance },
  ];

  const openAssignment = (row: TrainingAssignmentQueueRow) => {
    setSelectedAssignmentId(row.id);
    setActiveTab('detail');
  };

  return (
    <section className="ui3-module ui5-module ui5-training" data-ui5-module="training">
      <header className="ui5-module-header">
        <div>
          <span className="ui3-eyebrow">{copy('Training & Competency', 'التدريب والكفاءة')}</span>
          <h1>{copy('Workforce readiness and governed learning', 'جاهزية القوى العاملة والتعلم المحكوم')}</h1>
          <p>{copy('Live obligations from approved policy and SOP versions, with completion, acknowledgment, competency, evidence, and renewal governed independently.', 'التزامات مباشرة من إصدارات السياسات والإجراءات المعتمدة مع حوكمة مستقلة للإكمال والإقرار والكفاءة والأدلة والتجديد.')}</p>
        </div>
        <button type="button" className="ui3-secondary-button" onClick={() => void refreshLiveData()} disabled={Boolean(busy)}>
          <RefreshCw size={15} />{copy('Refresh', 'تحديث')}
        </button>
      </header>

      <nav className="ui5-workspace-tabs" aria-label={copy('Training workspace views', 'عروض مساحة عمل التدريب')}>
        {tabs.filter((tab) => tab.enabled).map((tab) => {
          const Icon = tab.icon;
          return <button type="button" key={tab.id} aria-current={activeTab === tab.id ? 'page' : undefined} className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}><Icon size={15} />{tab.label}</button>;
        })}
      </nav>

      {feedback ? <div className="ui3-notice" role="status">{feedback}</div> : null}

      {activeTab === 'dashboard' ? <div className="ui5-screen" data-testid="ui5-training-dashboard">
        <div className="ui3-kpi-grid ui5-kpi-grid">
          <article><span>{copy('Active programs', 'البرامج النشطة')}</span><strong>{formatLiveMetric(activeProgramCount, assignments.loading ? 'loading' : assignments.error ? 'error' : 'success')}</strong><small>{copy('governed curricula', 'مناهج محكومة')}</small></article>
          <article><span>{copy('Completion rate', 'نسبة الإكمال')}</span><strong>{matrixStatus === 'success' ? `${completionRate}%` : '—'}</strong><small>{matrixSummary?.completed_count ?? 0} / {matrixSummary?.training_target_count ?? 0}</small></article>
          <article className="ui3-tone--warning"><span>{copy('Acknowledgment gaps', 'فجوات الإقرار')}</span><strong>{formatLiveMetric(matrixSummary?.acknowledgment_gap_count ?? 0, matrixStatus)}</strong><small>{acknowledgmentRate}% {copy('acknowledged', 'تم الإقرار')}</small></article>
          <article className="ui3-tone--danger"><span>{copy('Competency gaps', 'فجوات الكفاءة')}</span><strong>{formatLiveMetric(matrixSummary?.competency_failed_count ?? 0, matrixStatus)}</strong><small>{competencyRate}% {copy('passed', 'ناجح')}</small></article>
          <article className="ui3-tone--warning"><span>{copy('Overdue', 'متأخر')}</span><strong>{formatLiveMetric(overdueCount, assignments.loading ? 'loading' : assignments.error ? 'error' : 'success')}</strong><small>{copy('requires action', 'يتطلب إجراء')}</small></article>
        </div>
        <div className="ui3-dashboard-grid">
          <section className="ui3-surface">
            <div className="ui3-section-heading"><div><span>{copy('Readiness posture', 'وضع الجاهزية')}</span><h2>{copy('Compliance by department', 'الامتثال حسب الإدارة')}</h2></div><Gauge size={20} /></div>
            <div className="ui3-bar-list">{departmentSummary.slice(0, 6).map((department) => {
              const value = department.total ? Math.round((department.completed / department.total) * 100) : 0;
              return <div key={department.name}><span><strong>{department.name}</strong><small>{department.completed} / {department.total} {copy('completed', 'مكتمل')}</small></span><div><i style={{ width: `${value}%` }} /></div><b>{value}%</b></div>;
            })}</div>
          </section>
          <section className="ui3-surface">
            <div className="ui3-section-heading"><div><span>{copy('Priority queue', 'قائمة الأولويات')}</span><h2>{copy('Upcoming obligations', 'الالتزامات القادمة')}</h2></div><History size={20} /></div>
            <div className="ui3-record-list">{assignmentRows.slice(0, 5).map((row) => <button type="button" key={row.id} onClick={() => openAssignment(row)}><span><strong>{localizedName(language, row.program_title, row.program_title_ar)}</strong><small>{localizedName(language, row.assigned_user_name_en, row.assigned_user_name_ar)}</small></span><span><StatusPill tone={statusTone(row.status)}>{row.status}</StatusPill><small>{row.due_date || '—'}</small></span></button>)}</div>
          </section>
        </div>
      </div> : null}

      {activeTab === 'register' ? <div className="ui5-screen" data-testid="ui5-training-register">
        <div className="ui3-filter-bar ui5-filter-bar"><label className="ui3-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy('Search employee, program, department, or status', 'ابحث عن موظف أو برنامج أو إدارة أو حالة')} /></label><span>{filteredAssignments.length} {copy('assignments', 'تكليفاً')}</span></div>
        <section className="ui3-surface ui3-register-surface"><div className="ui5-table ui5-training-table"><div className="ui5-table-head"><span>{copy('Training assignment', 'تكليف التدريب')}</span><span>{text.employee}</span><span>{text.department}</span><span>{text.dueDate}</span><span>{text.status}</span><span /></div>{filteredAssignments.map((row) => { const program = programById.get(row.program_id); const sourceLabel = program?.linked_sop_id ? copy('SOP-linked obligation', 'التزام مرتبط بإجراء') : program?.linked_document_id ? copy('Policy-linked obligation', 'التزام مرتبط بسياسة') : row.training_type || copy('Formal learning', 'تعلم رسمي'); return <button type="button" className="ui5-table-row" key={row.id} onClick={() => openAssignment(row)}><span><strong>{localizedName(language, row.program_title, row.program_title_ar)}</strong><small>{sourceLabel}</small></span><span>{localizedName(language, row.assigned_user_name_en, row.assigned_user_name_ar)}</span><span>{localizedName(language, row.department_name_en, row.department_name_ar)}</span><span>{row.due_date || '—'}</span><span><StatusPill tone={statusTone(row.status)}>{row.status}</StatusPill></span><ChevronRight size={15} /></button>; })}</div></section>
      </div> : null}

      {activeTab === 'detail' ? <div className="ui5-screen" data-testid="ui5-training-detail">
        {selectedAssignment ? <>
          <header className="ui3-record-header"><div><span className="ui3-eyebrow">{copy('Training assignment', 'تكليف التدريب')}</span><h1>{localizedName(language, selectedAssignment.program_title, selectedAssignment.program_title_ar)}</h1><p>{localizedName(language, selectedAssignment.assigned_user_name_en, selectedAssignment.assigned_user_name_ar)} · {localizedName(language, selectedAssignment.department_name_en, selectedAssignment.department_name_ar)}</p><div className="ui3-record-tags"><StatusPill tone={statusTone(selectedAssignment.status)}>{selectedAssignment.status}</StatusPill><span>{selectedAssignment.due_date || copy('No due date', 'لا يوجد استحقاق')}</span></div></div><GraduationCap size={28} /></header>
          <div className="ui5-obligation-strip">
            <article className={selectedAssignment.status === 'completed' ? 'complete' : ''}><BookOpenCheck size={18} /><span>{copy('Training completion', 'إكمال التدريب')}</span><strong>{selectedAssignment.status}</strong><small>{selectedAssignment.completed_at || copy('Evidence pending', 'الدليل معلق')}</small></article>
            <article className={selectedAcknowledgments.length === 0 ? 'complete' : ''}><FileCheck2 size={18} /><span>{copy('Version acknowledgment', 'إقرار الإصدار')}</span><strong>{selectedAcknowledgments.length ? copy('Pending', 'معلق') : copy('Satisfied', 'مستوفى')}</strong><small>{selectedAcknowledgments[0]?.version_label || copy('No open gap', 'لا توجد فجوة')}</small></article>
            <article className={selectedCompetencies.some((row) => row.result === 'passed') ? 'complete' : ''}><Award size={18} /><span>{copy('Competency assessment', 'تقييم الكفاءة')}</span><strong>{selectedCompetencies[0]?.result || copy('Pending', 'معلق')}</strong><small>{formatCompetencyScore(selectedCompetencies[0]?.score)}</small></article>
            <article><History size={18} /><span>{copy('Expiry / retraining', 'الانتهاء / إعادة التدريب')}</span><strong>{selectedCompetencies.some((row) => row.result === 'needs_retraining') ? copy('Retraining due', 'إعادة التدريب مستحقة') : copy('Monitored', 'قيد المتابعة')}</strong><small>{selectedCompetencies[0]?.due_date || selectedAssignment.due_date || '—'}</small></article>
          </div>
          <div className="ui3-detail-layout"><main className="ui3-stack"><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{copy('Governed obligation', 'الالتزام المحكوم')}</span><h2>{copy('Learning and evidence chain', 'سلسلة التعلم والأدلة')}</h2></div><ListChecks size={20} /></div><div className="ui3-data-grid"><div><span>{copy('Program', 'البرنامج')}</span><strong>{localizedName(language, selectedAssignment.program_title, selectedAssignment.program_title_ar)}</strong></div><div><span>{copy('Governed source', 'المصدر المحكوم')}</span><strong>{selectedProgram?.linked_sop_id ? copy('SOP-linked obligation', 'التزام مرتبط بإجراء') : selectedProgram?.linked_document_id ? copy('Policy-linked obligation', 'التزام مرتبط بسياسة') : copy('Program governance', 'حوكمة البرنامج')}</strong></div><div><span>{copy('Governed source version', 'إصدار المصدر المحكوم')}</span><strong>{selectedMatrixVersion ? `${selectedMatrixVersion.document_code} / ${selectedMatrixVersion.version_label}` : copy('Retained by source workflow', 'محفوظ بسير عمل المصدر')}</strong></div><div><span>{copy('Assignment state', 'حالة التكليف')}</span><strong>{selectedAssignment.status}</strong></div><div><span>{copy('Completion evidence', 'دليل الإكمال')}</span><strong>{selectedAssignment.completion_evidence_id || copy('Not linked', 'غير مرتبط')}</strong></div><div><span>{copy('Acknowledgment gaps', 'فجوات الإقرار')}</span><strong>{selectedAcknowledgments.length}</strong></div><div><span>{copy('Competency records', 'سجلات الكفاءة')}</span><strong>{selectedCompetencies.length}</strong></div><div><span>{copy('Assignee', 'المكلف')}</span><strong>{localizedName(language, selectedAssignment.assigned_user_name_en, selectedAssignment.assigned_user_name_ar)}</strong></div></div></section></main><aside className="ui3-stack"><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{copy('Governed actions', 'الإجراءات المحكومة')}</span><h2>{copy('Assignment controls', 'ضوابط التكليف')}</h2></div><SlidersHorizontal size={20} /></div><div className="ui5-action-stack">{selectedEligibility?.canCertifyCompletion ? <button type="button" onClick={() => setAdminAction({ type: 'certify', row: selectedAssignment })}>{text.certifyCompletion}</button> : null}{selectedEligibility?.canRecordCompetency ? <button type="button" onClick={() => setAdminAction({ type: 'competency', row: selectedAssignment })}>{text.recordCompetency}</button> : null}{selectedEligibility?.canWaive ? <button type="button" onClick={() => setAdminAction({ type: 'waive', row: selectedAssignment })}>{text.waive}</button> : null}{selectedEligibility?.canCancel ? <button type="button" onClick={() => setAdminAction({ type: 'cancel', row: selectedAssignment })}>{text.cancel}</button> : null}{selectedEligibility?.canReopen ? <button type="button" onClick={() => setAdminAction({ type: 'reopen', row: selectedAssignment })}>{text.reopen}</button> : null}</div></section></aside></div>
        </> : <section className="ui3-surface"><p>{text.noTeamObligations}</p></section>}
      </div> : null}

      {activeTab === 'catalog' ? <div className="ui5-screen" data-testid="ui5-training-catalog"><section className="ui5-catalog-grid">{matrixRows.map((row) => <article key={row.sop_version_id}><div><span className="ui3-pill">{row.document_code || 'SOP'}</span><StatusPill tone={row.document_status === 'published' ? 'good' : 'neutral'}>{row.document_status}</StatusPill></div><h2>{row.document_title}</h2><p>{copy('Version', 'الإصدار')} {row.version_label}</p><dl><div><dt>{text.trainingRequired}</dt><dd>{row.training_required ? text.yes : text.no}</dd></div><div><dt>{text.acknowledgmentRequired}</dt><dd>{row.acknowledgment_required ? text.yes : text.no}</dd></div><div><dt>{text.competencyRequired}</dt><dd>{row.competency_assessment_required ? text.yes : text.no}</dd></div><div><dt>{text.targetPopulation}</dt><dd>{row.target_population_count}</dd></div></dl></article>)}</section></div> : null}

      {activeTab === 'my' ? <div className="ui5-screen" data-testid="ui5-training-my"><DataState loading={myObligationsLoading} error={liveReadErrorMessage(assignments.error || ackGaps.error || competencyGaps.error, text)} empty={myAssignments.length === 0 && myAckRows.length === 0 && myCompetencyRows.length === 0} emptyTitle={text.noMyObligations} emptyMessage={text.noMyObligations}><div className="ui3-dashboard-grid"><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{copy('Assigned learning', 'التعلم المكلف')}</span><h2>{text.myObligations}</h2></div><BookOpenCheck size={20} /></div><div className="ui3-record-list">{myAssignments.map((row) => <div className="ui5-my-row" key={row.id}><button type="button" onClick={() => openAssignment(row)}><span><strong>{localizedName(language, row.program_title, row.program_title_ar)}</strong><small>{row.due_date || '—'}</small></span><StatusPill tone={statusTone(row.status)}>{row.status}</StatusPill></button>{persona.canStartOwnTraining && canShowEmployeeStart(row.status) ? <button type="button" className="ui3-primary-button" disabled={busy === `start:${row.id}`} onClick={() => runAction(`start:${row.id}`, () => startOwnTrainingAssignment(row.id))}>{text.startTraining}</button> : null}</div>)}</div></section><section className="ui3-stack"><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{copy('Attestation', 'الإقرار')}</span><h2>{copy('SOP acknowledgments', 'إقرارات الإجراءات')}</h2></div><FileCheck2 size={20} /></div>{myAckRows.map((row) => <div className="ui5-ack-item" key={`${row.version_id}-${row.user_id}`}><strong>{row.document_code} · {localizedName(language, row.sop_title, row.sop_title_ar)}</strong><small>{row.version_label} · {row.due_date || '—'}</small><textarea rows={2} value={ackNotes[row.version_id] ?? ''} onChange={(event) => setAckNotes({ ...ackNotes, [row.version_id]: event.target.value })} placeholder={text.acknowledgmentNote} />{persona.canAcknowledgeOwnVersion && row.linked_sop_id ? <button type="button" className="ui3-primary-button" disabled={busy === `ack:${row.version_id}`} onClick={() => runAction(`ack:${row.version_id}`, () => recordDocumentAcknowledgment({ document_id: row.linked_sop_id as string, version_id: row.version_id, acknowledgment_note: ackNotes[row.version_id] ?? null }))}>{text.acknowledge}</button> : null}</div>)}</section></section></div></DataState></div> : null}

      {activeTab === 'framework' ? <div className="ui5-screen" data-testid="ui5-training-framework"><div className="ui3-dashboard-grid"><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{copy('Competency model', 'نموذج الكفاءة')}</span><h2>{copy('Clinical and operational domains', 'المجالات السريرية والتشغيلية')}</h2></div><Target size={20} /></div><div className="ui5-framework-list">{competencyAreas.map((area, index) => { const rows = competencyRows.filter((row) => (row.competency_area || copy('General competency', 'الكفاءة العامة')) === area); const passed = rows.filter((row) => row.result === 'passed').length; return <article key={area}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{area}</strong><small>{rows.length} {copy('assessments', 'تقييماً')} · {passed} {copy('passed', 'ناجح')}</small></div><div><i style={{ width: `${rows.length ? Math.round((passed / rows.length) * 100) : 0}%` }} /></div></article>; })}</div></section><aside className="ui3-stack"><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{copy('Governance feedback', 'التغذية الراجعة للحوكمة')}</span><h2>{copy('Gap signals', 'إشارات الفجوات')}</h2></div><AlertTriangle size={20} /></div><div className="ui3-stat-list"><div><span>{copy('Failed assessments', 'التقييمات الراسبة')}</span><strong>{competencyRows.filter((row) => row.result === 'failed').length}</strong></div><div><span>{copy('Retraining required', 'إعادة التدريب مطلوبة')}</span><strong>{competencyRows.filter((row) => row.result === 'needs_retraining').length}</strong></div><div><span>{copy('Renewal due', 'التجديد مستحق')}</span><strong>{matrixSummary?.renewal_due_count ?? 0}</strong></div></div></section></aside></div></div> : null}

      {activeTab === 'assessments' ? <div className="ui5-screen" data-testid="ui5-training-assessments"><section className="ui3-surface ui3-register-surface"><div className="ui5-table ui5-assessment-table"><div className="ui5-table-head"><span>{text.employee}</span><span>{text.competencyArea}</span><span>{text.result}</span><span>{text.score}</span><span>{text.sopVersion}</span><span>{text.assessor}</span></div>{competencyRows.map((row) => <button type="button" className="ui5-table-row" key={`${row.user_id}-${row.assignment_id ?? row.competency_area}`} onClick={() => { const assignment = assignmentRows.find((item) => item.id === row.assignment_id); if (assignment) openAssignment(assignment); }}><span><strong>{localizedName(language, row.user_name_en, row.user_name_ar)}</strong><small>{row.assessed_at || row.due_date || '—'}</small></span><span>{row.competency_area || text.competencyRequired}</span><span><StatusPill tone={statusTone(row.result || 'pending')}>{row.result || 'pending'}</StatusPill></span><span>{formatCompetencyScore(row.score)}</span><span>{[row.document_code, row.version_label].filter(Boolean).join(' / ') || '—'}</span><span>{localizedName(language, row.assessor_name_en, row.assessor_name_ar)}</span></button>)}</div></section></div> : null}

      {activeTab === 'profile' ? <div className="ui5-screen" data-testid="ui5-training-profile">{selectedAssignment ? <div className="ui3-detail-layout"><main className="ui3-stack"><section className="ui3-surface ui5-profile-header"><div className="ui5-avatar">{localizedName(language, selectedAssignment.assigned_user_name_en, selectedAssignment.assigned_user_name_ar).slice(0, 2).toUpperCase()}</div><div><span className="ui3-eyebrow">{copy('Competency profile', 'ملف الكفاءة')}</span><h1>{localizedName(language, selectedAssignment.assigned_user_name_en, selectedAssignment.assigned_user_name_ar)}</h1><p>{localizedName(language, selectedAssignment.department_name_en, selectedAssignment.department_name_ar)}</p></div></section><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{copy('Assessment history', 'سجل التقييم')}</span><h2>{copy('Competency outcomes', 'نتائج الكفاءة')}</h2></div><History size={20} /></div><ol className="ui3-timeline">{selectedCompetencies.map((row) => <li key={`${row.assignment_id}-${row.competency_area}`}><span /><div><strong>{row.competency_area || text.competencyRequired}</strong><p>{row.result || 'pending'} · {formatCompetencyScore(row.score)}</p><small>{row.assessed_at || row.due_date || '—'}</small></div></li>)}</ol></section></main><aside className="ui3-stack"><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{copy('Current posture', 'الوضع الحالي')}</span><h2>{copy('Readiness summary', 'ملخص الجاهزية')}</h2></div><Gauge size={20} /></div><div className="ui3-stat-list"><div><span>{copy('Assignments', 'التكليفات')}</span><strong>{assignmentRows.filter((row) => row.assigned_to_user_id === selectedSubjectId).length}</strong></div><div><span>{copy('Acknowledgment gaps', 'فجوات الإقرار')}</span><strong>{selectedAcknowledgments.length}</strong></div><div><span>{copy('Competency passed', 'الكفاءة الناجحة')}</span><strong>{selectedCompetencies.filter((row) => row.result === 'passed').length}</strong></div></div></section></aside></div> : null}</div> : null}

      {activeTab === 'reports' ? <div className="ui5-screen" data-testid="ui5-training-reports"><div className="ui3-dashboard-grid"><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{copy('Training analytics', 'تحليلات التدريب')}</span><h2>{copy('Obligation status distribution', 'توزيع حالات الالتزام')}</h2></div><FileBarChart size={20} /></div><div className="ui5-distribution">{['completed', 'in_progress', 'assigned', 'overdue', 'waived'].map((status) => { const count = assignmentRows.filter((row) => row.status === status).length; const width = assignmentRows.length ? Math.round((count / assignmentRows.length) * 100) : 0; return <div key={status}><span><strong>{status.replace('_', ' ')}</strong><b>{count}</b></span><div><i className={`ui5-status-${status}`} style={{ width: `${width}%` }} /></div></div>; })}</div></section><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{copy('Assurance', 'التأكيد')}</span><h2>{copy('Independent obligation metrics', 'مقاييس الالتزام المستقلة')}</h2></div><ShieldCheck size={20} /></div><div className="ui5-rate-grid"><article><span>{copy('Completion', 'الإكمال')}</span><strong>{completionRate}%</strong></article><article><span>{copy('Acknowledgment', 'الإقرار')}</span><strong>{acknowledgmentRate}%</strong></article><article><span>{copy('Competency', 'الكفاءة')}</span><strong>{competencyRate}%</strong></article><article><span>{copy('Renewal due', 'التجديد مستحق')}</span><strong>{matrixSummary?.renewal_due_count ?? 0}</strong></article></div></section></div></div> : null}

      {activeTab === 'review' ? <div className="ui5-screen" data-testid="ui5-training-review"><section className="ui3-surface ui3-register-surface"><div className="ui3-record-header"><div><span className="ui3-eyebrow">{copy('Governed rollout', 'النشر المحكوم')}</span><h1>{copy('SOP training obligation review', 'مراجعة التزامات تدريب الإجراءات')}</h1><p>{copy('Approve retraining, re-acknowledgment, competency reassessment, publication, and population reconciliation without merging their evidence states.', 'اعتماد إعادة التدريب وإعادة الإقرار وإعادة تقييم الكفاءة والنشر وتسوية السكان دون دمج حالات الأدلة الخاصة بها.')}</p></div><ShieldCheck size={28} /></div><div className="ui5-table ui5-governance-table"><div className="ui5-table-head"><span>{text.sopVersion}</span><span>{text.population}</span><span>{copy('Completion', 'الإكمال')}</span><span>{text.acknowledgment}</span><span>{text.competency}</span><span>{text.actions}</span></div>{matrixRows.map((row) => <div className="ui5-table-row" key={row.sop_version_id}><span><strong>{row.document_code || '—'} · {row.document_title}</strong><small>{row.version_label} · {row.document_status}</small></span><span>{row.target_population_count}</span><span>{row.completed_count}/{row.training_target_count}</span><span>{row.acknowledged_count}/{row.acknowledgment_target_count}</span><span>{row.competency_passed_count}/{row.competency_target_count}</span><span className="ui5-inline-actions">{persona.canDecideRollout ? <button type="button" title={text.rolloutDecision} onClick={() => setRollout({ row, retraining_required: row.training_required, reacknowledgment_required: row.acknowledgment_required, competency_reassessment_required: row.competency_assessment_required, rationale: '' })}><SlidersHorizontal size={15} /></button> : null}{persona.canPublishObligations ? <button type="button" title={text.publishTrainingObligations} disabled={busy === `publish:${row.sop_version_id}`} onClick={() => runAction(`publish:${row.sop_version_id}`, () => publishSopTrainingObligations(row.sop_version_id))}><RotateCcw size={15} /></button> : null}{persona.canReconcilePopulation ? <button type="button" title={text.reconcilePopulation} disabled={busy === `reconcile:${row.sop_version_id}`} onClick={() => { setReconciliationResult(null); setReconcileConfirmed(false); setReconcileTarget(row); }}><RefreshCw size={15} /></button> : null}</span></div>)}</div></section></div> : null}

      {adminAction ? <section className="ui3-surface ui5-decision-panel" data-testid="ui5-training-action"><div className="ui3-section-heading"><div><span>{copy('Controlled action', 'إجراء مضبوط')}</span><h2>{text.actionDetails}</h2></div><ClipboardCheck size={20} /></div><div className="ui5-form-grid">{adminAction.type === 'certify' ? <label>{text.evidenceId}<input value={evidenceId} onChange={(event) => setEvidenceId(event.target.value)} /></label> : null}{adminAction.type === 'competency' ? <><label>{text.competencyArea}<input value={competencyArea} onChange={(event) => setCompetencyArea(event.target.value)} /></label><label>{text.result}<select value={competencyResult} onChange={(event) => setCompetencyResult(event.target.value as CompetencyAssessmentResult)}><option value="passed">passed</option><option value="failed">failed</option><option value="needs_retraining">needs_retraining</option><option value="pending">pending</option></select></label><label>{text.score}<input type="number" value={competencyScore} onChange={(event) => setCompetencyScore(event.target.value)} /></label><label>{text.evidenceIdOptional}<input value={evidenceId} onChange={(event) => setEvidenceId(event.target.value)} /></label><label className="ui5-span-all">{text.notes}<textarea value={competencyNotes} onChange={(event) => setCompetencyNotes(event.target.value)} /></label></> : null}{['waive', 'cancel', 'reopen'].includes(adminAction.type) ? <label className="ui5-span-all">{text.reason}<textarea value={reason} onChange={(event) => setReason(event.target.value)} /></label> : null}</div><div className="ui3-form-actions"><button type="button" className="ui3-secondary-button" onClick={() => setAdminAction(null)}>{text.cancelConfirmation}</button><button type="button" className="ui3-primary-button" disabled={Boolean(busy)} onClick={submitAdminAction}>{adminAction.type === 'certify' ? text.certifyCompletion : adminAction.type === 'competency' ? text.recordCompetency : adminAction.type === 'waive' ? text.waive : adminAction.type === 'cancel' ? text.cancel : text.reopen}</button></div></section> : null}

      {rollout ? <section className="ui3-surface ui5-decision-panel" data-testid="ui5-training-rollout"><div className="ui3-section-heading"><div><span>{rollout.row.document_code}</span><h2>{text.rolloutDecision}</h2></div><SlidersHorizontal size={20} /></div><div className="ui5-check-grid"><label><input type="checkbox" checked={rollout.retraining_required} onChange={(event) => setRollout({ ...rollout, retraining_required: event.target.checked })} />{copy('Retraining required', 'إعادة التدريب مطلوبة')}</label><label><input type="checkbox" checked={rollout.reacknowledgment_required} onChange={(event) => setRollout({ ...rollout, reacknowledgment_required: event.target.checked })} />{copy('Re-acknowledgment required', 'إعادة الإقرار مطلوبة')}</label><label><input type="checkbox" checked={rollout.competency_reassessment_required} onChange={(event) => setRollout({ ...rollout, competency_reassessment_required: event.target.checked })} />{copy('Competency reassessment required', 'إعادة تقييم الكفاءة مطلوبة')}</label></div><label className="ui5-field">{text.rationale}<textarea value={rollout.rationale} onChange={(event) => setRollout({ ...rollout, rationale: event.target.value })} /></label><div className="ui3-form-actions"><button type="button" className="ui3-secondary-button" onClick={() => setRollout(null)}>{text.cancelConfirmation}</button><button type="button" className="ui3-primary-button" disabled={Boolean(busy)} onClick={submitRollout}>{text.rolloutDecision}</button></div></section> : null}

      {reconcileTarget && persona.canReconcilePopulation ? <section className="ui3-surface ui5-decision-panel" data-testid="ui5-training-reconciliation"><div className="ui3-section-heading"><div><span>{reconcileTarget.document_code} · {reconcileTarget.version_label}</span><h2>{text.reconcilePopulation}</h2></div><RefreshCw size={20} /></div><ul className="ui5-impact-list"><li>{text.reconciliationCreatesObligations}</li><li>{text.reconciliationCancelsOpenObligations}</li><li>{text.reconciliationPreservesHistory}</li></ul><label className="ui5-confirm"><input type="checkbox" checked={reconcileConfirmed} onChange={(event) => setReconcileConfirmed(event.target.checked)} />{text.confirmReconciliation}</label><div className="ui3-form-actions"><button type="button" className="ui3-secondary-button" onClick={() => { setReconcileTarget(null); setReconcileConfirmed(false); }}>{text.cancelConfirmation}</button><button type="button" className="ui3-primary-button" disabled={!reconcileConfirmed || Boolean(busy)} onClick={submitReconciliation}>{text.confirmAndReconcile}</button></div></section> : null}

      {reconciliationResult ? <section className="ui3-surface"><div className="ui3-section-heading"><div><span>{reconciliationResult.version_id}</span><h2>{text.reconciliationResults}</h2></div><CheckCircle2 size={20} /></div><div className="ui5-rate-grid"><article><span>{text.targetPopulation}</span><strong>{reconciliationResult.target_population_count}</strong></article><article><span>{text.newAssignments}</span><strong>{reconciliationResult.newly_assigned_count}</strong></article><article><span>{text.reactivatedAssignments}</span><strong>{reconciliationResult.reactivated_assignment_count}</strong></article><article><span>{text.cancelledOutOfScope}</span><strong>{reconciliationResult.cancelled_out_of_scope_count}</strong></article><article><span>{text.ackRequirementsCreated}</span><strong>{reconciliationResult.acknowledgment_requirements_created}</strong></article><article><span>{text.ackRequirementsReactivated}</span><strong>{reconciliationResult.acknowledgment_requirements_reactivated}</strong></article><article><span>{text.ackRequirementsDeactivated}</span><strong>{reconciliationResult.acknowledgment_requirements_deactivated}</strong></article></div></section> : null}
    </section>
  );
}

const en = {
  eyebrow: 'Governed Training',
  title: 'Training Governance Center',
  subtitle: 'Formal training, SOP acknowledgments, and competency assessment governance.',
  myObligations: 'My Obligations',
  myObligationsSubtitle: 'Assigned formal training, exact SOP version acknowledgments, and competency status visible to you.',
  teamCompliance: 'Team Compliance',
  teamComplianceSubtitle: 'Scoped Assignment Compliance visible through RLS and security-invoker views.',
  trainingCompliance: 'Training & Compliance',
  governanceSubtitle: 'Published SOP version requirements, target populations, and compliance status.',
  readOnly: 'Read-only governance view.',
  noMyObligations: 'No training or acknowledgment obligations are currently assigned.',
  noTeamObligations: 'No scoped team training obligations are currently visible.',
  noGovernedObligations: 'No governed SOP training obligations have been published yet.',
  obligation: 'Obligation',
  context: 'Context',
  sopVersion: 'SOP / Version',
  dueDate: 'Due Date',
  status: 'State',
  actions: 'Actions',
  assigned: 'Assigned',
  inProgress: 'In Progress',
  completed: 'Completed',
  overdue: 'Overdue',
  waived: 'Waived',
  cancelled: 'Cancelled',
  startTraining: 'Start Training',
  acknowledge: 'Acknowledge',
  attestation: 'I confirm that I have read and understood this governed SOP version.',
  acknowledgmentNote: 'Optional acknowledgment note',
  employee: 'Employee',
  department: 'Department',
  trainingAssignments: 'Training Assignments',
  sopAcknowledgmentGaps: 'SOP Acknowledgment Gaps',
  competencyGapsStatus: 'Competency Gaps / Status',
  trainingStatus: 'Training Status',
  certifyCompletion: 'Certify Completion',
  recordCompetency: 'Record Competency',
  waive: 'Waive',
  cancel: 'Cancel',
  reopen: 'Reopen',
  actionDetails: 'Action Details',
  evidenceId: 'Evidence ID',
  evidenceIdOptional: 'Evidence ID (optional)',
  competencyArea: 'Competency Area',
  result: 'Result',
  score: 'Score',
  assessor: 'Assessor',
  notes: 'Notes',
  reason: 'Reason',
  reasonInvalid: 'Reason must be 3 to 1000 characters.',
  rationale: 'Rationale',
  rationaleInvalid: 'Rationale must be 5 to 4000 characters.',
  actionCompleted: 'Action completed. Live obligations refreshed.',
  errorAuthorizationDenied: 'The backend rejected this operation for the current authenticated user.',
  errorInvalidLifecycle: 'The operation is not valid for the current lifecycle state.',
  errorObjectNotFound: 'The selected governed record could not be found.',
  errorSchemaMismatch: 'The deployed database contract does not match the E2B2 frontend contract.',
  errorActionFailed: 'The action could not be completed.',
  errorLiveReadUnavailable: 'Live training compliance data is unavailable. Ask an administrator to verify the deployment contract.',
  trainingRequired: 'Training Required',
  acknowledgmentRequired: 'Acknowledgment Required',
  competencyRequired: 'Competency Required',
  acknowledgmentGaps: 'Acknowledgment Gaps',
  competencyGaps: 'Competency Gaps',
  requirements: 'Requirements',
  population: 'Population',
  statusCounts: 'Status Counts',
  acknowledgment: 'Acknowledgment',
  competency: 'Competency',
  targetPopulation: 'Target Population',
  acknowledged: 'Acknowledged',
  gap: 'Gap',
  passed: 'Passed',
  failed: 'Failed',
  pending: 'Pending',
  renewalDue: 'Renewal Due',
  rolloutDecision: 'Rollout Decision',
  publishTrainingObligations: 'Publish Training Obligations',
  reconcilePopulation: 'Reconcile Population',
  reconciliationImpactTitle: 'Confirm the population lifecycle impact',
  reconciliationCreatesObligations: 'Newly eligible employees may receive training, competency, or acknowledgment obligations.',
  reconciliationCancelsOpenObligations: 'Open obligations for employees leaving the target scope may be cancelled.',
  reconciliationPreservesHistory: 'Historical completion and acknowledgment evidence is preserved.',
  confirmReconciliation: 'I understand these changes and explicitly confirm population reconciliation.',
  confirmAndReconcile: 'Confirm and Reconcile',
  cancelConfirmation: 'Cancel',
  reconciliationCompleted: 'Population reconciliation completed. Live compliance data refreshed.',
  reconciliationResults: 'Reconciliation Results',
  newAssignments: 'New Assignments',
  reactivatedAssignments: 'Reactivated Assignments',
  cancelledOutOfScope: 'Cancelled Out of Scope',
  ackRequirementsCreated: 'Acknowledgment Requirements Created',
  ackRequirementsReactivated: 'Acknowledgment Requirements Reactivated',
  ackRequirementsDeactivated: 'Acknowledgment Requirements Deactivated',
  yes: 'Yes',
  no: 'No',
};

const ar: typeof en = {
  eyebrow: 'التدريب المحكوم',
  title: 'مركز حوكمة التدريب',
  subtitle: 'حوكمة التدريب الرسمي وإقرارات نسخ إجراءات التشغيل وتقييم الكفاءة.',
  myObligations: 'التزاماتي',
  myObligationsSubtitle: 'التدريب الرسمي وإقرارات النسخ وحالة الكفاءة الظاهرة لك.',
  teamCompliance: 'امتثال الفريق',
  teamComplianceSubtitle: 'امتثال التعيينات ضمن النطاق الظاهر عبر سياسات RLS والعروض الآمنة.',
  trainingCompliance: 'التدريب والامتثال',
  governanceSubtitle: 'متطلبات نسخ إجراءات التشغيل المنشورة والفئات المستهدفة وحالة الامتثال.',
  readOnly: 'عرض حوكمي للقراءة فقط.',
  noMyObligations: 'لا توجد التزامات تدريب أو إقرار معينة حالياً.',
  noTeamObligations: 'لا توجد التزامات تدريب فريق ظاهرة ضمن نطاقك حالياً.',
  noGovernedObligations: 'لم يتم نشر التزامات تدريب لإجراءات تشغيل محكومة بعد.',
  obligation: 'الالتزام',
  context: 'السياق',
  sopVersion: 'الإجراء / النسخة',
  dueDate: 'تاريخ الاستحقاق',
  status: 'الحالة',
  actions: 'الإجراءات',
  assigned: 'معين',
  inProgress: 'قيد التنفيذ',
  completed: 'مكتمل',
  overdue: 'متأخر',
  waived: 'معفى',
  cancelled: 'ملغى',
  startTraining: 'بدء التدريب',
  acknowledge: 'إقرار',
  attestation: 'أؤكد أنني قرأت وفهمت هذه النسخة المحكومة من إجراء التشغيل.',
  acknowledgmentNote: 'ملاحظة إقرار اختيارية',
  employee: 'الموظف',
  department: 'القسم',
  trainingAssignments: 'تعيينات التدريب',
  sopAcknowledgmentGaps: 'فجوات إقرار إجراءات التشغيل',
  competencyGapsStatus: 'فجوات / حالة الكفاءة',
  trainingStatus: 'حالة التدريب',
  certifyCompletion: 'اعتماد الإكمال',
  recordCompetency: 'تسجيل الكفاءة',
  waive: 'إعفاء',
  cancel: 'إلغاء',
  reopen: 'إعادة فتح',
  actionDetails: 'تفاصيل الإجراء',
  evidenceId: 'معرف الدليل',
  evidenceIdOptional: 'معرف الدليل (اختياري)',
  competencyArea: 'مجال الكفاءة',
  result: 'النتيجة',
  score: 'الدرجة',
  assessor: 'المقيم',
  notes: 'ملاحظات',
  reason: 'السبب',
  reasonInvalid: 'يجب أن يكون السبب بين 3 و1000 حرف.',
  rationale: 'المبرر',
  rationaleInvalid: 'يجب أن يكون المبرر بين 5 و4000 حرف.',
  actionCompleted: 'اكتمل الإجراء وتم تحديث الالتزامات الحية.',
  errorAuthorizationDenied: 'رفض الخادم هذا الإجراء للمستخدم المصادق الحالي.',
  errorInvalidLifecycle: 'لا يمكن تنفيذ الإجراء في حالة دورة الحياة الحالية.',
  errorObjectNotFound: 'تعذر العثور على السجل المحكوم المحدد.',
  errorSchemaMismatch: 'عقد قاعدة البيانات المنشور لا يطابق عقد واجهة E2B2.',
  errorActionFailed: 'تعذر إكمال الإجراء.',
  errorLiveReadUnavailable: 'بيانات امتثال التدريب الحية غير متاحة. يرجى طلب التحقق من عقد النشر.',
  trainingRequired: 'التدريب مطلوب',
  acknowledgmentRequired: 'الإقرار مطلوب',
  competencyRequired: 'الكفاءة مطلوبة',
  acknowledgmentGaps: 'فجوات الإقرار',
  competencyGaps: 'فجوات الكفاءة',
  requirements: 'المتطلبات',
  population: 'الفئة المستهدفة',
  statusCounts: 'أعداد الحالات',
  acknowledgment: 'الإقرار',
  competency: 'الكفاءة',
  targetPopulation: 'الفئة المستهدفة',
  acknowledged: 'تم الإقرار',
  gap: 'الفجوة',
  passed: 'ناجح',
  failed: 'راسب',
  pending: 'معلق',
  renewalDue: 'مستحق التجديد',
  rolloutDecision: 'قرار النشر',
  publishTrainingObligations: 'نشر التزامات التدريب',
  reconcilePopulation: 'تسوية الفئة المستهدفة',
  reconciliationImpactTitle: 'تأكيد أثر دورة حياة الفئة المستهدفة',
  reconciliationCreatesObligations: 'قد يتلقى الموظفون المؤهلون حديثًا التزامات تدريب أو كفاءة أو إقرار.',
  reconciliationCancelsOpenObligations: 'قد تُلغى الالتزامات المفتوحة للموظفين الذين غادروا النطاق المستهدف.',
  reconciliationPreservesHistory: 'يتم الحفاظ على أدلة الإكمال والإقرار التاريخية.',
  confirmReconciliation: 'أفهم هذه التغييرات وأؤكد صراحةً تسوية الفئة المستهدفة.',
  confirmAndReconcile: 'تأكيد وتنفيذ التسوية',
  cancelConfirmation: 'إلغاء',
  reconciliationCompleted: 'اكتملت تسوية الفئة المستهدفة وتم تحديث بيانات الامتثال الحية.',
  reconciliationResults: 'نتائج التسوية',
  newAssignments: 'تعيينات جديدة',
  reactivatedAssignments: 'تعيينات أُعيد تفعيلها',
  cancelledOutOfScope: 'ملغاة لخروجها من النطاق',
  ackRequirementsCreated: 'متطلبات إقرار جديدة',
  ackRequirementsReactivated: 'متطلبات إقرار أُعيد تفعيلها',
  ackRequirementsDeactivated: 'متطلبات إقرار عُطلت',
  yes: 'نعم',
  no: 'لا',
};
