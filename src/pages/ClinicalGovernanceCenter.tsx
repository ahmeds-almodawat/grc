import { useEffect, useMemo, useState } from 'react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import {
  getAuditEngagementRegister,
  getAuditFindingRegister,
  getAuditFindingsRequiringCapaOrEvidence,
  getAuditSignoffQueue,
  getAuditTestStepQueue,
  getClinicalGovernanceEscalationRegister,
  getDepartmentClinicalGovernanceWorkload,
  getExecutiveClinicalGovernanceSummary,
  getOverdueAuditOvrGovernanceItems,
  getOvrCapaEvidenceBridge,
  getOvrRcaCaseRegister,
  type AuditEngagementRegisterRow,
  type AuditFindingRegisterRow,
  type AuditSignoffQueueRow,
  type AuditTestStepQueueRow,
  type ClinicalGovernanceEscalationRow,
  type DepartmentClinicalGovernanceWorkloadRow,
  type ExecutiveClinicalGovernanceSummaryRow,
  type OvrCapaEvidenceBridgeRow,
  type OvrRcaCaseRegisterRow,
  type OverdueGovernanceItemRow,
} from '../lib/clinicalGovernanceApi';
import { getLiveResultMessage, isLive, type LiveResult } from '../lib/liveResult';

type Tone = 'neutral' | 'good' | 'warning' | 'danger';
type CellValue = string | number | boolean | null | undefined;

function emptyRows<T>(message: string): LiveResult<T[]> {
  return {
    status: 'empty',
    data: null,
    source: 'system',
    isLive: false,
    generatedAt: new Date(0).toISOString(),
    message,
  };
}

function rows<T>(result: LiveResult<T[]>): T[] {
  return isLive(result) ? result.data : [];
}

function first<T>(result: LiveResult<T[]>): T | null {
  return isLive(result) ? result.data[0] ?? null : null;
}

function formatValue(value: CellValue): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(1);
  return value.replaceAll('_', ' ');
}

function statusTone(status?: string | null): Tone {
  if (['active', 'completed', 'closed', 'accepted', 'signed_off', 'passed', 'resolved'].includes(status ?? '')) return 'good';
  if (['planned', 'fieldwork', 'reporting', 'in_progress', 'pending', 'under_review', 'awaiting_review', 'acknowledged'].includes(status ?? '')) return 'warning';
  if (['failed', 'exception', 'capa_required', 'evidence_required', 'rejected', 'reopened', 'action_required', 'cancelled'].includes(status ?? '')) return 'danger';
  return 'neutral';
}

function severityTone(value?: string | null): Tone {
  if (value === 'sentinel' || value === 'critical' || value === 'high') return 'danger';
  if (value === 'medium') return 'warning';
  if (value === 'low') return 'good';
  return 'neutral';
}

function signalTone(value?: string | null): Tone {
  if (value === 'on_track') return 'good';
  if (value === 'watch') return 'warning';
  if (value === 'attention_required' || value === 'sentinel_attention') return 'danger';
  return 'neutral';
}

function StatusBadge({ value }: { value?: string | null }) {
  return <StatusPill tone={statusTone(value)}>{formatValue(value)}</StatusPill>;
}

function SeverityBadge({ value }: { value?: string | null }) {
  return <StatusPill tone={severityTone(value)}>{formatValue(value)}</StatusPill>;
}

function EmptyRow({ label, columns }: { label: string; columns: number }) {
  return (
    <tr>
      <td colSpan={columns}><strong>No {label} records returned.</strong></td>
    </tr>
  );
}

