import { useEffect, useMemo, useState } from 'react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import {
  getWorkflowKernelModuleCoverage,
  getWorkflowKernelQueue,
  getWorkflowKernelSlaDashboard,
  getWorkflowKernelSummary,
  type WorkflowKernelModuleCoverageRow,
  type WorkflowKernelQueueRow,
  type WorkflowKernelSlaRow,
  type WorkflowKernelSummary,
} from '../lib/workflowKernelApi';
import { getLiveResultMessage, isLive, type LiveResult } from '../lib/liveResult';

const emptySummary: LiveResult<WorkflowKernelSummary> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No workflow kernel summary loaded yet.',
};

const emptyQueue: LiveResult<WorkflowKernelQueueRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No workflow queue loaded yet.',
};

const emptySla: LiveResult<WorkflowKernelSlaRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No workflow SLA dashboard loaded yet.',
};

const emptyCoverage: LiveResult<WorkflowKernelModuleCoverageRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No workflow module coverage loaded yet.',
};

function rows<T>(result: LiveResult<T[]>): T[] {
  return isLive(result) ? result.data : [];
}

function priorityTone(priority: string): 'neutral' | 'good' | 'warning' | 'danger' {
  if (priority === 'critical') return 'danger';
  if (priority === 'high') return 'warning';
  return 'neutral';
}

function signalTone(signal: string): 'neutral' | 'good' | 'warning' | 'danger' {
  if (signal === 'overdue') return 'danger';
  if (signal === 'due_soon' || signal === 'high_priority') return 'warning';
  return 'neutral';
}

function statusTone(status: string): 'neutral' | 'good' | 'warning' | 'danger' {
  if (['approved', 'closed', 'completed'].includes(status)) return 'good';
  if (['rejected', 'cancelled'].includes(status)) return 'neutral';
  if (['overdue', 'changes_requested'].includes(status)) return 'danger';
  if (['submitted', 'in_review', 'pending', 'in_progress'].includes(status)) return 'warning';
  return 'neutral';
}

