import { useState } from 'react';
import { DataState } from '../components/DataState';
import { EntityTable } from '../components/EntityTable';
import { ComplianceForm } from '../components/GrcForms';
import { Modal } from '../components/Modal';
import { ModuleHeader } from '../components/ModuleHeader';
import { StatusBadge } from '../components/StatusBadge';
import { ProfessionalGrcMaturityPanel } from '../components/v140/ProfessionalGrcMaturityPanel';
import { ProfessionalGrcWorkflowMap } from '../components/v140/ProfessionalGrcWorkflowMap';
import { departmentName, formatDate, humanize, ownerName } from '../lib/format';
import { getComplianceItems, getDepartments, getOrganizations, getProfiles } from '../lib/grcApi';
import { useAsyncData } from '../hooks/useAsyncData';
import type { ComplianceRow } from '../types/domain';

export function Compliance() {
  const [formOpen, setFormOpen] = useState(false);
  const compliance = useAsyncData(getComplianceItems, []);
  const departments = useAsyncData(getDepartments, []);
  const profiles = useAsyncData(getProfiles, []);
  const organizations = useAsyncData(getOrganizations, []);
  const organizationId = organizations.data?.[0]?.id || '';

  return (
    <section className="page-section">
      <ModuleHeader
        eyebrow="Compliance calendar"
        title="Licenses, regulatory obligations, expiry warnings and evidence"
        subtitle="Designed for hospital obligations such as MOH, Civil Defense, CBAHI, HR and ZATCA deadlines."
        action={<button className="primary-button" onClick={() => setFormOpen(true)}>New Obligation</button>}
      />

      <div className="module-grid">
        <div className="module-card warning"><strong>Compliance obligations register</strong><span>Controlled list of regulatory, licensing, policy and contractual obligations.</span></div>
        <div className="module-card"><strong>Regulatory change pipeline</strong><span>Capture new requirements, assess impact and assign implementation owners.</span></div>
        <div className="module-card"><strong>Compliance testing</strong><span>Test obligations with evidence before marking them compliant.</span></div>
        <div className="module-card"><strong>Policy / attestation link</strong><span>Connect obligations to policies, versions, attestations and exceptions.</span></div>
      </div>

      <ProfessionalGrcWorkflowMap highlight="compliance" />
      <ProfessionalGrcMaturityPanel domain="compliance" />

      <div className="panel">
        <div className="panel-header"><h4>Compliance obligations</h4></div>
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
      </Modal>
    </section>
  );
}
