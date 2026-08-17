import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, FilePlus2, GitBranch, Printer, ShieldCheck, Upload, Workflow } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';
import { EmptySupabaseNotice } from '../components/EmptySupabaseNotice';
import { EntityTable } from '../components/EntityTable';
import { Modal } from '../components/Modal';
import { ModuleHeader } from '../components/ModuleHeader';
import { StatusBadge } from '../components/StatusBadge';
import { EvidenceUploadForm } from '../components/WorkItemControls';
import { OvrPrintableReport } from '../components/OvrPrintableReport';
import { useAsyncData } from '../hooks/useAsyncData';
import { formatDate, humanize } from '../lib/format';
import { isEmptyLiveObject } from '../lib/liveData';
import {
  createOvrCorrectiveActionProject,
  createOvrReport,
  finalizeCorrectiveOvr,
  getDepartments,
  getEvidenceForItem,
  getOrganizations,
  getOvrReports,
  getProfiles,
  getOvrSummary,
  getOvrWorkflowControlSummary,
  getOvrWorkflowQueue,
  searchEligibleWorkParticipants,
  updateOvrWorkflow
} from '../lib/grcApi';
import { useI18n } from '../i18n/I18nContext';
import type { OvrReportRow, OvrSeverityLevel, OvrStatus, OvrWorkflowQueueRow, ProfileOption } from '../types/domain';
import {
  createScenarioLabScenario,
  V99_SCENARIO_TAG,
} from '../lib/scenarioLab';

const occurrenceCategories = [
  'medications',
  'treatment_blood',
  'dama',
  'needle_stick',
  'behavioral_patient',
  'practice_medical',
  'practice_nursing',
  'falls_injury',
  'environment',
  'miscellaneous',
  'damaged_material',
  'other'
];

const preOccurrenceFlags = ['bedridden', 'active', 'post_op_procedure', 'intra_procedure', 'alert', 'sedated', 'anesthetized', 'disoriented', 'unconscious'];
const majorLevels: Array<OvrSeverityLevel | null> = ['level_4', 'sentinel'];
type OvrDashboardFilter = 'all' | 'open' | 'quality' | 'corrective' | 'sentinel' | 'nearMiss';

export type OvrAuthoritativeStatePatch = {
  id: string;
  status: OvrStatus;
  supervisor_due_date?: string | null;
  quality_validated_at?: string | null;
  cross_department_notified_at?: string | null;
  final_verdict?: string | null;
  final_verdict_at?: string | null;
  reporter_response?: string | null;
  linked_project_id?: string | null;
  closed_at?: string | null;
  closed_by?: string | null;
  reporter_decision_required?: boolean;
  replayed?: boolean;
};

export type OvrAuthoritativePatchRecord = {
  mutation: OvrAuthoritativeStatePatch;
  baseline: Partial<Record<keyof OvrAuthoritativeStatePatch, unknown>>;
};

export type OvrPatchFetchClassification =
  | 'stale_baseline'
  | 'mutation_converged'
  | 'server_moved_beyond_patch';

const persistedOvrMutationFields: ReadonlyArray<keyof OvrAuthoritativeStatePatch> = [
  'id',
  'status',
  'supervisor_due_date',
  'quality_validated_at',
  'cross_department_notified_at',
  'final_verdict',
  'final_verdict_at',
  'reporter_response',
  'linked_project_id',
  'closed_at',
  'closed_by',
];

function isFetchedOvrConsistent(
  fetched: OvrReportRow,
  mutation: OvrAuthoritativeStatePatch,
): boolean {
  const fetchedFields = fetched as unknown as Record<string, unknown>;
  return persistedOvrMutationFields.every(field => (
    mutation[field] === undefined || fetchedFields[field] === mutation[field]
  ));
}

export function createOvrAuthoritativePatchRecord(
  current: OvrReportRow,
  mutation: OvrAuthoritativeStatePatch,
): OvrAuthoritativePatchRecord {
  const currentFields = current as unknown as Record<string, unknown>;
  const baseline: Partial<Record<keyof OvrAuthoritativeStatePatch, unknown>> = {};
  persistedOvrMutationFields.forEach(field => {
    if (mutation[field] !== undefined) baseline[field] = currentFields[field];
  });
  return { mutation, baseline };
}

export function classifyFetchedOvrAgainstPatch(
  fetched: OvrReportRow,
  record: OvrAuthoritativePatchRecord,
): OvrPatchFetchClassification {
  if (fetched.id !== record.mutation.id) return 'server_moved_beyond_patch';
  if (isFetchedOvrConsistent(fetched, record.mutation)) return 'mutation_converged';
  const fetchedFields = fetched as unknown as Record<string, unknown>;
  const remainsAtBaseline = persistedOvrMutationFields.every(field => (
    record.mutation[field] === undefined || fetchedFields[field] === record.baseline[field]
  ));
  return remainsAtBaseline ? 'stale_baseline' : 'server_moved_beyond_patch';
}

export function reconcileOvrAuthoritativeRecord(
  current: OvrReportRow,
  record: OvrAuthoritativePatchRecord,
  fetched?: OvrReportRow,
): OvrReportRow {
  if (current.id !== record.mutation.id) return current;
  if (!fetched) return { ...current, ...record.mutation } as OvrReportRow;
  if (classifyFetchedOvrAgainstPatch(fetched, record) === 'stale_baseline') {
    return { ...current, ...record.mutation } as OvrReportRow;
  }
  return fetched;
}

export function applyOvrAuthoritativePatches(
  reports: OvrReportRow[],
  patches: ReadonlyMap<string, OvrAuthoritativePatchRecord>,
): OvrReportRow[] {
  return reports.map(report => {
    const record = patches.get(report.id);
    return record ? reconcileOvrAuthoritativeRecord(report, record, report) : report;
  });
}

export function retireResolvedOvrPatches(
  patches: ReadonlyMap<string, OvrAuthoritativePatchRecord>,
  fetchedReports: OvrReportRow[],
): ReadonlyMap<string, OvrAuthoritativePatchRecord> {
  let next: Map<string, OvrAuthoritativePatchRecord> | null = null;
  const fetchedById = new Map(fetchedReports.map(report => [report.id, report]));
  patches.forEach((record, reportId) => {
    const fetched = fetchedById.get(reportId);
    if (fetched && classifyFetchedOvrAgainstPatch(fetched, record) !== 'stale_baseline') {
      next ??= new Map(patches);
      next.delete(reportId);
    }
  });
  return next ?? patches;
}

export function canCompleteManagerReview(status: OvrStatus): boolean {
  return status === 'submitted';
}

const ovrEvidenceUploadRoles: ReadonlySet<string> = new Set([
  'super_admin',
  'governance_admin',
  'compliance_officer',
]);
const ovrEvidenceUploadStatuses: ReadonlySet<OvrStatus> = new Set([
  'corrective_action_in_progress',
  'quality_final_review',
  'evidence_submitted',
  'quality_closure_review',
]);

interface OvrEvidenceUploadAccess {
  status: OvrStatus;
  evidenceRequired: boolean;
  organizationMatches: boolean;
  roles: readonly string[];
}

