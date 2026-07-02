import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';
import { EntityTable } from '../components/EntityTable';
import { RiskForm } from '../components/GrcForms';
import { Modal } from '../components/Modal';
import { ModuleHeader } from '../components/ModuleHeader';
import { ScenarioFillButton } from '../components/ScenarioFillButton';
import { StatusBadge } from '../components/StatusBadge';
import { ProfessionalGrcMaturityPanel } from '../components/v140/ProfessionalGrcMaturityPanel';
import { ProfessionalGrcWorkflowMap } from '../components/v140/ProfessionalGrcWorkflowMap';
import { RiskAppetiteTreatmentPanel } from '../components/v170/RiskAppetiteTreatmentPanel';
import { RiskControlTraceabilityPanel } from '../components/v170/RiskControlTraceabilityPanel';
import { RiskExecutionWorkflowMap } from '../components/v170/RiskExecutionWorkflowMap';
import { departmentName, formatDate, humanize, ownerName } from '../lib/format';
import {
  approveRiskAcceptance,
  approveRiskClosure,
  completeRiskTreatment,
  getDepartments,
  getExecutiveRiskEscalations,
  getOrganizations,
  getProfiles,
  getRiskAppetiteBreaches,
  getRiskClosureBlockers,
  getRiskKriAlerts,
  getRiskReassessmentHistory,
  getRiskTreatmentQueue,
  getRiskWorkflowEvents,
  getRiskWorkflowQueue,
  getRisks,
  linkRiskSource,
  markDuplicateRisk,
  rejectRiskAcceptance,
  reopenRiskWithReason,
  requestRiskAcceptance,
  requestRiskClosure,
  updateRiskAssessment,
  updateRiskTreatment,
} from '../lib/grcApi';
import { useAsyncData } from '../hooks/useAsyncData';
import type { RiskReassessmentHistoryRow, RiskRow, RiskWorkflowEventRow } from '../types/domain';
import '../styles/v170-enterprise-risk.css';
import {
  createScenarioLabScenario,
  V99_SCENARIO_TAG,
} from '../lib/scenarioLab';
import { FrameworkCrosswalkBackbonePanel } from '../components/v210/FrameworkCrosswalkBackbonePanel';
import { ControlTestingWorkflowPanel } from '../components/v220/ControlTestingWorkflowPanel';
import { ControlAssuranceReadinessPanel } from '../components/v220/ControlAssuranceReadinessPanel';

