import { useState } from 'react';
import { DataState } from '../components/DataState';
import { EntityTable } from '../components/EntityTable';
import { AuditFindingForm } from '../components/GrcForms';
import { Modal } from '../components/Modal';
import { ModuleHeader } from '../components/ModuleHeader';
import { StatusBadge } from '../components/StatusBadge';
import { departmentName, formatDate, humanize, ownerName } from '../lib/format';
import { getAuditFindings, getDepartments, getOrganizations, getProfiles } from '../lib/grcApi';
import { useAsyncData } from '../hooks/useAsyncData';
import type { AuditFindingRow } from '../types/domain';

export function Audit() {
  const [formOpen, setFormOpen] = useState(false);
  const findings = useAsyncData(getAuditFindings, []);
  const departments = useAsyncData(getDepartments, []);
  const profiles = useAsyncData(getProfiles, []);
  const organizations = useAsyncData(getOrganizations, []);
  const organizationId = organizations.data?.[0]?.id || '';

  return (
    <section className="page-section">
      <ModuleHeader
        eyebrow="Internal audit follow-up"
        title="Findings, corrective actions, evidence review and closure approval"
        subtitle="Departments submit evidence; audit or governance approves final closure."
        action={<button className="primary-button" onClick={() => setFormOpen(true)}>New Finding</button>}
      />

      <div className="panel two-column">
        <div>
          <h4>Audit closure rule</h4>
          <p className="muted">The department should not close its own finding. Closure requires evidence review and approval by Audit or Governance.</p>
        </div>
        <div className="mini-card"><span>Workflow</span><strong>Finding → Action Plan → Evidence → Audit Review → Close / Reject</strong></div>
      </div>

      <div className="panel">
        <div className="panel-header"><h4>Audit findings</h4></div>
        <DataState loading={findings.loading} error={findings.error} empty={!findings.data?.length}>
          <EntityTable<AuditFindingRow>
            rows={findings.data || []}
            getRowKey={row => row.id}
            columns={[
              { key: 'code', header: 'Code', render: row => row.finding_code || '—' },
              { key: 'title', header: 'Finding', render: row => <strong>{row.title}</strong> },
              { key: 'audit', header: 'Audit', render: row => row.audit_title || '—' },
              { key: 'department', header: 'Department', render: row => departmentName(row.departments) },
              { key: 'owner', header: 'Owner', render: row => ownerName(row.owner) },
              { key: 'due', header: 'Due', render: row => formatDate(row.due_date) },
              { key: 'status', header: 'Status', render: row => <StatusBadge status={humanize(row.status)} /> },
              { key: 'risk', header: 'Risk', render: row => <span className={`risk-pill ${row.risk_level}`}>{row.risk_level}</span> }
            ]}
          />
        </DataState>
      </div>

      <Modal open={formOpen} title="Create audit finding" onClose={() => setFormOpen(false)}>
        <AuditFindingForm organizationId={organizationId} departments={departments.data || []} profiles={profiles.data || []} onCancel={() => setFormOpen(false)} onCreated={() => { setFormOpen(false); void findings.refresh(); }} />
      </Modal>
    </section>
  );
}
