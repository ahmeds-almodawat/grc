import { useState } from 'react';
import { DataState } from './DataState';
import { EntityTable } from './EntityTable';
import { MilestoneForm, TaskForm } from './GrcForms';
import { Modal } from './Modal';
import { StatusBadge } from './StatusBadge';
import { ApprovalRequestForm, EvidenceUploadForm, StatusUpdateForm, WorkControlButtons, type ControllableItemType } from './WorkItemControls';
import { formatDate, humanize, ownerName } from '../lib/format';
import { getProjectMilestones, getProjectTasks } from '../lib/grcApi';
import { useAsyncData } from '../hooks/useAsyncData';
import type { MilestoneRow, ProfileOption, ProjectRow, TaskRow } from '../types/domain';

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
  const [milestoneFormOpen, setMilestoneFormOpen] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [activeControl, setActiveControl] = useState<ActiveControl>(null);
  const milestones = useAsyncData(() => getProjectMilestones(project.id), [project.id]);
  const tasks = useAsyncData(() => getProjectTasks(project.id), [project.id]);
  const organizationId = project.organization_id || 'demo-org';

  function refreshDetail() {
    void milestones.refresh();
    void tasks.refresh();
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
          <WorkControlButtons
            onStatus={() => setActiveControl({ mode: 'status', itemType: 'project', itemId: project.id, title: project.title, status: project.status, progress: project.progress_percent })}
            onEvidence={() => setActiveControl({ mode: 'evidence', itemType: 'project', itemId: project.id, title: project.title })}
            onApproval={() => setActiveControl({ mode: 'approval', itemType: 'project', itemId: project.id, title: project.title })}
          />
        </div>
      </div>

      <div className="panel inner-panel">
        <div className="panel-header split-header">
          <div><h4>Milestones</h4><p>Major stages with owner, due date, evidence and approval.</p></div>
          <button className="ghost-button" type="button" onClick={() => setMilestoneFormOpen(true)}>Add Milestone</button>
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
                render: row => <WorkControlButtons
                  onStatus={() => setActiveControl({ mode: 'status', itemType: 'milestone', itemId: row.id, title: row.title, status: row.status, progress: row.progress_percent })}
                  onEvidence={() => setActiveControl({ mode: 'evidence', itemType: 'milestone', itemId: row.id, title: row.title })}
                  onApproval={() => setActiveControl({ mode: 'approval', itemType: 'milestone', itemId: row.id, title: row.title })}
                />
              }
            ]}
          />
        </DataState>
      </div>

      <div className="panel inner-panel">
        <div className="panel-header split-header">
          <div><h4>Tasks</h4><p>Assigned work under milestones. Keep this for controlled tasks, not daily small to-dos.</p></div>
          <button className="ghost-button" type="button" onClick={() => setTaskFormOpen(true)}>Add Task</button>
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
                render: row => <WorkControlButtons
                  onStatus={() => setActiveControl({ mode: 'status', itemType: 'task', itemId: row.id, title: row.title, status: row.status, progress: row.progress_percent })}
                  onEvidence={() => setActiveControl({ mode: 'evidence', itemType: 'task', itemId: row.id, title: row.title })}
                  onApproval={() => setActiveControl({ mode: 'approval', itemType: 'task', itemId: row.id, title: row.title })}
                />
              }
            ]}
          />
        </DataState>
      </div>

      <Modal open={milestoneFormOpen} title="Add controlled milestone" onClose={() => setMilestoneFormOpen(false)}>
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
      </Modal>

      <Modal open={taskFormOpen} title="Add controlled task" onClose={() => setTaskFormOpen(false)}>
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
      </Modal>

      <Modal open={Boolean(activeControl)} title={activeControl ? `${activeControl.title}` : 'Control item'} onClose={() => setActiveControl(null)}>
        {activeControl?.mode === 'status' ? (
          <StatusUpdateForm itemType={activeControl.itemType} itemId={activeControl.itemId} currentStatus={activeControl.status} currentProgress={activeControl.progress} onCancel={() => setActiveControl(null)} onUpdated={closeControlAndRefresh} />
        ) : null}
        {activeControl?.mode === 'evidence' ? (
          <EvidenceUploadForm organizationId={organizationId} itemType={activeControl.itemType} itemId={activeControl.itemId} onCancel={() => setActiveControl(null)} onUploaded={closeControlAndRefresh} />
        ) : null}
        {activeControl?.mode === 'approval' ? (
          <ApprovalRequestForm organizationId={organizationId} itemType={activeControl.itemType} itemId={activeControl.itemId} profiles={profiles} onCancel={() => setActiveControl(null)} onRequested={closeControlAndRefresh} />
        ) : null}
      </Modal>
    </div>
  );
}
