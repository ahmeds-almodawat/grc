import { useState } from 'react';
import { ActionPlanForm } from '../components/ActionPlanForm';
import { DataState } from '../components/DataState';
import { EntityTable } from '../components/EntityTable';
import { Modal } from '../components/Modal';
import { ModuleHeader } from '../components/ModuleHeader';
import { ProjectDetail } from '../components/ProjectDetail';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate, humanize, departmentName, ownerName } from '../lib/format';
import { getDepartments, getOrganizations, getProfiles, getProjects } from '../lib/grcApi';
import { useAsyncData } from '../hooks/useAsyncData';
import type { ProjectRow } from '../types/domain';

export function Projects() {
  const [formOpen, setFormOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectRow | null>(null);
  const projects = useAsyncData(getProjects, []);
  const departments = useAsyncData(getDepartments, []);
  const profiles = useAsyncData(getProfiles, []);
  const organizations = useAsyncData(getOrganizations, []);

  const organizationId = organizations.data?.[0]?.id || '';

  return (
    <section className="page-section">
      <ModuleHeader
        eyebrow="Execution engine"
        title="Projects, action plans, milestones and task ownership"
        subtitle="Every controlled action should have source, owner, due date, evidence and approval path. Open any project to add milestones and tasks."
        action={<button className="primary-button" onClick={() => setFormOpen(true)}>New Action Plan</button>}
      />

      <div className="panel two-column">
        <div>
          <h4>Project governance rules</h4>
          <ul className="rule-list">
            <li>Every major project must have an owner, sponsor, due date and department.</li>
            <li>Closure requires evidence and approval when marked as controlled work.</li>
            <li>Delay reason becomes mandatory once a due date is missed.</li>
            <li>High-risk delays appear automatically in the executive dashboard.</li>
          </ul>
        </div>
        <div className="mini-card">
          <span>Core chain</span>
          <strong>Source → Action Plan → Milestone → Task → Evidence → Approval → Closure</strong>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h4>Action plans</h4>
          <p>Live from Supabase when configured; otherwise demo records are displayed.</p>
        </div>
        <DataState loading={projects.loading} error={projects.error} empty={!projects.data?.length}>
          <EntityTable<ProjectRow>
            rows={projects.data || []}
            getRowKey={row => row.id}
            columns={[
              { key: 'title', header: 'Project', render: row => <strong>{row.title}</strong> },
              { key: 'source', header: 'Source', render: row => humanize(row.source_type) },
              { key: 'department', header: 'Department', render: row => departmentName(row.departments) },
              { key: 'owner', header: 'Owner', render: row => ownerName(row.owner) },
              { key: 'due', header: 'Target', render: row => formatDate(row.target_end_date) },
              { key: 'status', header: 'Status', render: row => <StatusBadge status={humanize(row.status)} /> },
              { key: 'risk', header: 'Risk', render: row => <span className={`risk-pill ${row.risk_level}`}>{row.risk_level}</span> },
              { key: 'progress', header: 'Progress', render: row => `${row.progress_percent ?? 0}%` },
              { key: 'open', header: 'Open', render: row => <button className="ghost-button compact-button" type="button" onClick={() => setSelectedProject(row)}>Open</button> }
            ]}
          />
        </DataState>
      </div>

      <Modal open={formOpen} title="Create controlled action plan" onClose={() => setFormOpen(false)}>
        <ActionPlanForm
          organizationId={organizationId}
          departments={departments.data || []}
          profiles={profiles.data || []}
          onCancel={() => setFormOpen(false)}
          onCreated={() => {
            setFormOpen(false);
            void projects.refresh();
          }}
        />
      </Modal>

      <Modal open={Boolean(selectedProject)} title="Project control file" onClose={() => setSelectedProject(null)}>
        {selectedProject ? <ProjectDetail project={selectedProject} profiles={profiles.data || []} /> : null}
      </Modal>
    </section>
  );
}
