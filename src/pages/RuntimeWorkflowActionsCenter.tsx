import { useEffect, useMemo, useState } from 'react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import {
  getRuntimeWorkflowActionQueue,
  getRuntimeWorkflowActionSummary,
  getRuntimeWorkflowExceptionDashboard,
  getRuntimeWorkflowNotificationOutbox,
  type RuntimeWorkflowActionQueueRow,
  type RuntimeWorkflowActionSummary,
  type RuntimeWorkflowExceptionRow,
  type RuntimeWorkflowNotificationOutboxRow,
} from '../lib/runtimeWorkflowActionsApi';
import { getLiveResultMessage, isLive, type LiveResult } from '../lib/liveResult';

const emptySummary: LiveResult<RuntimeWorkflowActionSummary> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No runtime workflow action summary loaded yet.',
};

const emptyActions: LiveResult<RuntimeWorkflowActionQueueRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No workflow action queue loaded yet.',
};

const emptyOutbox: LiveResult<RuntimeWorkflowNotificationOutboxRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No notification outbox loaded yet.',
};

const emptyExceptions: LiveResult<RuntimeWorkflowExceptionRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No runtime workflow exceptions loaded yet.',
};

function rows<T>(result: LiveResult<T[]>): T[] {
  return isLive(result) ? result.data : [];
}

function signalTone(signal?: string | null): 'neutral' | 'good' | 'warning' | 'danger' {
  if (!signal || signal === 'normal') return 'neutral';
  if (['resolved', 'complete', 'sent'].includes(signal)) return 'good';
  if (signal.includes('failed') || signal.includes('overdue') || signal.includes('blocked')) return 'danger';
  if (signal.includes('high') || signal.includes('retry') || signal.includes('stale')) return 'warning';
  return 'neutral';
}

function statusTone(status?: string | null): 'neutral' | 'good' | 'warning' | 'danger' {
  if (!status) return 'neutral';
  if (['executed', 'approved', 'sent', 'resolved', 'completed'].includes(status)) return 'good';
  if (['failed', 'rejected', 'open'].includes(status)) return 'danger';
  if (['submitted', 'in_review', 'pending', 'retrying', 'acknowledged'].includes(status)) return 'warning';
  return 'neutral';
}