function EngagementTable({ data }: { data: AuditEngagementRegisterRow[] }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead><tr><th>Engagement</th><th>Department</th><th>Lead</th><th>Status</th><th>Steps</th><th>Findings</th><th>Signoffs</th></tr></thead>
        <tbody>
          {data.length === 0 ? <EmptyRow label="audit engagement" columns={7} /> : data.slice(0, 80).map(row => (
            <tr key={row.id ?? row.engagement_title}>
              <td><strong>{formatValue(row.engagement_title)}</strong><br /><small>{formatValue(row.scope_summary)}</small></td>
              <td>{formatValue(row.department_name)}</td>
              <td>{formatValue(row.lead_auditor_name)}</td>
              <td><StatusBadge value={row.status} /></td>
              <td>{formatValue(row.completed_step_count)} / {formatValue(row.test_step_count)}</td>
              <td>{formatValue(row.open_finding_count)}</td>
              <td>{formatValue(row.pending_signoff_count)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TestStepTable({ data }: { data: AuditTestStepQueueRow[] }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead><tr><th>Step</th><th>Engagement</th><th>Program</th><th>Assignee</th><th>Status</th><th>Due</th><th>Evidence</th></tr></thead>
        <tbody>
          {data.length === 0 ? <EmptyRow label="audit test step" columns={7} /> : data.slice(0, 90).map(row => (
            <tr key={row.id ?? row.step_title}>
              <td><strong>{formatValue(row.step_code)}</strong><br /><small>{formatValue(row.step_title)}</small></td>
              <td>{formatValue(row.engagement_title)}</td>
              <td>{formatValue(row.program_title)}</td>
              <td>{formatValue(row.assigned_to_name)}</td>
              <td>{row.is_overdue ? <StatusPill tone="danger">Overdue</StatusPill> : <StatusBadge value={row.status} />}</td>
              <td>{formatValue(row.due_date)}</td>
              <td>{formatValue(row.expected_evidence)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FindingTable({ data, label }: { data: AuditFindingRegisterRow[]; label: string }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead><tr><th>Finding</th><th>Engagement</th><th>Severity</th><th>Status</th><th>Owner</th><th>Links</th><th>Due</th></tr></thead>
        <tbody>
          {data.length === 0 ? <EmptyRow label={label} columns={7} /> : data.slice(0, 90).map(row => (
            <tr key={row.id ?? row.finding_title}>
              <td><strong>{formatValue(row.finding_title)}</strong><br /><small>{formatValue(row.finding_description)}</small></td>
              <td>{formatValue(row.engagement_title)}<br /><small>{formatValue(row.step_title)}</small></td>
              <td><SeverityBadge value={row.severity} /></td>
              <td>{row.is_overdue ? <StatusPill tone="danger">Overdue</StatusPill> : <StatusBadge value={row.finding_status} />}</td>
              <td>{formatValue(row.owner_name ?? row.department_name)}</td>
              <td>CAPA {row.linked_capa_id ? 'Yes' : 'No'}<br /><small>Evidence {row.linked_evidence_bridge_link_id ? 'Yes' : 'No'}</small></td>
              <td>{formatValue(row.due_date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RcaTable({ data }: { data: OvrRcaCaseRegisterRow[] }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead><tr><th>RCA</th><th>Incident</th><th>Severity</th><th>Status</th><th>Owner</th><th>Links</th><th>Due</th></tr></thead>
        <tbody>
          {data.length === 0 ? <EmptyRow label="OVR RCA case" columns={7} /> : data.slice(0, 90).map(row => (
            <tr key={row.id ?? row.rca_title}>
              <td><strong>{formatValue(row.rca_title)}</strong><br /><small>{formatValue(row.root_cause_summary)}</small></td>
              <td>{formatValue(row.incident_reference)}</td>
              <td><SeverityBadge value={row.severity} /></td>
              <td>{row.is_overdue ? <StatusPill tone="danger">Overdue</StatusPill> : <StatusBadge value={row.rca_status} />}</td>
              <td>{formatValue(row.owner_name ?? row.department_name)}</td>
              <td>CAPA {formatValue(row.capa_link_count)}<br /><small>Evidence {formatValue(row.evidence_bridge_link_count)} / Clause {formatValue(row.accreditation_clause_link_count)}</small></td>
              <td>{formatValue(row.due_date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BridgeTable({ data }: { data: OvrCapaEvidenceBridgeRow[] }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead><tr><th>Incident/RCA</th><th>Linked entity</th><th>Role</th><th>Status</th><th>Evidence</th><th>Clause</th></tr></thead>
        <tbody>
          {data.length === 0 ? <EmptyRow label="OVR bridge" columns={6} /> : data.slice(0, 80).map(row => (
            <tr key={row.id ?? `${row.linked_entity_type}-${row.linked_entity_id}`}>
              <td><strong>{formatValue(row.incident_reference)}</strong><br /><small>{formatValue(row.rca_title)}</small></td>
              <td>{formatValue(row.linked_entity_type)}<br /><small>{formatValue(row.linked_entity_id)}</small></td>
              <td>{formatValue(row.link_role)}</td>
              <td><StatusBadge value={row.link_status} /></td>
              <td>{formatValue(row.evidence_status)}<br /><small>{formatValue(row.freshness_status)}</small></td>
              <td>{formatValue(row.clause_code)}<br /><small>{formatValue(row.clause_title)}</small></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EscalationTable({ data }: { data: ClinicalGovernanceEscalationRow[] }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead><tr><th>Item</th><th>Level</th><th>Status</th><th>Reason</th><th>Escalated to</th><th>Resolved</th></tr></thead>
        <tbody>
          {data.length === 0 ? <EmptyRow label="clinical governance escalation" columns={6} /> : data.slice(0, 80).map(row => (
            <tr key={row.id ?? row.escalated_at}>
              <td><strong>{formatValue(row.incident_reference ?? row.finding_title)}</strong><br /><small>{formatValue(row.rca_title)}</small></td>
              <td><SeverityBadge value={row.escalation_level} /></td>
              <td><StatusBadge value={row.escalation_status} /></td>
              <td>{formatValue(row.escalation_reason)}</td>
              <td>{formatValue(row.escalated_to_name ?? row.escalated_to_department_name)}</td>
              <td>{formatValue(row.resolved_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WorkloadTable({ data }: { data: DepartmentClinicalGovernanceWorkloadRow[] }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead><tr><th>Department</th><th>Audits</th><th>Findings</th><th>RCA</th><th>Escalations</th><th>Overdue</th></tr></thead>
        <tbody>
          {data.length === 0 ? <EmptyRow label="department workload" columns={6} /> : data.slice(0, 80).map(row => (
            <tr key={row.department_id ?? row.department_name}>
              <td><strong>{formatValue(row.department_name)}</strong></td>
              <td>{formatValue(row.active_audit_engagement_count)}</td>
              <td>{formatValue(row.open_audit_finding_count)}</td>
              <td>{formatValue(row.open_rca_case_count)}</td>
              <td>{formatValue(row.open_escalation_count)}</td>
              <td><StatusPill tone={(row.overdue_item_count ?? 0) > 0 ? 'danger' : 'good'}>{formatValue(row.overdue_item_count)}</StatusPill></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OverdueTable({ data }: { data: OverdueGovernanceItemRow[] }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead><tr><th>Type</th><th>Item</th><th>Status</th><th>Due</th></tr></thead>
        <tbody>
          {data.length === 0 ? <EmptyRow label="overdue governance item" columns={4} /> : data.slice(0, 80).map(row => (
            <tr key={row.item_id ?? row.item_title}>
              <td>{formatValue(row.item_type)}</td>
              <td><strong>{formatValue(row.item_title)}</strong></td>
              <td><StatusBadge value={row.item_status} /></td>
              <td>{formatValue(row.due_date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SignoffTable({ data }: { data: AuditSignoffQueueRow[] }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead><tr><th>Engagement</th><th>Type</th><th>Status</th><th>Signed by</th><th>Notes</th></tr></thead>
        <tbody>
          {data.length === 0 ? <EmptyRow label="audit signoff" columns={5} /> : data.slice(0, 80).map(row => (
            <tr key={row.id ?? `${row.engagement_title}-${row.signoff_type}`}>
              <td><strong>{formatValue(row.engagement_title)}</strong><br /><small>{formatValue(row.engagement_status)}</small></td>
              <td>{formatValue(row.signoff_type)}</td>
              <td><StatusBadge value={row.signoff_status} /></td>
              <td>{formatValue(row.signed_by_name)}</td>
              <td>{formatValue(row.signoff_notes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ClinicalGovernanceCenter() {
  const [engagements, setEngagements] = useState<LiveResult<AuditEngagementRegisterRow[]>>(emptyRows('No audit engagements loaded yet.'));
  const [steps, setSteps] = useState<LiveResult<AuditTestStepQueueRow[]>>(emptyRows('No audit test steps loaded yet.'));
  const [findings, setFindings] = useState<LiveResult<AuditFindingRegisterRow[]>>(emptyRows('No audit findings loaded yet.'));
  const [actionFindings, setActionFindings] = useState<LiveResult<AuditFindingRegisterRow[]>>(emptyRows('No CAPA or evidence finding actions loaded yet.'));
  const [signoffs, setSignoffs] = useState<LiveResult<AuditSignoffQueueRow[]>>(emptyRows('No audit signoffs loaded yet.'));
  const [rcaCases, setRcaCases] = useState<LiveResult<OvrRcaCaseRegisterRow[]>>(emptyRows('No OVR RCA cases loaded yet.'));
  const [bridge, setBridge] = useState<LiveResult<OvrCapaEvidenceBridgeRow[]>>(emptyRows('No OVR bridge links loaded yet.'));
  const [escalations, setEscalations] = useState<LiveResult<ClinicalGovernanceEscalationRow[]>>(emptyRows('No clinical governance escalations loaded yet.'));
  const [overdue, setOverdue] = useState<LiveResult<OverdueGovernanceItemRow[]>>(emptyRows('No overdue governance items loaded yet.'));
  const [workload, setWorkload] = useState<LiveResult<DepartmentClinicalGovernanceWorkloadRow[]>>(emptyRows('No department workload loaded yet.'));
  const [summary, setSummary] = useState<LiveResult<ExecutiveClinicalGovernanceSummaryRow[]>>(emptyRows('No executive summary loaded yet.'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const [
        engagementResult,
        stepResult,
        findingResult,
        actionFindingResult,
        signoffResult,
        rcaResult,
        bridgeResult,
        escalationResult,
        overdueResult,
        workloadResult,
        summaryResult,
      ] = await Promise.all([
        getAuditEngagementRegister(),
        getAuditTestStepQueue(),
        getAuditFindingRegister(),
        getAuditFindingsRequiringCapaOrEvidence(),
        getAuditSignoffQueue(),
        getOvrRcaCaseRegister(),
        getOvrCapaEvidenceBridge(),
        getClinicalGovernanceEscalationRegister(),
        getOverdueAuditOvrGovernanceItems(),
        getDepartmentClinicalGovernanceWorkload(),
        getExecutiveClinicalGovernanceSummary(),
      ]);

      if (!mounted) return;
      setEngagements(engagementResult);
      setSteps(stepResult);
      setFindings(findingResult);
      setActionFindings(actionFindingResult);
      setSignoffs(signoffResult);
      setRcaCases(rcaResult);
      setBridge(bridgeResult);
      setEscalations(escalationResult);
      setOverdue(overdueResult);
      setWorkload(workloadResult);
      setSummary(summaryResult);
      setLoading(false);
    }

    void load();
    return () => { mounted = false; };
  }, []);

  const engagementRows = rows(engagements);
  const stepRows = rows(steps);
  const findingRows = rows(findings);
  const actionFindingRows = rows(actionFindings);
  const signoffRows = rows(signoffs);
  const rcaRows = rows(rcaCases);
  const bridgeRows = rows(bridge);
  const escalationRows = rows(escalations);
  const overdueRows = rows(overdue);
  const workloadRows = rows(workload);
  const summaryRow = first(summary);

  const nonLiveMessages = useMemo(() => ([
    engagements, steps, findings, actionFindings, signoffs, rcaCases, bridge, escalations, overdue, workload, summary,
  ] as LiveResult<unknown>[])
    .filter(result => !isLive(result))
    .map(result => getLiveResultMessage(result))
    .filter((message, index, all) => all.indexOf(message) === index), [
      engagements, steps, findings, actionFindings, signoffs, rcaCases, bridge, escalations, overdue, workload, summary,
    ]);

  const hasAnyData = engagementRows.length > 0 || stepRows.length > 0 || findingRows.length > 0
    || actionFindingRows.length > 0 || signoffRows.length > 0 || rcaRows.length > 0
    || bridgeRows.length > 0 || escalationRows.length > 0 || overdueRows.length > 0
    || workloadRows.length > 0 || Boolean(summaryRow);

  return (
    <div className="page-stack clinical-governance-center">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Audit + OVR Clinical Governance</p>
          <h1>Clinical governance execution engine</h1>
          <p className="section-subtitle">
            Live audit execution, OVR RCA, CAPA/evidence/accreditation links, escalation tracking, overdue work, and executive clinical governance posture.
          </p>
        </div>
      </section>

      <DataState
        loading={loading}
        empty={!loading && !hasAnyData}
        emptyTitle="Clinical governance engine is installed, but no live execution records are visible yet"
        emptyMessage={nonLiveMessages[0] ?? 'Create an audit engagement or OVR RCA case to activate daily clinical governance operations.'}
      >
        <div className="kpi-grid">
          <KpiTile label="Executive signal" value={formatValue(summaryRow?.executive_signal)} hint="Clinical governance posture" tone={signalTone(summaryRow?.executive_signal)} />
          <KpiTile label="Active audits" value={summaryRow?.active_audit_engagement_count ?? engagementRows.length} hint="Audit engagements in execution" />
          <KpiTile label="Open test steps" value={summaryRow?.open_audit_test_step_count ?? stepRows.length} hint="Audit checklist work" tone={(summaryRow?.open_audit_test_step_count ?? stepRows.length) > 0 ? 'warning' : 'good'} />
          <KpiTile label="Open findings" value={summaryRow?.open_audit_finding_count ?? findingRows.length} hint="Audit findings not closed" tone={(summaryRow?.open_audit_finding_count ?? findingRows.length) > 0 ? 'warning' : 'good'} />
          <KpiTile label="RCA cases" value={summaryRow?.open_rca_case_count ?? rcaRows.length} hint="OVR/patient safety RCA" tone={(summaryRow?.severe_rca_case_count ?? 0) > 0 ? 'danger' : 'neutral'} />
          <KpiTile label="Overdue" value={summaryRow?.overdue_governance_item_count ?? overdueRows.length} hint="Blocked governance work" tone={(summaryRow?.overdue_governance_item_count ?? overdueRows.length) > 0 ? 'danger' : 'good'} />
        </div>

        <ModernCard title="Audit engagement register" subtitle="Active audit campaigns with programs, test step progress, open findings, and signoffs.">
          <EngagementTable data={engagementRows} />
        </ModernCard>

        <ModernCard title="Audit test step queue" subtitle="DB-backed audit checklist work with assignees, due dates, and expected evidence.">
          <TestStepTable data={stepRows} />
        </ModernCard>

        <ModernCard title="Audit findings" subtitle="Findings connected to owners, departments, CAPA, evidence bridge, and accreditation clauses.">
          <FindingTable data={findingRows} label="audit finding" />
        </ModernCard>

        <ModernCard title="Findings requiring CAPA or evidence" subtitle="Audit findings that need corrective action or accepted evidence before closure.">
          <FindingTable data={actionFindingRows} label="finding action" />
        </ModernCard>

        <ModernCard title="Audit signoff queue" subtitle="Lead auditor, quality, executive, and department owner signoff work.">
          <SignoffTable data={signoffRows} />
        </ModernCard>

        <ModernCard title="OVR RCA cases" subtitle="Patient safety RCA cases, severity, ownership, links, and overdue status.">
          <RcaTable data={rcaRows} />
        </ModernCard>

        <ModernCard title="OVR-CAPA-evidence bridge" subtitle="Links from incidents and RCA cases to CAPA, evidence bridge, accreditation clauses, risks, audits, documents, training, and controls.">
          <BridgeTable data={bridgeRows} />
        </ModernCard>

        <ModernCard title="Clinical governance escalations" subtitle="Severe, sentinel, executive, quality, and department escalation register.">
          <EscalationTable data={escalationRows} />
        </ModernCard>

        <ModernCard title="Overdue audit/OVR governance items" subtitle="Audit test steps, audit findings, and RCA cases past due.">
          <OverdueTable data={overdueRows} />
        </ModernCard>

        <ModernCard title="Department clinical governance workload" subtitle="Audit, RCA, escalation, and overdue work by department.">
          <WorkloadTable data={workloadRows} />
        </ModernCard>
      </DataState>
    </div>
  );
}
