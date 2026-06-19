import { useState } from 'react';
import { DataState } from '../components/DataState';
import { EntityTable } from '../components/EntityTable';
import { DecisionForm } from '../components/GrcForms';
import { Modal } from '../components/Modal';
import { ModuleHeader } from '../components/ModuleHeader';
import { StatusBadge } from '../components/StatusBadge';
import { departmentName, formatDate, humanize, ownerName } from '../lib/format';
import { getDepartments, getGovernanceDecisions, getOrganizations, getProfiles } from '../lib/grcApi';
import { useAsyncData } from '../hooks/useAsyncData';
import type { GovernanceDecisionRow } from '../types/domain';

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

      <div className="module-grid">
        <div className="module-card"><strong>Authority matrix</strong><span>Approval levels, limits, roles, users and dual approval rules.</span></div>
        <div className="module-card"><strong>Committees</strong><span>Meetings, minutes, decisions and assigned follow-up actions.</span></div>
        <div className="module-card"><strong>Policies</strong><span>Policy register, review dates, versions and approvals.</span></div>
        <div className="module-card"><strong>CEO directives</strong><span>Executive decisions converted into action plans.</span></div>
      </div>

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