export function RuntimeWorkflowActionsCenter() {
  const [summary, setSummary] = useState<LiveResult<RuntimeWorkflowActionSummary>>(emptySummary);
  const [actions, setActions] = useState<LiveResult<RuntimeWorkflowActionQueueRow[]>>(emptyActions);
  const [outbox, setOutbox] = useState<LiveResult<RuntimeWorkflowNotificationOutboxRow[]>>(emptyOutbox);
  const [exceptions, setExceptions] = useState<LiveResult<RuntimeWorkflowExceptionRow[]>>(emptyExceptions);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const [summaryResult, actionResult, outboxResult, exceptionResult] = await Promise.all([
        getRuntimeWorkflowActionSummary(),
        getRuntimeWorkflowActionQueue(),
        getRuntimeWorkflowNotificationOutbox(),
        getRuntimeWorkflowExceptionDashboard(),
      ]);

      if (!mounted) return;
      setSummary(summaryResult);
      setActions(actionResult);
      setOutbox(outboxResult);
      setExceptions(exceptionResult);
      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const summaryData = isLive(summary) ? summary.data : null;
  const actionRows = rows(actions);
  const outboxRows = rows(outbox);
  const exceptionRows = rows(exceptions);

  const nonLiveMessages = useMemo(() => ([summary, actions, outbox, exceptions] as LiveResult<unknown>[])
    .filter(result => !isLive(result))
    .map(result => getLiveResultMessage(result))
    .filter((message, index, all) => all.indexOf(message) === index), [actions, exceptions, outbox, summary]);

  const hasAnyData = Boolean(summaryData) || actionRows.length > 0 || outboxRows.length > 0 || exceptionRows.length > 0;
  const activeRequests = summaryData?.active_request_count ?? actionRows.filter(row => !['executed', 'cancelled'].includes(row.request_status)).length;
  const openExceptions = summaryData?.open_exception_count ?? exceptionRows.filter(row => row.exception_status === 'open').length;

  return (
    <div className="page-stack runtime-workflow-actions-center">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Runtime workflow action engine</p>
          <h1>Actionable approvals, notifications, SLA, and exception control</h1>
          <p className="section-subtitle">
            Converts the workflow kernel into daily execution: transition rules, action requests, decision history, bulk actions, notification rules, escalation rules, integration outbox, and runtime exceptions.
          </p>
        </div>
      </section>

      <DataState
        loading={loading}
        empty={!loading && !hasAnyData}
        emptyTitle="Patch 9 runtime action engine is installed, but no live records are loaded yet"
        emptyMessage={nonLiveMessages[0] ?? 'Create workflow action requests, notification rules, or runtime exceptions to activate this workspace.'}
      >
        <div className="kpi-grid">
          <KpiTile label="Action requests" value={summaryData?.action_request_count ?? actionRows.length} hint="Runtime commands" />
          <KpiTile label="Active requests" value={activeRequests} hint="Needs review/execution" tone={activeRequests > 0 ? 'warning' : 'good'} />
          <KpiTile label="High priority" value={summaryData?.high_priority_request_count ?? actionRows.filter(row => row.priority === 'high' || row.priority === 'critical').length} hint="Critical/high requests" tone={(summaryData?.high_priority_request_count ?? 0) > 0 ? 'danger' : 'good'} />
          <KpiTile label="Open exceptions" value={openExceptions} hint="SLA / transition / delivery issues" tone={openExceptions > 0 ? 'danger' : 'good'} />
          <KpiTile label="Outbox pending" value={summaryData?.pending_outbox_count ?? outboxRows.filter(row => ['pending', 'retrying', 'failed'].includes(row.delivery_status)).length} hint="Notification / integration delivery" />
          <KpiTile label="Bulk operations" value={summaryData?.active_bulk_operation_count ?? 0} hint="Queued or running" />
        </div>

        <ModernCard title="Runtime action queue" subtitle="Submitted workflow actions, assigned reviewer, due time, priority, and execution signal.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Action</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Requester</th>
                  <th>Reviewer</th>
                  <th>Due</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {actionRows.map(row => (
                  <tr key={row.action_request_id}>
                    <td>{row.source_module} / {row.source_type}</td>
                    <td>{row.requested_action}</td>
                    <td><StatusPill tone={statusTone(row.request_status)}>{row.request_status}</StatusPill></td>
                    <td>{row.priority}</td>
                    <td>{row.requester_name ?? '—'}</td>
                    <td>{row.assigned_reviewer_name ?? '—'}</td>
                    <td>{row.due_at ?? '—'}</td>
                    <td><StatusPill tone={signalTone(row.queue_signal)}>{row.queue_signal}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard title="Notification and integration outbox" subtitle="Delivery reliability for assignment, SLA, escalation, decision, and closure events.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Type</th>
                  <th>Module</th>
                  <th>Target</th>
                  <th>Status</th>
                  <th>Retries</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {outboxRows.map(row => (
                  <tr key={row.outbox_id}>
                    <td>{row.event_code}</td>
                    <td>{row.event_type}</td>
                    <td>{row.source_module}</td>
                    <td>{row.target_system}</td>
                    <td><StatusPill tone={statusTone(row.delivery_status)}>{row.delivery_status}</StatusPill></td>
                    <td>{row.retry_count}</td>
                    <td><StatusPill tone={signalTone(row.queue_signal)}>{row.queue_signal}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard title="Runtime exceptions" subtitle="SLA breaches, invalid transitions, missing assignees/evidence, failed notifications, and integration failures.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Exception</th>
                  <th>Module</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Due</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {exceptionRows.map(row => (
                  <tr key={row.exception_code}>
                    <td>{row.exception_code}</td>
                    <td>{row.source_module}</td>
                    <td>{row.exception_type}</td>
                    <td>{row.severity}</td>
                    <td><StatusPill tone={statusTone(row.exception_status)}>{row.exception_status}</StatusPill></td>
                    <td>{row.owner_name ?? '—'}</td>
                    <td>{row.due_date ?? '—'}</td>
                    <td><StatusPill tone={signalTone(row.queue_signal)}>{row.queue_signal}</StatusPill></td>
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
