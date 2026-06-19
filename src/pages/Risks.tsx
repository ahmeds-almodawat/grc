import { useState } from 'react';
import { DataState } from '../components/DataState';
import { EntityTable } from '../components/EntityTable';
import { RiskForm } from '../components/GrcForms';
import { Modal } from '../components/Modal';
import { ModuleHeader } from '../components/ModuleHeader';
import { StatusBadge } from '../components/StatusBadge';
import { departmentName, formatDate, humanize, ownerName } from '../lib/format';
import { getDepartments, getOrganizations, getProfiles, getRisks } from '../lib/grcApi';
import { useAsyncData } from '../hooks/useAsyncData';
import type { RiskRow } from '../types/domain';

export function Risks() {
  const [formOpen, setFormOpen] = useState(false);
  const risks = useAsyncData(getRisks, []);
  const departments = useAsyncData(getDepartments, []);
  const profiles = useAsyncData(getProfiles, []);
  const organizations = useAsyncData(getOrganizations, []);
  const organizationId = organizations.data?.[0]?.id || '';

  return (
    <section className="page-section">
      <ModuleHeader
        eyebrow="Risk register"
        title="Track risks, controls, residual scores and mitigation actions"
        subtitle="Risk is the source; mitigation actions should become controlled projects or tasks."
        action={<button className="primary-button" onClick={() => setFormOpen(true)}>New Risk</button>}
      />

      <div className="module-grid">
        <div className="module-card danger"><strong>Critical risks</strong><span>Financial, regulatory, clinical and operational risks.</span></div>
        <div className="module-card"><strong>Risk controls</strong><span>Preventive, detective, corrective and directive controls.</span></div>
        <div className="module-card"><strong>Mitigation plans</strong><span>Convert risk treatment into tracked action plans.</span></div>
        <div className="module-card"><strong>Review cycle</strong><span>Next review date, owner and evidence required.</span></div>
      </div>

      <div className="panel">
        <div className="panel-header"><h4>Risk register</h4></div>
        <DataState loading={risks.loading} error={risks.error} empty={!risks.data?.length}>
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
    </section>
  );
}
