import { useMemo, useState } from 'react';
import { DataState } from '../components/DataState';
import { EntityTable } from '../components/EntityTable';
import { ModuleHeader } from '../components/ModuleHeader';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { acknowledgeEscalation, getDelayReasonQueue, getEscalations, getManagementControlSummary, refreshEscalations, resolveEscalation } from '../lib/grcApi';
import { formatDate, humanize } from '../lib/format';
import { useAsyncData } from '../hooks/useAsyncData';
import type { DelayReasonQueueRow, EscalationRow } from '../types/domain';

export function Escalations() {
  const summary = useAsyncData(getManagementControlSummary, []);
  const escalations = useAsyncData(getEscalations, []);
  const delayQueue = useAsyncData(getDelayReasonQueue, []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'executive' | 'critical' | 'open'>('all');
  const [error, setError] = useState<string | null>(null);

  const filteredEscalations = useMemo(() => {
    const rows = escalations.data || [];
    if (filter === 'executive') return rows.filter(row => row.escalation_level === 'executive');
    if (filter === 'critical') return rows.filter(row => row.risk_level === 'critical');
    if (filter === 'open') return rows.filter(row => row.status === 'open');
    return rows;
  }, [escalations.data, filter]);

  async function handleRefreshEscalations() {
    setError(null);
    setRefreshing(true);
    try {
      await refreshEscalations();
      await Promise.all([escalations.refresh(), delayQueue.refresh(), summary.refresh()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh escalation events.');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleAcknowledge(row: EscalationRow) {
    setError(null);
    setBusyId(row.id);
    try {
      await acknowledgeEscalation(row.id, 'Acknowledged from Escalation Center.');
      await Promise.all([escalations.refresh(), summary.refresh()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to acknowledge escalation.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleResolve(row: EscalationRow) {
    const note = window.prompt('Resolution note', 'Resolved and verified by owner/manager.');
    if (note === null) return;
    setError(null);
    setBusyId(row.id);
    try {
      await resolveEscalation(row.id, note || 'Resolved from Escalation Center.');
      await Promise.all([escalations.refresh(), summary.refresh()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve escalation.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="page-section">
      <ModuleHeader
        eyebrow="Management control layer"
        title="Escalations, missing delay reasons and overdue governance follow-up"
        subtitle="This page is for management control, not normal task tracking. It shows what must be acknowledged, explained, escalated or resolved."
        action={
          <button className="primary-button" disabled={refreshing} onClick={() => void handleRefreshEscalations()}>
            {refreshing ? 'Refreshing…' : 'Refresh Escalations'}
          </button>
        }
      />

      {error ? <div className="panel error-panel">{error}</div> : null}

      <DataState loading={summary.loading} error={summary.error} empty={!summary.data}>
        {summary.data ? (
          <div className="stats-grid">
            <StatCard label="Open escalations" value={summary.data.open_escalations} tone="warning" />
            <StatCard label="Acknowledged escalations" value={summary.data.acknowledged_escalations} />
            <StatCard label="Executive escalations" value={summary.data.executive_escalations} tone="danger" />
            <StatCard label="Critical escalations" value={summary.data.critical_escalations} tone="danger" />
            <StatCard label="Missing delay reasons" value={summary.data.missing_delay_reasons} tone="warning" />
          </div>
        ) : null}
      </DataState>

      <div className="panel two-column align-start">
        <div>
          <h4>Escalation rules</h4>
          <ul className="rule-list">
            <li>Due within 3 days becomes a reminder.</li>
            <li>Overdue items escalate to manager level.</li>
            <li>Critical or 7+ day overdue items escalate to executive level.</li>
            <li>Resolved escalations remain in audit logs and stop showing in the active queue.</li>
          </ul>
        </div>
        <div className="notice-banner">
          Before using this page in production, run migration <strong>007_escalation_and_governance_controls.sql</strong>. Later this refresh can be scheduled automatically using pg_cron or an Edge Function.
        </div>
      </div>

      <div className="panel">
        <div className="split-header">
          <div className="panel-header">
            <h4>Active escalation queue</h4>
            <p>Open and acknowledged items needing management follow-up.</p>
          </div>
          <div className="toolbar">
            <select value={filter} onChange={event => setFilter(event.target.value as typeof filter)}>
              <option value="all">All escalations</option>
              <option value="open">Open only</option>
              <option value="executive">Executive only</option>
              <option value="critical">Critical risk only</option>
            </select>
          </div>
        </div>
        <DataState loading={escalations.loading} error={escalations.error} empty={!filteredEscalations.length}>
          <EntityTable<EscalationRow>
            rows={filteredEscalations}
            getRowKey={row => row.id}
            columns={[
              { key: 'level', header: 'Level', render: row => <StatusBadge status={humanize(row.escalation_level)} /> },
              { key: 'type', header: 'Type', render: row => humanize(row.item_type) },
              { key: 'title', header: 'Item', render: row => <strong>{row.title}</strong> },
              { key: 'owner', header: 'Owner', render: row => row.owner_name || 'Unassigned' },
              { key: 'department', header: 'Department', render: row => row.department_name || 'Company-wide' },
              { key: 'due', header: 'Due', render: row => formatDate(row.due_date) },
              { key: 'risk', header: 'Risk', render: row => <span className={`risk-pill ${row.risk_level}`}>{humanize(row.risk_level)}</span> },
              { key: 'status', header: 'Status', render: row => <StatusBadge status={humanize(row.status)} /> },
              { key: 'reason', header: 'Reason', render: row => row.reason },
              {
                key: 'actions',
                header: 'Action',
                render: row => (
                  <div className="inline-actions">
                    {row.status === 'open' ? <button className="ghost-button compact-button" disabled={busyId === row.id} onClick={() => void handleAcknowledge(row)}>Acknowledge</button> : null}
                    <button className="ghost-button compact-button" disabled={busyId === row.id} onClick={() => void handleResolve(row)}>Resolve</button>
                  </div>
                )
              }
            ]}
          />
        </DataState>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h4>Missing delay reason queue</h4>
          <p>Overdue controlled work must explain why it is late before it can be marked delayed.</p>
        </div>
        <DataState loading={delayQueue.loading} error={delayQueue.error} empty={!delayQueue.data?.length}>
          <EntityTable<DelayReasonQueueRow>
            rows={delayQueue.data || []}
            getRowKey={row => `${row.item_type}-${row.item_id}`}
            columns={[
              { key: 'type', header: 'Type', render: row => humanize(row.item_type) },
              { key: 'title', header: 'Item', render: row => <strong>{row.title}</strong> },
              { key: 'owner', header: 'Owner', render: row => row.owner_name || 'Unassigned' },
              { key: 'department', header: 'Department', render: row => row.department_name || 'Company-wide' },
              { key: 'due', header: 'Due', render: row => formatDate(row.due_date) },
              { key: 'risk', header: 'Risk', render: row => <span className={`risk-pill ${row.risk_level}`}>{humanize(row.risk_level)}</span> },
              { key: 'status', header: 'Current Status', render: row => <StatusBadge status={humanize(row.status)} /> },
              { key: 'reason', header: 'Control Gap', render: row => <span className="danger-text">{row.missing_reason}</span> }
            ]}
          />
        </DataState>
      </div>
    </section>
  );
}
