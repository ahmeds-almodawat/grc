import { useState } from 'react';
import { DataState } from './DataState';
import { EntityTable } from './EntityTable';
import { MilestoneForm, TaskForm } from './GrcForms';
import { Modal } from './Modal';
import { StatusBadge } from './StatusBadge';
import { ApprovalRequestForm, AssignmentManagementForm, EvidenceUploadForm, StatusUpdateForm, WorkControlButtons, type ControllableItemType } from './WorkItemControls';
import { formatDate, humanize } from '../lib/format';
import { getProjectMilestones, getProjectTasks, getProjectWorkAssignments } from '../lib/grcApi';
import { getEvidenceForItem } from '../lib/grcApi';
import { useAsyncData } from '../hooks/useAsyncData';
import type { WorkItemAssignmentSummary } from '../lib/grcApi';
import type { MilestoneRow, ProjectRow, TaskRow } from '../types/domain';
import { useAuth } from '../auth/AuthProvider';
import { GovernedEvidenceAccess } from './GovernedEvidenceAccess';
import { useI18n } from '../i18n/I18nContext';

interface ProjectDetailProps {
  project: ProjectRow;
  onProjectUpdated?: () => void;
}

type ActiveControl =
  | { mode: 'status'; itemType: ControllableItemType; itemId: string; title: string; status: ProjectRow['status'] | MilestoneRow['status'] | TaskRow['status']; progress: number | null }
  | { mode: 'evidence'; itemType: ControllableItemType; itemId: string; title: string }
  | { mode: 'approval'; itemType: ControllableItemType; itemId: string; title: string }
  | { mode: 'assignment'; itemType: ControllableItemType; itemId: string; title: string; assignment?: WorkItemAssignmentSummary }
  | null;

type ProjectRelationshipControl = Pick<ProjectRow, 'owner_id' | 'sponsor_id' | 'created_by'>;
type ProjectRelationshipAssignment = Pick<WorkItemAssignmentSummary, 'assignee_id' | 'assignment_status'>;

export function canControlProjectByRelationship(
  actorId: string | null | undefined,
  project: ProjectRelationshipControl,
  projectAssignment?: ProjectRelationshipAssignment,
): boolean {
  const actorIsAcceptedProjectOwner = Boolean(
    actorId
    && actorId === project.owner_id
    && projectAssignment?.assignee_id === actorId
    && ['accepted', 'legacy_unverified'].includes(projectAssignment.assignment_status),
  );

  return Boolean(
    actorId
    && (
      actorIsAcceptedProjectOwner
      || actorId === project.sponsor_id
      || actorId === project.created_by
    )
  );
}