export function canUploadOvrEvidence({
  status,
  evidenceRequired,
  organizationMatches,
  roles,
}: OvrEvidenceUploadAccess): boolean {
  return evidenceRequired
    && organizationMatches
    && ovrEvidenceUploadStatuses.has(status)
    && roles.some(role => ovrEvidenceUploadRoles.has(role));
}

function cleanLabel(value: string) {
  return humanize(value.replaceAll('_', ' '));
}

export function nextStageHint(status: OvrStatus) {
  const order: Partial<Record<OvrStatus, number>> = {
    draft: 0,
    submitted: 1,
    manager_review: 2,
    under_supervisor_review: 2,
    quality_validation: 3,
    under_quality_review: 3,
    referred_party_response: 4,
    action_plan_required: 4,
    corrective_action_in_progress: 4,
    quality_final_review: 5,
    evidence_submitted: 5,
    quality_closure_review: 5,
    disputed: 5,
    reopened: 3,
    escalated: 3,
    rejected: 5,
    closed: 8,
    cancelled: 8
  };
  return order[status] ?? 0;
}

function WorkflowSteps({ status }: { status: OvrStatus }) {
  const { t } = useI18n();
  const current = nextStageHint(status);
  const steps = [
    ['submitted', t('ovr.stepSubmitted')],
    ['manager_review', t('ovr.stepSupervisor')],
    ['quality_validation', t('ovr.stepQuality')],
    ['referred_party_response', t('ovr.stepReferral')],
    ['quality_final_review', t('ovr.stepFinalVerdict')],
    ['closed', t('ovr.stepClosure')]
  ] as const;

  return (
    <div className="workflow-steps">
      {steps.map((step, index) => (
        <div key={step[0]} className={`workflow-step ${index + 1 <= current ? 'done' : ''} ${status === step[0] ? 'current' : ''}`}>
          <span>{index + 1}</span>
          <strong>{step[1]}</strong>
        </div>
      ))}
    </div>
  );
}

function WorkflowQueue({ rows }: { rows: OvrWorkflowQueueRow[] }) {
  const { t } = useI18n();
  return (
    <div className="panel">
      <div className="panel-header">
        <h4>{t('ovr.workflowQueue')}</h4>
        <p>{t('ovr.workflowQueueHint')}</p>
      </div>
      <EntityTable<OvrWorkflowQueueRow>
        rows={rows}
        getRowKey={row => row.id}
        columns={[
          { key: 'no', header: t('ovr.loggingNumber'), render: row => row.ovr_number || '—' },
          { key: 'title', header: t('ovr.summaryFacts'), render: row => row.title },
          { key: 'stage', header: t('ovr.workflowStage'), render: row => cleanLabel(row.workflow_stage) },
          { key: 'due', header: t('common.dueDate'), render: row => formatDate(row.due_date) },
          { key: 'risk', header: t('common.risk'), render: row => <span className={`risk-pill ${row.risk_level}`}>{t(`risk.${row.risk_level}`)}</span> },
          { key: 'overdue', header: t('ovr.overdue'), render: row => row.is_overdue ? <StatusBadge status={t('status.delayed')} /> : '—' }
        ]}
      />
    </div>
  );
}

const INITIAL_OVR_FORM_STATE = {
  logging_number: '',
  occurrence_date: '',
  occurrence_time: '',
  occurrence_location: '',
  involved_person_type: 'patient',
  person_involved_name: '',
  mrn_or_id_no: '',
  age: '',
  sex: '',
  department_id: '',
  notification_at: '',
  physical_condition: '',
  mental_condition: '',
  pre_occurrence_condition_flags: [] as string[],
  brief_description: '',
  occurrence_category: 'medications',
  severity_level: 'level_1' as OvrSeverityLevel,
  injury_type: '',
  create_linked_action_plan: true
};

