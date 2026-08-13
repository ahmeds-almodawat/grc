import { useState } from 'react';
import { DataState } from './DataState';
import { EntityTable } from './EntityTable';
import { MilestoneForm, TaskForm } from './GrcForms';
import { Modal } from './Modal';
import { StatusBadge } from './StatusBadge';
import { ApprovalRequestForm, EvidenceUploadForm, StatusUpdateForm, WorkControlButtons, type ControllableItemType } from './WorkItemControls';
import { formatDate, humanize, ownerName } from '../lib/format';
import { getProjectMilestones, getProjectTasks } from '../lib/grcApi';
import { getEvidenceForItem } from '../lib/grcApi';
import { useAsyncData } from '../hooks/useAsyncData';
import type { MilestoneRow, ProfileOption, ProjectRow, TaskRow } from '../types/domain';
import { useAuth } from '../auth/AuthProvider';
import { GovernedEvidenceAccess } from './GovernedEvidenceAccess';

interface ProjectDetailProps {
  project: ProjectRow;
  profiles: ProfileOption[];
  onProjectUpdated?: () => void;
}

type ActiveControl =
  | { mode: 'status'; itemType: ControllableItemType; itemId: string; title: string; status: ProjectRow['status'] | MilestoneRow['status'] | TaskRow['status']; progress: number | null }
  | { mode: 'evidence'; itemType: ControllableItemType; itemId: string; title: string }
  | { mode: 'approval'; itemType: ControllableItemType; itemId: string; title: string }
  | null;