export function WorkflowKernelCenter() {
  const [summary, setSummary] = useState<LiveResult<WorkflowKernelSummary>>(emptySummary);
  const [queue, setQueue] = useState<LiveResult<WorkflowKernelQueueRow[]>>(emptyQueue);
  const [sla, setSla] = useState<LiveResult<WorkflowKernelSlaRow[]>>(emptySla);
  const [coverage, setCoverage] = useState<LiveResult<WorkflowKernelModuleCoverageRow[]>>(emptyCoverage);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const [summaryResult, queueResult, slaResult, coverageResult] = await Promise.all([
        getWorkflowKernelSummary(),
        getWorkflowKernelQueue(),
        getWorkflowKernelSlaDashboard(),
        getWorkflowKernelModuleCoverage(),
      ]);

      if (!mounted) return;
      setSummary(summaryResult);
      setQueue(queueResult);
      setSla(slaResult);
      setCoverage(coverageResult);
      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const summaryData = isLive(summary) ? summary.data : null;
  const queueRows = rows(queue);
  const slaRows = rows(sla);
  const coverageRows = rows(coverage);

  const nonLiveMessages = useMemo(() => ([summary, queue, sla, coverage] as LiveResult<unknown>[])
    .filter(result => !isLive(result))
    .map(result => getLiveResultMessage(result))
    .filter((message, index, all) => all.indexOf(message) === index), [coverage, queue, sla, summary]);

  const hasAnyData = Boolean(summaryData)
    || queueRows.length > 0
    || slaRows.length > 0
    || coverageRows.length > 0;

  return (
    <div className="page-stack workflow-kernel-center">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Workflow kernel</p>
          <h1>Shared owner - reviewer - approver operating engine</h1>
          <p className="section-subtitle">
            One workflow backbone for accreditation, quality, risk, audit, compliance, evidence, CAPA, approvals, assignments, SLA, escalation, RACI, comments, attachments, and activity history.
          </p>
        </div>
      </section>

      <DataState
        loading={loading}
        empty={!loading && !hasAnyData}
        emptyTitle="Workflow kernel is installed, but no live workflow records are loaded yet"
        emptyMessage={nonLiveMessages[0] ?? 'Create workflow templates and instances to activate operating queues, SLA tracking, approvals, and escalations.'}
      >
        <div className="kpi-grid">
          <KpiTile label="Workflows" value={summaryData?.workflow_count ?? 0} hint="Total live workflow instances" />
          <KpiTile label="Active" value={summaryData?.active_workflow_count ?? 0} hint="Submitted / in review / changes requested" tone={(summaryData?.active_workflow_count ?? 0) > 0 ? 'warning' : 'neutral'} />
          <KpiTile label="Overdue" value={summaryData?.overdue_workflow_count ?? 0} hint="Workflow due date breached" tone={(summaryData?.overdue_workflow_count ?? 0) > 0 ? 'danger' : 'good'} />
          <KpiTile label="Assignments" value={summaryData?.open_assignment_count ?? 0} hint="Pending / in-progress tasks" tone={(summaryData?.open_assignment_count ?? 0) > 0 ? 'warning' : 'neutral'} />
          <KpiTile label="Escalations" value={summaryData?.open_escalation_count ?? 0} hint="Open escalation cases" tone={(summaryData?.open_escalation_count ?? 0) > 0 ? 'danger' : 'good'} />
          <KpiTile label="Evidence attention" value={summaryData?.evidence_attention_count ?? 0} hint="Submitted / rejected / expired attachments" tone={(summaryData?.evidence_attention_count ?? 0) > 0 ? 'warning' : 'neutral'} />
        </div>

        <ModernCard
          title="Workflow queue"
          subtitle="Active assignments and workflows across GRC, accreditation, quality, audit, compliance, evidence, and CAPA."
        >
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Workflow</th>
                  <th>Module</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Owner</th>
                  <th>Assignee</th>
                  <th>Assignment</th>
                  <th>Due</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {queueRows.slice(0, 120).map(row => (
                  <tr key={`${row.workflow_id}-${row.assignment_id ?? 'no-assignment'}`}>
                    <td><strong>{row.source_code ?? row.source_type}</strong><br /><small>{row.workflow_title}</small></td>
                    <td>{row.module_key}</td>
                    <td><StatusPill tone={statusTone(row.workflow_status)}>{row.workflow_status}</StatusPill></td>
                    <td><StatusPill tone={priorityTone(row.priority)}>{row.priority}</StatusPill></td>
                    <td>{row.owner_name ?? 'Unassigned'}</td>
                    <td>{row.assignee_name ?? 'Unassigned'}</td>
                    <td>{row.assignment_role ?? '-'} / {row.assignment_status ?? '-'}</td>
                    <td>{row.assignment_due_date ?? row.workflow_due_date ?? '-'}</td>
                    <td><StatusPill tone={signalTone(row.queue_signal)}>{row.queue_signal}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard
          title="SLA dashboard"
          subtitle="Workload grouped by module, status, overdue count, due-soon count, and nearest due date."
        >
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Status</th>
                  <th>Workflows</th>
                  <th>Overdue</th>
                  <th>Due soon</th>
                  <th>Nearest due date</th>
                </tr>
              </thead>
              <tbody>
                {slaRows.map(row => (
                  <tr key={`${row.module_key}-${row.workflow_status}`}>
                    <td>{row.module_key}</td>
                    <td><StatusPill tone={statusTone(row.workflow_status)}>{row.workflow_status}</StatusPill></td>
                    <td>{row.workflow_count}</td>
                    <td><StatusPill tone={row.overdue_count > 0 ? 'danger' : 'good'}>{row.overdue_count}</StatusPill></td>
                    <td>{row.due_soon_count}</td>
                    <td>{row.nearest_due_date ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard
          title="Module workflow coverage"
          subtitle="Shows which modules have workflow templates, steps, and active instances."
        >
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Templates</th>
                  <th>Steps</th>
                  <th>Instances</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {coverageRows.map(row => (
                  <tr key={row.module_key}>
                    <td><strong>{row.module_key}</strong></td>
                    <td>{row.template_count}</td>
                    <td>{row.step_count}</td>
                    <td>{row.instance_count}</td>
                    <td>{row.active_instance_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>
      </DataState>
    </div>
  );
}