export function OVR() {
  const { t, language } = useI18n();
  const auth = useAuth();
  const summary = useAsyncData(getOvrSummary, []);
  const workflowSummary = useAsyncData(getOvrWorkflowControlSummary, []);
  const workflowQueue = useAsyncData(getOvrWorkflowQueue, []);
  const reports = useAsyncData(getOvrReports, []);
  const organizations = useAsyncData(getOrganizations, []);
  const departments = useAsyncData(getDepartments, []);
  const profiles = useAsyncData(getProfiles, []);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const isSubmittingOvrRef = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<OvrReportRow | null>(null);
  const [evidenceUploadReport, setEvidenceUploadReport] = useState<OvrReportRow | null>(null);
  const [selectedDashboardReport, setSelectedDashboardReport] = useState<OvrReportRow | null>(null);
  const [correctiveProjectReport, setCorrectiveProjectReport] = useState<OvrReportRow | null>(null);
  const [correctiveProjectForm, setCorrectiveProjectForm] = useState({ owner_id: '', sponsor_id: '', start_date: '', target_end_date: '', title: '', description: '' });
  const [ownerQuery, setOwnerQuery] = useState('');
  const [sponsorQuery, setSponsorQuery] = useState('');
  const [eligibleOwners, setEligibleOwners] = useState<ProfileOption[]>([]);
  const [eligibleSponsors, setEligibleSponsors] = useState<ProfileOption[]>([]);
  const [activeFilter, setActiveFilter] = useState<OvrDashboardFilter>('all');
  const [reportSearch, setReportSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OvrStatus>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | OvrSeverityLevel>('all');
  const [workflowSaving, setWorkflowSaving] = useState(false);
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);
  const [authoritativeOvrPatches, setAuthoritativeOvrPatches] = useState<ReadonlyMap<string, OvrAuthoritativePatchRecord>>(
    () => new Map(),
  );
  const convergenceRefreshTimers = useRef<Map<string, number>>(new Map());
  const printableEvidence = useAsyncData(
    () => selectedReport ? getEvidenceForItem('ovr_report', selectedReport.id) : Promise.resolve([]),
    [selectedReport?.id],
  );
  const [workflowForm, setWorkflowForm] = useState({
    supervisor_investigation: '',
    corrective_action: '',
    quality_manager_comments: '',
    referred_department_id: '',
    referred_user_id: '',
    referred_response: '',
    final_verdict: '',
    note: '',
    confirmed_severity_level: 'level_1' as OvrSeverityLevel,
    corrective_action_due_date: ''
  });
  const [form, setForm] = useState({ ...INITIAL_OVR_FORM_STATE });

  const organizationId = organizations.data?.[0]?.id || '';
  useEffect(() => {
    if (!correctiveProjectReport) { setEligibleOwners([]); setEligibleSponsors([]); return; }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void Promise.all([
        searchEligibleWorkParticipants('ovr', correctiveProjectReport.id, 'project_owner', ownerQuery, 100),
        searchEligibleWorkParticipants('ovr', correctiveProjectReport.id, 'sponsor', sponsorQuery, 100),
      ]).then(([owners, sponsors]) => {
        if (!cancelled) { setEligibleOwners(owners); setEligibleSponsors(sponsors); }
      }).catch(error => {
        if (!cancelled) setWorkflowMessage(error instanceof Error ? error.message : t('ovr.workflowFailed'));
      });
    }, 250);
    return () => { cancelled=true; window.clearTimeout(timer); };
  }, [correctiveProjectReport, ownerQuery, sponsorQuery, t]);
  const effectiveReports = useMemo(
    () => applyOvrAuthoritativePatches(reports.data || [], authoritativeOvrPatches),
    [authoritativeOvrPatches, reports.data],
  );
  const filteredReports = useMemo(() => {
    const query = reportSearch.trim().toLowerCase();
    return effectiveReports.filter(row => {
      const matchesCard =
        activeFilter === 'all'
        || (activeFilter === 'open' && !['closed', 'cancelled', 'rejected'].includes(row.status))
        || (activeFilter === 'quality' && ['quality_validation', 'under_quality_review', 'quality_final_review', 'quality_closure_review'].includes(row.status))
        || (activeFilter === 'corrective' && ['action_plan_required', 'corrective_action_in_progress'].includes(row.status))
        || (activeFilter === 'sentinel' && row.severity_level === 'sentinel')
        || (activeFilter === 'nearMiss' && row.severity_level === 'level_1');
      const matchesStatus = statusFilter === 'all' || row.status === statusFilter;
      const matchesSeverity = severityFilter === 'all' || row.severity_level === severityFilter;
      const matchesQuery = !query || [
        row.ovr_number,
        row.logging_number,
        row.departments?.name_en,
        row.departments?.name_ar,
        row.occurrence_category,
        row.owner?.full_name_en,
        row.owner?.full_name_ar,
        row.status
      ].some(value => value?.toLowerCase().includes(query));
      return matchesCard && matchesStatus && matchesSeverity && matchesQuery;
    });
  }, [activeFilter, effectiveReports, reportSearch, severityFilter, statusFilter]);
  const isQuality = auth.roles.some(role => ['super_admin', 'governance_admin', 'compliance_officer'].includes(role.role));
  const isAuditorOnly = auth.roles.some(role => role.role === 'auditor') && !isQuality;
  const isViewerOnly = auth.roles.some(role => role.role === 'viewer')
    && !auth.roles.some(role => ['super_admin', 'governance_admin', 'compliance_officer'].includes(role.role));
  const isReadOnly = isAuditorOnly || isViewerOnly;
  const currentUserId = auth.profile?.id || '';
  const summaryData = isEmptyLiveObject(summary.data) ? null : summary.data;
  const workflowSummaryData = isEmptyLiveObject(workflowSummary.data) ? null : workflowSummary.data;

  const update = (key: keyof typeof form, value: string | boolean | string[]) => setForm(current => ({ ...current, [key]: value }));
  const updateWorkflowForm = (key: keyof typeof workflowForm, value: string) => setWorkflowForm(current => ({ ...current, [key]: value }));

  const synchronizeOpenOvr = (record: OvrAuthoritativePatchRecord, fetched?: OvrReportRow) => {
    setSelectedReport(current => current?.id === record.mutation.id
      ? reconcileOvrAuthoritativeRecord(current, record, fetched)
      : current);
    setSelectedDashboardReport(current => current?.id === record.mutation.id
      ? reconcileOvrAuthoritativeRecord(current, record, fetched)
      : current);
  };

  const recordAuthoritativeOvrPatch = (
    baseline: OvrReportRow,
    mutation: OvrAuthoritativeStatePatch,
  ): OvrAuthoritativePatchRecord => {
    const record = createOvrAuthoritativePatchRecord(baseline, mutation);
    setAuthoritativeOvrPatches(current => {
      const next = new Map(current);
      next.set(mutation.id, record);
      return next;
    });
    synchronizeOpenOvr(record);
    return record;
  };

  const scheduleConvergenceRefresh = (reportId: string) => {
    const existing = convergenceRefreshTimers.current.get(reportId);
    if (existing !== undefined) window.clearTimeout(existing);
    const timer = window.setTimeout(() => {
      convergenceRefreshTimers.current.delete(reportId);
      void reports.refresh();
    }, 2000);
    convergenceRefreshTimers.current.set(reportId, timer);
  };

  const reconcileOvrAfterMutation = async (record: OvrAuthoritativePatchRecord) => {
    await reports.refresh();
    const authoritative = (await getOvrReports()).find(report => report.id === record.mutation.id);
    synchronizeOpenOvr(record, authoritative);
    if (authoritative && classifyFetchedOvrAgainstPatch(authoritative, record) !== 'stale_baseline') {
      await reports.refresh();
    } else {
      scheduleConvergenceRefresh(record.mutation.id);
    }
  };

  useEffect(() => {
    if (!reports.data) return;
    const fetchedById = new Map(reports.data.map(report => [report.id, report]));
    const resolved = Array.from(authoritativeOvrPatches.entries()).flatMap(([reportId, record]) => {
      const fetched = fetchedById.get(reportId);
      return fetched && classifyFetchedOvrAgainstPatch(fetched, record) !== 'stale_baseline'
        ? [{ reportId, record, fetched }]
        : [];
    });
    if (!resolved.length) return;
    setSelectedReport(current => {
      const match = current && resolved.find(item => item.reportId === current.id);
      return current && match ? reconcileOvrAuthoritativeRecord(current, match.record, match.fetched) : current;
    });
    setSelectedDashboardReport(current => {
      const match = current && resolved.find(item => item.reportId === current.id);
      return current && match ? reconcileOvrAuthoritativeRecord(current, match.record, match.fetched) : current;
    });
    setAuthoritativeOvrPatches(current => retireResolvedOvrPatches(current, reports.data || []));
  }, [authoritativeOvrPatches, reports.data]);

  useEffect(() => () => {
    convergenceRefreshTimers.current.forEach(timer => window.clearTimeout(timer));
    convergenceRefreshTimers.current.clear();
  }, []);

  const openNewReportForm = () => {
    setForm({ ...INITIAL_OVR_FORM_STATE });
    setMessage(null);
    setShowForm(true);
  };

  const closeNewReportForm = () => {
    setForm({ ...INITIAL_OVR_FORM_STATE });
    setMessage(null);
    setShowForm(false);
  };

  const openReport = (row: OvrReportRow) => {
    setSelectedReport(row);
    setWorkflowMessage(null);
    setWorkflowForm({
      supervisor_investigation: row.supervisor_investigation || '',
      corrective_action: row.corrective_action || '',
      quality_manager_comments: row.quality_manager_comments || '',
      referred_department_id: row.referred_department_id || '',
      referred_user_id: row.referred_user_id || '',
      referred_response: row.referred_response || '',
      final_verdict: row.final_verdict || '',
      note: '',
      confirmed_severity_level: row.severity_level || 'level_1',
      corrective_action_due_date: ''
    });
  };

  const toggleFlag = (flag: string) => {
    setForm(current => ({
      ...current,
      pre_occurrence_condition_flags: current.pre_occurrence_condition_flags.includes(flag)
        ? current.pre_occurrence_condition_flags.filter(item => item !== flag)
        : [...current.pre_occurrence_condition_flags, flag]
    }));
  };

  const saveReport = async (status: 'draft' | 'submitted') => {
    setMessage(null);
    if (isSubmittingOvrRef.current) return;
    if (!form.brief_description.trim()) {
      setMessage(t('ovr.validationBriefRequired'));
      return;
    }
    if (!organizationId) {
      setMessage(t('ovr.noActiveOrganization'));
      return;
    }
    isSubmittingOvrRef.current = true;
    setSaving(true);
    try {
      if (form.brief_description.includes(V99_SCENARIO_TAG)) {
        await createScenarioLabScenario(
          form.severity_level === 'sentinel'
            ? 'ovr_high_severity'
            : 'ovr_same_department',
        );
        setMessage(t('ovr.submittedMessage'));
        setForm({ ...INITIAL_OVR_FORM_STATE });
        setShowForm(false);
        reports.refresh();
        summary.refresh();
        workflowSummary.refresh();
        workflowQueue.refresh();
        return;
      }
      await createOvrReport({
        organization_id: organizationId,
        logging_number: form.logging_number,
        occurrence_date: form.occurrence_date,
        occurrence_time: form.occurrence_time,
        occurrence_location: form.occurrence_location,
        involved_person_type: form.involved_person_type,
        person_involved_name: form.person_involved_name,
        mrn_or_id_no: form.mrn_or_id_no,
        age: form.age ? Number(form.age) : undefined,
        sex: form.sex,
        department_id: form.department_id,
        notification_at: form.notification_at || undefined,
        physical_condition: form.physical_condition,
        mental_condition: form.mental_condition,
        pre_occurrence_condition_flags: form.pre_occurrence_condition_flags,
        brief_description: form.brief_description,
        occurrence_category: form.occurrence_category,
        severity_level: form.severity_level,
        injury_type: form.injury_type,
        create_linked_action_plan: form.create_linked_action_plan,
        status
      });
      setMessage(status === 'submitted' ? t('ovr.submittedMessage') : t('ovr.draftMessage'));
      setForm({ ...INITIAL_OVR_FORM_STATE });
      setShowForm(false);
      reports.refresh();
      summary.refresh();
      workflowSummary.refresh();
      workflowQueue.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('ovr.saveFailed'));
    } finally {
      isSubmittingOvrRef.current = false;
      setSaving(false);
    }
  };

  const runWorkflowAction = async (nextStatus: OvrStatus) => {
    if (!selectedReport) return;
    setWorkflowMessage(null);

    if (nextStatus === 'manager_review' && !workflowForm.supervisor_investigation.trim()) {
      setWorkflowMessage(t('ovr.validationInvestigationRequired'));
      return;
    }
    if (nextStatus === 'quality_validation' && !workflowForm.quality_manager_comments.trim()) {
      setWorkflowMessage(t('ovr.validationQualityRequired'));
      return;
    }
    if (nextStatus === 'referred_party_response' && !workflowForm.referred_department_id && !workflowForm.referred_user_id) {
      setWorkflowMessage(t('ovr.validationReferralRequired'));
      return;
    }
    if (nextStatus === 'quality_final_review') {
      const referredResponseSubmission = selectedReport.status === 'referred_party_response' && !isQuality;
      if (referredResponseSubmission && !workflowForm.referred_response.trim() && !workflowForm.corrective_action.trim()) {
        setWorkflowMessage(t('ovr.validationReferredResponseRequired'));
        return;
      }
      if (!referredResponseSubmission && !workflowForm.final_verdict.trim()) {
        setWorkflowMessage(t('ovr.validationFinalVerdictRequired'));
        return;
      }
    }
    if (['disputed', 'escalated', 'rejected'].includes(nextStatus) && !workflowForm.note.trim()) {
      setWorkflowMessage(t('ovr.validationWorkflowNoteRequired'));
      return;
    }

    setWorkflowSaving(true);
    try {
      const transition = await updateOvrWorkflow({
        ovr_report_id: selectedReport.id,
        next_status: nextStatus,
        note: workflowForm.note,
        supervisor_investigation: workflowForm.supervisor_investigation,
        corrective_action: workflowForm.corrective_action,
        quality_manager_comments: workflowForm.quality_manager_comments,
        referred_department_id: workflowForm.referred_department_id,
        referred_user_id: workflowForm.referred_user_id,
        referred_response: workflowForm.referred_response,
        final_verdict: workflowForm.final_verdict,
        confirmed_severity_level: workflowForm.confirmed_severity_level,
        corrective_action_due_date: workflowForm.corrective_action_due_date || undefined
      });
      const authoritativeRecord = recordAuthoritativeOvrPatch(selectedReport, transition);
      setWorkflowMessage(t('ovr.workflowUpdated'));
      await reconcileOvrAfterMutation(authoritativeRecord);
      workflowSummary.refresh();
      workflowQueue.refresh();
      summary.refresh();
    } catch (error) {
      setWorkflowMessage(error instanceof Error ? error.message : t('ovr.workflowFailed'));
    } finally {
      setWorkflowSaving(false);
    }
  };

  const createLinkedProject = async () => {
    if (!selectedReport) return;
    setCorrectiveProjectReport(selectedReport);
    setOwnerQuery(''); setSponsorQuery('');
    setCorrectiveProjectForm({ owner_id: '', sponsor_id: '', start_date: '', target_end_date: '', title: `Corrective action for ${selectedReport.ovr_number || selectedReport.logging_number || ''}`, description: '' });
  };

  const submitLinkedProject = async () => {
    if (!correctiveProjectReport) return;
    if (!correctiveProjectForm.owner_id || !correctiveProjectForm.sponsor_id || !correctiveProjectForm.start_date || !correctiveProjectForm.target_end_date) {
      setWorkflowMessage(t('ovr.correctiveProjectRequiredFields', 'Owner, sponsor, start date, and target end date are required.'));
      return;
    }
    if (correctiveProjectForm.target_end_date < correctiveProjectForm.start_date) {
      setWorkflowMessage(t('ovr.correctiveProjectDateOrder', 'Target end date cannot precede the start date.'));
      return;
    }
    setWorkflowSaving(true);
    try {
      const reportId = correctiveProjectReport.id;
      const projectId = await createOvrCorrectiveActionProject({ ovr_report_id: reportId, ...correctiveProjectForm });
      const transition: OvrAuthoritativeStatePatch = {
        id: reportId,
        linked_project_id: projectId,
        status: 'corrective_action_in_progress',
      };
      const authoritativeRecord = recordAuthoritativeOvrPatch(correctiveProjectReport, transition);
      setWorkflowMessage(t('ovr.linkedProjectCreated'));
      setCorrectiveProjectReport(null);
      await reconcileOvrAfterMutation(authoritativeRecord);
    } catch (error) {
      setWorkflowMessage(error instanceof Error ? error.message : t('ovr.workflowFailed'));
    } finally {
      setWorkflowSaving(false);
    }
  };

  const finalizeCorrectiveClosure = async () => {
    if (!selectedReport) return;
    if (!workflowForm.final_verdict.trim() || !workflowForm.quality_manager_comments.trim()) {
      setWorkflowMessage(t('ovr.validationFinalVerdictRequired'));
      return;
    }
    setWorkflowSaving(true);
    try {
      const transition = await finalizeCorrectiveOvr({
        ovr_report_id: selectedReport.id,
        final_verdict: workflowForm.final_verdict,
        final_severity: workflowForm.confirmed_severity_level,
        closure_comment: workflowForm.quality_manager_comments,
        idempotency_key: `f1r2-close-${selectedReport.id}-${crypto.randomUUID()}`,
      });
      const authoritativeRecord = recordAuthoritativeOvrPatch(selectedReport, transition);
      setWorkflowMessage(t('ovr.workflowUpdated'));
      await reconcileOvrAfterMutation(authoritativeRecord);
      workflowSummary.refresh(); workflowQueue.refresh(); summary.refresh();
    } catch (error) {
      setWorkflowMessage(error instanceof Error ? error.message : t('ovr.workflowFailed'));
    } finally {
      setWorkflowSaving(false);
    }
  };

  const isManagerFor = (report: OvrReportRow) => auth.roles.some(role =>
    role.role === 'department_manager'
    && (
      role.scope === 'global'
      || role.departmentId === report.department_id
    )
  );

  const isReferredPartyFor = (report: OvrReportRow) => (
    report.referred_user_id === currentUserId
    || auth.roles.some(role =>
      role.role === 'department_manager'
      && (
        role.scope === 'global'
        || role.departmentId === report.referred_department_id
      )
    )
  );

  const isReporterFor = (report: OvrReportRow) => report.reported_by === currentUserId;
  const canUploadEvidenceFor = (report: OvrReportRow) => canUploadOvrEvidence({
    status: report.status,
    evidenceRequired: report.evidence_required === true,
    organizationMatches: Boolean(organizationId) && report.organization_id === organizationId,
    roles: auth.roles.map(role => role.role),
  });
  const openOvrEvidenceUpload = () => {
    if (!selectedReport || !canUploadEvidenceFor(selectedReport)) return;
    setEvidenceUploadReport(selectedReport);
    setSelectedReport(null);
  };
  const cancelOvrEvidenceUpload = () => {
    const report = evidenceUploadReport;
    setEvidenceUploadReport(null);
    if (report) setSelectedReport(report);
  };
  const completeOvrEvidenceUpload = () => {
    setEvidenceUploadReport(null);
    void Promise.all([
      reports.refresh(),
      workflowSummary.refresh(),
      workflowQueue.refresh(),
    ]);
  };
  const referredProfiles = (profiles.data || []).filter(profile =>
    !workflowForm.referred_department_id
    || profile.department_id === workflowForm.referred_department_id
  );
  const resetOvrFilters = () => {
    setActiveFilter('all');
    setReportSearch('');
    setStatusFilter('all');
    setSeverityFilter('all');
    setSelectedDashboardReport(null);
  };
  const ovrFilterLabel = t(`ovr.filter.${activeFilter}`);
  const ovrDashboardCards = summaryData ? [
    { key: 'all' as const, label: t('ovr.totalReports'), value: summaryData.total_reports, tone: 'normal' as const },
    { key: 'open' as const, label: t('ovr.openReports'), value: summaryData.open_reports, tone: 'warning' as const },
    { key: 'quality' as const, label: t('ovr.qualityReview'), value: summaryData.under_quality_review, tone: 'normal' as const },
    { key: 'corrective' as const, label: t('ovr.correctiveActions'), value: summaryData.corrective_actions_required, tone: 'warning' as const },
    { key: 'sentinel' as const, label: t('ovr.sentinelEvents'), value: summaryData.sentinel_events, tone: 'danger' as const },
    { key: 'nearMiss' as const, label: t('ovr.nearMiss'), value: summaryData.near_miss_level_1, tone: 'success' as const }
  ] : [];

  return (
    <section className="page-section">
      <EmptySupabaseNotice />
      <ModuleHeader
        eyebrow={t('ovr.eyebrow')}
        title={t('ovr.title')}
        subtitle={t('ovr.subtitle')}
        action={!isReadOnly ? (
          <div className="inline-actions">
            
            <button className="primary-button" onClick={() => (showForm ? closeNewReportForm() : openNewReportForm())}>
              <FilePlus2 size={17} />
              {showForm ? t('common.cancel', 'Cancel') : t('ovr.newReport')}
            </button>
          </div>
        ) : null}
      />

      <div className="notice-banner ovr-confidential">
        <ShieldCheck size={18} />
        <span>{t('ovr.formNotice')}</span>
      </div>

      <DataState
        loading={summary.loading}
        error={summary.error}
        empty={!summaryData}
        emptyTitle={t('ovr.summaryUnavailable')}
        emptyMessage={t('ovr.summaryUnavailableHint')}
      >
        {summaryData ? (
          <div className="stats-grid">
            {ovrDashboardCards.map(card => (
              <button
                key={card.key}
                type="button"
                className={`stat-card ${card.tone} ${activeFilter === card.key ? 'active' : ''}`}
                onClick={() => setActiveFilter(card.key)}
              >
                <div className="stat-value">{card.value}</div>
                <div className="stat-label">{card.label}</div>
              </button>
            ))}
          </div>
        ) : null}
      </DataState>

      <div className="panel">
        <div className="split-header">
          <div className="panel-header">
            <h4>{t('ovr.dashboardFilters')}</h4>
            <p>{t('ovr.dashboardFiltersHint').replace('{shown}', String(filteredReports.length)).replace('{total}', String(effectiveReports.length))}</p>
          </div>
          <button className="ghost-button" type="button" onClick={resetOvrFilters}>{t('common.resetFilters')}</button>
        </div>
        <div className="toolbar">
          <span className="status-badge status-info">{t('common.activeFilter')}: {ovrFilterLabel}</span>
          <input value={reportSearch} onChange={event => setReportSearch(event.target.value)} placeholder={t('ovr.searchPlaceholder')} />
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)}>
            <option value="all">{t('common.allStatuses')}</option>
            {Array.from(new Set(effectiveReports.map(row => row.status))).map(status => <option key={status} value={status}>{t(`status.${status}`, cleanLabel(status))}</option>)}
          </select>
          <select value={severityFilter} onChange={event => setSeverityFilter(event.target.value as typeof severityFilter)}>
            <option value="all">{t('ovr.allSeverity')}</option>
            {(['level_1', 'level_2', 'level_3', 'level_4', 'sentinel'] as OvrSeverityLevel[]).map(level => <option key={level} value={level}>{t(`ovr.severity.${level}`)}</option>)}
          </select>
        </div>
      </div>

      <DataState
        loading={workflowSummary.loading}
        error={workflowSummary.error}
        empty={!workflowSummaryData}
        emptyTitle={t('ovr.controlsUnavailable')}
        emptyMessage={t('ovr.controlsUnavailableHint')}
      >
        {workflowSummaryData ? (
          <div className="panel">
            <div className="panel-header">
              <h4>{t('ovr.controlSummary')}</h4>
              <p>{t('ovr.controlSummaryHint')}</p>
            </div>
            <div className="card-grid">
              <div className="mini-card"><span>{t('ovr.pendingSupervisor')}</span><strong>{workflowSummaryData.pending_supervisor_review}</strong></div>
              <div className="mini-card"><span>{t('ovr.pendingQuality')}</span><strong>{workflowSummaryData.pending_quality_review}</strong></div>
              <div className="mini-card"><span>{t('ovr.returned')}</span><strong>{workflowSummaryData.returned_for_clarification}</strong></div>
              <div className="mini-card"><span>{t('ovr.pendingEvidence')}</span><strong>{workflowSummaryData.pending_evidence_review}</strong></div>
              <div className="mini-card"><span>{t('ovr.majorOpen')}</span><strong>{workflowSummaryData.major_open_ovrs}</strong></div>
              <div className="mini-card"><span>{t('ovr.overdueWorkflow')}</span><strong>{workflowSummaryData.overdue_ovr_workflow_items}</strong></div>
            </div>
          </div>
        ) : null}
      </DataState>

      {showForm ? (
        <div className="panel ovr-form-panel">
          <div className="panel-header">
            <h4>{t('ovr.newReport')}</h4>
            <p>{t('ovr.workflowText')}</p>
          </div>
          {message ? <div className="notice-banner"><AlertTriangle size={16} />{message}</div> : null}
          <div className="form-grid three">
            <label>{t('ovr.loggingNumber')}<input value={form.logging_number} onChange={event => update('logging_number', event.target.value)} placeholder="QMD-001" /></label>
            <label>{t('ovr.occurrenceDate')}<input type="date" value={form.occurrence_date} onChange={event => update('occurrence_date', event.target.value)} /></label>
            <label>{t('ovr.occurrenceTime')}<input type="time" value={form.occurrence_time} onChange={event => update('occurrence_time', event.target.value)} /></label>
            <label>{t('ovr.location')}<input value={form.occurrence_location} onChange={event => update('occurrence_location', event.target.value)} /></label>
            <label>{t('ovr.involvedType')}
              <select value={form.involved_person_type} onChange={event => update('involved_person_type', event.target.value)}>
                <option value="patient">{t('ovr.patient')}</option>
                <option value="visitor">{t('ovr.visitor')}</option>
                <option value="employee">{t('ovr.employee')}</option>
                <option value="company_representative">{t('ovr.companyRepresentative')}</option>
                <option value="other">{t('ovr.category.other')}</option>
              </select>
            </label>
            <label>{t('ovr.department')}
              <select value={form.department_id} onChange={event => update('department_id', event.target.value)}>
                <option value="">—</option>
                {departments.data?.map(department => (
                  <option key={department.id} value={department.id}>{language === 'ar' && department.name_ar ? department.name_ar : department.name_en}</option>
                ))}
              </select>
            </label>
            <label>{t('ovr.personName')}<input value={form.person_involved_name} onChange={event => update('person_involved_name', event.target.value)} /></label>
            <label>{t('ovr.mrId')}<input value={form.mrn_or_id_no} onChange={event => update('mrn_or_id_no', event.target.value)} /></label>
            <label>{t('ovr.age')}<input type="number" min="0" value={form.age} onChange={event => update('age', event.target.value)} /></label>
            <label>{t('ovr.sex')}<input value={form.sex} onChange={event => update('sex', event.target.value)} /></label>
            <label>{t('ovr.notificationAt')}<input type="datetime-local" value={form.notification_at} onChange={event => update('notification_at', event.target.value)} /></label>
            <label>{t('ovr.type')}
              <select value={form.occurrence_category} onChange={event => update('occurrence_category', event.target.value)}>
                {occurrenceCategories.map(category => <option key={category} value={category}>{t(`ovr.category.${category}`, cleanLabel(category))}</option>)}
              </select>
            </label>
            <label>{t('ovr.severity')}
              <select value={form.severity_level} onChange={event => update('severity_level', event.target.value as OvrSeverityLevel)}>
                {(['level_1', 'level_2', 'level_3', 'level_4', 'sentinel'] as OvrSeverityLevel[]).map(level => <option key={level} value={level}>{t(`ovr.severity.${level}`)}</option>)}
              </select>
            </label>
            <label>{t('ovr.injury')}<input value={form.injury_type} onChange={event => update('injury_type', event.target.value)} placeholder={t('ovr.injuryPlaceholder')} /></label>
          </div>

          <div className="form-grid two">
            <label>{t('ovr.physical')}<textarea rows={3} value={form.physical_condition} onChange={event => update('physical_condition', event.target.value)} /></label>
            <label>{t('ovr.mental')}<textarea rows={3} value={form.mental_condition} onChange={event => update('mental_condition', event.target.value)} /></label>
          </div>

          <div className="checkbox-grid">
            {preOccurrenceFlags.map(flag => (
              <label key={flag} className="check-chip">
                <input type="checkbox" checked={form.pre_occurrence_condition_flags.includes(flag)} onChange={() => toggleFlag(flag)} />
                <span>{t(`ovr.condition.${flag}`, cleanLabel(flag))}</span>
              </label>
            ))}
          </div>

          <div className="form-grid two">
            <label>{t('ovr.summaryFacts')}<textarea rows={5} value={form.brief_description} onChange={event => update('brief_description', event.target.value)} /></label>
          </div>

          <label className="check-line">
            <input type="checkbox" checked={form.create_linked_action_plan} onChange={event => update('create_linked_action_plan', event.target.checked)} />
            <span>{t('ovr.createActionPlan')}</span>
          </label>

          <div className="form-actions">
            <button className="ghost-button" type="button" disabled={saving} onClick={closeNewReportForm}>{t('common.cancel', 'Cancel')}</button>
            <button className="ghost-button" type="button" disabled={saving} onClick={() => saveReport('draft')}>{t('ovr.saveDraft')}</button>
            <button className="primary-button" type="button" disabled={saving} onClick={() => saveReport('submitted')}>{saving ? t('common.saving', 'Saving…') : t('ovr.submit')}</button>
          </div>
        </div>
      ) : null}

      <DataState
        loading={workflowQueue.loading}
        error={workflowQueue.error}
        empty={!workflowQueue.data?.length}
        emptyTitle={t('ovr.workflowEmptyTitle')}
        emptyMessage={t('ovr.workflowEmptyMessage')}
      >
        <WorkflowQueue rows={workflowQueue.data || []} />
      </DataState>

      <div className="panel">
        <div className="panel-header">
          <h4>{t('ovr.reportList')}</h4>
          <p>{t('ovr.reportListHint')}</p>
        </div>
        <DataState
          loading={reports.loading}
          error={reports.error}
          empty={!filteredReports.length}
          emptyTitle={t('ovr.reportsEmptyTitle')}
          emptyMessage={
            activeFilter !== 'all' || reportSearch || statusFilter !== 'all' || severityFilter !== 'all'
              ? t('ovr.reportsNoMatch').replace('{filter}', ovrFilterLabel)
              : isReadOnly
              ? t('ovr.reportsReadonlyEmpty')
              : t('ovr.reportsCreateHint')
          }
        >
          <EntityTable<OvrReportRow>
            rows={filteredReports}
            getRowKey={row => row.id}
            columns={[
              { key: 'no', header: t('ovr.loggingNumber'), render: row => <button className="link-button" type="button" onClick={() => setSelectedDashboardReport(row)}>{row.ovr_number || row.logging_number || '—'}</button> },
              { key: 'date', header: t('ovr.occurrenceDate'), render: row => formatDate(row.occurrence_date) },
              { key: 'type', header: t('ovr.type'), render: row => t(`ovr.category.${row.occurrence_category}`, cleanLabel(row.occurrence_category)) },
              { key: 'severity', header: t('ovr.severity'), render: row => row.severity_level ? t(`ovr.severity.${row.severity_level}`) : '—' },
              { key: 'department', header: t('common.department'), render: row => language === 'ar' && row.departments?.name_ar ? row.departments.name_ar : row.departments?.name_en || '—' },
              { key: 'owner', header: t('common.owner'), render: row => language === 'ar' && row.owner?.full_name_ar ? row.owner.full_name_ar : row.owner?.full_name_en || '—' },
              { key: 'status', header: t('common.status'), render: row => <StatusBadge status={t(`status.${row.status}`, cleanLabel(row.status))} /> },
              { key: 'action', header: t('common.actions'), render: row => <button className="ghost-button small" onClick={() => openReport(row)}>{t('ovr.openWorkflow')}</button> }
            ]}
          />
        </DataState>
        {selectedDashboardReport ? (
          <div className="detail-panel">
            <div className="split-header">
              <div>
                <h4>{t('ovr.selectedDetail')}</h4>
                <p>{selectedDashboardReport.ovr_number || selectedDashboardReport.logging_number || t('ovr.record')} · {t(`status.${selectedDashboardReport.status}`, cleanLabel(selectedDashboardReport.status))}</p>
              </div>
              <button className="ghost-button small" type="button" onClick={() => setSelectedDashboardReport(null)}>{t('common.clearSelection')}</button>
            </div>
            <div className="detail-grid">
              <div><span>{t('common.department')}</span><strong>{language === 'ar' && selectedDashboardReport.departments?.name_ar ? selectedDashboardReport.departments.name_ar : selectedDashboardReport.departments?.name_en || '—'}</strong></div>
              <div><span>{t('common.owner')}</span><strong>{language === 'ar' && selectedDashboardReport.owner?.full_name_ar ? selectedDashboardReport.owner.full_name_ar : selectedDashboardReport.owner?.full_name_en || '—'}</strong></div>
              <div><span>{t('ovr.category')}</span><strong>{t(`ovr.category.${selectedDashboardReport.occurrence_category}`, cleanLabel(selectedDashboardReport.occurrence_category))}</strong></div>
              <div><span>{t('ovr.severity')}</span><strong>{selectedDashboardReport.severity_level ? t(`ovr.severity.${selectedDashboardReport.severity_level}`) : '—'}</strong></div>
              <div><span>{t('ovr.nextAction')}</span><strong>{['closed', 'cancelled', 'rejected'].includes(selectedDashboardReport.status) ? t('ovr.noDashboardAction') : t('ovr.reviewSourceWorkflow')}</strong></div>
            </div>
          </div>
        ) : null}
      </div>

      <Modal size="workspace" title={selectedReport?.ovr_number || selectedReport?.logging_number || t('ovr.detailTitle')} open={Boolean(selectedReport)} onClose={() => setSelectedReport(null)}>
        {selectedReport ? (
          <div className="ovr-detail">
            <WorkflowSteps status={selectedReport.status} />
            {workflowMessage ? <div className="notice-banner"><AlertTriangle size={16} />{workflowMessage}</div> : null}
            {majorLevels.includes(workflowForm.confirmed_severity_level) ? (
              <div className="notice-banner danger"><AlertTriangle size={16} />{t('ovr.majorEscalationNotice')}</div>
            ) : null}
            <div className="detail-grid">
              <div><span>{t('ovr.summaryFacts')}</span><strong>{selectedReport.brief_description}</strong></div>
              <div><span>{t('ovr.type')}</span><strong>{t(`ovr.category.${selectedReport.occurrence_category}`, cleanLabel(selectedReport.occurrence_category))}</strong></div>
              <div><span>{t('ovr.severity')}</span><strong>{selectedReport.severity_level ? t(`ovr.severity.${selectedReport.severity_level}`) : '—'}</strong></div>
              <div><span>{t('common.status')}</span><strong>{t(`status.${selectedReport.status}`, cleanLabel(selectedReport.status))}</strong></div>
            </div>

            <div className="form-grid two">
              {(isManagerFor(selectedReport) || isQuality) ? (
                <label>{t('ovr.supervisorInvestigation')}<textarea rows={4} value={workflowForm.supervisor_investigation} onChange={event => updateWorkflowForm('supervisor_investigation', event.target.value)} /></label>
              ) : null}
              {(isReferredPartyFor(selectedReport) || isQuality) ? (
                <label>{t('ovr.correctiveAction')}<textarea rows={4} value={workflowForm.corrective_action} onChange={event => updateWorkflowForm('corrective_action', event.target.value)} /></label>
              ) : null}
              {isQuality ? (
                <label>{t('ovr.qualityComments')}<textarea rows={4} value={workflowForm.quality_manager_comments} onChange={event => updateWorkflowForm('quality_manager_comments', event.target.value)} /></label>
              ) : null}
              {selectedReport.status === 'referred_party_response' && isReferredPartyFor(selectedReport) ? (
                <label>{t('ovr.referredResponse')}<textarea rows={4} value={workflowForm.referred_response} onChange={event => updateWorkflowForm('referred_response', event.target.value)} /></label>
              ) : null}
              {!isReadOnly ? (
                <label>{t('ovr.workflowNote')}<textarea rows={4} value={workflowForm.note} onChange={event => updateWorkflowForm('note', event.target.value)} /></label>
              ) : null}
              {isQuality ? <label>{t('ovr.confirmedSeverity')}
                <select value={workflowForm.confirmed_severity_level} onChange={event => updateWorkflowForm('confirmed_severity_level', event.target.value)}>
                  {(['level_1', 'level_2', 'level_3', 'level_4', 'sentinel'] as OvrSeverityLevel[]).map(level => <option key={level} value={level}>{t(`ovr.severity.${level}`)}</option>)}
                </select>
              </label> : null}
              {(isQuality || isReferredPartyFor(selectedReport)) ? (
                <label>{t('ovr.correctiveDueDate')}<input type="date" value={workflowForm.corrective_action_due_date} onChange={event => updateWorkflowForm('corrective_action_due_date', event.target.value)} /></label>
              ) : null}
              {isQuality ? (
                <>
                  <label>{t('ovr.referredDepartment')}
                    <select value={workflowForm.referred_department_id} onChange={event => {
                      updateWorkflowForm('referred_department_id', event.target.value);
                      updateWorkflowForm('referred_user_id', '');
                    }}>
                      <option value="">—</option>
                      {(departments.data || []).map(department => (
                        <option key={department.id} value={department.id}>{language === 'ar' && department.name_ar ? department.name_ar : department.name_en}</option>
                      ))}
                    </select>
                  </label>
                  <label>{t('ovr.referredPerson')}
                    <select value={workflowForm.referred_user_id} onChange={event => updateWorkflowForm('referred_user_id', event.target.value)}>
                      <option value="">—</option>
                      {referredProfiles.map(profile => (
                        <option key={profile.id} value={profile.id}>{language === 'ar' && profile.full_name_ar ? profile.full_name_ar : profile.full_name_en}</option>
                      ))}
                    </select>
                  </label>
                  <label className="full-width">{t('ovr.finalVerdict')}<textarea rows={4} value={workflowForm.final_verdict} onChange={event => updateWorkflowForm('final_verdict', event.target.value)} /></label>
                </>
              ) : null}
            </div>

            <div className="workflow-actions">
              <button
                className="ghost-button"
                type="button"
                disabled={printableEvidence.loading || Boolean(printableEvidence.error)}
                onClick={() => window.print()}
              >
                <Printer size={16} />{t('ovr.print.action', 'Print OVR')}
              </button>
              {canCompleteManagerReview(selectedReport.status) && (isManagerFor(selectedReport) || isQuality) ? (
                <button className="ghost-button" disabled={workflowSaving} onClick={() => runWorkflowAction('manager_review')}><Workflow size={16} />{t('ovr.completeManagerReview')}</button>
              ) : null}
              {selectedReport.status === 'manager_review' && isQuality ? (
                <button className="ghost-button" disabled={workflowSaving} onClick={() => runWorkflowAction('quality_validation')}>{t('ovr.validateByQuality')}</button>
              ) : null}
              {selectedReport.status === 'quality_validation' && isQuality ? (
                <>
                  <button className="ghost-button" disabled={workflowSaving} onClick={() => runWorkflowAction('referred_party_response')}>{t('ovr.notifyReferral')}</button>
                  <button className="ghost-button" disabled={workflowSaving} onClick={() => runWorkflowAction('quality_final_review')}>{t('ovr.issueFinalVerdict')}</button>
                </>
              ) : null}
              {selectedReport.status === 'referred_party_response' && isReferredPartyFor(selectedReport) ? (
                <button className="ghost-button" disabled={workflowSaving} onClick={() => runWorkflowAction('quality_final_review')}>{t('ovr.submitReferredResponse')}</button>
              ) : null}
              {['quality_final_review', 'reopened', 'escalated'].includes(selectedReport.status) && isQuality && !selectedReport.linked_project_id ? (
                <button className="ghost-button" disabled={workflowSaving} onClick={() => runWorkflowAction('quality_final_review')}>{t('ovr.issueFinalVerdict')}</button>
              ) : null}
              {['corrective_action_in_progress', 'reopened'].includes(selectedReport.status) && selectedReport.linked_project_id && isQuality ? (
                <button className="primary-button" disabled={workflowSaving} onClick={finalizeCorrectiveClosure}>{t('ovr.issueFinalVerdict', 'Issue final verdict')}</button>
              ) : null}
              {selectedReport.status === 'quality_final_review' && isReporterFor(selectedReport) ? (
                <>
                  <button className="primary-button" disabled={workflowSaving} onClick={() => runWorkflowAction('closed')}>{t('ovr.acceptVerdict')}</button>
                  <button className="ghost-button" disabled={workflowSaving} onClick={() => runWorkflowAction('disputed')}>{t('ovr.disputeVerdict')}</button>
                </>
              ) : null}
              {canUploadEvidenceFor(selectedReport) ? (
                <button className="ghost-button" type="button" disabled={workflowSaving} onClick={openOvrEvidenceUpload}>
                  <Upload size={16} />{t('workControl.uploadEvidence')}
                </button>
              ) : null}
              {selectedReport.status === 'disputed' && isQuality ? (
                <button className="ghost-button" disabled={workflowSaving} onClick={() => runWorkflowAction('reopened')}>{t('ovr.reopenOvr')}</button>
              ) : null}
              {!['closed', 'cancelled', 'rejected'].includes(selectedReport.status) && (isQuality || isManagerFor(selectedReport)) ? (
                <button className="ghost-button" disabled={workflowSaving} onClick={() => runWorkflowAction('escalated')}>{t('ovr.escalateOvr')}</button>
              ) : null}
              {!['closed', 'cancelled', 'rejected'].includes(selectedReport.status) && isQuality ? (
                <button className="ghost-button" disabled={workflowSaving} onClick={() => runWorkflowAction('rejected')}>{t('ovr.rejectOvr')}</button>
              ) : null}
              {(isManagerFor(selectedReport) || isQuality) ? (
                <button className="ghost-button" disabled={workflowSaving || Boolean(selectedReport.linked_project_id)} onClick={createLinkedProject}><GitBranch size={16} />{selectedReport.linked_project_id ? t('ovr.projectAlreadyLinked') : t('ovr.createLinkedProject')}</button>
              ) : null}
            </div>
            {printableEvidence.error ? (
              <div className="form-error">
                {t('ovr.print.evidenceUnavailable', 'Authorized evidence could not be loaded, so printing is temporarily unavailable.')}
              </div>
            ) : null}
            <OvrPrintableReport report={selectedReport} evidence={printableEvidence.data || []} />
          </div>
        ) : null}
      </Modal>

      <Modal size="large" title={t('ovr.createLinkedProject', 'Create corrective project')} open={Boolean(correctiveProjectReport)} onClose={() => setCorrectiveProjectReport(null)}>
        <form className="form-grid" onSubmit={event => { event.preventDefault(); void submitLinkedProject(); }}>
          <label className="field full-width"><span>{t('common.title', 'Title')}</span><input value={correctiveProjectForm.title} onChange={event => setCorrectiveProjectForm(current => ({ ...current, title: event.target.value }))} /></label>
          <label className="field full-width"><span>{t('common.description')}</span><textarea value={correctiveProjectForm.description} onChange={event => setCorrectiveProjectForm(current => ({ ...current, description: event.target.value }))} /></label>
          <label className="field"><span>{t('common.owner', 'Owner')} *</span><input value={ownerQuery} onChange={event => setOwnerQuery(event.target.value)} placeholder={t('assignment.searchPlaceholder', 'Name or Employee ID')} /><select value={correctiveProjectForm.owner_id} onChange={event => setCorrectiveProjectForm(current => ({ ...current, owner_id: event.target.value }))}><option value="">—</option>{eligibleOwners.map(profile => <option key={profile.id} value={profile.id}>{language === 'ar' && profile.full_name_ar ? profile.full_name_ar : profile.full_name_en}</option>)}</select></label>
          <label className="field"><span>{t('common.sponsor', 'Sponsor')} *</span><input value={sponsorQuery} onChange={event => setSponsorQuery(event.target.value)} placeholder={t('assignment.searchPlaceholder', 'Name or Employee ID')} /><select value={correctiveProjectForm.sponsor_id} onChange={event => setCorrectiveProjectForm(current => ({ ...current, sponsor_id: event.target.value }))}><option value="">—</option>{eligibleSponsors.map(profile => <option key={profile.id} value={profile.id}>{language === 'ar' && profile.full_name_ar ? profile.full_name_ar : profile.full_name_en}</option>)}</select></label>
          <label className="field"><span>{t('common.startDate', 'Start date')} *</span><input type="date" value={correctiveProjectForm.start_date} onChange={event => setCorrectiveProjectForm(current => ({ ...current, start_date: event.target.value }))} /></label>
          <label className="field"><span>{t('common.targetEndDate', 'Target end date')} *</span><input type="date" value={correctiveProjectForm.target_end_date} onChange={event => setCorrectiveProjectForm(current => ({ ...current, target_end_date: event.target.value }))} /></label>
          <div className="form-actions full-width"><button className="ghost-button" type="button" onClick={() => setCorrectiveProjectReport(null)}>{t('common.cancel')}</button><button className="primary-button" disabled={workflowSaving}>{workflowSaving ? t('common.saving') : t('common.create', 'Create')}</button></div>
        </form>
      </Modal>

      <Modal
        size="large"
        title={t('workControl.uploadEvidence')}
        open={Boolean(evidenceUploadReport)}
        onClose={cancelOvrEvidenceUpload}
      >
        {evidenceUploadReport ? (
          <EvidenceUploadForm
            organizationId={organizationId}
            itemType="ovr_report"
            itemId={evidenceUploadReport.id}
            onCancel={cancelOvrEvidenceUpload}
            onUploaded={completeOvrEvidenceUpload}
          />
        ) : null}
      </Modal>
    </section>
  );
}
