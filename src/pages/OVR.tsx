import { useMemo, useState } from 'react';
import { AlertTriangle, FilePlus2, GitBranch, ShieldCheck, Workflow } from 'lucide-react';
import { DataState } from '../components/DataState';
import { EmptySupabaseNotice } from '../components/EmptySupabaseNotice';
import { EntityTable } from '../components/EntityTable';
import { Modal } from '../components/Modal';
import { ModuleHeader } from '../components/ModuleHeader';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { useAsyncData } from '../hooks/useAsyncData';
import { formatDate, humanize } from '../lib/format';
import {
  createOvrCorrectiveActionProject,
  createOvrReport,
  getDepartments,
  getOrganizations,
  getOvrReports,
  getOvrSummary,
  getOvrWorkflowControlSummary,
  getOvrWorkflowQueue,
  updateOvrWorkflow
} from '../lib/grcApi';
import { useI18n } from '../i18n/I18nContext';
import type { OvrReportRow, OvrSeverityLevel, OvrStatus, OvrWorkflowQueueRow } from '../types/domain';

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

function cleanLabel(value: string) {
  return humanize(value.replaceAll('_', ' '));
}

function nextStageHint(status: OvrStatus) {
  const order: Record<OvrStatus, number> = {
    draft: 0,
    submitted: 1,
    under_supervisor_review: 2,
    under_quality_review: 3,
    returned_for_clarification: 3,
    action_plan_required: 4,
    corrective_action_in_progress: 5,
    evidence_submitted: 6,
    quality_closure_review: 7,
    rejected: 7,
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
    ['under_supervisor_review', t('ovr.stepSupervisor')],
    ['under_quality_review', t('ovr.stepQuality')],
    ['action_plan_required', t('ovr.stepActionPlan')],
    ['evidence_submitted', t('ovr.stepEvidence')],
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

export function OVR() {
  const { t, language } = useI18n();
  const summary = useAsyncData(getOvrSummary, []);
  const workflowSummary = useAsyncData(getOvrWorkflowControlSummary, []);
  const workflowQueue = useAsyncData(getOvrWorkflowQueue, []);
  const reports = useAsyncData(getOvrReports, []);
  const organizations = useAsyncData(getOrganizations, []);
  const departments = useAsyncData(getDepartments, []);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<OvrReportRow | null>(null);
  const [workflowSaving, setWorkflowSaving] = useState(false);
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);
  const [workflowForm, setWorkflowForm] = useState({
    supervisor_investigation: '',
    corrective_action: '',
    quality_manager_comments: '',
    note: '',
    confirmed_severity_level: 'level_1' as OvrSeverityLevel,
    corrective_action_due_date: ''
  });
  const [form, setForm] = useState({
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
    supervisor_investigation: '',
    corrective_action: '',
    quality_manager_comments: '',
    referred_to_person: '',
    referred_to_department: '',
    create_linked_action_plan: true
  });

  const organizationId = organizations.data?.[0]?.id || 'demo-org';
  const filteredReports = useMemo(() => reports.data || [], [reports.data]);

  const update = (key: keyof typeof form, value: string | boolean | string[]) => setForm(current => ({ ...current, [key]: value }));
  const updateWorkflowForm = (key: keyof typeof workflowForm, value: string) => setWorkflowForm(current => ({ ...current, [key]: value }));

  const openReport = (row: OvrReportRow) => {
    setSelectedReport(row);
    setWorkflowMessage(null);
    setWorkflowForm({
      supervisor_investigation: row.supervisor_investigation || '',
      corrective_action: row.corrective_action || '',
      quality_manager_comments: row.quality_manager_comments || '',
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
    if (!form.brief_description.trim()) {
      setMessage(t('ovr.validationBriefRequired'));
      return;
    }
    setSaving(true);
    try {
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
        notification_at: form.notification_at ? new Date(form.notification_at).toISOString() : undefined,
        physical_condition: form.physical_condition,
        mental_condition: form.mental_condition,
        pre_occurrence_condition_flags: form.pre_occurrence_condition_flags,
        brief_description: form.brief_description,
        occurrence_category: form.occurrence_category,
        severity_level: form.severity_level,
        injury_type: form.injury_type,
        supervisor_investigation: form.supervisor_investigation,
        corrective_action: form.corrective_action,
        quality_manager_comments: form.quality_manager_comments,
        referred_to_person: form.referred_to_person,
        referred_to_department: form.referred_to_department,
        create_linked_action_plan: form.create_linked_action_plan,
        status
      });
      setMessage(status === 'submitted' ? t('ovr.submittedMessage') : t('ovr.draftMessage'));
      setShowForm(false);
      reports.refresh();
      summary.refresh();
      workflowSummary.refresh();
      workflowQueue.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('ovr.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const runWorkflowAction = async (nextStatus: OvrStatus) => {
    if (!selectedReport) return;
    setWorkflowMessage(null);

    if (nextStatus === 'under_quality_review' && !workflowForm.supervisor_investigation.trim()) {
      setWorkflowMessage(t('ovr.validationInvestigationRequired'));
      return;
    }
    if ((nextStatus === 'action_plan_required' || nextStatus === 'corrective_action_in_progress') && !workflowForm.corrective_action.trim()) {
      setWorkflowMessage(t('ovr.validationCorrectiveRequired'));
      return;
    }
    if (nextStatus === 'returned_for_clarification' && !workflowForm.note.trim()) {
      setWorkflowMessage(t('ovr.validationReturnNoteRequired'));
      return;
    }
    if (nextStatus === 'closed' && !workflowForm.quality_manager_comments.trim()) {
      setWorkflowMessage(t('ovr.validationQualityClosureRequired'));
      return;
    }

    setWorkflowSaving(true);
    try {
      await updateOvrWorkflow({
        ovr_report_id: selectedReport.id,
        next_status: nextStatus,
        note: workflowForm.note,
        supervisor_investigation: workflowForm.supervisor_investigation,
        corrective_action: workflowForm.corrective_action,
        quality_manager_comments: workflowForm.quality_manager_comments,
        confirmed_severity_level: workflowForm.confirmed_severity_level,
        corrective_action_due_date: workflowForm.corrective_action_due_date || undefined
      });
      setWorkflowMessage(t('ovr.workflowUpdated'));
      await reports.refresh();
      workflowSummary.refresh();
      workflowQueue.refresh();
      summary.refresh();
      setSelectedReport(null);
    } catch (error) {
      setWorkflowMessage(error instanceof Error ? error.message : t('ovr.workflowFailed'));
    } finally {
      setWorkflowSaving(false);
    }
  };

  const createLinkedProject = async () => {
    if (!selectedReport) return;
    setWorkflowSaving(true);
    try {
      await createOvrCorrectiveActionProject(selectedReport.id);
      setWorkflowMessage(t('ovr.linkedProjectCreated'));
      reports.refresh();
    } catch (error) {
      setWorkflowMessage(error instanceof Error ? error.message : t('ovr.workflowFailed'));
    } finally {
      setWorkflowSaving(false);
    }
  };

  return (
    <section className="page-section">
      <EmptySupabaseNotice />
      <ModuleHeader
        eyebrow={t('ovr.eyebrow')}
        title={t('ovr.title')}
        subtitle={t('ovr.subtitle')}
        action={<button className="primary-button" onClick={() => setShowForm(value => !value)}><FilePlus2 size={17} />{t('ovr.newReport')}</button>}
      />

      <div className="notice-banner ovr-confidential">
        <ShieldCheck size={18} />
        <span>{t('ovr.formNotice')}</span>
      </div>

      <DataState loading={summary.loading} error={summary.error} empty={!summary.data}>
        {summary.data ? (
          <div className="stats-grid">
            <StatCard label={t('ovr.totalReports')} value={summary.data.total_reports} />
            <StatCard label={t('ovr.openReports')} value={summary.data.open_reports} tone="warning" />
            <StatCard label={t('ovr.qualityReview')} value={summary.data.under_quality_review} />
            <StatCard label={t('ovr.correctiveActions')} value={summary.data.corrective_actions_required} tone="warning" />
            <StatCard label={t('ovr.sentinelEvents')} value={summary.data.sentinel_events} tone="danger" />
            <StatCard label={t('ovr.nearMiss')} value={summary.data.near_miss_level_1} tone="success" />
          </div>
        ) : null}
      </DataState>

      <DataState loading={workflowSummary.loading} error={workflowSummary.error} empty={!workflowSummary.data}>
        {workflowSummary.data ? (
          <div className="panel">
            <div className="panel-header">
              <h4>{t('ovr.controlSummary')}</h4>
              <p>{t('ovr.controlSummaryHint')}</p>
            </div>
            <div className="card-grid">
              <div className="mini-card"><span>{t('ovr.pendingSupervisor')}</span><strong>{workflowSummary.data.pending_supervisor_review}</strong></div>
              <div className="mini-card"><span>{t('ovr.pendingQuality')}</span><strong>{workflowSummary.data.pending_quality_review}</strong></div>
              <div className="mini-card"><span>{t('ovr.returned')}</span><strong>{workflowSummary.data.returned_for_clarification}</strong></div>
              <div className="mini-card"><span>{t('ovr.pendingEvidence')}</span><strong>{workflowSummary.data.pending_evidence_review}</strong></div>
              <div className="mini-card"><span>{t('ovr.majorOpen')}</span><strong>{workflowSummary.data.major_open_ovrs}</strong></div>
              <div className="mini-card"><span>{t('ovr.overdueWorkflow')}</span><strong>{workflowSummary.data.overdue_ovr_workflow_items}</strong></div>
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
            <label>{t('ovr.injury')}<input value={form.injury_type} onChange={event => update('injury_type', event.target.value)} placeholder="None observed / Abrasion / Burn..." /></label>
          </div>

          <div className="form-grid two">
            <label>{t('ovr.physical')}<textarea rows={3} value={form.physical_condition} onChange={event => update('physical_condition', event.target.value)} /></label>
            <label>{t('ovr.mental')}<textarea rows={3} value={form.mental_condition} onChange={event => update('mental_condition', event.target.value)} /></label>
          </div>

          <div className="checkbox-grid">
            {preOccurrenceFlags.map(flag => (
              <label key={flag} className="check-chip">
                <input type="checkbox" checked={form.pre_occurrence_condition_flags.includes(flag)} onChange={() => toggleFlag(flag)} />
                <span>{cleanLabel(flag)}</span>
              </label>
            ))}
          </div>

          <div className="form-grid two">
            <label>{t('ovr.summaryFacts')}<textarea rows={5} value={form.brief_description} onChange={event => update('brief_description', event.target.value)} /></label>
            <label>{t('ovr.supervisorInvestigation')}<textarea rows={5} value={form.supervisor_investigation} onChange={event => update('supervisor_investigation', event.target.value)} /></label>
            <label>{t('ovr.correctiveAction')}<textarea rows={4} value={form.corrective_action} onChange={event => update('corrective_action', event.target.value)} /></label>
            <label>{t('ovr.qualityComments')}<textarea rows={4} value={form.quality_manager_comments} onChange={event => update('quality_manager_comments', event.target.value)} /></label>
            <label>{t('ovr.referredTo')}<input value={form.referred_to_person} onChange={event => update('referred_to_person', event.target.value)} /></label>
            <label>{t('ovr.department')}<input value={form.referred_to_department} onChange={event => update('referred_to_department', event.target.value)} /></label>
          </div>

          <label className="check-line">
            <input type="checkbox" checked={form.create_linked_action_plan} onChange={event => update('create_linked_action_plan', event.target.checked)} />
            <span>{t('ovr.createActionPlan')}</span>
          </label>

          <div className="form-actions">
            <button className="ghost-button" disabled={saving} onClick={() => saveReport('draft')}>{t('ovr.saveDraft')}</button>
            <button className="primary-button" disabled={saving} onClick={() => saveReport('submitted')}>{t('ovr.submit')}</button>
          </div>
        </div>
      ) : null}

      <DataState loading={workflowQueue.loading} error={workflowQueue.error} empty={!workflowQueue.data?.length}>
        <WorkflowQueue rows={workflowQueue.data || []} />
      </DataState>

      <div className="panel">
        <div className="panel-header">
          <h4>{t('ovr.reportList')}</h4>
          <p>{t('ovr.reportListHint')}</p>
        </div>
        <DataState loading={reports.loading} error={reports.error} empty={!filteredReports.length}>
          <EntityTable<OvrReportRow>
            rows={filteredReports}
            getRowKey={row => row.id}
            columns={[
              { key: 'no', header: t('ovr.loggingNumber'), render: row => row.ovr_number || row.logging_number || '—' },
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
      </div>

      <Modal title={selectedReport?.ovr_number || selectedReport?.logging_number || t('ovr.detailTitle')} open={Boolean(selectedReport)} onClose={() => setSelectedReport(null)}>
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
              <label>{t('ovr.supervisorInvestigation')}<textarea rows={4} value={workflowForm.supervisor_investigation} onChange={event => updateWorkflowForm('supervisor_investigation', event.target.value)} /></label>
              <label>{t('ovr.correctiveAction')}<textarea rows={4} value={workflowForm.corrective_action} onChange={event => updateWorkflowForm('corrective_action', event.target.value)} /></label>
              <label>{t('ovr.qualityComments')}<textarea rows={4} value={workflowForm.quality_manager_comments} onChange={event => updateWorkflowForm('quality_manager_comments', event.target.value)} /></label>
              <label>{t('ovr.workflowNote')}<textarea rows={4} value={workflowForm.note} onChange={event => updateWorkflowForm('note', event.target.value)} /></label>
              <label>{t('ovr.confirmedSeverity')}
                <select value={workflowForm.confirmed_severity_level} onChange={event => updateWorkflowForm('confirmed_severity_level', event.target.value)}>
                  {(['level_1', 'level_2', 'level_3', 'level_4', 'sentinel'] as OvrSeverityLevel[]).map(level => <option key={level} value={level}>{t(`ovr.severity.${level}`)}</option>)}
                </select>
              </label>
              <label>{t('ovr.correctiveDueDate')}<input type="date" value={workflowForm.corrective_action_due_date} onChange={event => updateWorkflowForm('corrective_action_due_date', event.target.value)} /></label>
            </div>

            <div className="workflow-actions">
              <button className="ghost-button" disabled={workflowSaving} onClick={() => runWorkflowAction('under_supervisor_review')}><Workflow size={16} />{t('ovr.toSupervisor')}</button>
              <button className="ghost-button" disabled={workflowSaving} onClick={() => runWorkflowAction('under_quality_review')}>{t('ovr.toQuality')}</button>
              <button className="ghost-button" disabled={workflowSaving} onClick={() => runWorkflowAction('returned_for_clarification')}>{t('ovr.returnClarification')}</button>
              <button className="ghost-button" disabled={workflowSaving} onClick={() => runWorkflowAction('action_plan_required')}>{t('ovr.requireActionPlan')}</button>
              <button className="ghost-button" disabled={workflowSaving} onClick={() => runWorkflowAction('corrective_action_in_progress')}>{t('ovr.startCorrective')}</button>
              <button className="ghost-button" disabled={workflowSaving} onClick={() => runWorkflowAction('evidence_submitted')}>{t('ovr.submitEvidenceReview')}</button>
              <button className="ghost-button" disabled={workflowSaving || Boolean(selectedReport.linked_project_id)} onClick={createLinkedProject}><GitBranch size={16} />{selectedReport.linked_project_id ? t('ovr.projectAlreadyLinked') : t('ovr.createLinkedProject')}</button>
              <button className="primary-button" disabled={workflowSaving} onClick={() => runWorkflowAction('closed')}>{t('ovr.closeByQuality')}</button>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