export function ProjectDetail({ project, onProjectUpdated }: ProjectDetailProps) {
  const auth = useAuth();
  const { t, language } = useI18n();
  const [milestoneFormOpen, setMilestoneFormOpen] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [activeControl, setActiveControl] = useState<ActiveControl>(null);
  const milestones = useAsyncData(() => getProjectMilestones(project.id), [project.id]);
  const tasks = useAsyncData(() => getProjectTasks(project.id), [project.id]);
  const assignments = useAsyncData(() => getProjectWorkAssignments(project.id), [project.id]);
  const organizationId = project.organization_id ?? null;
  const actorId = auth.session?.user.id;
  const hasManagerAuthority = auth.roles.some(role => {
    const organizationMatches = !role.organizationId || role.organizationId === project.organization_id;
    if (!organizationMatches) return false;
    if (['super_admin', 'executive', 'governance_admin'].includes(role.role)) return role.scope === 'global';
    if (role.role === 'division_head') return role.scope === 'division' && Boolean(project.division_id) && role.divisionId === project.division_id;
    if (role.role === 'department_manager') return role.scope === 'department' && Boolean(project.department_id) && role.departmentId === project.department_id;
    return false;
  });
  const currentAssignment = (itemType: ControllableItemType, itemId: string) => assignments.data?.find(row => row.item_type === itemType && row.item_id === itemId);
  const projectAssignment = currentAssignment('project', project.id);
  const canControlProject = canControlProjectByRelationship(actorId, project, projectAssignment) || hasManagerAuthority;
  const projectAssignmentPending = projectAssignment?.assignment_status === 'pending';
  const canViewProjectEvidence = canControlProject;
  const evidence = useAsyncData(
    () => canViewProjectEvidence ? getEvidenceForItem('project', project.id) : Promise.resolve([]),
    [project.id, canViewProjectEvidence],
  );
  const personName = (nested?: { full_name_en: string | null; full_name_ar: string | null } | null, assignment?: WorkItemAssignmentSummary) => {
    if (language === 'ar') return nested?.full_name_ar || nested?.full_name_en || assignment?.assignee_name || t('common.unassigned', 'Unassigned');
    return nested?.full_name_en || nested?.full_name_ar || assignment?.assignee_name || t('common.unassigned', 'Unassigned');
  };

  function refreshDetail() {
    void milestones.refresh();
    void tasks.refresh();
    void evidence.refresh();
    void assignments.refresh();
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
          <StatusBadge status={t(`status.${project.status}`, humanize(project.status))} />
          <span className={`risk-pill ${project.risk_level}`}>{project.risk_level}</span>
        </div>
      </div>

      <div className="module-grid compact-grid">
        <div className="mini-card"><span>Source</span><strong>{humanize(project.source_type)}</strong></div>
        <div className="mini-card"><span>Owner</span><strong>{personName(project.owner, projectAssignment)}</strong></div>
        <div className="mini-card"><span>{t('myWork.assignment', 'Assignment')}</span><strong>{t(`assignment.${projectAssignment?.assignment_status || 'unassigned'}`, humanize(projectAssignment?.assignment_status || 'unassigned'))}</strong></div>
        <div className="mini-card"><span>Target end</span><strong>{formatDate(project.target_end_date)}</strong></div>
        <div className="mini-card"><span>Progress</span><strong>{project.progress_percent ?? 0}%</strong></div>
      </div>

      <div className="panel inner-panel">
        <div className="panel-header split-header">
          <div>
            <h4>Project controls</h4>
            <p>Update the project, upload proof, or request closure/decision approval.</p>
          </div>
          {canControlProject ? <div className="inline-actions"><WorkControlButtons
            canUpdateStatus={!projectAssignmentPending}
            onStatus={() => setActiveControl({ mode: 'status', itemType: 'project', itemId: project.id, title: project.title, status: project.status, progress: project.progress_percent })}
            onEvidence={() => setActiveControl({ mode: 'evidence', itemType: 'project', itemId: project.id, title: project.title })}
            onApproval={() => setActiveControl({ mode: 'approval', itemType: 'project', itemId: project.id, title: project.title })}
          /><button className="ghost-button compact-button" type="button" onClick={() => setActiveControl({ mode: 'assignment', itemType: 'project', itemId: project.id, title: project.title, assignment: projectAssignment })}>{t('assignment.manage', 'Manage assignment')}</button></div> : null}
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
              { key: 'owner', header: 'Owner', render: row => personName(row.owner, currentAssignment('milestone', row.id)) },
              { key: 'assignment', header: t('myWork.assignment', 'Assignment'), render: row => { const assignment=currentAssignment('milestone',row.id); return assignment ? <><StatusBadge status={t(`assignment.${assignment.assignment_status}`,humanize(assignment.assignment_status))} />{assignment.responded_at ? <small>{formatDate(assignment.responded_at)}</small> : null}</> : '—'; } },
              { key: 'due', header: 'Due', render: row => formatDate(row.due_date) },
              { key: 'status', header: 'Status', render: row => <StatusBadge status={t(`status.${row.status}`, humanize(row.status))} /> },
              { key: 'evidence', header: 'Evidence', render: row => row.evidence_required ? 'Required' : 'Optional' },
              { key: 'progress', header: 'Progress', render: row => `${row.progress_percent ?? 0}%` },
              {
                key: 'actions',
                header: 'Controls',
                render: row => { const assignment=currentAssignment('milestone',row.id); const assigneeCanAct=Boolean(assignment && assignment.assignee_id===actorId && ['accepted','legacy_unverified'].includes(assignment.assignment_status)); return (canControlProject || assigneeCanAct) ? <div className="inline-actions"><WorkControlButtons
                  canUpdateStatus={Boolean(assigneeCanAct || (!assignment && canControlProject))}
                  onStatus={() => setActiveControl({ mode: 'status', itemType: 'milestone', itemId: row.id, title: row.title, status: row.status, progress: row.progress_percent })}
                  onEvidence={() => setActiveControl({ mode: 'evidence', itemType: 'milestone', itemId: row.id, title: row.title })}
                  onApproval={() => setActiveControl({ mode: 'approval', itemType: 'milestone', itemId: row.id, title: row.title })}
                />{canControlProject ? <button className="ghost-button compact-button" type="button" onClick={() => setActiveControl({ mode: 'assignment', itemType: 'milestone', itemId: row.id, title: row.title, assignment })}>{t('assignment.manage', 'Manage assignment')}</button> : null}</div> : '-'; }
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
              { key: 'assignee', header: 'Assigned To', render: row => personName(row.assignee || row.owner, currentAssignment('task', row.id)) },
              { key: 'assignment', header: t('myWork.assignment', 'Assignment'), render: row => { const assignment=currentAssignment('task',row.id); return assignment ? <><StatusBadge status={t(`assignment.${assignment.assignment_status}`,humanize(assignment.assignment_status))} />{assignment.decline_reason ? <small>{assignment.decline_reason}</small> : null}</> : '—'; } },
              { key: 'due', header: 'Due', render: row => formatDate(row.due_date) },
              { key: 'status', header: 'Status', render: row => <StatusBadge status={t(`status.${row.status}`, humanize(row.status))} /> },
              { key: 'evidence', header: 'Evidence', render: row => row.evidence_required ? 'Required' : 'Optional' },
              { key: 'progress', header: 'Progress', render: row => `${row.progress_percent ?? 0}%` },
              {
                key: 'actions',
                header: 'Controls',
                render: row => { const assignment=currentAssignment('task',row.id); const assigneeCanAct=Boolean(assignment && assignment.assignee_id===actorId && ['accepted','legacy_unverified'].includes(assignment.assignment_status)); return (canControlProject || assigneeCanAct) ? <div className="inline-actions"><WorkControlButtons
                  canUpdateStatus={Boolean(assigneeCanAct || (!assignment && canControlProject))}
                  onStatus={() => setActiveControl({ mode: 'status', itemType: 'task', itemId: row.id, title: row.title, status: row.status, progress: row.progress_percent })}
                  onEvidence={() => setActiveControl({ mode: 'evidence', itemType: 'task', itemId: row.id, title: row.title })}
                  onApproval={() => setActiveControl({ mode: 'approval', itemType: 'task', itemId: row.id, title: row.title })}
                />{canControlProject ? <button className="ghost-button compact-button" type="button" onClick={() => setActiveControl({ mode: 'assignment', itemType: 'task', itemId: row.id, title: row.title, assignment })}>{t('assignment.manage', 'Manage assignment')}</button> : null}</div> : '-'; }
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
            <ApprovalRequestForm organizationId={organizationId} itemType={activeControl.itemType} itemId={activeControl.itemId} onCancel={() => setActiveControl(null)} onRequested={closeControlAndRefresh} />
          ) : (
            <div className="notice-banner">Cannot request approval without a real organization context.</div>
          )
        ) : null}
        {activeControl?.mode === 'assignment' ? <AssignmentManagementForm itemType={activeControl.itemType} itemId={activeControl.itemId} currentAssignment={activeControl.assignment} onCancel={() => setActiveControl(null)} onCompleted={closeControlAndRefresh} /> : null}
      </Modal>
    </div>
  );
}
