import { useEffect, useMemo, useState } from 'react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import {
  getAccreditationOperationsDashboard,
  getActiveReviewCycles,
  getClauseBlockerSummary,
  getClauseOwnerRegister,
  getClauseOwnerTaskQueue,
  getClauseReviewerSignoffQueue,
  getClauseSignoffRegister,
  getDepartmentAccreditationWorkload,
  getEscalationRegister,
  getExecutiveAccreditationWorkflowSummary,
  getOverdueClauseTasks,
  getReadyForSurveyReviewQueue,
  type AccreditationOperationsDashboardRow,
  type ClauseBlockerSummaryRow,
  type ClauseOwnerRegisterRow,
  type ClauseSignoffRegisterRow,
  type ClauseTaskQueueRow,
  type DepartmentAccreditationWorkloadRow,
  type EscalationRegisterRow,
  type ReviewCycleRow,
} from '../lib/accreditationWorkflowApi';
import { getLiveResultMessage, isLive, type LiveResult } from '../lib/liveResult';

type Tone = 'neutral' | 'good' | 'warning' | 'danger';
type RowValue = string | number | boolean | null | undefined;

function emptyRows<T>(message: string): LiveResult<T[]> {
  return {
    status: 'empty',
    data: null,
    source: 'system',
    isLive: false,
    generatedAt: new Date(0).toISOString(),
    message,
  };
}

function rows<T>(result: LiveResult<T[]>): T[] {
  return isLive(result) ? result.data : [];
}

function first<T>(result: LiveResult<T[]>): T | null {
  return isLive(result) ? result.data[0] ?? null : null;
}

function formatValue(value: RowValue): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(1);
  return value.replaceAll('_', ' ');
}

function statusTone(status?: string | null): Tone {
  if (['active', 'approved', 'signed_off', 'completed', 'resolved'].includes(status ?? '')) return 'good';
  if (['draft', 'submitted', 'under_review', 'pending', 'acknowledged', 'in_progress'].includes(status ?? '')) return 'warning';
  if (['rejected', 'overdue', 'reopened', 'escalated', 'suspended', 'cancelled'].includes(status ?? '')) return 'danger';
  return 'neutral';
}

function priorityTone(priority?: string | null): Tone {
  if (priority === 'critical' || priority === 'high') return 'danger';
  if (priority === 'medium') return 'warning';
  if (priority === 'low') return 'good';
  return 'neutral';
}

function signalTone(signal?: string | null): Tone {
  if (signal === 'on_track') return 'good';
  if (signal === 'watch') return 'warning';
  if (signal === 'attention_required') return 'danger';
  return 'neutral';
}

function StatusBadge({ value }: { value?: string | null }) {
  return <StatusPill tone={statusTone(value)}>{formatValue(value)}</StatusPill>;
}

function PriorityBadge({ value }: { value?: string | null }) {
  return <StatusPill tone={priorityTone(value)}>{formatValue(value)}</StatusPill>;
}

function EmptyTableMessage({ label, columns }: { label: string; columns: number }) {
  return (
    <tr>
      <td colSpan={columns}><strong>No {label} records returned.</strong></td>
    </tr>
  );
}

