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
import { ProfessionalGrcMaturityPanel } from '../components/v140/ProfessionalGrcMaturityPanel';
import { ProfessionalGrcWorkflowMap } from '../components/v140/ProfessionalGrcWorkflowMap';
import { AuditAssuranceCoveragePanel } from '../components/v150/AuditAssuranceCoveragePanel';
import { AuditEngagementChecklist } from '../components/v150/AuditEngagementChecklist';
import { AuditProgramWorkflowMap } from '../components/v150/AuditProgramWorkflowMap';
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
import { FrameworkCrosswalkBackbonePanel } from '../components/v210/FrameworkCrosswalkBackbonePanel';
import { CapaExecutionPanel } from '../components/v220/CapaExecutionPanel';
import { ControlAssuranceReadinessPanel } from '../components/v220/ControlAssuranceReadinessPanel';

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
  return (
    <DataState
      loading={false}
      empty={!rows.length}
      emptyTitle="No validation events"
      emptyMessage="Lifecycle transitions will appear here after Patch 24 actions run."
    >
      <EntityTable<AuditFindingValidationEventRow>
        rows={rows}
        getRowKey={row => row.id}
        columns={[
          { key: 'type', header: 'Event', render: row => humanize(row.validation_type) },
          { key: 'status', header: 'Status', render: row => `${humanize(row.from_status)} -> ${humanize(row.to_status)}` },
          { key: 'actor', header: 'Actor', render: row => row.actor_id || '-' },
          { key: 'note', header: 'Note', render: row => row.note || '-' },
          { key: 'date', header: 'Date', render: row => formatDate(row.created_at) },
        ]}
      />
    </DataState>
  );
}

