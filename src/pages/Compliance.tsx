import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';
import { EntityTable } from '../components/EntityTable';
import { ComplianceForm } from '../components/GrcForms';
import { Modal } from '../components/Modal';
import { ModuleHeader } from '../components/ModuleHeader';
import { StatusBadge } from '../components/StatusBadge';
import { departmentName, formatDate, humanize, ownerName } from '../lib/format';
import { getComplianceItems, getDepartments, getOrganizations, getProfiles } from '../lib/grcApi';
import { useAsyncData } from '../hooks/useAsyncData';
import type { ComplianceRow } from '../types/domain';

export function Compliance() {
  const auth = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const compliance = useAsyncData(getComplianceItems, []);
  const departments = useAsyncData(getDepartments, []);
  const profiles = useAsyncData(getProfiles, []);
  const organizations = useAsyncData(getOrganizations, []);
  const organizationId = organizations.data?.[0]?.id || '';
  const canManageCompliance = auth.roles.some(role =>
    ['super_admin', 'governance_admin', 'compliance_officer', 'department_manager'].includes(role.role),
  );
  const complianceRows = compliance.data || [];
  const metrics = {
    register: complianceRows.length,
    expiring: complianceRows.filter(r => r.expiry_date && new Date(r.expiry_date).getTime() < Date.now() + 90 * 24 * 60 * 60 * 1000).length,
    highRisk: complianceRows.filter(r => r.risk_level === 'critical' || r.risk_level === 'high').length,
    evidenceNeeded: complianceRows.filter(r => r.status === 'evidence_needed' || r.status === 'review_needed').length,
    overdue: complianceRows.filter(r => r.due_date && new Date(r.due_date).getTime() < Date.now() && r.status !== 'closed' && r.status !== 'compliant').length,
  };

  return (
    <section className="page-section">
      <ModuleHeader
        eyebrow="Compliance"
        title="Compliance Obligations Register"
        subtitle="Track regulatory obligations, owners, expiry dates, evidence and status."
        action={canManageCompliance ? <button className="primary-button" onClick={() => setFormOpen(true)}>New Obligation</button> : null}
      />

      <div className="module-grid">
        <div className="module-card"><strong>Total obligations</strong><span>{metrics.register} active</span></div>
        <div className="module-card warning"><strong>Expiring soon</strong><span>{metrics.expiring} within 90 days</span></div>
        <div className="module-card danger"><strong>High risk</strong><span>{metrics.highRisk} critical/high</span></div>
        <div className="module-card warning"><strong>Evidence needed</strong><span>{metrics.evidenceNeeded} pending</span></div>
        <div className="module-card danger"><strong>Overdue</strong><span>{metrics.overdue} overdue</span></div>
      </div>



      <div className="panel">
        <div className="panel-header">
          <div>
            <h4>Compliance obligations register</h4>
            <p className="muted">Operational register for regulatory obligations, expiry warnings, responsible owner, risk level and evidence status.</p>
          </div>
          <span className="status-chip neutral">Evidence-based CMS</span>
        </div>
        <DataState loading={compliance.loading} error={compliance.error} empty={!compliance.data?.length}>
          <EntityTable<ComplianceRow>
            rows={compliance.data || []}
            getRowKey={row => row.id}
            columns={[
              { key: 'code', header: 'Code', render: row => row.compliance_code || '—' },
              { key: 'title', header: 'Requirement', render: row => <strong>{row.title}</strong> },
              { key: 'body', header: 'Regulator', render: row => row.regulatory_body || '—' },
              { key: 'department', header: 'Department', render: row => departmentName(row.departments) },
              { key: 'owner', header: 'Owner', render: row => ownerName(row.owner) },
              { key: 'due', header: 'Due', render: row => formatDate(row.due_date) },
              { key: 'expiry', header: 'Expiry', render: row => formatDate(row.expiry_date) },
              { key: 'status', header: 'Status', render: row => <StatusBadge status={humanize(row.status)} /> },
              { key: 'risk', header: 'Risk', render: row => <span className={`risk-pill ${row.risk_level}`}>{row.risk_level}</span> }
            ]}
          />
        </DataState>
      </div>

      <Modal open={formOpen} title="Create compliance obligation" onClose={() => setFormOpen(false)}>
        <ComplianceForm organizationId={organizationId} departments={departments.data || []} profiles={profiles.data || []} onCancel={() => setFormOpen(false)} onCreated={() => { setFormOpen(false); void compliance.refresh(); }} />
      </Modal></section>
  );
}