function OwnerRegisterTable({ data }: { data: ClauseOwnerRegisterRow[] }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead><tr><th>Clause</th><th>Owner</th><th>Reviewer</th><th>Department</th><th>Status</th><th>Due</th></tr></thead>
        <tbody>
          {data.length === 0 ? <EmptyTableMessage label="owner assignment" columns={6} /> : data.slice(0, 80).map(row => (
            <tr key={row.owner_assignment_id ?? row.clause_id}>
              <td><strong>{formatValue(row.clause_code)}</strong><br /><small>{formatValue(row.clause_title)}</small></td>
              <td>{formatValue(row.owner_name)}</td>
              <td>{formatValue(row.reviewer_name)}</td>
              <td>{formatValue(row.owner_department_name ?? row.reviewer_department_name)}</td>
              <td><StatusBadge value={row.assignment_status} /></td>
              <td>{formatValue(row.due_date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CycleTable({ data }: { data: ReviewCycleRow[] }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead><tr><th>Cycle</th><th>Type</th><th>Status</th><th>Starts</th><th>Ends</th><th>Notes</th></tr></thead>
        <tbody>
          {data.length === 0 ? <EmptyTableMessage label="review cycle" columns={6} /> : data.slice(0, 60).map(row => (
            <tr key={row.id ?? row.cycle_name}>
              <td><strong>{formatValue(row.cycle_name)}</strong></td>
              <td>{formatValue(row.cycle_type)}</td>
              <td><StatusBadge value={row.status} /></td>
              <td>{formatValue(row.starts_on)}</td>
              <td>{formatValue(row.ends_on)}</td>
              <td>{formatValue(row.notes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskTable({ data, label }: { data: ClauseTaskQueueRow[]; label: string }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead><tr><th>Task</th><th>Clause</th><th>Assignee</th><th>Status</th><th>Priority</th><th>Due</th><th>Cycle</th></tr></thead>
        <tbody>
          {data.length === 0 ? <EmptyTableMessage label={label} columns={7} /> : data.slice(0, 90).map(row => (
            <tr key={row.id ?? `${row.clause_id}-${row.task_type}`}>
              <td><strong>{formatValue(row.task_type)}</strong><br /><small>{formatValue(row.outcome_notes)}</small></td>
              <td><strong>{formatValue(row.clause_code)}</strong><br /><small>{formatValue(row.clause_title)}</small></td>
              <td>{formatValue(row.assigned_to_name ?? row.assigned_department_name)}</td>
              <td>{row.is_overdue ? <StatusPill tone="danger">Overdue</StatusPill> : <StatusBadge value={row.status} />}</td>
              <td><PriorityBadge value={row.priority} /></td>
              <td>{formatValue(row.due_date)}</td>
              <td>{formatValue(row.cycle_name)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WorkloadTable({ data }: { data: DepartmentAccreditationWorkloadRow[] }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead><tr><th>Department</th><th>Open tasks</th><th>Overdue</th><th>High priority</th><th>Pending review</th><th>Nearest due</th></tr></thead>
        <tbody>
          {data.length === 0 ? <EmptyTableMessage label="department workload" columns={6} /> : data.slice(0, 80).map(row => (
            <tr key={row.department_id ?? row.department_name}>
              <td><strong>{formatValue(row.department_name)}</strong></td>
              <td>{formatValue(row.open_task_count)}</td>
              <td><StatusPill tone={(row.overdue_task_count ?? 0) > 0 ? 'danger' : 'good'}>{formatValue(row.overdue_task_count)}</StatusPill></td>
              <td>{formatValue(row.high_priority_task_count)}</td>
              <td>{formatValue(row.pending_review_count)}</td>
              <td>{formatValue(row.nearest_due_date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BlockerTable({ data, label }: { data: ClauseBlockerSummaryRow[]; label: string }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead><tr><th>Clause</th><th>Standard</th><th>Workflow</th><th>Evidence</th><th>Dependencies</th><th>Escalations</th><th>Signoffs</th></tr></thead>
        <tbody>
          {data.length === 0 ? <EmptyTableMessage label={label} columns={7} /> : data.slice(0, 90).map(row => (
            <tr key={row.clause_id ?? row.clause_code}>
              <td><strong>{formatValue(row.clause_code)}</strong><br /><small>{formatValue(row.clause_title)}</small></td>
              <td>{formatValue(row.framework)}<br /><small>{formatValue(row.standard_code)}</small></td>
              <td>{formatValue(row.workflow_blocker_count)}</td>
              <td>{formatValue(row.evidence_blocker_count)}</td>
              <td>{formatValue(row.dependency_link_count)}</td>
              <td>{formatValue(row.open_escalation_count)}</td>
              <td>{formatValue(row.signed_off_count)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SignoffTable({ data }: { data: ClauseSignoffRegisterRow[] }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead><tr><th>Clause</th><th>Type</th><th>Status</th><th>Signed by</th><th>Signed at</th><th>Cycle</th></tr></thead>
        <tbody>
          {data.length === 0 ? <EmptyTableMessage label="signoff" columns={6} /> : data.slice(0, 80).map(row => (
            <tr key={row.id ?? `${row.clause_id}-${row.signoff_type}`}>
              <td><strong>{formatValue(row.clause_code)}</strong><br /><small>{formatValue(row.clause_title)}</small></td>
              <td>{formatValue(row.signoff_type)}</td>
              <td><StatusBadge value={row.signoff_status} /></td>
              <td>{formatValue(row.signed_by_name)}</td>
              <td>{formatValue(row.signed_at)}</td>
              <td>{formatValue(row.cycle_name)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EscalationTable({ data }: { data: EscalationRegisterRow[] }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead><tr><th>Clause</th><th>Level</th><th>Status</th><th>Reason</th><th>Escalated to</th><th>Resolved</th></tr></thead>
        <tbody>
          {data.length === 0 ? <EmptyTableMessage label="escalation" columns={6} /> : data.slice(0, 80).map(row => (
            <tr key={row.id ?? `${row.clause_id}-${row.escalated_at}`}>
              <td><strong>{formatValue(row.clause_code)}</strong><br /><small>{formatValue(row.clause_title)}</small></td>
              <td><PriorityBadge value={row.escalation_level} /></td>
              <td><StatusBadge value={row.escalation_status} /></td>
              <td>{formatValue(row.escalation_reason)}</td>
              <td>{formatValue(row.escalated_to_name ?? row.escalated_to_department_name)}</td>
              <td>{formatValue(row.resolved_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AccreditationWorkflowCenter() {
  const [owners, setOwners] = useState<LiveResult<ClauseOwnerRegisterRow[]>>(emptyRows('No clause owner assignments loaded yet.'));
  const [cycles, setCycles] = useState<LiveResult<ReviewCycleRow[]>>(emptyRows('No active review cycles loaded yet.'));
  const [tasks, setTasks] = useState<LiveResult<ClauseTaskQueueRow[]>>(emptyRows('No owner tasks loaded yet.'));
  const [overdue, setOverdue] = useState<LiveResult<ClauseTaskQueueRow[]>>(emptyRows('No overdue clause tasks loaded yet.'));
  const [reviewerQueue, setReviewerQueue] = useState<LiveResult<ClauseTaskQueueRow[]>>(emptyRows('No reviewer signoff tasks loaded yet.'));
  const [workload, setWorkload] = useState<LiveResult<DepartmentAccreditationWorkloadRow[]>>(emptyRows('No department workload rows loaded yet.'));
  const [blockers, setBlockers] = useState<LiveResult<ClauseBlockerSummaryRow[]>>(emptyRows('No clause blocker summary loaded yet.'));
  const [signoffs, setSignoffs] = useState<LiveResult<ClauseSignoffRegisterRow[]>>(emptyRows('No clause signoff records loaded yet.'));
  const [escalations, setEscalations] = useState<LiveResult<EscalationRegisterRow[]>>(emptyRows('No escalation records loaded yet.'));
  const [dashboard, setDashboard] = useState<LiveResult<AccreditationOperationsDashboardRow[]>>(emptyRows('No operations dashboard loaded yet.'));
  const [executive, setExecutive] = useState<LiveResult<AccreditationOperationsDashboardRow[]>>(emptyRows('No executive workflow summary loaded yet.'));
  const [readyForSurvey, setReadyForSurvey] = useState<LiveResult<ClauseBlockerSummaryRow[]>>(emptyRows('No ready-for-survey rows loaded yet.'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const [
        ownerResult,
        cycleResult,
        taskResult,
        overdueResult,
        reviewerResult,
        workloadResult,
        blockerResult,
        signoffResult,
        escalationResult,
        dashboardResult,
        executiveResult,
        readyResult,
      ] = await Promise.all([
        getClauseOwnerRegister(),
        getActiveReviewCycles(),
        getClauseOwnerTaskQueue(),
        getOverdueClauseTasks(),
        getClauseReviewerSignoffQueue(),
        getDepartmentAccreditationWorkload(),
        getClauseBlockerSummary(),
        getClauseSignoffRegister(),
        getEscalationRegister(),
        getAccreditationOperationsDashboard(),
        getExecutiveAccreditationWorkflowSummary(),
        getReadyForSurveyReviewQueue(),
      ]);

      if (!mounted) return;
      setOwners(ownerResult);
      setCycles(cycleResult);
      setTasks(taskResult);
      setOverdue(overdueResult);
      setReviewerQueue(reviewerResult);
      setWorkload(workloadResult);
      setBlockers(blockerResult);
      setSignoffs(signoffResult);
      setEscalations(escalationResult);
      setDashboard(dashboardResult);
      setExecutive(executiveResult);
      setReadyForSurvey(readyResult);
      setLoading(false);
    }

    void load();
    return () => { mounted = false; };
  }, []);

  const ownerRows = rows(owners);
  const cycleRows = rows(cycles);
  const taskRows = rows(tasks);
  const overdueRows = rows(overdue);
  const reviewerRows = rows(reviewerQueue);
  const workloadRows = rows(workload);
  const blockerRows = rows(blockers);
  const signoffRows = rows(signoffs);
  const escalationRows = rows(escalations);
  const readyRows = rows(readyForSurvey);
  const dashboardRow = first(dashboard);
  const executiveRow = first(executive);

  const nonLiveMessages = useMemo(() => ([
    owners, cycles, tasks, overdue, reviewerQueue, workload, blockers, signoffs, escalations, dashboard, executive, readyForSurvey,
  ] as LiveResult<unknown>[])
    .filter(result => !isLive(result))
    .map(result => getLiveResultMessage(result))
    .filter((message, index, all) => all.indexOf(message) === index), [
      owners, cycles, tasks, overdue, reviewerQueue, workload, blockers, signoffs, escalations, dashboard, executive, readyForSurvey,
    ]);

  const hasAnyData = ownerRows.length > 0 || cycleRows.length > 0 || taskRows.length > 0
    || overdueRows.length > 0 || reviewerRows.length > 0 || workloadRows.length > 0
    || blockerRows.length > 0 || signoffRows.length > 0 || escalationRows.length > 0
    || readyRows.length > 0 || Boolean(dashboardRow) || Boolean(executiveRow);

  return (
    <div className="page-stack accreditation-workflow-center">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Accreditation Workflow</p>
          <h1>Daily accreditation operations command center</h1>
          <p className="section-subtitle">
            Clause ownership, review cycles, task queues, signoffs, escalations, blocker tracking, and ready-for-survey workflow from the Patch 35 operations layer.
          </p>
        </div>
      </section>

      <DataState
        loading={loading}
        empty={!loading && !hasAnyData}
        emptyTitle="Accreditation workflow is installed, but no live operations records are visible yet"
        emptyMessage={nonLiveMessages[0] ?? 'Assign clause owners, create a review cycle, and start owner tasks to activate daily accreditation operations.'}
      >
        <div className="kpi-grid">
          <KpiTile label="Executive signal" value={formatValue(executiveRow?.executive_signal)} hint="Workflow posture" tone={signalTone(executiveRow?.executive_signal)} />
          <KpiTile label="Owner assignments" value={dashboardRow?.active_owner_assignment_count ?? ownerRows.length} hint="Active clause owners" />
          <KpiTile label="Open tasks" value={dashboardRow?.open_task_count ?? taskRows.length} hint="Owner and reviewer workload" tone={(dashboardRow?.open_task_count ?? taskRows.length) > 0 ? 'warning' : 'good'} />
          <KpiTile label="Overdue" value={dashboardRow?.overdue_task_count ?? overdueRows.length} hint="Past due clause tasks" tone={(dashboardRow?.overdue_task_count ?? overdueRows.length) > 0 ? 'danger' : 'good'} />
          <KpiTile label="Blocked clauses" value={dashboardRow?.blocked_clause_count ?? blockerRows.filter(row => (row.workflow_blocker_count ?? 0) > 0 || (row.evidence_blocker_count ?? 0) > 0).length} hint="Workflow/evidence blockers" tone={(dashboardRow?.blocked_clause_count ?? 0) > 0 ? 'danger' : 'good'} />
          <KpiTile label="Ready for survey" value={readyRows.length} hint="No open blockers" tone="good" />
        </div>

        <ModernCard title="Clause owner register" subtitle="Accountable owners and reviewers by accreditation clause.">
          <OwnerRegisterTable data={ownerRows} />
        </ModernCard>

        <ModernCard title="Active review cycles" subtitle="Readiness campaigns, internal reviews, survey rehearsals, and department reviews.">
          <CycleTable data={cycleRows} />
        </ModernCard>

        <ModernCard title="Owner task queue" subtitle="Open clause owner work, evidence collection, SOP updates, CAPA closure, training completion, and reviewer actions.">
          <TaskTable data={taskRows} label="owner task" />
        </ModernCard>

        <ModernCard title="Overdue clause tasks" subtitle="Clause workflow items that require follow-up or escalation.">
          <TaskTable data={overdueRows} label="overdue task" />
        </ModernCard>

        <ModernCard title="Reviewer signoff queue" subtitle="Submitted clauses waiting for reviewer signoff or rework.">
          <TaskTable data={reviewerRows} label="reviewer signoff" />
        </ModernCard>

        <ModernCard title="Department accreditation workload" subtitle="Workload by department with overdue, high priority, and pending review counts.">
          <WorkloadTable data={workloadRows} />
        </ModernCard>

        <ModernCard title="Clause blocker summary" subtitle="Workflow, evidence, dependency, and escalation blockers by clause.">
          <BlockerTable data={blockerRows} label="clause blocker" />
        </ModernCard>

        <ModernCard title="Clause signoff register" subtitle="Owner, reviewer, quality, and executive signoff status.">
          <SignoffTable data={signoffRows} />
        </ModernCard>

        <ModernCard title="Escalation register" subtitle="Open, acknowledged, resolved, or cancelled accreditation workflow escalations.">
          <EscalationTable data={escalationRows} />
        </ModernCard>

        <ModernCard title="Ready-for-survey review queue" subtitle="Clauses with no open workflow, evidence, or escalation blockers.">
          <BlockerTable data={readyRows} label="ready-for-survey" />
        </ModernCard>
      </DataState>
    </div>
  );
}
