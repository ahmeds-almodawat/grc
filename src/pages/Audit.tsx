import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ClipboardCheck,
  Clock,
  FileCheck2,
  Flag,
  Link2,
  PackageCheck,
  RotateCcw,
  Send,
  ShieldAlert,
  ThumbsUp,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';
import { EntityTable } from '../components/EntityTable';
import { AuditFindingForm } from '../components/GrcForms';
import { Modal } from '../components/Modal';
import { ModuleHeader } from '../components/ModuleHeader';
import { StatusBadge } from '../components/StatusBadge';
import { departmentName, formatDate, humanize, ownerName } from '../lib/format';
import {
  acceptCorrectiveActionPlan,
  acceptManagementResponse,
  approveAuditFindingExtension,
  escalateAuditFinding,
  generateAuditClosurePackIndex,
  getAuditClosureGateStatus,
  getAuditClosurePackIndex,
  getAuditExecutiveEscalations,
  getAuditFindingValidationEvents,
  getAuditFindingWorkflowQueue,
  getAuditFindings,
  getDepartments,
  getOrganizations,
  getOverdueAuditFindings,
  getRisks,
  getComplianceItems,
  getProfiles,
  getRepeatAuditFindings,
  issueAuditFinding,
  linkAuditFindingToCompliance,
  linkAuditFindingToRisk,
  markRepeatAuditFinding,
  rejectAuditFindingClosure,
  rejectAuditFindingExtension,
  rejectCorrectiveActionPlan,
  rejectManagementResponse,
  reopenAuditFindingWithReason,
  requestAuditFindingClosure,
  requestAuditFindingExtension,
  submitCorrectiveActionPlan,
  submitManagementResponse,
  validateAuditFindingClosure,
} from '../lib/grcApi';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import type {
  AuditClosureGateStatusRow,
  AuditClosurePackIndexRow,
  AuditExecutiveEscalationRow,
  AuditFindingRow,
  AuditFindingValidationEventRow,
  AuditFindingWorkflowQueueRow,
  OverdueAuditFindingRow,
  RepeatAuditFindingRow,
} from '../types/domain';

