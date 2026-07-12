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
  const decisionRows = decisions.data || [];
  const metrics = {
    register: decisionRows.length,
    highPriority: decisionRows.filter(r => r.priority === 'critical' || r.priority === 'high').length,
    overdue: decisionRows.filter(r => r.due_date && new Date(r.due_date).getTime() < Date.now() && r.status !== 'closed' && r.status !== 'completed').length,
    open: decisionRows.filter(r => r.status === 'open' || r.status === 'in_progress').length,
    closed: decisionRows.filter(r => r.status === 'closed' || r.status === 'completed').length,
  };

  return (
    <section className="page-section">
      <ModuleHeader
        eyebrow="Governance"
        title="Governance Decisions Register"
        subtitle="Track decisions, owners, due dates, priority, status and follow-up."
        action={<button className="primary-button" onClick={() => setFormOpen(true)}>New Decision</button>}
      />

      <div className="module-grid">
        <div className="module-card"><strong>Total decisions</strong><span>{metrics.register} decisions</span></div>
        <div className="module-card danger"><strong>High priority</strong><span>{metrics.highPriority} critical/high</span></div>
        <div className="module-card danger"><strong>Overdue</strong><span>{metrics.overdue} overdue</span></div>
        <div className="module-card warning"><strong>Open</strong><span>{metrics.open} open</span></div>
        <div className="module-card good"><strong>Closed</strong><span>{metrics.closed} closed</span></div>
      </div>

      <div className="panel">
        <div className="panel-header"><h4>Governance decisions register</h4></div>
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
      </Modal></section>
  );
}
