import { useState } from 'react';
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
import { getDepartments, getOrganizations, getProfiles, getRisks } from '../lib/grcApi';
import { useAsyncData } from '../hooks/useAsyncData';
import type { RiskRow } from '../types/domain';
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
  const risks = useAsyncData(getRisks, []);
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
              { key: 'review', header: 'Next Review', render: row => formatDate(row.next_review_date) },
              { key: 'status', header: 'Status', render: row => <StatusBadge status={humanize(row.status)} /> },
              { key: 'level', header: 'Level', render: row => <span className={`risk-pill ${row.risk_level}`}>{row.risk_level}</span> }
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
    </section>
  );
}