function isPast(value: string | null | undefined) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: 'warning' | 'danger' | 'success';
}) {
  return (
    <div className={`stat-card ${tone || ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function DetailValue({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value || '-'}</strong>
    </div>
  );
}

function findingTitle(row?: AuditFindingRow | null) {
  if (!row) return 'Audit finding';
  return row.finding_code ? `${row.finding_code} - ${row.title}` : row.title;
}

function EventTable({ rows }: { rows: AuditFindingValidationEventRow[] }) {
  const { t } = useI18n();
  return (
    <DataState
      loading={false}
      empty={!rows.length}
      emptyTitle={t('audit.g.noValidationEvents', 'No validation events')}
      emptyMessage={t('audit.g.validationEventsHint', 'Lifecycle transitions will appear here once actions run.')}
    >
      <EntityTable<AuditFindingValidationEventRow>
        rows={rows}
        getRowKey={row => row.id}
        columns={[
          { key: 'type', header: t('audit.g.event', 'Event'), render: row => humanize(row.validation_type) },
          { key: 'status', header: t('common.status', 'Status'), render: row => `${humanize(row.from_status)} -> ${humanize(row.to_status)}` },
          { key: 'actor', header: t('audit.g.actor', 'Actor'), render: row => row.actor_id || '-' },
          { key: 'note', header: t('common.note', 'Note'), render: row => row.note || '-' },
          { key: 'date', header: t('common.date', 'Date'), render: row => formatDate(row.created_at) },
        ]}
      />
    </DataState>
  );
}

export function Audit() {
  const auth = useAuth();
  const { language, t } = useI18n();
  const [formOpen, setFormOpen] = useState(false);
  const [findingFormDirty, setFindingFormDirty] = useState(false);
  const [findingFormSubmitting, setFindingFormSubmitting] = useState(false);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const findings = useAsyncData(getAuditFindings, []);
  const workflowQueue = useAsyncData(getAuditFindingWorkflowQueue, []);
  const overdueFindings = useAsyncData(getOverdueAuditFindings, []);
  const repeatFindings = useAsyncData(getRepeatAuditFindings, []);
  const closureGates = useAsyncData(getAuditClosureGateStatus, []);
  const executiveEscalations = useAsyncData(getAuditExecutiveEscalations, []);
  const closurePackIndex = useAsyncData(getAuditClosurePackIndex, []);
  const validationEvents = useAsyncData(
    () => selectedFindingId ? getAuditFindingValidationEvents(selectedFindingId) : Promise.resolve([]),
    [selectedFindingId]
  );
  const departments = useAsyncData(getDepartments, []);
  const profiles = useAsyncData(getProfiles, []);
  const risks = useAsyncData(getRisks, []);
  const complianceItems = useAsyncData(getComplianceItems, []);
  const organizations = useAsyncData(getOrganizations, []);
  const organizationId = organizations.data?.[0]?.id || '';
  const canManageFindings = auth.roles.some(
    role => ['super_admin', 'governance_admin', 'auditor', 'compliance_officer', 'department_manager'].includes(role.role)
  );

  const selectedFinding = useMemo(
    () => (findings.data || []).find(row => row.id === selectedFindingId) || null,
    [findings.data, selectedFindingId]
  );
  const selectedGate = useMemo(
    () => (closureGates.data || []).find(row => row.audit_finding_id === selectedFindingId) || null,
    [closureGates.data, selectedFindingId]
  );
  const selectedPack = useMemo(
    () => (closurePackIndex.data || []).find(row => row.audit_finding_id === selectedFindingId) || null,
    [closurePackIndex.data, selectedFindingId]
  );

  const metrics = useMemo(() => ({
    register: findings.data?.length || 0,
    queue: workflowQueue.data?.length || 0,
    overdue: overdueFindings.data?.length || 0,
    blocked: (closureGates.data || []).filter(row => !row.can_close).length,
    escalations: executiveEscalations.data?.length || 0,
  }), [closureGates.data, executiveEscalations.data?.length, findings.data?.length, overdueFindings.data?.length, workflowQueue.data?.length]);

  const warnings = useMemo(() => {
    const queueRows = workflowQueue.data || [];
    const gateRows = closureGates.data || [];
    const repeatRows = repeatFindings.data || [];
    const escalationRows = executiveEscalations.data || [];
    return [
      {
        id: 'response-overdue',
        show: queueRows.some(row => isPast(row.management_response_due_date) && !['accepted', 'waived', 'not_required'].includes(row.management_response_status)),
        title: 'Management response overdue',
        body: 'One or more issued findings need accountable management response before the lifecycle can advance.',
      },
      {
        id: 'action-overdue',
        show: queueRows.some(row => isPast(row.corrective_action_due_date) && !['accepted', 'completed', 'not_required'].includes(row.corrective_action_status)),
        title: 'Corrective action overdue',
        body: 'A corrective action plan is overdue or still waiting for audit acceptance.',
      },
      {
        id: 'evidence-missing',
        show: gateRows.some(row => row.evidence_required && row.accepted_evidence_count < row.minimum_accepted_evidence_count && row.approved_waiver_count === 0),
        title: 'Evidence missing',
        body: 'Closure requires accepted evidence or an approved evidence waiver.',
      },
      {
        id: 'closure-blocked',
        show: gateRows.some(row => !row.can_close || row.closure_blocker),
        title: 'Closure blocked',
        body: 'At least one finding cannot close because response, action plan, evidence, or validation is incomplete.',
      },
      {
        id: 'repeat',
        show: Boolean(repeatRows.length),
        title: 'Repeat finding',
        body: 'Repeat or systemic issues should be visible to executives or committee review.',
      },
      {
        id: 'executive',
        show: escalationRows.some(row => row.escalation_required || row.executive_visible),
        title: 'Executive escalation required',
        body: 'High-risk, overdue, repeat, systemic, or committee-required findings need executive attention.',
      },
      {
        id: 'committee',
        show: escalationRows.some(row => row.committee_review_required),
        title: 'Committee review required',
        body: 'Committee-required findings should not be silently closed without documented review.',
      },
    ].filter(row => row.show);
  }, [closureGates.data, executiveEscalations.data, repeatFindings.data, workflowQueue.data]);

  async function refreshAuditWorkflow() {
    await Promise.all([
      findings.refresh(),
      workflowQueue.refresh(),
      overdueFindings.refresh(),
      repeatFindings.refresh(),
      closureGates.refresh(),
      executiveEscalations.refresh(),
      closurePackIndex.refresh(),
      validationEvents.refresh(),
    ]);
  }


  const [actionModal, setActionModal] = useState<{ open: boolean; action: string; findingId: string } | null>(null);

  function openActionModal(action: string, auditFindingId: string) {
    if (action === 'generate_pack' || action === 'request_closure' || action === 'validate_closure') {
      setActionModal({ open: true, action, findingId: auditFindingId });
      return;
    }
    setActionModal({ open: true, action, findingId: auditFindingId });
  }

  async function runFindingAction(action: string, auditFindingId: string, payload: Record<string, any>) {
    setBusyAction(`${action}:${auditFindingId}`);
    setError(null);
    setMessage(null);
    setActionModal(null);
    try {
      if (action === 'issue') {
        await issueAuditFinding({ audit_finding_id: auditFindingId, severity_level: payload.severity || 'medium', note: payload.note || 'Finding issued from Audit Findings Workflow Center.' });
      } else if (action === 'submit_response') {
        if (!payload.managementResponse) return;
        await submitManagementResponse({ audit_finding_id: auditFindingId, management_response: payload.managementResponse });
      } else if (action === 'accept_response') {
        await acceptManagementResponse({ audit_finding_id: auditFindingId, note: payload.note || 'Management response accepted.' });
      } else if (action === 'reject_response') {
        if (!payload.reason) return;
        await rejectManagementResponse({ audit_finding_id: auditFindingId, reason: payload.reason });
      } else if (action === 'submit_action') {
        if (!payload.correctiveActionPlan || !payload.correctiveActionDueDate) return;
        await submitCorrectiveActionPlan({ audit_finding_id: auditFindingId, corrective_action_plan: payload.correctiveActionPlan, corrective_action_due_date: payload.correctiveActionDueDate, corrective_action_owner_id: payload.correctiveActionOwnerId || undefined });
      } else if (action === 'accept_action') {
        await acceptCorrectiveActionPlan({ audit_finding_id: auditFindingId, note: payload.note || 'Corrective action plan accepted.' });
      } else if (action === 'reject_action') {
        if (!payload.reason) return;
        await rejectCorrectiveActionPlan({ audit_finding_id: auditFindingId, reason: payload.reason });
      } else if (action === 'request_extension') {
        if (!payload.requestedDueDate || !payload.reason) return;
        await requestAuditFindingExtension({ audit_finding_id: auditFindingId, requested_due_date: payload.requestedDueDate, reason: payload.reason });
      } else if (action === 'approve_extension') {
        if (!payload.extensionId) return;
        await approveAuditFindingExtension({ audit_finding_id: auditFindingId, extension_id: payload.extensionId, note: payload.note || 'Extension approved.' });
      } else if (action === 'reject_extension') {
        if (!payload.extensionId || !payload.reason) return;
        await rejectAuditFindingExtension({ audit_finding_id: auditFindingId, extension_id: payload.extensionId, reason: payload.reason });
      } else if (action === 'request_closure') {
        await requestAuditFindingClosure({ audit_finding_id: auditFindingId, note: payload.note || 'Closure requested for auditor validation.' });
      } else if (action === 'validate_closure') {
        await validateAuditFindingClosure({ audit_finding_id: auditFindingId, note: payload.note || 'Closure validated.' });
      } else if (action === 'reject_closure') {
        if (!payload.reason) return;
        await rejectAuditFindingClosure({ audit_finding_id: auditFindingId, reason: payload.reason });
      } else if (action === 'reopen') {
        if (!payload.reason) return;
        await reopenAuditFindingWithReason({ audit_finding_id: auditFindingId, reason: payload.reason });
      } else if (action === 'escalate') {
        if (!payload.reason) return;
        await escalateAuditFinding({ audit_finding_id: auditFindingId, reason: payload.reason, escalation_level: payload.escalationLevel || 'executive' });
      } else if (action === 'mark_repeat') {
        await markRepeatAuditFinding({ audit_finding_id: auditFindingId, repeat_of_finding_id: payload.repeatOfFindingId || undefined, systemic_issue_flag: Boolean(payload.systemicIssueFlag) });
      } else if (action === 'link_risk') {
        if (!payload.relatedRiskId) return;
        await linkAuditFindingToRisk({ audit_finding_id: auditFindingId, related_risk_id: payload.relatedRiskId });
      } else if (action === 'link_compliance') {
        if (!payload.relatedComplianceId) return;
        await linkAuditFindingToCompliance({ audit_finding_id: auditFindingId, related_compliance_id: payload.relatedComplianceId });
      } else if (action === 'generate_pack') {
        await generateAuditClosurePackIndex({ audit_finding_id: auditFindingId });
      }

      setMessage(`${humanize(action)} completed for audit finding.`);
      await refreshAuditWorkflow();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Audit finding workflow action failed.');
    } finally {
      setBusyAction(null);
    }
  }
const actionDisabled = !canManageFindings || Boolean(busyAction);

  const openFindingForm = () => {
    setFindingFormDirty(false);
    setFindingFormSubmitting(false);
    setFormOpen(true);
  };

  const closeFindingForm = () => {
    setFormOpen(false);
    setFindingFormDirty(false);
    setFindingFormSubmitting(false);
  };

  return (
    <section className="page-section">
      <ModuleHeader
        eyebrow={t('audit.eyebrow')}
        title={t('audit.title')}
        subtitle={t('audit.subtitle')}
        action={canManageFindings ? (
          <div className="inline-actions">
            <button className="primary-button" onClick={openFindingForm}>{t('audit.newFinding')}</button>
          </div>
        ) : null}
      />
            {error ? <div className="panel error-panel">{error}</div> : null}
      {message ? <div className="notice-banner">{message}</div> : null}
      <div className="module-grid">
        <div className="module-card"><strong>{t('audit.findings')}</strong><span>{metrics.register} {t('audit.active')}</span></div>
        <div className="module-card warning"><strong>{t('audit.workflowQueue')}</strong><span>{metrics.queue} {t('audit.queued')}</span></div>
        <div className="module-card danger"><strong>{t('audit.overdueFindings')}</strong><span>{metrics.overdue} {t('audit.overdue')}</span></div>
        <div className="module-card warning"><strong>{t('audit.closureBlocked')}</strong><span>{metrics.blocked} {t('audit.blocked')}</span></div>
        <div className="module-card danger"><strong>{t('audit.escalations')}</strong><span>{metrics.escalations} {t('audit.escalations')}</span></div>
      </div>


      {warnings.length ? (
        <div className="warning-stack">
          {warnings.map(warning => (
            <div className="warning-card" key={warning.id}>
              <strong><AlertTriangle size={16} /> {warning.title}</strong>
              <p>{warning.body}</p>
            </div>
          ))}
        </div>
      ) : null}




      <div className="panel">
        <div className="panel-header"><h4><ClipboardCheck size={18} /> {t('audit.register')}</h4></div>
        <DataState
          loading={findings.loading}
          error={findings.error}
          empty={!findings.data?.length}
          emptyTitle={t('audit.g.noFindings', 'No audit findings in your scope')}
          emptyMessage={
            canManageFindings
              ? t('audit.g.noFindingsManage', 'Create a controlled finding when an audit issue requires tracked remediation.')
              : t('audit.g.noFindingsReadOnly', 'No audit findings are currently available for this read-only account.')
          }
        >
          <EntityTable<AuditFindingRow>
            rows={findings.data || []}
            getRowKey={row => row.id}
            columns={[
              { key: 'code', header: t('common.code'), render: row => row.finding_code || '-' },
              { key: 'title', header: t('audit.finding'), render: row => <button className="link-button" type="button" onClick={() => setSelectedFindingId(row.id)}><strong>{row.title}</strong></button> },
              { key: 'department', header: t('common.department'), render: row => departmentName(row.departments) },
              { key: 'owner', header: t('common.owner'), render: row => ownerName(row.owner) },
              { key: 'due', header: t('common.due'), render: row => formatDate(row.due_date) },
              { key: 'status', header: t('audit.lifecycle'), render: row => <StatusBadge status={t(`status.${row.finding_status || row.status}`, humanize(row.finding_status || row.status))} /> },
              { key: 'severity', header: t('common.severity'), render: row => <span className={`risk-pill ${row.severity_level || row.risk_level}`}>{t(`risk.${row.severity_level || row.risk_level}`, row.severity_level || row.risk_level)}</span> },
              {
                key: 'actions',
                header: t('common.actions'),
                render: row => canManageFindings ? (
                  <div className="inline-actions">
                    <button className="ghost-button compact-button" disabled={actionDisabled} title={t('audit.issueFinding')} onClick={() => openActionModal('issue', row.id)}><Send size={14} /></button>
                    <button className="ghost-button compact-button" disabled={actionDisabled} title={t('audit.requestClosure')} onClick={() => openActionModal('request_closure', row.id)}><FileCheck2 size={14} /></button>
                    <button className="ghost-button compact-button" disabled={actionDisabled} title={t('audit.escalate')} onClick={() => openActionModal('escalate', row.id)}><Flag size={14} /></button>
                  </div>
                ) : '-',
              },
            ]}
          />
        </DataState>
      </div>

      <details className="panel" style={{ marginTop: '16px', border: 'none', background: 'transparent', boxShadow: 'none' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, padding: '12px 16px', background: 'var(--panel-bg)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
          {t('audit.g.showWorkflowDetails', 'Show workflow queues and lifecycle details')}
        </summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
<div className="panel">
        <div className="panel-header"><h4><Clock size={18} /> {t('audit.workflowQueue', 'Workflow queue')}</h4></div>
        <DataState loading={workflowQueue.loading} error={workflowQueue.error} empty={!workflowQueue.data?.length} emptyTitle={t('audit.g.noWorkflowItems', 'No workflow queue items')} emptyMessage={t('audit.g.workflowItemsHint', 'Findings requiring response, action, evidence, validation, correction, closure or escalation appear here.')}>
          <EntityTable<AuditFindingWorkflowQueueRow>
            rows={workflowQueue.data || []}
            getRowKey={row => row.audit_finding_id}
            columns={[
              { key: 'finding', header: t('audit.finding', 'Finding'), render: row => <button className="link-button" type="button" onClick={() => setSelectedFindingId(row.audit_finding_id)}>{row.finding_code || row.title}</button> },
              { key: 'reason', header: t('audit.g.queueReason', 'Queue reason'), render: row => humanize(row.queue_reason) },
              { key: 'response', header: t('audit.g.response', 'Response'), render: row => <StatusBadge status={humanize(row.management_response_status)} /> },
              { key: 'action', header: t('audit.g.actionPlan', 'Action plan'), render: row => <StatusBadge status={humanize(row.corrective_action_status)} /> },
              { key: 'evidence', header: t('audit.g.evidence', 'Evidence'), render: row => `${row.accepted_evidence_count} / ${row.minimum_accepted_evidence_count}` },
              { key: 'due', header: t('common.due', 'Due'), render: row => formatDate(row.due_date || row.management_response_due_date || row.corrective_action_due_date) },
              {
                key: 'actions',
                header: t('common.actions', 'Actions'),
                render: row => canManageFindings ? (
                  <div className="inline-actions">
                    <button className="ghost-button compact-button" disabled={actionDisabled} title={t('audit.g.submitResponse', 'Submit response')} onClick={() => openActionModal('submit_response', row.audit_finding_id)}><Send size={14} /></button>
                    <button className="ghost-button compact-button" disabled={actionDisabled} title={t('audit.g.acceptResponse', 'Accept response')} onClick={() => openActionModal('accept_response', row.audit_finding_id)}><ThumbsUp size={14} /></button>
                    <button className="ghost-button compact-button" disabled={actionDisabled} title={t('audit.g.rejectResponse', 'Reject response')} onClick={() => openActionModal('reject_response', row.audit_finding_id)}><XCircle size={14} /></button>
                    <button className="ghost-button compact-button" disabled={actionDisabled} title={t('audit.g.submitActionPlan', 'Submit action plan')} onClick={() => openActionModal('submit_action', row.audit_finding_id)}><ClipboardCheck size={14} /></button>
                  </div>
                ) : '-',
              },
            ]}
          />
        </DataState>
      </div>

      <div className="panel">
        <div className="panel-header"><h4><AlertTriangle size={18} /> {t('audit.overdueFindings', 'Overdue findings')}</h4></div>
        <DataState loading={overdueFindings.loading} error={overdueFindings.error} empty={!overdueFindings.data?.length} emptyTitle={t('audit.g.noOverdueItems', 'No overdue audit workflow items')} emptyMessage={t('audit.g.noOverdueItemsHint', 'Overdue responses, corrective actions, validations and findings appear here.')}>
          <EntityTable<OverdueAuditFindingRow>
            rows={overdueFindings.data || []}
            getRowKey={row => row.audit_finding_id}
            columns={[
              { key: 'finding', header: t('audit.finding', 'Finding'), render: row => <button className="link-button" type="button" onClick={() => setSelectedFindingId(row.audit_finding_id)}>{row.finding_code || row.title}</button> },
              { key: 'reason', header: t('audit.g.reason', 'Reason'), render: row => humanize(row.overdue_reason, language) },
              { key: 'days', header: t('audit.g.days', 'Days'), render: row => row.days_overdue },
              { key: 'owner', header: t('common.owner', 'Owner'), render: row => row.responsible_owner_name || '-' },
              { key: 'severity', header: t('common.severity', 'Severity'), render: row => <StatusBadge status={humanize(row.severity_level, language)} /> },
            ]}
          />
        </DataState>
      </div>

      <div className="panel">
        <div className="panel-header"><h4><ShieldAlert size={18} /> {t('audit.g.repeatSystemic', 'Repeat/systemic findings')}</h4></div>
        <DataState loading={repeatFindings.loading} error={repeatFindings.error} empty={!repeatFindings.data?.length} emptyTitle={t('audit.g.noRepeatFindings', 'No repeat findings visible')} emptyMessage={t('audit.g.noRepeatFindingsHint', 'Repeat, systemic, or detected recurrence findings appear here.')}>
          <EntityTable<RepeatAuditFindingRow>
            rows={repeatFindings.data || []}
            getRowKey={row => row.audit_finding_id}
            columns={[
              { key: 'finding', header: t('audit.finding', 'Finding'), render: row => <button className="link-button" type="button" onClick={() => setSelectedFindingId(row.audit_finding_id)}>{row.finding_code || row.title}</button> },
              { key: 'department', header: t('common.department', 'Department'), render: row => row.department_name || '-' },
              { key: 'root', header: t('form.audit.rootCause', 'Root cause'), render: row => humanize(row.root_cause_category, language) || '-' },
              { key: 'repeat', header: t('audit.g.repeatCount', 'Repeat count'), render: row => Math.max(row.recurrence_count, row.detected_repeat_count) },
              { key: 'systemic', header: t('audit.g.systemic', 'Systemic'), render: row => row.systemic_issue_flag ? <StatusBadge status={t('audit.g.systemic', 'Systemic')} /> : '-' },
            ]}
          />
        </DataState>
      </div>

      <div className="panel">
        <div className="panel-header"><h4><FileCheck2 size={18} /> {t('audit.g.closureGate', 'Closure gate status')}</h4></div>
        <DataState loading={closureGates.loading} error={closureGates.error} empty={!closureGates.data?.length} emptyTitle={t('audit.g.noClosureGates', 'No closure gates')} emptyMessage={t('audit.g.noClosureGatesHint', 'Closure gate status will appear here.')}>
          <EntityTable<AuditClosureGateStatusRow>
            rows={closureGates.data || []}
            getRowKey={row => row.audit_finding_id}
            columns={[
              { key: 'finding', header: t('audit.finding', 'Finding'), render: row => <button className="link-button" type="button" onClick={() => setSelectedFindingId(row.audit_finding_id)}>{row.finding_code || row.title}</button> },
              { key: 'response', header: t('common.status', 'Status'), render: row => <StatusBadge status={row.can_close ? t('audit.g.canClose', 'Can close') : t('audit.blocked', 'Blocked')} /> },
              { key: 'evidence', header: t('audit.g.evidence', 'Evidence'), render: row => row.evidence_required ? `${row.accepted_evidence_count} / ${row.minimum_accepted_evidence_count}` : t('audit.g.notRequired', 'Not required') },
              { key: 'waiver', header: t('audit.g.waivers', 'Waivers'), render: row => row.approved_waiver_count },
              { key: 'blocker', header: t('risks.g.blocker', 'Blocker'), render: row => humanize(row.closure_blocker, language) },
              {
                key: 'actions',
                header: t('common.actions', 'Actions'),
                render: row => canManageFindings ? (
                  <div className="inline-actions">
                    <button className="ghost-button compact-button" disabled={actionDisabled} title={t('audit.g.validateClosure', 'Validate closure')} onClick={() => openActionModal('validate_closure', row.audit_finding_id)}><ThumbsUp size={14} /></button>
                    <button className="ghost-button compact-button" disabled={actionDisabled} title={t('audit.g.rejectClosure', 'Reject closure')} onClick={() => openActionModal('reject_closure', row.audit_finding_id)}><XCircle size={14} /></button>
                  </div>
                ) : '-',
              },
            ]}
          />
        </DataState>
      </div>

      <div className="panel">
        <div className="panel-header"><h4><Flag size={18} /> {t('risks.g.executiveEscalations', 'Executive escalations')}</h4></div>
        <DataState loading={executiveEscalations.loading} error={executiveEscalations.error} empty={!executiveEscalations.data?.length} emptyTitle={t('risks.g.noExecutiveEscalations', 'No executive escalations')} emptyMessage={t('audit.g.noExecutiveEscalationsHint', 'High, critical, overdue, repeat, systemic, and committee-required findings appear here.')}>
          <EntityTable<AuditExecutiveEscalationRow>
            rows={executiveEscalations.data || []}
            getRowKey={row => row.audit_finding_id}
            columns={[
              { key: 'finding', header: t('audit.finding', 'Finding'), render: row => <button className="link-button" type="button" onClick={() => setSelectedFindingId(row.audit_finding_id)}>{row.finding_code || row.title}</button> },
              { key: 'reason', header: t('audit.g.reason', 'Reason'), render: row => humanize(row.escalation_reason_code, language) },
              { key: 'level', header: t('risks.level', 'Level'), render: row => humanize(row.escalation_level, language) },
              { key: 'committee', header: t('audit.g.committee', 'Committee'), render: row => row.committee_review_required ? <StatusBadge status={humanize(row.committee_review_status, language)} /> : '-' },
              { key: 'owner', header: t('audit.g.escalatedTo', 'Escalated to'), render: row => row.escalated_to_name || row.escalated_to || '-' },
            ]}
          />
        </DataState>
      </div>

      <div className="panel">
        <div className="panel-header"><h4><PackageCheck size={18} /> {t('audit.g.closurePackIndex', 'Closure pack index')}</h4></div>
        <DataState loading={closurePackIndex.loading} error={closurePackIndex.error} empty={!closurePackIndex.data?.length} emptyTitle={t('audit.g.noClosurePackCandidates', 'No closure pack candidates')} emptyMessage={t('audit.g.noClosurePackCandidatesHint', 'Audit-ready closure pack candidates appear here with evidence and validation status.')}>
          <EntityTable<AuditClosurePackIndexRow>
            rows={closurePackIndex.data || []}
            getRowKey={row => row.audit_finding_id}
            columns={[
              { key: 'finding', header: t('audit.finding', 'Finding'), render: row => <button className="link-button" type="button" onClick={() => setSelectedFindingId(row.audit_finding_id)}>{row.finding_code || row.title}</button> },
              { key: 'response', header: t('audit.g.response', 'Response'), render: row => <StatusBadge status={humanize(row.management_response_status, language)} /> },
              { key: 'action', header: t('audit.g.action', 'Action'), render: row => <StatusBadge status={humanize(row.corrective_action_status, language)} /> },
              { key: 'evidence', header: t('audit.g.evidence', 'Evidence'), render: row => `${row.accepted_evidence_count} ${t('audit.g.accepted', 'accepted')} / ${row.linked_evidence_count} ${t('audit.g.linked', 'linked')}` },
              { key: 'validator', header: t('audit.g.validator', 'Validator'), render: row => row.closure_validator_name || row.closure_validated_by || '-' },
              { key: 'generated', header: t('audit.g.pack', 'Pack'), render: row => row.closure_pack_reference || formatDate(row.closure_pack_generated_at) },
            ]}
          />
        </DataState>
      </div>

      <Modal size="xl" open={Boolean(selectedFindingId)} title={t('audit.g.findingDetail', 'Audit finding detail')} onClose={() => setSelectedFindingId(null)}>
        {selectedFinding ? (
          <div className="form-grid">
            <div className="detail-grid full-width">
              <DetailValue label={t('audit.finding', 'Finding')} value={findingTitle(selectedFinding)} />
              <DetailValue label={t('audit.g.audit', 'Audit')} value={selectedFinding.audit_title} />
              <DetailValue label={t('common.severity', 'Severity')} value={humanize(selectedFinding.severity_level || selectedFinding.risk_level)} />
              <DetailValue label={t('audit.lifecycle', 'Lifecycle')} value={humanize(selectedFinding.finding_status || selectedFinding.status)} />
              <DetailValue label={t('audit.g.stage', 'Stage')} value={humanize(selectedFinding.workflow_stage)} />
              <DetailValue label={t('common.department', 'Department')} value={departmentName(selectedFinding.departments)} />
              <DetailValue label={t('common.owner', 'Owner')} value={ownerName(selectedFinding.owner)} />
              <DetailValue label={t('common.dueDate', 'Due date')} value={formatDate(selectedFinding.due_date)} />
              <DetailValue label={t('audit.g.responseStatus', 'Response status')} value={humanize(selectedFinding.management_response_status)} />
              <DetailValue label={t('audit.g.actionStatus', 'Action status')} value={humanize(selectedFinding.corrective_action_status)} />
              <DetailValue label={t('audit.g.evidenceGate', 'Evidence gate')} value={selectedGate ? humanize(selectedGate.evidence_gate_status) : humanize(selectedFinding.evidence_gate_status)} />
              <DetailValue label={t('risks.g.closure', 'Closure')} value={selectedGate ? (selectedGate.can_close ? t('audit.g.canClose', 'Can close') : humanize(selectedGate.closure_blocker)) : humanize(selectedFinding.closure_validation_status)} />
              <DetailValue label={t('audit.g.repeatSystemic', 'Repeat/systemic')} value={`${selectedFinding.repeat_finding_flag ? t('audit.g.repeat', 'Repeat') : t('audit.g.notRepeat', 'Not repeat')} / ${selectedFinding.systemic_issue_flag ? t('audit.g.systemic', 'Systemic') : t('audit.g.notSystemic', 'Not systemic')}`} />
              <DetailValue label={t('audit.g.relatedRisk', 'Related risk')} value={selectedFinding.related_risk_id} />
              <DetailValue label={t('audit.g.relatedCompliance', 'Related compliance')} value={selectedFinding.related_compliance_id} />
              <DetailValue label={t('audit.g.sourceOvr', 'Source OVR')} value={selectedFinding.source_ovr_id} />
              <DetailValue label={t('audit.g.closurePack', 'Closure pack')} value={selectedPack?.closure_pack_reference || selectedFinding.closure_pack_reference} />
            </div>

            <div className="panel full-width">
              <div className="panel-header"><h4>{t('audit.g.managementResponse', 'Management response')}</h4></div>
              <p>{selectedFinding.management_response || t('audit.g.noManagementResponse', 'No management response submitted.')}</p>
            </div>

            <div className="panel full-width">
              <div className="panel-header"><h4>{t('audit.g.correctiveActionPlan', 'Corrective action plan')}</h4></div>
              <p>{selectedFinding.corrective_action_plan || t('audit.g.noCorrectiveActionPlan', 'No corrective action plan submitted.')}</p>
            </div>

            <div className="panel full-width">
              <div className="panel-header"><h4>{t('audit.g.actionControls', 'Action controls')}</h4></div>
              <div className="inline-actions">
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => openActionModal('issue', selectedFinding.id)}><Send size={16} /> {t('audit.g.issue', 'Issue')}</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => openActionModal('submit_response', selectedFinding.id)}><Send size={16} /> {t('audit.g.response', 'Response')}</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => openActionModal('accept_response', selectedFinding.id)}><ThumbsUp size={16} /> {t('audit.g.acceptResponse', 'Accept response')}</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => openActionModal('reject_response', selectedFinding.id)}><XCircle size={16} /> {t('audit.g.rejectResponse', 'Reject response')}</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => openActionModal('submit_action', selectedFinding.id)}><ClipboardCheck size={16} /> {t('audit.g.actionPlan', 'Action plan')}</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => openActionModal('accept_action', selectedFinding.id)}><ThumbsUp size={16} /> {t('audit.g.acceptAction', 'Accept action')}</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => openActionModal('reject_action', selectedFinding.id)}><XCircle size={16} /> {t('audit.g.rejectAction', 'Reject action')}</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => openActionModal('request_extension', selectedFinding.id)}><Clock size={16} /> {t('audit.g.extension', 'Extension')}</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => openActionModal('approve_extension', selectedFinding.id)}><ThumbsUp size={16} /> {t('audit.g.approveExtension', 'Approve extension')}</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => openActionModal('reject_extension', selectedFinding.id)}><XCircle size={16} /> {t('audit.g.rejectExtension', 'Reject extension')}</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => openActionModal('request_closure', selectedFinding.id)}><FileCheck2 size={16} /> {t('audit.requestClosure', 'Request closure')}</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => openActionModal('validate_closure', selectedFinding.id)}><ThumbsUp size={16} /> {t('audit.g.validateClosure', 'Validate closure')}</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => openActionModal('reject_closure', selectedFinding.id)}><XCircle size={16} /> {t('audit.g.rejectClosure', 'Reject closure')}</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => openActionModal('reopen', selectedFinding.id)}><RotateCcw size={16} /> {t('audit.g.reopen', 'Reopen')}</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => openActionModal('escalate', selectedFinding.id)}><Flag size={16} /> {t('audit.escalate', 'Escalate')}</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => openActionModal('mark_repeat', selectedFinding.id)}><ShieldAlert size={16} /> {t('audit.g.markRepeat', 'Mark repeat')}</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => openActionModal('link_risk', selectedFinding.id)}><Link2 size={16} /> {t('audit.g.linkRisk', 'Link risk')}</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => openActionModal('link_compliance', selectedFinding.id)}><Link2 size={16} /> {t('audit.g.linkCompliance', 'Link compliance')}</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => openActionModal('generate_pack', selectedFinding.id)}><PackageCheck size={16} /> {t('audit.g.generatePack', 'Generate pack')}</button>
              </div>
              {!canManageFindings ? <p className="muted">{t('audit.g.readOnlyActions', 'Your current role can view audit finding workflow data but cannot perform governed transitions.')}</p> : null}
            </div>

            <div className="panel full-width">
              <div className="panel-header"><h4>{t('audit.g.validationEvents', 'Validation events')}</h4></div>
              <DataState loading={validationEvents.loading} error={validationEvents.error} empty={false}>
                <EventTable rows={validationEvents.data || []} />
              </DataState>
            </div>
          </div>
        ) : (
          <DataState loading={findings.loading} error={findings.error} empty emptyTitle={t('audit.g.findingNotLoaded', 'Finding not loaded')} emptyMessage={t('audit.g.findingNotLoadedHint', 'Refresh the register and select the finding again.')}>
            <div />
          </DataState>
        )}
      </Modal>


        </div>
      </details>
      <Modal
        size="large"
        open={formOpen}
        title={t('audit.g.createTitle', 'Create audit finding')}
        isDirty={findingFormDirty}
        isSubmitting={findingFormSubmitting}
        onClose={closeFindingForm}
      >
        <AuditFindingForm
          organizationId={organizationId}
          departments={departments.data || []}
          profiles={profiles.data || []}
          onDirtyChange={setFindingFormDirty}
          onSubmittingChange={setFindingFormSubmitting}
          onCancel={closeFindingForm}
          onCreated={() => {
            closeFindingForm();
            void refreshAuditWorkflow();
          }}
        />
      </Modal>
    </section>
  );
}


function AuditActionForm({ state, profiles, findings, risks, complianceItems, onClose, onConfirm }: { state: any, profiles: any[], findings: any[], risks: any[], complianceItems: any[], onClose: () => void, onConfirm: (p: Record<string, any>) => void }) {
  const { language, t } = useI18n();
  const [payload, setPayload] = useState<Record<string, any>>({});
  const needsReason = ['reject_response', 'reject_action', 'reject_extension', 'reject_closure', 'reopen', 'escalate'].includes(state.action);
  const needsNote = ['accept_response', 'accept_action', 'approve_extension', 'request_closure', 'validate_closure', 'issue'].includes(state.action);

  const missingFields: string[] = [];
  if (needsReason && !payload.reason) missingFields.push(t('audit.g.reason', 'Reason'));
  if (state.action === 'submit_response' && !payload.managementResponse) missingFields.push(t('audit.g.managementResponse', 'Management Response'));
  if (state.action === 'submit_action' && !payload.correctiveActionPlan) missingFields.push(t('audit.g.correctiveActionPlan', 'Corrective Action Plan'));
  if (state.action === 'submit_action' && !payload.correctiveActionDueDate) missingFields.push(t('common.dueDate', 'Due Date'));
  if (state.action === 'request_extension' && !payload.requestedDueDate) missingFields.push(t('audit.g.requestedDueDate', 'Requested Due Date'));
  if (state.action === 'link_risk' && !payload.relatedRiskId) missingFields.push(t('audit.g.relatedRiskId', 'Related Risk ID'));
  if (state.action === 'link_compliance' && !payload.relatedComplianceId) missingFields.push(t('audit.g.relatedComplianceId', 'Related Compliance Item ID'));

  const isValid = missingFields.length === 0;

  const currentFinding = findings.find(f => f.id === state.findingId);
  const findingTitle = currentFinding ? `${currentFinding.finding_code ? currentFinding.finding_code + ' - ' : ''}${currentFinding.title}` : state.findingId;

  return (
    <div className="panel" style={{ padding: '24px', border: 'none', margin: 0 }}>
       <div style={{ marginBottom: '16px' }}>
         <strong>{t('audit.g.action', 'Action')}: {humanize(state.action, language)}</strong><br/>
         <small>{t('audit.finding', 'Finding')}: {findingTitle}</small>
       </div>

       {needsReason && (
         <div className="field-group">
           <label>{t('audit.g.reason', 'Reason')} *</label>
           <input autoFocus value={payload.reason || ''} onChange={e => setPayload({...payload, reason: e.target.value})} />
         </div>
       )}
       {needsNote && (
         <div className="field-group">
           <label>{t('audit.g.noteComment', 'Note / Comment')}</label>
           <input autoFocus value={payload.note || ''} onChange={e => setPayload({...payload, note: e.target.value})} />
         </div>
       )}
       {state.action === 'submit_response' && (
         <div className="field-group">
           <label>{t('audit.g.managementResponse', 'Management Response')} *</label>
           <textarea autoFocus value={payload.managementResponse || ''} onChange={e => setPayload({...payload, managementResponse: e.target.value})} />
         </div>
       )}
       {state.action === 'submit_action' && (
         <>
           <div className="field-group">
             <label>{t('audit.g.correctiveActionPlan', 'Corrective Action Plan')} *</label>
             <textarea autoFocus value={payload.correctiveActionPlan || ''} onChange={e => setPayload({...payload, correctiveActionPlan: e.target.value})} />
           </div>
           <div className="field-group">
             <label>{t('audit.g.dueDateFormat', 'Due Date (YYYY-MM-DD)')} *</label>
             <input type="date" value={payload.correctiveActionDueDate || ''} onChange={e => setPayload({...payload, correctiveActionDueDate: e.target.value})} />
           </div>
           <div className="field-group">
             <label>{t('audit.g.ownerOptional', 'Owner Profile (Optional)')}</label>
             <select value={payload.correctiveActionOwnerId || ''} onChange={e => setPayload({...payload, correctiveActionOwnerId: e.target.value})}>
               <option value="">-- {t('common.unassigned', 'Unassigned')} --</option>
               {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email || p.id}</option>)}
             </select>
           </div>
         </>
       )}
       {state.action === 'request_extension' && (
         <>
           <div className="field-group">
             <label>{t('audit.g.requestedDueDateFormat', 'Requested Due Date (YYYY-MM-DD)')} *</label>
             <input type="date" value={payload.requestedDueDate || ''} onChange={e => setPayload({...payload, requestedDueDate: e.target.value})} />
           </div>
         </>
       )}
       {['approve_extension', 'reject_extension'].includes(state.action) && (
         <div className="field-group">
           <label>{t('audit.g.extensionId', 'Extension ID')} *</label>
           <div className="notice-banner warning">{t('audit.g.noExtensionRequest', 'No selectable extension request is available in your current scope.')}</div>
         </div>
       )}
       {state.action === 'escalate' && (
         <div className="field-group">
           <label>{t('audit.g.escalationLevel', 'Escalation Level')}</label>
           <select value={payload.escalationLevel || 'executive'} onChange={e => setPayload({...payload, escalationLevel: e.target.value})}>
             <option value="manager">{t('audit.g.manager', 'Manager')}</option>
             <option value="executive">{t('audit.g.executive', 'Executive')}</option>
             <option value="committee">{t('audit.g.committee', 'Committee')}</option>
             <option value="board">{t('audit.g.board', 'Board')}</option>
           </select>
         </div>
       )}
       {state.action === 'mark_repeat' && (
         <>
           <div className="field-group">
             <label>{t('audit.g.originalFindingOptional', 'Original Finding (Optional)')}</label>
             <select value={payload.repeatOfFindingId || ''} onChange={e => setPayload({...payload, repeatOfFindingId: e.target.value})}>
               <option value="">-- {t('audit.g.none', 'None')} --</option>
               {findings.filter(f => f.id !== state.findingId).map(f => <option key={f.id} value={f.id}>{f.finding_code ? f.finding_code + ' - ' : ''}{f.title}</option>)}
             </select>
           </div>
           <div className="field-group checkbox-field" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
             <input type="checkbox" id="systemic" checked={payload.systemicIssueFlag || false} onChange={e => setPayload({...payload, systemicIssueFlag: e.target.checked})} />
             <label htmlFor="systemic">{t('audit.g.markSystemic', 'Mark as Systemic Issue')}</label>
           </div>
         </>
       )}
       {state.action === 'link_risk' && (
         <div className="field-group">
           <label>{t('audit.g.relatedRisk', 'Related Risk')} *</label>
           <select value={payload.relatedRiskId || ''} onChange={e => setPayload({...payload, relatedRiskId: e.target.value})}>
             <option value="">-- {t('audit.g.selectRisk', 'Select a risk')} --</option>
             {risks.map(r => <option key={r.id} value={r.id}>{r.risk_code ? r.risk_code + ' - ' : ''}{r.title}</option>)}
           </select>
         </div>
       )}
       {state.action === 'link_compliance' && (
         <div className="field-group">
           <label>{t('audit.g.relatedCompliance', 'Related Compliance Item')} *</label>
           <select value={payload.relatedComplianceId || ''} onChange={e => setPayload({...payload, relatedComplianceId: e.target.value})}>
             <option value="">-- {t('audit.g.selectCompliance', 'Select a compliance item')} --</option>
             {complianceItems.map(c => <option key={c.id} value={c.id}>{c.requirement_code ? c.requirement_code + ' - ' : ''}{c.title}</option>)}
           </select>
         </div>
       )}
       {state.action === 'issue' && (
         <div className="field-group">
           <label>{t('audit.g.severityLevel', 'Severity Level')}</label>
           <select value={payload.severity || 'medium'} onChange={e => setPayload({...payload, severity: e.target.value})}>
             {['low', 'medium', 'high', 'critical'].map(level => <option key={level} value={level}>{humanize(level, language)}</option>)}
           </select>
         </div>
       )}
       {needsReason && <div className="notice-banner danger" style={{ marginTop: '16px' }}>{t('audit.g.negativeActionWarning', 'This is a destructive or negative action. Please provide a clear reason.')}</div>}

       {!isValid && <div className="notice-banner warning" style={{ marginTop: '16px' }}>{t('audit.g.missingFields', 'Please fill out all required fields. Missing')}: {missingFields.join(', ')}</div>}

       <div className="form-actions" style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
         <button className="ghost-button" onClick={onClose}>{t('common.cancel', 'Cancel')}</button>
         {['approve_extension', 'reject_extension'].includes(state.action) || !isValid ? (
           <button className="primary-button" disabled>{t('audit.g.confirmAction', 'Confirm Action')}</button>
         ) : (
           <button className="primary-button" onClick={() => onConfirm(payload)}>{t('audit.g.confirmAction', 'Confirm Action')}</button>
         )}
       </div>
    </div>
  );
}