export function Audit() {
  const auth = useAuth();
  const [formOpen, setFormOpen] = useState(false);
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
        body: 'Closure requires accepted evidence or an approved Patch 23 evidence waiver.',
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

  async function runFindingAction(action: string, auditFindingId: string) {
    setBusyAction(`${action}:${auditFindingId}`);
    setError(null);
    setMessage(null);
    try {
      if (action === 'issue') {
        const severity = window.prompt('Severity level: low, medium, high, critical', 'medium') || 'medium';
        await issueAuditFinding({ audit_finding_id: auditFindingId, severity_level: severity, note: 'Finding issued from Audit Findings Workflow Center.' });
      } else if (action === 'submit_response') {
        const managementResponse = window.prompt('Management response');
        if (!managementResponse) return;
        await submitManagementResponse({ audit_finding_id: auditFindingId, management_response: managementResponse });
      } else if (action === 'accept_response') {
        await acceptManagementResponse({ audit_finding_id: auditFindingId, note: 'Management response accepted.' });
      } else if (action === 'reject_response') {
        const reason = window.prompt('Response rejection reason', 'Response is incomplete or not accountable.');
        if (!reason) return;
        await rejectManagementResponse({ audit_finding_id: auditFindingId, reason });
      } else if (action === 'submit_action') {
        const correctiveActionPlan = window.prompt('Corrective action plan');
        if (!correctiveActionPlan) return;
        const correctiveActionDueDate = window.prompt('Corrective action due date YYYY-MM-DD');
        if (!correctiveActionDueDate) return;
        const correctiveActionOwnerId = window.prompt('Corrective action owner profile id, optional') || undefined;
        await submitCorrectiveActionPlan({ audit_finding_id: auditFindingId, corrective_action_plan: correctiveActionPlan, corrective_action_due_date: correctiveActionDueDate, corrective_action_owner_id: correctiveActionOwnerId });
      } else if (action === 'accept_action') {
        await acceptCorrectiveActionPlan({ audit_finding_id: auditFindingId, note: 'Corrective action plan accepted.' });
      } else if (action === 'reject_action') {
        const reason = window.prompt('Action plan rejection reason', 'Action plan needs owner, date, or stronger remediation.');
        if (!reason) return;
        await rejectCorrectiveActionPlan({ audit_finding_id: auditFindingId, reason });
      } else if (action === 'request_extension') {
        const requestedDueDate = window.prompt('Requested due date YYYY-MM-DD');
        if (!requestedDueDate) return;
        const reason = window.prompt('Extension reason', 'Additional time needed for corrective action validation.');
        if (!reason) return;
        await requestAuditFindingExtension({ audit_finding_id: auditFindingId, requested_due_date: requestedDueDate, reason });
      } else if (action === 'approve_extension' || action === 'reject_extension') {
        const extensionId = window.prompt('Extension request id');
        if (!extensionId) return;
        if (action === 'approve_extension') {
          await approveAuditFindingExtension({ audit_finding_id: auditFindingId, extension_id: extensionId, note: 'Extension approved.' });
        } else {
          const reason = window.prompt('Extension rejection reason', 'Extension request not approved.');
          if (!reason) return;
          await rejectAuditFindingExtension({ audit_finding_id: auditFindingId, extension_id: extensionId, reason });
        }
      } else if (action === 'request_closure') {
        await requestAuditFindingClosure({ audit_finding_id: auditFindingId, note: 'Closure requested for auditor validation.' });
      } else if (action === 'validate_closure') {
        await validateAuditFindingClosure({ audit_finding_id: auditFindingId, note: 'Closure validated.' });
      } else if (action === 'reject_closure') {
        const reason = window.prompt('Closure rejection reason', 'Closure evidence or remediation is not sufficient.');
        if (!reason) return;
        await rejectAuditFindingClosure({ audit_finding_id: auditFindingId, reason });
      } else if (action === 'reopen') {
        const reason = window.prompt('Reopen reason', 'Finding requires further remediation.');
        if (!reason) return;
        await reopenAuditFindingWithReason({ audit_finding_id: auditFindingId, reason });
      } else if (action === 'escalate') {
        const reason = window.prompt('Escalation reason', 'High-risk, overdue, repeat, or systemic finding.');
        if (!reason) return;
        const escalationLevel = window.prompt('Escalation level', 'executive') || 'executive';
        await escalateAuditFinding({ audit_finding_id: auditFindingId, reason, escalation_level: escalationLevel });
      } else if (action === 'mark_repeat') {
        const repeatOfFindingId = window.prompt('Original finding id, optional') || undefined;
        const systemicIssueFlag = window.confirm('Mark this as systemic?');
        await markRepeatAuditFinding({ audit_finding_id: auditFindingId, repeat_of_finding_id: repeatOfFindingId, systemic_issue_flag: systemicIssueFlag });
      } else if (action === 'link_risk') {
        const relatedRiskId = window.prompt('Related risk id');
        if (!relatedRiskId) return;
        await linkAuditFindingToRisk({ audit_finding_id: auditFindingId, related_risk_id: relatedRiskId });
      } else if (action === 'link_compliance') {
        const relatedComplianceId = window.prompt('Related compliance item id');
        if (!relatedComplianceId) return;
        await linkAuditFindingToCompliance({ audit_finding_id: auditFindingId, related_compliance_id: relatedComplianceId });
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

  return (
    <section className="page-section">
      <ModuleHeader
        eyebrow="Patch 24 Audit findings workflow"
        title="Audit Findings Workflow Center"
        subtitle="Governed lifecycle from finding issue through response, action plan, evidence, auditor validation, escalation and closure pack."
        action={canManageFindings ? (
          <div className="inline-actions">
            <button className="primary-button" onClick={() => setFormOpen(true)}>New Finding</button>
          </div>
        ) : null}
      />

      <CapaExecutionPanel />
      <ControlAssuranceReadinessPanel />

      <ProfessionalGrcWorkflowMap highlight="audit" />
      <ProfessionalGrcMaturityPanel domain="audit" />
      <AuditProgramWorkflowMap highlight="engagement-planning" />
      <AuditEngagementChecklist />
      <AuditAssuranceCoveragePanel />
      <FrameworkCrosswalkBackbonePanel context="audit" />

      {error ? <div className="panel error-panel">{error}</div> : null}
      {message ? <div className="notice-banner">{message}</div> : null}

      <div className="operations-kpi-grid">
        <MetricCard label="Findings register" value={metrics.register} />
        <MetricCard label="Workflow queue" value={metrics.queue} tone={metrics.queue ? 'warning' : 'success'} />
        <MetricCard label="Overdue findings" value={metrics.overdue} tone={metrics.overdue ? 'danger' : 'success'} />
        <MetricCard label="Closure blocked" value={metrics.blocked} tone={metrics.blocked ? 'danger' : 'success'} />
        <MetricCard label="Escalations" value={metrics.escalations} tone={metrics.escalations ? 'warning' : undefined} />
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
      ) : (
        <div className="notice-banner">No Patch 24 audit workflow warnings are currently visible in your RLS scope.</div>
      )}

      <div className="panel two-column">
        <div>
          <h4>Audit closure rule</h4>
          <p className="muted">Closure requires accepted response, accepted/completed corrective action, accepted evidence or approved waiver where evidence is required, and auditor validation.</p>
        </div>
        <div className="mini-card"><span>Follow-up chain</span><strong>Finding - Response - Action Plan - Evidence - Validation - Closure Pack</strong></div>
      </div>

      <div className="panel">
        <div className="panel-header"><h4><ClipboardCheck size={18} /> Audit findings register</h4></div>
        <DataState
          loading={findings.loading}
          error={findings.error}
          empty={!findings.data?.length}
          emptyTitle="No audit findings in your scope"
          emptyMessage={
            canManageFindings
              ? 'Create a controlled finding when an audit issue requires tracked remediation.'
              : 'No audit findings are currently available for this read-only account.'
          }
        >
          <EntityTable<AuditFindingRow>
            rows={findings.data || []}
            getRowKey={row => row.id}
            columns={[
              { key: 'code', header: 'Code', render: row => row.finding_code || '-' },
              { key: 'title', header: 'Finding', render: row => <button className="link-button" type="button" onClick={() => setSelectedFindingId(row.id)}><strong>{row.title}</strong></button> },
              { key: 'department', header: 'Department', render: row => departmentName(row.departments) },
              { key: 'owner', header: 'Owner', render: row => ownerName(row.owner) },
              { key: 'due', header: 'Due', render: row => formatDate(row.due_date) },
              { key: 'status', header: 'Lifecycle', render: row => <StatusBadge status={humanize(row.finding_status || row.status)} /> },
              { key: 'severity', header: 'Severity', render: row => <span className={`risk-pill ${row.severity_level || row.risk_level}`}>{row.severity_level || row.risk_level}</span> },
              {
                key: 'actions',
                header: 'Actions',
                render: row => canManageFindings ? (
                  <div className="inline-actions">
                    <button className="ghost-button compact-button" disabled={actionDisabled} title="Issue finding" onClick={() => void runFindingAction('issue', row.id)}><Send size={14} /></button>
                    <button className="ghost-button compact-button" disabled={actionDisabled} title="Request closure" onClick={() => void runFindingAction('request_closure', row.id)}><FileCheck2 size={14} /></button>
                    <button className="ghost-button compact-button" disabled={actionDisabled} title="Escalate" onClick={() => void runFindingAction('escalate', row.id)}><Flag size={14} /></button>
                  </div>
                ) : '-',
              },
            ]}
          />
        </DataState>
      </div>

      <div className="panel">
        <div className="panel-header"><h4><Clock size={18} /> Workflow queue</h4></div>
        <DataState loading={workflowQueue.loading} error={workflowQueue.error} empty={!workflowQueue.data?.length} emptyTitle="No workflow queue items" emptyMessage="Findings requiring response, action, evidence, validation, correction, closure or escalation appear here.">
          <EntityTable<AuditFindingWorkflowQueueRow>
            rows={workflowQueue.data || []}
            getRowKey={row => row.audit_finding_id}
            columns={[
              { key: 'finding', header: 'Finding', render: row => <button className="link-button" type="button" onClick={() => setSelectedFindingId(row.audit_finding_id)}>{row.finding_code || row.title}</button> },
              { key: 'reason', header: 'Queue reason', render: row => humanize(row.queue_reason) },
              { key: 'response', header: 'Response', render: row => <StatusBadge status={humanize(row.management_response_status)} /> },
              { key: 'action', header: 'Action plan', render: row => <StatusBadge status={humanize(row.corrective_action_status)} /> },
              { key: 'evidence', header: 'Evidence', render: row => `${row.accepted_evidence_count} / ${row.minimum_accepted_evidence_count}` },
              { key: 'due', header: 'Due', render: row => formatDate(row.due_date || row.management_response_due_date || row.corrective_action_due_date) },
              {
                key: 'actions',
                header: 'Actions',
                render: row => canManageFindings ? (
                  <div className="inline-actions">
                    <button className="ghost-button compact-button" disabled={actionDisabled} title="Submit response" onClick={() => void runFindingAction('submit_response', row.audit_finding_id)}><Send size={14} /></button>
                    <button className="ghost-button compact-button" disabled={actionDisabled} title="Accept response" onClick={() => void runFindingAction('accept_response', row.audit_finding_id)}><ThumbsUp size={14} /></button>
                    <button className="ghost-button compact-button" disabled={actionDisabled} title="Reject response" onClick={() => void runFindingAction('reject_response', row.audit_finding_id)}><XCircle size={14} /></button>
                    <button className="ghost-button compact-button" disabled={actionDisabled} title="Submit action plan" onClick={() => void runFindingAction('submit_action', row.audit_finding_id)}><ClipboardCheck size={14} /></button>
                  </div>
                ) : '-',
              },
            ]}
          />
        </DataState>
      </div>

      <div className="panel">
        <div className="panel-header"><h4><AlertTriangle size={18} /> Overdue findings</h4></div>
        <DataState loading={overdueFindings.loading} error={overdueFindings.error} empty={!overdueFindings.data?.length} emptyTitle="No overdue audit workflow items" emptyMessage="Overdue responses, corrective actions, validations and findings appear here.">
          <EntityTable<OverdueAuditFindingRow>
            rows={overdueFindings.data || []}
            getRowKey={row => row.audit_finding_id}
            columns={[
              { key: 'finding', header: 'Finding', render: row => <button className="link-button" type="button" onClick={() => setSelectedFindingId(row.audit_finding_id)}>{row.finding_code || row.title}</button> },
              { key: 'reason', header: 'Reason', render: row => humanize(row.overdue_reason) },
              { key: 'days', header: 'Days', render: row => row.days_overdue },
              { key: 'owner', header: 'Owner', render: row => row.responsible_owner_name || '-' },
              { key: 'severity', header: 'Severity', render: row => <StatusBadge status={humanize(row.severity_level)} /> },
            ]}
          />
        </DataState>
      </div>

      <div className="panel">
        <div className="panel-header"><h4><ShieldAlert size={18} /> Repeat/systemic findings</h4></div>
        <DataState loading={repeatFindings.loading} error={repeatFindings.error} empty={!repeatFindings.data?.length} emptyTitle="No repeat findings visible" emptyMessage="Repeat, systemic, or detected recurrence findings appear here.">
          <EntityTable<RepeatAuditFindingRow>
            rows={repeatFindings.data || []}
            getRowKey={row => row.audit_finding_id}
            columns={[
              { key: 'finding', header: 'Finding', render: row => <button className="link-button" type="button" onClick={() => setSelectedFindingId(row.audit_finding_id)}>{row.finding_code || row.title}</button> },
              { key: 'department', header: 'Department', render: row => row.department_name || '-' },
              { key: 'root', header: 'Root cause', render: row => row.root_cause_category || '-' },
              { key: 'repeat', header: 'Repeat count', render: row => Math.max(row.recurrence_count, row.detected_repeat_count) },
              { key: 'systemic', header: 'Systemic', render: row => row.systemic_issue_flag ? <StatusBadge status="Systemic" /> : '-' },
            ]}
          />
        </DataState>
      </div>

      <div className="panel">
        <div className="panel-header"><h4><FileCheck2 size={18} /> Closure gate status</h4></div>
        <DataState loading={closureGates.loading} error={closureGates.error} empty={!closureGates.data?.length} emptyTitle="No closure gates" emptyMessage="Closure gate status appears after Patch 24 migration is applied.">
          <EntityTable<AuditClosureGateStatusRow>
            rows={closureGates.data || []}
            getRowKey={row => row.audit_finding_id}
            columns={[
              { key: 'finding', header: 'Finding', render: row => <button className="link-button" type="button" onClick={() => setSelectedFindingId(row.audit_finding_id)}>{row.finding_code || row.title}</button> },
              { key: 'response', header: 'Status', render: row => <StatusBadge status={row.can_close ? 'Can close' : 'Blocked'} /> },
              { key: 'evidence', header: 'Evidence', render: row => row.evidence_required ? `${row.accepted_evidence_count} / ${row.minimum_accepted_evidence_count}` : 'Not required' },
              { key: 'waiver', header: 'Waivers', render: row => row.approved_waiver_count },
              { key: 'blocker', header: 'Blocker', render: row => humanize(row.closure_blocker) },
              {
                key: 'actions',
                header: 'Actions',
                render: row => canManageFindings ? (
                  <div className="inline-actions">
                    <button className="ghost-button compact-button" disabled={actionDisabled} title="Validate closure" onClick={() => void runFindingAction('validate_closure', row.audit_finding_id)}><ThumbsUp size={14} /></button>
                    <button className="ghost-button compact-button" disabled={actionDisabled} title="Reject closure" onClick={() => void runFindingAction('reject_closure', row.audit_finding_id)}><XCircle size={14} /></button>
                  </div>
                ) : '-',
              },
            ]}
          />
        </DataState>
      </div>

      <div className="panel">
        <div className="panel-header"><h4><Flag size={18} /> Executive escalations</h4></div>
        <DataState loading={executiveEscalations.loading} error={executiveEscalations.error} empty={!executiveEscalations.data?.length} emptyTitle="No executive escalations" emptyMessage="High, critical, overdue, repeat, systemic, and committee-required findings appear here.">
          <EntityTable<AuditExecutiveEscalationRow>
            rows={executiveEscalations.data || []}
            getRowKey={row => row.audit_finding_id}
            columns={[
              { key: 'finding', header: 'Finding', render: row => <button className="link-button" type="button" onClick={() => setSelectedFindingId(row.audit_finding_id)}>{row.finding_code || row.title}</button> },
              { key: 'reason', header: 'Reason', render: row => humanize(row.escalation_reason_code) },
              { key: 'level', header: 'Level', render: row => humanize(row.escalation_level) },
              { key: 'committee', header: 'Committee', render: row => row.committee_review_required ? <StatusBadge status={humanize(row.committee_review_status)} /> : '-' },
              { key: 'owner', header: 'Escalated to', render: row => row.escalated_to_name || row.escalated_to || '-' },
            ]}
          />
        </DataState>
      </div>

      <div className="panel">
        <div className="panel-header"><h4><PackageCheck size={18} /> Closure pack index</h4></div>
        <DataState loading={closurePackIndex.loading} error={closurePackIndex.error} empty={!closurePackIndex.data?.length} emptyTitle="No closure pack candidates" emptyMessage="Audit-ready closure pack candidates appear here with evidence and validation status.">
          <EntityTable<AuditClosurePackIndexRow>
            rows={closurePackIndex.data || []}
            getRowKey={row => row.audit_finding_id}
            columns={[
              { key: 'finding', header: 'Finding', render: row => <button className="link-button" type="button" onClick={() => setSelectedFindingId(row.audit_finding_id)}>{row.finding_code || row.title}</button> },
              { key: 'response', header: 'Response', render: row => <StatusBadge status={humanize(row.management_response_status)} /> },
              { key: 'action', header: 'Action', render: row => <StatusBadge status={humanize(row.corrective_action_status)} /> },
              { key: 'evidence', header: 'Evidence', render: row => `${row.accepted_evidence_count} accepted / ${row.linked_evidence_count} linked` },
              { key: 'validator', header: 'Validator', render: row => row.closure_validator_name || row.closure_validated_by || '-' },
              { key: 'generated', header: 'Pack', render: row => row.closure_pack_reference || formatDate(row.closure_pack_generated_at) },
            ]}
          />
        </DataState>
      </div>

      <Modal open={Boolean(selectedFindingId)} title="Audit finding detail" onClose={() => setSelectedFindingId(null)}>
        {selectedFinding ? (
          <div className="form-grid">
            <div className="detail-grid full-width">
              <DetailValue label="Finding" value={findingTitle(selectedFinding)} />
              <DetailValue label="Audit" value={selectedFinding.audit_title} />
              <DetailValue label="Severity" value={humanize(selectedFinding.severity_level || selectedFinding.risk_level)} />
              <DetailValue label="Lifecycle" value={humanize(selectedFinding.finding_status || selectedFinding.status)} />
              <DetailValue label="Stage" value={humanize(selectedFinding.workflow_stage)} />
              <DetailValue label="Department" value={departmentName(selectedFinding.departments)} />
              <DetailValue label="Owner" value={ownerName(selectedFinding.owner)} />
              <DetailValue label="Due date" value={formatDate(selectedFinding.due_date)} />
              <DetailValue label="Response status" value={humanize(selectedFinding.management_response_status)} />
              <DetailValue label="Action status" value={humanize(selectedFinding.corrective_action_status)} />
              <DetailValue label="Evidence gate" value={selectedGate ? humanize(selectedGate.evidence_gate_status) : humanize(selectedFinding.evidence_gate_status)} />
              <DetailValue label="Closure" value={selectedGate ? (selectedGate.can_close ? 'Can close' : humanize(selectedGate.closure_blocker)) : humanize(selectedFinding.closure_validation_status)} />
              <DetailValue label="Repeat/systemic" value={`${selectedFinding.repeat_finding_flag ? 'Repeat' : 'Not repeat'} / ${selectedFinding.systemic_issue_flag ? 'Systemic' : 'Not systemic'}`} />
              <DetailValue label="Related risk" value={selectedFinding.related_risk_id} />
              <DetailValue label="Related compliance" value={selectedFinding.related_compliance_id} />
              <DetailValue label="Source OVR" value={selectedFinding.source_ovr_id} />
              <DetailValue label="Closure pack" value={selectedPack?.closure_pack_reference || selectedFinding.closure_pack_reference} />
            </div>

            <div className="panel full-width">
              <div className="panel-header"><h4>Management response</h4></div>
              <p>{selectedFinding.management_response || 'No management response submitted.'}</p>
            </div>

            <div className="panel full-width">
              <div className="panel-header"><h4>Corrective action plan</h4></div>
              <p>{selectedFinding.corrective_action_plan || 'No corrective action plan submitted.'}</p>
            </div>

            <div className="panel full-width">
              <div className="panel-header"><h4>Action controls</h4></div>
              <div className="inline-actions">
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => void runFindingAction('issue', selectedFinding.id)}><Send size={16} /> Issue</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => void runFindingAction('submit_response', selectedFinding.id)}><Send size={16} /> Response</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => void runFindingAction('accept_response', selectedFinding.id)}><ThumbsUp size={16} /> Accept response</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => void runFindingAction('reject_response', selectedFinding.id)}><XCircle size={16} /> Reject response</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => void runFindingAction('submit_action', selectedFinding.id)}><ClipboardCheck size={16} /> Action plan</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => void runFindingAction('accept_action', selectedFinding.id)}><ThumbsUp size={16} /> Accept action</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => void runFindingAction('reject_action', selectedFinding.id)}><XCircle size={16} /> Reject action</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => void runFindingAction('request_extension', selectedFinding.id)}><Clock size={16} /> Extension</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => void runFindingAction('approve_extension', selectedFinding.id)}><ThumbsUp size={16} /> Approve extension</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => void runFindingAction('reject_extension', selectedFinding.id)}><XCircle size={16} /> Reject extension</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => void runFindingAction('request_closure', selectedFinding.id)}><FileCheck2 size={16} /> Request closure</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => void runFindingAction('validate_closure', selectedFinding.id)}><ThumbsUp size={16} /> Validate closure</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => void runFindingAction('reject_closure', selectedFinding.id)}><XCircle size={16} /> Reject closure</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => void runFindingAction('reopen', selectedFinding.id)}><RotateCcw size={16} /> Reopen</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => void runFindingAction('escalate', selectedFinding.id)}><Flag size={16} /> Escalate</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => void runFindingAction('mark_repeat', selectedFinding.id)}><ShieldAlert size={16} /> Mark repeat</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => void runFindingAction('link_risk', selectedFinding.id)}><Link2 size={16} /> Link risk</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => void runFindingAction('link_compliance', selectedFinding.id)}><Link2 size={16} /> Link compliance</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => void runFindingAction('generate_pack', selectedFinding.id)}><PackageCheck size={16} /> Generate pack</button>
              </div>
              {!canManageFindings ? <p className="muted">Your current role can view audit finding workflow data but cannot perform governed transitions.</p> : null}
            </div>

            <div className="panel full-width">
              <div className="panel-header"><h4>Validation events</h4></div>
              <DataState loading={validationEvents.loading} error={validationEvents.error} empty={false}>
                <EventTable rows={validationEvents.data || []} />
              </DataState>
            </div>
          </div>
        ) : (
          <DataState loading={findings.loading} error={findings.error} empty emptyTitle="Finding not loaded" emptyMessage="Refresh the register and select the finding again.">
            <div />
          </DataState>
        )}
      </Modal>

      <Modal open={formOpen} title="Create audit finding" onClose={() => setFormOpen(false)}>
        <AuditFindingForm organizationId={organizationId} departments={departments.data || []} profiles={profiles.data || []} onCancel={() => setFormOpen(false)} onCreated={() => { setFormOpen(false); void refreshAuditWorkflow(); }} />
      </Modal>
    </section>
  );
}
