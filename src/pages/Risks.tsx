import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';
import { EntityTable } from '../components/EntityTable';
import { RiskForm } from '../components/GrcForms';
import { Modal } from '../components/Modal';
import { ModuleHeader } from '../components/ModuleHeader';
import { ScenarioFillButton } from '../components/ScenarioFillButton';
import { StatusBadge } from '../components/StatusBadge';
import { departmentName, formatDate, humanize, ownerName } from '../lib/format';
import { getDepartments, getOrganizations, getProfiles, getRisks } from '../lib/grcApi';
import { useAsyncData } from '../hooks/useAsyncData';
import type { RiskRow } from '../types/domain';
import {
  createScenarioLabScenario,
  V99_SCENARIO_TAG,
} from '../lib/scenarioLab';

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
        eyebrow="Risk register"
        title="Track risks, controls, residual scores and mitigation actions"
        subtitle="Risk is the source; mitigation actions should become controlled projects or tasks."
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

      {controlMessage ? <div className="notice-banner">{controlMessage}</div> : null}

      <div className="module-grid">
        <div className="module-card danger"><strong>Critical risks</strong><span>Financial, regulatory, clinical and operational risks.</span></div>
        <div className="module-card"><strong>Risk controls</strong><span>Preventive, detective, corrective and directive controls.</span></div>
        <div className="module-card"><strong>Mitigation plans</strong><span>Convert risk treatment into tracked action plans.</span></div>
        <div className="module-card"><strong>Review cycle</strong><span>Next review date, owner and evidence required.</span></div>
      </div>

      <div className="panel">
        <div className="panel-header"><h4>Risk register</h4></div>
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
