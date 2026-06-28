import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';
import { EntityTable } from '../components/EntityTable';
import { AuditFindingForm } from '../components/GrcForms';
import { Modal } from '../components/Modal';
import { ModuleHeader } from '../components/ModuleHeader';
import { StatusBadge } from '../components/StatusBadge';
import { ProfessionalGrcMaturityPanel } from '../components/v140/ProfessionalGrcMaturityPanel';
import { ProfessionalGrcWorkflowMap } from '../components/v140/ProfessionalGrcWorkflowMap';
import { AuditAssuranceCoveragePanel } from '../components/v150/AuditAssuranceCoveragePanel';
import { AuditEngagementChecklist } from '../components/v150/AuditEngagementChecklist';
import { AuditProgramWorkflowMap } from '../components/v150/AuditProgramWorkflowMap';
import { departmentName, formatDate, humanize, ownerName } from '../lib/format';
import { getAuditFindings, getDepartments, getOrganizations, getProfiles } from '../lib/grcApi';
import { useAsyncData } from '../hooks/useAsyncData';
import type { AuditFindingRow } from '../types/domain';

export function Audit() {
  const auth = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const findings = useAsyncData(getAuditFindings, []);
  const departments = useAsyncData(getDepartments, []);
  const profiles = useAsyncData(getProfiles, []);
  const organizations = useAsyncData(getOrganizations, []);
  const organizationId = organizations.data?.[0]?.id || '';
  const canManageFindings = auth.roles.some(
    role => role.role === 'super_admin' || role.role === 'governance_admin'
  );

  return (
    <section className="page-section">
      <ModuleHeader
        eyebrow="Internal audit program"
        title="Audit universe, annual plan, engagements, workpapers and follow-up"
        subtitle="A professional audit lifecycle from risk-based planning through workpapers, evidence requests, findings, management response and assurance reporting."
        action={canManageFindings ? <button className="primary-button" onClick={() => setFormOpen(true)}>New Finding</button> : null}
      />

      <ProfessionalGrcWorkflowMap highlight="audit" />
      <ProfessionalGrcMaturityPanel domain="audit" />
      <AuditProgramWorkflowMap highlight="engagement-planning" />
      <AuditEngagementChecklist />
      <AuditAssuranceCoveragePanel />

      <div className="panel two-column">
        <div>
          <h4>Audit closure rule</h4>
          <p className="muted">The department should not close its own finding. Closure requires evidence review and approval by Audit or Governance.</p>
        </div>
        <div className="mini-card"><span>Follow-up chain</span><strong>Finding → Management Response → CAPA / Action Plan → Evidence → Audit Review → Closure / Rejection</strong></div>
      </div>

      <div className="module-grid">
        <div className="module-card"><strong>Audit Universe</strong><span>Risk-based list of auditable entities, processes, systems and departments.</span></div>
        <div className="module-card"><strong>Annual Audit Plan</strong><span>Prioritized engagements connected to risk exposure and governance approval.</span></div>
        <div className="module-card"><strong>Engagement Planning</strong><span>Scope, criteria, risk/control matrix, procedures, resources and sample approach.</span></div>
        <div className="module-card"><strong>Workpapers</strong><span>Document procedure execution, evidence, review notes, conclusion and sign-off.</span></div>
        <div className="module-card"><strong>Evidence Requests</strong><span>Track departmental evidence requests, due dates, blockers and escalation status.</span></div>
        <div className="module-card"><strong>Management Response</strong><span>Capture accountable response, CAPA/action plan, target date and ownership.</span></div>
        <div className="module-card"><strong>Action Plan Follow-up</strong><span>Verify evidence before closure and reject unsupported remediation.</span></div>
        <div className="module-card"><strong>Assurance Reporting</strong><span>Summarize high-risk coverage, uncovered areas, overdue actions and committee readiness.</span></div>
      </div>

      <div className="panel">
        <div className="panel-header"><h4>Audit findings</h4></div>
        <DataState
          loading={findings.loading}
          error={findings.error}
          empty={!findings.data?.length}
          emptyTitle="No audit findings in your scope"
          emptyMessage={
            canManageFindings
              ? 'Create a controlled finding when an audit issue requires tracked remediation.'
              : 'No audit findings are currently available for this read-only account.'
          }
        >
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
