import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';
import { EntityTable } from '../components/EntityTable';
import { ComplianceForm } from '../components/GrcForms';
import { Modal } from '../components/Modal';
import { ModuleHeader } from '../components/ModuleHeader';
import { StatusBadge } from '../components/StatusBadge';
import { ComplianceExecutionWorkflowMap } from '../components/v160/ComplianceExecutionWorkflowMap';
import { ComplianceObligationMaturityPanel } from '../components/v160/ComplianceObligationMaturityPanel';
import { ComplianceTestingCalendar } from '../components/v160/ComplianceTestingCalendar';
import { departmentName, formatDate, humanize, ownerName } from '../lib/format';
import { getComplianceItems, getDepartments, getOrganizations, getProfiles } from '../lib/grcApi';
import { useAsyncData } from '../hooks/useAsyncData';
import type { ComplianceRow } from '../types/domain';
import '../styles/v160-compliance-management.css';
import { FrameworkCrosswalkBackbonePanel } from '../components/v210/FrameworkCrosswalkBackbonePanel';

import { ComplianceHardeningOverview } from '../components/v230/ComplianceHardeningOverview';
import { PolicyAttestationTracker } from '../components/v230/PolicyAttestationTracker';
import { VendorIncidentHardeningPanel } from '../components/v230/VendorIncidentHardeningPanel';
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

  return (
    <section className="page-section">
      <ModuleHeader
        eyebrow="Compliance management system"
        title="Obligations, regulatory change, testing, evidence and non-compliance follow-up"
        subtitle="v16 connects compliance work into an ISO 37301-style chain: obligation, change, policy/control, test, evidence, issue, CAPA and management reporting."
        action={canManageCompliance ? <button className="primary-button" onClick={() => setFormOpen(true)}>New Obligation</button> : null}
      />

      <ComplianceExecutionWorkflowMap />
      <ComplianceObligationMaturityPanel />
      <ComplianceTestingCalendar />
      <FrameworkCrosswalkBackbonePanel context="compliance" />


      <div className="module-grid">
        <div className="module-card warning"><strong>Expiring soon</strong><span>MOH, Civil Defense, CBAHI and contract renewals with owner and evidence controls.</span></div>
        <div className="module-card"><strong>Evidence needed</strong><span>Required files, review decision and rejected-evidence follow-up before marking compliant.</span></div>
        <div className="module-card"><strong>Regulatory change</strong><span>Changed requirement becomes impact assessment, policy/control update and verification.</span></div>
        <div className="module-card"><strong>Non-compliance</strong><span>Failed obligations and tests create issue, CAPA and leadership reporting.</span></div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h4>Compliance obligations</h4>
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

      <div className="panel two-column">
        <div>
          <h4>Compliance closure rule</h4>
          <p className="muted">
            A high-risk obligation should not be closed only because the due date passed or a user changed the status. Closure should require reviewed evidence, a policy/control link where applicable, and issue/CAPA tracking when testing fails.
          </p>
        </div>
        <div className="mini-card">
          <span>Professional CMS workflow</span>
          <strong>Obligation → Evidence → Test → Issue / CAPA → Management Reporting</strong>
        </div>
      </div>

      <Modal open={formOpen} title="Create compliance obligation" onClose={() => setFormOpen(false)}>
        <ComplianceForm organizationId={organizationId} departments={departments.data || []} profiles={profiles.data || []} onCancel={() => setFormOpen(false)} onCreated={() => { setFormOpen(false); void compliance.refresh(); }} />
      </Modal>
    
      {/* v23.0 compliance, policy, vendor and incident hardening */}
      <ComplianceHardeningOverview />
      <PolicyAttestationTracker />
      <VendorIncidentHardeningPanel />

</section>
  );
}