export function ProjectDetail({ project, profiles, onProjectUpdated }: ProjectDetailProps) {
  const auth = useAuth();
  const [milestoneFormOpen, setMilestoneFormOpen] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [activeControl, setActiveControl] = useState<ActiveControl>(null);
  const milestones = useAsyncData(() => getProjectMilestones(project.id), [project.id]);
  const tasks = useAsyncData(() => getProjectTasks(project.id), [project.id]);
  const evidence = useAsyncData(() => getEvidenceForItem('project', project.id), [project.id]);
  const organizationId = project.organization_id ?? null;
  const actorId = auth.session?.user.id;
  const hasManagerAuthority = auth.roles.some(role => ['super_admin', 'executive', 'governance_admin', 'division_head', 'department_manager'].includes(role.role));
  const canControlProject = Boolean(actorId && (actorId === project.owner_id || actorId === project.sponsor_id || actorId === project.created_by)) || hasManagerAuthority;

  function refreshDetail() {
    void milestones.refresh();
    void tasks.refresh();
    void evidence.refresh();
    onProjectUpdated?.();
  }

  function closeControlAndRefresh() {
    setActiveControl(null);
    refreshDetail();
  }

  return (
    <div className="project-detail">
      <div className="detail-hero">
        <div>
          <p className="eyebrow">Controlled action plan</p>
          <h3>{project.title}</h3>
          <p className="section-subtitle">{project.description || 'No description added yet.'}</p>
        </div>
        <div className="detail-meta">
          <StatusBadge status={humanize(project.status)} />
          <span className={`risk-pill ${project.risk_level}`}>{project.risk_level}</span>
        </div>
      </div>

      <div className="module-grid compact-grid">
        <div className="mini-card"><span>Source</span><strong>{humanize(project.source_type)}</strong></div>
        <div className="mini-card"><span>Owner</span><strong>{ownerName(project.owner)}</strong></div>
        <div className="mini-card"><span>Target end</span><strong>{formatDate(project.target_end_date)}</strong></div>
        <div className="mini-card"><span>Progress</span><strong>{project.progress_percent ?? 0}%</strong></div>
      </div>

      <div className="panel inner-panel">
        <div className="panel-header split-header">
          <div>
            <h4>Project controls</h4>
            <p>Update the project, upload proof, or request closure/decision approval.</p>
          </div>
          {canControlProject ? <WorkControlButtons
            onStatus={() => setActiveControl({ mode: 'status', itemType: 'project', itemId: project.id, title: project.title, status: project.status, progress: project.progress_percent })}
            onEvidence={() => setActiveControl({ mode: 'evidence', itemType: 'project', itemId: project.id, title: project.title })}
            onApproval={() => setActiveControl({ mode: 'approval', itemType: 'project', itemId: project.id, title: project.title })}
          /> : null}
        </div>
      </div>

      <div className="panel inner-panel">
        <div className="panel-header split-header">
          <div><h4>Milestones</h4><p>Major stages with owner, due date, evidence and approval.</p></div>
          {canControlProject ? <button className="ghost-button" type="button" onClick={() => setMilestoneFormOpen(true)}>Add Milestone</button> : null}
        </div>
        <DataState loading={milestones.loading} error={milestones.error} empty={!milestones.data?.length} emptyMessage="No milestones yet.">
          <EntityTable<MilestoneRow>
            rows={milestones.data || []}
            getRowKey={row => row.id}
            columns={[
              { key: 'title', header: 'Milestone', render: row => <strong>{row.title}</strong> },
              { key: 'owner', header: 'Owner', render: row => ownerName(row.owner) },
              { key: 'due', header: 'Due', render: row => formatDate(row.due_date) },
              { key: 'status', header: 'Status', render: row => <StatusBadge status={humanize(row.status)} /> },
              { key: 'evidence', header: 'Evidence', render: row => row.evidence_required ? 'Required' : 'Optional' },
              { key: 'progress', header: 'Progress', render: row => `${row.progress_percent ?? 0}%` },
              {
                key: 'actions',
                header: 'Controls',
                render: row => (canControlProject || row.owner_id === actorId) ? <WorkControlButtons
                  onStatus={() => setActiveControl({ mode: 'status', itemType: 'milestone', itemId: row.id, title: row.title, status: row.status, progress: row.progress_percent })}
                  onEvidence={() => setActiveControl({ mode: 'evidence', itemType: 'milestone', itemId: row.id, title: row.title })}
                  onApproval={() => setActiveControl({ mode: 'approval', itemType: 'milestone', itemId: row.id, title: row.title })}
                /> : '-'
              }
            ]}
          />
        </DataState>
      </div>

      <div className="panel inner-panel">
        <div className="panel-header split-header">
          <div><h4>Tasks</h4><p>Assigned work under milestones. Keep this for controlled tasks, not daily small to-dos.</p></div>
          {canControlProject ? <button className="ghost-button" type="button" onClick={() => setTaskFormOpen(true)}>Add Task</button> : null}
        </div>
        <DataState loading={tasks.loading} error={tasks.error} empty={!tasks.data?.length} emptyMessage="No tasks yet.">
          <EntityTable<TaskRow>
            rows={tasks.data || []}
            getRowKey={row => row.id}
            columns={[
              { key: 'title', header: 'Task', render: row => <strong>{row.title}</strong> },
              { key: 'assignee', header: 'Assigned To', render: row => ownerName(row.assignee) },
              { key: 'due', header: 'Due', render: row => formatDate(row.due_date) },
              { key: 'status', header: 'Status', render: row => <StatusBadge status={humanize(row.status)} /> },
              { key: 'evidence', header: 'Evidence', render: row => row.evidence_required ? 'Required' : 'Optional' },
              { key: 'progress', header: 'Progress', render: row => `${row.progress_percent ?? 0}%` },
              {
                key: 'actions',
                header: 'Controls',
                render: row => (canControlProject || row.owner_id === actorId || row.assigned_to === actorId) ? <WorkControlButtons
                  onStatus={() => setActiveControl({ mode: 'status', itemType: 'task', itemId: row.id, title: row.title, status: row.status, progress: row.progress_percent })}
                  onEvidence={() => setActiveControl({ mode: 'evidence', itemType: 'task', itemId: row.id, title: row.title })}
                  onApproval={() => setActiveControl({ mode: 'approval', itemType: 'task', itemId: row.id, title: row.title })}
                /> : '-'
              }
            ]}
          />
        </DataState>
      </div>

      <div className="panel inner-panel">
        <div className="panel-header split-header">
          <div><h4>Project evidence</h4><p>Files are private. Every view or download is authorized against the evidence record and audited.</p></div>
        </div>
        <DataState loading={evidence.loading} error={evidence.error} empty={!evidence.data?.length} emptyMessage="No project evidence is visible in your assignment scope.">
          <div className="governed-evidence-list">
            {(evidence.data || []).map(file => <GovernedEvidenceAccess key={file.id} evidenceId={file.id} fileName={file.file_name} fileType={file.file_type} fileSize={file.file_size} description={file.description} />)}
          </div>
        </DataState>
      </div>

      <Modal size="large" open={milestoneFormOpen} title="Add controlled milestone" onClose={() => setMilestoneFormOpen(false)}>
        {organizationId ? (
          <MilestoneForm
            organizationId={organizationId}
            projectId={project.id}
            profiles={profiles}
            onCancel={() => setMilestoneFormOpen(false)}
            onCreated={() => {
              setMilestoneFormOpen(false);
              void milestones.refresh();
            }}
          />
        ) : (
          <div className="notice-banner">Cannot add a milestone without a real organization context.</div>
        )}
      </Modal>

      <Modal size="large" open={taskFormOpen} title="Add controlled task" onClose={() => setTaskFormOpen(false)}>
        {organizationId ? (
          <TaskForm
            organizationId={organizationId}
            projectId={project.id}
            milestones={milestones.data || []}
            profiles={profiles}
            onCancel={() => setTaskFormOpen(false)}
            onCreated={() => {
              setTaskFormOpen(false);
              void tasks.refresh();
            }}
          />
        ) : (
          <div className="notice-banner">Cannot add a task without a real organization context.</div>
        )}
      </Modal>

      <Modal size="large" open={Boolean(activeControl)} title={activeControl ? `${activeControl.title}` : 'Control item'} onClose={() => setActiveControl(null)}>
        {activeControl?.mode === 'status' ? (
          <StatusUpdateForm itemType={activeControl.itemType} itemId={activeControl.itemId} currentStatus={activeControl.status} currentProgress={activeControl.progress} onCancel={() => setActiveControl(null)} onUpdated={closeControlAndRefresh} />
        ) : null}
        {activeControl?.mode === 'evidence' ? (
          organizationId ? (
            <EvidenceUploadForm organizationId={organizationId} itemType={activeControl.itemType} itemId={activeControl.itemId} onCancel={() => setActiveControl(null)} onUploaded={closeControlAndRefresh} />
          ) : (
            <div className="notice-banner">Cannot upload evidence without a real organization context.</div>
          )
        ) : null}
        {activeControl?.mode === 'approval' ? (
          organizationId ? (
            <ApprovalRequestForm organizationId={organizationId} itemType={activeControl.itemType} itemId={activeControl.itemId} profiles={profiles} onCancel={() => setActiveControl(null)} onRequested={closeControlAndRefresh} />
          ) : (
            <div className="notice-banner">Cannot request approval without a real organization context.</div>
          )
        ) : null}
      </Modal>
    </div>
  );
}
