import { useState } from 'react';
import { DataState } from '../components/DataState';
import { EntityTable } from '../components/EntityTable';
import { DecisionForm } from '../components/GrcForms';
import { Modal } from '../components/Modal';
import { ModuleHeader } from '../components/ModuleHeader';
import { StatusBadge } from '../components/StatusBadge';
import { ProfessionalGrcMaturityPanel } from '../components/v140/ProfessionalGrcMaturityPanel';
import { ProfessionalGrcWorkflowMap } from '../components/v140/ProfessionalGrcWorkflowMap';
import { departmentName, formatDate, humanize, ownerName } from '../lib/format';
import { getDepartments, getGovernanceDecisions, getOrganizations, getProfiles } from '../lib/grcApi';
import { useAsyncData } from '../hooks/useAsyncData';
import type { GovernanceDecisionRow } from '../types/domain';
import { AssuranceMapPanel } from '../components/v180/AssuranceMapPanel';
import { GrcTraceabilityMap } from '../components/v180/GrcTraceabilityMap';
import { TraceabilityGapPanel } from '../components/v180/TraceabilityGapPanel';
import { FrameworkCrosswalkBackbonePanel } from '../components/v210/FrameworkCrosswalkBackbonePanel';
import { ControlAssuranceReadinessPanel } from '../components/v220/ControlAssuranceReadinessPanel';

export function Governance() {
  const [formOpen, setFormOpen] = useState(false);
  const decisions = useAsyncData(getGovernanceDecisions, []);
  const departments = useAsyncData(getDepartments, []);
  const profiles = useAsyncData(getProfiles, []);
  const organizations = useAsyncData(getOrganizations, []);
  const organizationId = organizations.data?.[0]?.id || '';

  return (
    <section className="page-section">
      <ModuleHeader
        eyebrow="Governance center"
        title="Authority matrix, CEO decisions, committees, policies and delegations"
        subtitle="Governance decisions can generate controlled projects and evidence-based follow-up."
        action={<button className="primary-button" onClick={() => setFormOpen(true)}>New Decision</button>}
      />

      {/* v22-control-testing-capa: governance assurance readiness */}
      <ControlAssuranceReadinessPanel />

      <GrcTraceabilityMap context="governance" />
      <AssuranceMapPanel />
      <TraceabilityGapPanel />
      <FrameworkCrosswalkBackbonePanel context="governance" />


      <div className="module-grid">
        <div className="module-card"><strong>Executive GRC dashboard</strong><span>Material risks, high issues, overdue CAPA, compliance exposure and audit coverage.</span></div>
        <div className="module-card"><strong>Assurance map</strong><span>Shows which risks and obligations are covered by controls, compliance and audit.</span></div>
        <div className="module-card"><strong>Committee / board reporting</strong><span>Structured decisions, risk acceptance, exceptions and follow-up actions.</span></div>
        <div className="module-card"><strong>Cross-module traceability</strong><span>Risk → control → test → evidence → issue → CAPA → report.</span></div>
      </div>

      <ProfessionalGrcWorkflowMap highlight="reporting" />
      <ProfessionalGrcMaturityPanel domain="governance" />

      <div className="panel">
        <div className="panel-header"><h4>Governance decisions</h4></div>
        <DataState loading={decisions.loading} error={decisions.error} empty={!decisions.data?.length}>
          <EntityTable<GovernanceDecisionRow>
            rows={decisions.data || []}
            getRowKey={row => row.id}
            columns={[
              { key: 'code', header: 'Code', render: row => row.decision_code || '—' },
              { key: 'title', header: 'Decision', render: row => <strong>{row.title}</strong> },
              { key: 'department', header: 'Department', render: row => departmentName(row.departments) },
              { key: 'owner', header: 'Owner', render: row => ownerName(row.owner) },
              { key: 'due', header: 'Due', render: row => formatDate(row.due_date) },
              { key: 'status', header: 'Status', render: row => <StatusBadge status={humanize(row.status)} /> },
              { key: 'priority', header: 'Priority', render: row => humanize(row.priority) },
              { key: 'risk', header: 'Risk', render: row => <span className={`risk-pill ${row.risk_level}`}>{row.risk_level}</span> }
            ]}
          />
        </DataState>
      </div>

      <Modal open={formOpen} title="Create governance decision" onClose={() => setFormOpen(false)}>
        <DecisionForm organizationId={organizationId} departments={departments.data || []} profiles={profiles.data || []} onCancel={() => setFormOpen(false)} onCreated={() => { setFormOpen(false); void decisions.refresh(); }} />
      </Modal>
    </section>
  );
}