export function Risks() {
  const auth = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [controlFormOpen, setControlFormOpen] = useState(false);
  const [controlBusy, setControlBusy] = useState(false);
  const [controlMessage, setControlMessage] = useState<string | null>(null);
  const [selectedRisk, setSelectedRisk] = useState<RiskRow | null>(null);
  const [riskHistory, setRiskHistory] = useState<RiskReassessmentHistoryRow[]>([]);
  const [riskEvents, setRiskEvents] = useState<RiskWorkflowEventRow[]>([]);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);
  const risks = useAsyncData(getRisks, []);
  const workflowQueue = useAsyncData(getRiskWorkflowQueue, []);
  const appetiteBreaches = useAsyncData(getRiskAppetiteBreaches, []);
  const treatmentQueue = useAsyncData(getRiskTreatmentQueue, []);
  const kriAlerts = useAsyncData(getRiskKriAlerts, []);
  const executiveEscalations = useAsyncData(getExecutiveRiskEscalations, []);
  const closureBlockers = useAsyncData(getRiskClosureBlockers, []);
  const departments = useAsyncData(getDepartments, []);
  const profiles = useAsyncData(getProfiles, []);
  const organizations = useAsyncData(getOrganizations, []);
  const organizationId = organizations.data?.[0]?.id || '';
  const canUseScenarioControls = auth.roles.some(
    (role) => ['super_admin', 'governance_admin'].includes(role.role),
  );
  const canManageRisks = auth.roles.some(
    role => ['super_admin', 'governance_admin', 'division_head', 'department_manager', 'compliance_officer'].includes(role.role)
  );
  const riskRows = risks.data || [];
  const queueRows = workflowQueue.data || [];
  const breachRows = appetiteBreaches.data || [];
  const treatmentRows = treatmentQueue.data || [];
  const kriRows = kriAlerts.data || [];
  const escalationRows = executiveEscalations.data || [];
  const blockerRows = closureBlockers.data || [];
  const selectedBlocker = selectedRisk ? blockerRows.find(row => row.risk_id === selectedRisk.id) : null;
  const selectedQueueRows = selectedRisk ? queueRows.filter(row => row.risk_id === selectedRisk.id) : [];
  const selectedWarnings = useMemo(() => {
    if (!selectedRisk) return [];
    return [
      selectedRisk.appetite_breached ? 'Above appetite' : '',
      selectedRisk.treatment_required && selectedRisk.treatment_status !== 'completed' ? 'Treatment required' : '',
      selectedRisk.review_overdue ? 'Review overdue' : '',
      selectedBlocker?.blocker_reason ? `Closure blocked: ${selectedBlocker.blocker_reason}` : '',
      selectedRisk.escalation_required ? 'Executive or management escalation required' : '',
    ].filter(Boolean);
  }, [selectedBlocker?.blocker_reason, selectedRisk]);

  async function refreshRiskWorkflow() {
    await Promise.all([
      risks.refresh(),
      workflowQueue.refresh(),
      appetiteBreaches.refresh(),
      treatmentQueue.refresh(),
      kriAlerts.refresh(),
      executiveEscalations.refresh(),
      closureBlockers.refresh(),
    ]);
    if (selectedRisk) {
      const [history, events] = await Promise.all([
        getRiskReassessmentHistory(selectedRisk.id),
        getRiskWorkflowEvents(selectedRisk.id),
      ]);
      setRiskHistory(history);
      setRiskEvents(events);
    }
  }

  useEffect(() => {
    let cancelled = false;
    if (!selectedRisk) {
      setRiskHistory([]);
      setRiskEvents([]);
      return;
    }
    Promise.all([
      getRiskReassessmentHistory(selectedRisk.id),
      getRiskWorkflowEvents(selectedRisk.id),
    ]).then(([history, events]) => {
      if (!cancelled) {
        setRiskHistory(history);
        setRiskEvents(events);
      }
    }).catch(error => {
      if (!cancelled) setWorkflowMessage(error instanceof Error ? error.message : 'Unable to load risk workflow history.');
    });
    return () => { cancelled = true; };
  }, [selectedRisk]);

  async function runRiskAction(label: string, action: () => Promise<unknown>) {
    setWorkflowBusy(true);
    setWorkflowMessage(null);
    try {
      await action();
      setWorkflowMessage(`${label} saved.`);
      await refreshRiskWorkflow();
    } catch (error) {
      setWorkflowMessage(error instanceof Error ? error.message : `${label} failed.`);
    } finally {
      setWorkflowBusy(false);
    }
  }

  function promptText(label: string, fallback = '') {
    const value = window.prompt(label, fallback);
    return value === null ? null : value.trim();
  }

  function defaultExpiryDate() {
    const date = new Date();
    date.setDate(date.getDate() + 90);
    return date.toISOString().slice(0, 10);
  }

  async function reassessSelectedRisk() {
    if (!selectedRisk) return;
    const residualLikelihood = Number(promptText('Residual likelihood 1-5', String(selectedRisk.residual_likelihood ?? 3)));
    const residualImpact = Number(promptText('Residual impact 1-5', String(selectedRisk.residual_impact ?? 3)));
    const reason = promptText('Reason for score change');
    if (!reason) return;
    await runRiskAction('Risk reassessment', () => updateRiskAssessment({
      risk_id: selectedRisk.id,
      likelihood: selectedRisk.likelihood,
      impact: selectedRisk.impact,
      residual_likelihood: residualLikelihood,
      residual_impact: residualImpact,
      appetite_threshold: selectedRisk.appetite_threshold ?? 12,
      change_reason: reason,
    }));
  }

  async function requestAcceptanceForSelectedRisk() {
    if (!selectedRisk) return;
    const reason = promptText('Acceptance reason');
    if (!reason) return;
    const acceptance_expiry_date = promptText('Acceptance expiry date', selectedRisk.acceptance_expiry_date || defaultExpiryDate());
    if (!acceptance_expiry_date) return;
    await runRiskAction('Risk acceptance request', () => requestRiskAcceptance({ risk_id: selectedRisk.id, reason, acceptance_expiry_date }));
  }

  async function updateTreatmentForSelectedRisk() {
    if (!selectedRisk) return;
    const treatment_plan_summary = promptText('Treatment plan summary', selectedRisk.treatment_plan_summary || '');
    if (!treatment_plan_summary) return;
    const treatment_due_date = promptText('Treatment due date', selectedRisk.treatment_due_date || defaultExpiryDate()) || undefined;
    await runRiskAction('Risk treatment', () => updateRiskTreatment({
      risk_id: selectedRisk.id,
      treatment_status: 'planned',
      treatment_plan_summary,
      treatment_due_date,
      treatment_owner_id: selectedRisk.treatment_owner_id || selectedRisk.owner_id || undefined,
      note: treatment_plan_summary,
    }));
  }

  async function linkSourceForSelectedRisk() {
    if (!selectedRisk) return;
    const source_ovr_id = promptText('Source OVR id, optional', selectedRisk.source_ovr_id || '') || undefined;
    const source_audit_finding_id = promptText('Source audit finding id, optional', selectedRisk.source_audit_finding_id || '') || undefined;
    const source_compliance_id = promptText('Source compliance id, optional', selectedRisk.source_compliance_id || '') || undefined;
    const source_project_id = promptText('Source project id, optional', selectedRisk.source_project_id || '') || undefined;
    await runRiskAction('Risk source link', () => linkRiskSource({
      risk_id: selectedRisk.id,
      source_ovr_id,
      source_audit_finding_id,
      source_compliance_id,
      source_project_id,
      note: 'Source linkage updated',
    }));
  }

  async function markDuplicateForSelectedRisk() {
    if (!selectedRisk) return;
    const duplicate_of_risk_id = promptText('Duplicate of risk id', selectedRisk.duplicate_of_risk_id || '');
    if (!duplicate_of_risk_id) return;
    const reason = promptText('Duplicate / related-risk reason', 'Duplicate or related risk signal') || undefined;
    await runRiskAction('Duplicate risk signal', () => markDuplicateRisk({ risk_id: selectedRisk.id, duplicate_of_risk_id, reason }));
  }

  async function createSyntheticControl() {
    setControlBusy(true);
    setControlMessage(null);
    try {
      const result = await createScenarioLabScenario('control');
      setControlMessage(`Synthetic control created: ${result.id}`);
      await risks.refresh();
    } catch (error) {
      setControlMessage(error instanceof Error ? error.message : 'Failed to create synthetic control.');
    } finally {
      setControlBusy(false);
    }
  }

  return (
    <section className="page-section">
      <ModuleHeader
        eyebrow="Enterprise risk execution cockpit"
        title="Risk identification, appetite, treatment, control linkage and executive reporting"
        subtitle="v17 turns the risk register into an ERM execution flow from assessment through KRIs, treatment, control evidence, escalation and reporting."
        action={(
          <div className="inline-actions">
            {canUseScenarioControls ? (
              <ScenarioFillButton
                label="Test-fill Control"
                onClick={() => setControlFormOpen(true)}
              />
            ) : null}
            {canManageRisks ? <button className="primary-button" onClick={() => setFormOpen(true)}>New Risk</button> : null}
          </div>
        )}
      />

      {/* v22-control-testing-capa: risk control testing linkage */}
      <ControlTestingWorkflowPanel />
      <ControlAssuranceReadinessPanel />
      <FrameworkCrosswalkBackbonePanel context="risk" />


      {controlMessage ? <div className="notice-banner">{controlMessage}</div> : null}
      {workflowMessage ? <div className="notice-banner">{workflowMessage}</div> : null}

      <div className="module-grid">
        <div className="module-card danger"><strong>Enterprise risk register</strong><span>Strategic, financial, regulatory, clinical and operational risk records.</span></div>
        <div className="module-card"><strong>Risk assessment and scoring</strong><span>Inherent and residual score with treatment priority.</span></div>
        <div className="module-card"><strong>Risk appetite / KRI monitoring</strong><span>Thresholds and indicators that show when risk moves outside tolerance.</span></div>
        <div className="module-card"><strong>Control mapping</strong><span>Connect material risks to controls, testing, issues and CAPA.</span></div>
      </div>

      <ProfessionalGrcWorkflowMap highlight="risk" />
      <ProfessionalGrcMaturityPanel domain="risk" />
      <RiskExecutionWorkflowMap highlight="risk-assessment" />
      <RiskAppetiteTreatmentPanel />
      <RiskControlTraceabilityPanel />

      <div className="panel two-column">
        <div>
          <h4>Risk closure rule</h4>
          <p className="muted">A high or out-of-appetite risk should not be closed only because the owner changed status. Closure should require treatment evidence, control linkage, residual reassessment and governance acceptance where exposure remains material.</p>
        </div>
        <div className="mini-card"><span>Professional ERM workflow</span><strong>Risk → Appetite / KRI → Treatment → Control Test → Evidence → Issue / CAPA → Executive Reporting</strong></div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div><h4>Patch 22 workflow queues</h4><p className="muted">Review, treatment, acceptance, closure and escalation items generated from governed risk state.</p></div>
          <span className="status-chip warning">{queueRows.length} active</span>
        </div>
        <div className="module-grid">
          <div className="module-card danger"><strong>Appetite breaches</strong><span>{breachRows.length} risks above appetite or tolerance.</span></div>
          <div className="module-card warning"><strong>Treatment queue</strong><span>{treatmentRows.length} treatment plans required or overdue.</span></div>
          <div className="module-card warning"><strong>KRI alerts</strong><span>{kriRows.length} warning or critical early signals.</span></div>
          <div className="module-card danger"><strong>Executive escalations</strong><span>{escalationRows.length} board or executive-visible risks.</span></div>
          <div className="module-card"><strong>Closure blockers</strong><span>{blockerRows.filter(row => row.blocker_reason).length} risks blocked by evidence, review, KRI, acceptance or treatment rules.</span></div>
        </div>
        <DataState
          loading={workflowQueue.loading}
          error={workflowQueue.error}
          empty={!queueRows.length}
          emptyTitle="No risk workflow items"
          emptyMessage="Risks needing review, treatment, acceptance, closure approval or escalation will appear here."
        >
          <EntityTable
            rows={queueRows.slice(0, 12)}
            getRowKey={row => `${row.risk_id}-${row.queue_reason}`}
            columns={[
              { key: 'risk', header: 'Risk', render: row => <button className="link-button" onClick={() => setSelectedRisk(riskRows.find(risk => risk.id === row.risk_id) || null)}>{row.risk_code || row.title}</button> },
              { key: 'reason', header: 'Reason', render: row => humanize(row.queue_reason) },
              { key: 'owner', header: 'Owner', render: row => row.risk_owner_name || '—' },
              { key: 'due', header: 'Due', render: row => formatDate(row.due_date) },
              { key: 'status', header: 'Status', render: row => <StatusBadge status={humanize(row.status)} /> },
              { key: 'risk', header: 'Level', render: row => <span className={`risk-pill ${row.risk_level}`}>{row.risk_level}</span> },
            ]}
          />
        </DataState>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div><h4>Treatment queue</h4><p className="muted">Treatment-required and overdue risks with accountable owner and due date.</p></div>
          <span className="status-chip warning">{treatmentRows.length} queued</span>
        </div>
        <DataState loading={treatmentQueue.loading} error={treatmentQueue.error} empty={!treatmentRows.length} emptyTitle="No treatment queue items">
          <EntityTable
            rows={treatmentRows.slice(0, 12)}
            getRowKey={row => row.risk_id}
            columns={[
              { key: 'risk', header: 'Risk', render: row => <button className="link-button" onClick={() => setSelectedRisk(riskRows.find(risk => risk.id === row.risk_id) || null)}>{row.risk_code || row.title}</button> },
              { key: 'score', header: 'Residual', render: row => row.residual_score },
              { key: 'status', header: 'Treatment', render: row => <StatusBadge status={humanize(row.treatment_status)} /> },
              { key: 'owner', header: 'Owner', render: row => row.treatment_owner_name || '—' },
              { key: 'due', header: 'Due', render: row => formatDate(row.treatment_due_date) },
              { key: 'overdue', header: 'Overdue', render: row => row.treatment_overdue ? <span className="risk-pill high">Overdue</span> : <span className="status-chip good">On track</span> },
            ]}
          />
        </DataState>
      </div>

      <div className="two-column">
        <div className="panel">
          <div className="panel-header"><div><h4>Appetite breaches</h4><p className="muted">Residual exposure outside approved tolerance.</p></div></div>
          <DataState loading={appetiteBreaches.loading} error={appetiteBreaches.error} empty={!breachRows.length} emptyTitle="No appetite breaches">
            <EntityTable
              rows={breachRows.slice(0, 8)}
              getRowKey={row => row.risk_id}
              columns={[
                { key: 'risk', header: 'Risk', render: row => row.risk_code || row.title },
                { key: 'score', header: 'Residual', render: row => `${row.residual_score}/${row.appetite_threshold}` },
                { key: 'acceptance', header: 'Acceptance', render: row => <StatusBadge status={humanize(row.acceptance_status)} /> },
              ]}
            />
          </DataState>
        </div>
        <div className="panel">
          <div className="panel-header"><div><h4>Closure blockers</h4><p className="muted">Risks cannot close while a blocker remains active.</p></div></div>
          <DataState loading={closureBlockers.loading} error={closureBlockers.error} empty={!blockerRows.filter(row => row.blocker_reason).length} emptyTitle="No closure blockers">
            <EntityTable
              rows={blockerRows.filter(row => row.blocker_reason).slice(0, 8)}
              getRowKey={row => row.risk_id}
              columns={[
                { key: 'risk', header: 'Risk', render: row => row.risk_code || row.title },
                { key: 'blocker', header: 'Blocker', render: row => row.blocker_reason || '—' },
              ]}
            />
          </DataState>
        </div>
      </div>

      <div className="two-column">
        <div className="panel">
          <div className="panel-header"><div><h4>KRI alerts</h4><p className="muted">Warning and critical indicators tied to risk records.</p></div></div>
          <DataState loading={kriAlerts.loading} error={kriAlerts.error} empty={!kriRows.length} emptyTitle="No KRI alerts">
            <EntityTable
              rows={kriRows.slice(0, 8)}
              getRowKey={row => row.kri_id}
              columns={[
                { key: 'kri', header: 'KRI', render: row => row.kri_code || row.name_en },
                { key: 'risk', header: 'Risk', render: row => row.risk_code || row.risk_title },
                { key: 'value', header: 'Value', render: row => row.current_value ?? '—' },
                { key: 'status', header: 'Status', render: row => <StatusBadge status={humanize(row.status)} /> },
              ]}
            />
          </DataState>
        </div>
        <div className="panel">
          <div className="panel-header"><div><h4>Executive escalations</h4><p className="muted">Critical or executive-visible risk exposure.</p></div></div>
          <DataState loading={executiveEscalations.loading} error={executiveEscalations.error} empty={!escalationRows.length} emptyTitle="No executive escalations">
            <EntityTable
              rows={escalationRows.slice(0, 8)}
              getRowKey={row => row.risk_id}
              columns={[
                { key: 'risk', header: 'Risk', render: row => row.risk_code || row.title },
                { key: 'score', header: 'Residual', render: row => row.residual_score },
                { key: 'level', header: 'Escalation', render: row => humanize(row.escalation_level) },
                { key: 'owner', header: 'Owner', render: row => row.executive_owner_name || '—' },
              ]}
            />
          </DataState>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header"><div><h4>Enterprise risk register</h4><p className="muted">Operational risk records with owner, scoring, review date and residual exposure visibility.</p></div><span className="status-chip neutral">ERM record source</span></div>
        <DataState
          loading={risks.loading}
          error={risks.error}
          empty={!risks.data?.length}
          emptyTitle="No risks in your scope"
          emptyMessage={
            canManageRisks
              ? 'Start by adding an identified risk with an owner, treatment and review date.'
              : 'No risk records are currently available for this read-only role and scope.'
          }
        >
          <EntityTable<RiskRow>
            rows={risks.data || []}
            getRowKey={row => row.id}
            columns={[
              { key: 'code', header: 'Code', render: row => row.risk_code || '—' },
              { key: 'title', header: 'Risk', render: row => <strong>{row.title}</strong> },
              { key: 'category', header: 'Category', render: row => humanize(row.category) },
              { key: 'department', header: 'Department', render: row => departmentName(row.departments) },
              { key: 'owner', header: 'Owner', render: row => ownerName(row.owner) },
              { key: 'score', header: 'Score', render: row => `${row.inherent_score} → ${row.residual_score}` },
              { key: 'appetite', header: 'Appetite', render: row => row.appetite_breached ? <span className="risk-pill high">Breached</span> : <span className="status-chip good">Within</span> },
              { key: 'treatment', header: 'Treatment', render: row => <StatusBadge status={humanize(row.treatment_status || 'not required')} /> },
              { key: 'review', header: 'Next Review', render: row => formatDate(row.next_review_date) },
              { key: 'status', header: 'Status', render: row => <StatusBadge status={humanize(row.status)} /> },
              { key: 'level', header: 'Level', render: row => <span className={`risk-pill ${row.risk_level}`}>{row.risk_level}</span> },
              { key: 'actions', header: 'Actions', render: row => <button className="ghost-button" onClick={() => setSelectedRisk(row)}>Workflow</button> }
            ]}
          />
        </DataState>
      </div>

      <Modal open={formOpen} title="Create risk" onClose={() => setFormOpen(false)}>
        <RiskForm organizationId={organizationId} departments={departments.data || []} profiles={profiles.data || []} onCancel={() => setFormOpen(false)} onCreated={() => { setFormOpen(false); void risks.refresh(); }} />
      </Modal>

      <Modal
        open={controlFormOpen}
        title="Synthetic control test fill"
        onClose={() => setControlFormOpen(false)}
      >
        <div className="form-grid">
          <div className="notice-banner full-width">
            Fields are synthetic and cleanup-registered under <code>{V99_SCENARIO_TAG}</code>.
          </div>
          <label className="field full-width">
            <span>Control title</span>
            <input readOnly value={`[${V99_SCENARIO_TAG}] Synthetic preventive control`} />
          </label>
          <label className="field full-width">
            <span>Description</span>
            <textarea
              readOnly
              value={`[${V99_SCENARIO_TAG}] Synthetic control for pilot visibility and workflow checks.`}
            />
          </label>
          <label className="field">
            <span>Type</span>
            <input readOnly value="Preventive" />
          </label>
          <label className="field">
            <span>Frequency</span>
            <input readOnly value="Monthly" />
          </label>
          <div className="form-actions full-width">
            <button className="ghost-button" type="button" onClick={() => setControlFormOpen(false)}>
              Cancel
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={controlBusy}
              onClick={() => void createSyntheticControl()}
            >
              {controlBusy ? 'Creating…' : 'Create synthetic record'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(selectedRisk)} title="Risk workflow detail" onClose={() => setSelectedRisk(null)}>
        {selectedRisk ? (
          <div className="form-grid">
            {selectedWarnings.length ? (
              <div className="notice-banner full-width">
                {selectedWarnings.map(warning => <div key={warning}>{warning}</div>)}
              </div>
            ) : null}
            <div className="mini-card"><span>Risk</span><strong>{selectedRisk.risk_code || selectedRisk.title}</strong></div>
            <div className="mini-card"><span>Inherent score</span><strong>{selectedRisk.inherent_score}</strong></div>
            <div className="mini-card"><span>Residual score</span><strong>{selectedRisk.residual_score}</strong></div>
            <div className="mini-card"><span>Appetite</span><strong>{selectedRisk.appetite_breached ? 'Breached' : 'Within appetite'}</strong></div>
            <div className="mini-card"><span>Risk owner</span><strong>{ownerName(selectedRisk.risk_owner || selectedRisk.owner)}</strong></div>
            <div className="mini-card"><span>Control owner</span><strong>{ownerName(selectedRisk.control_owner)}</strong></div>
            <div className="mini-card"><span>Treatment owner</span><strong>{ownerName(selectedRisk.treatment_owner)}</strong></div>
            <div className="mini-card"><span>Executive sponsor</span><strong>{ownerName(selectedRisk.executive_sponsor)}</strong></div>
            <div className="mini-card"><span>Treatment</span><strong>{humanize(selectedRisk.treatment_status || 'not required')}</strong></div>
            <div className="mini-card"><span>Acceptance</span><strong>{humanize(selectedRisk.acceptance_status || 'not required')}</strong></div>
            <div className="mini-card"><span>Next review</span><strong>{formatDate(selectedRisk.next_review_date)}</strong></div>
            <div className="mini-card"><span>Closure</span><strong>{selectedBlocker?.blocker_reason || selectedRisk.closure_reason || 'No active blocker'}</strong></div>

            <div className="panel full-width">
              <h4>Linked sources</h4>
              <div className="module-grid">
                <div className="mini-card"><span>OVR</span><strong>{selectedRisk.source_ovr_id || '—'}</strong></div>
                <div className="mini-card"><span>Audit finding</span><strong>{selectedRisk.source_audit_finding_id || '—'}</strong></div>
                <div className="mini-card"><span>Compliance</span><strong>{selectedRisk.source_compliance_id || '—'}</strong></div>
                <div className="mini-card"><span>Project</span><strong>{selectedRisk.source_project_id || '—'}</strong></div>
              </div>
            </div>

            {selectedQueueRows.length ? (
              <div className="panel full-width">
                <h4>Active workflow reasons</h4>
                <ul>
                  {selectedQueueRows.map(row => <li key={`${row.risk_id}-${row.queue_reason}`}>{humanize(row.queue_reason)} · {formatDate(row.due_date)}</li>)}
                </ul>
              </div>
            ) : null}

            <div className="panel full-width">
              <h4>Reassessment history</h4>
              {riskHistory.length ? (
                <EntityTable
                  rows={riskHistory}
                  getRowKey={row => row.id}
                  columns={[
                    { key: 'date', header: 'Changed', render: row => formatDate(row.changed_at) },
                    { key: 'old', header: 'Previous', render: row => `${row.previous_score ?? '—'} / ${row.previous_residual_score ?? '—'}` },
                    { key: 'new', header: 'New', render: row => `${row.new_score ?? '—'} / ${row.new_residual_score ?? '—'}` },
                    { key: 'reason', header: 'Reason', render: row => row.change_reason || '—' },
                  ]}
                />
              ) : <p className="muted">No reassessment history is visible yet.</p>}
            </div>

            <div className="panel full-width">
              <h4>Workflow events</h4>
              {riskEvents.length ? (
                <EntityTable
                  rows={riskEvents}
                  getRowKey={row => row.id}
                  columns={[
                    { key: 'date', header: 'Date', render: row => formatDate(row.created_at) },
                    { key: 'action', header: 'Action', render: row => humanize(row.action) },
                    { key: 'status', header: 'Status', render: row => `${row.from_status || '—'} → ${row.to_status || '—'}` },
                    { key: 'note', header: 'Note', render: row => row.note || '—' },
                  ]}
                />
              ) : <p className="muted">No workflow events are visible yet.</p>}
            </div>

            {canManageRisks ? (
              <div className="form-actions full-width">
                <button className="ghost-button" disabled={workflowBusy} onClick={() => void reassessSelectedRisk()}>Reassess risk</button>
                <button className="ghost-button" disabled={workflowBusy} onClick={() => void requestAcceptanceForSelectedRisk()}>Request acceptance</button>
                <button className="ghost-button" disabled={workflowBusy} onClick={() => void runRiskAction('Acceptance approval', () => approveRiskAcceptance({ risk_id: selectedRisk.id, reason: 'Approved from workflow center' }))}>Approve acceptance</button>
                <button className="ghost-button" disabled={workflowBusy} onClick={() => void runRiskAction('Acceptance rejection', () => rejectRiskAcceptance({ risk_id: selectedRisk.id, reason: 'Rejected from workflow center' }))}>Reject acceptance</button>
                <button className="ghost-button" disabled={workflowBusy} onClick={() => void updateTreatmentForSelectedRisk()}>Update treatment</button>
                <button className="ghost-button" disabled={workflowBusy} onClick={() => void runRiskAction('Treatment completion', () => completeRiskTreatment({ risk_id: selectedRisk.id, reason: 'Treatment completed from workflow center' }))}>Complete treatment</button>
                <button className="ghost-button" disabled={workflowBusy} onClick={() => void runRiskAction('Closure request', () => requestRiskClosure({ risk_id: selectedRisk.id, reason: promptText('Closure reason') || undefined }))}>Request closure</button>
                <button className="ghost-button" disabled={workflowBusy} onClick={() => void runRiskAction('Closure approval', () => approveRiskClosure({ risk_id: selectedRisk.id, reason: 'Approved from workflow center' }))}>Approve closure</button>
                <button className="ghost-button" disabled={workflowBusy} onClick={() => void runRiskAction('Risk reopen', () => reopenRiskWithReason({ risk_id: selectedRisk.id, reason: promptText('Reopen reason') || undefined }))}>Reopen with reason</button>
                <button className="ghost-button" disabled={workflowBusy} onClick={() => void linkSourceForSelectedRisk()}>Link source</button>
                <button className="ghost-button" disabled={workflowBusy} onClick={() => void markDuplicateForSelectedRisk()}>Mark duplicate</button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
