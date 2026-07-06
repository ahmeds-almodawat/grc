import { useMemo, useState } from 'react';
import { DataState } from '../components/DataState';
import { EntityTable } from '../components/EntityTable';
import { ModuleHeader } from '../components/ModuleHeader';
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
  const [filter, setFilter] = useState<'all' | 'executive' | 'critical' | 'open' | 'acknowledged' | 'missingDelay'>('all');
  const [search, setSearch] = useState('');
  const [selectedEscalation, setSelectedEscalation] = useState<EscalationRow | null>(null);
  const [selectedDelayReason, setSelectedDelayReason] = useState<DelayReasonQueueRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredEscalations = useMemo(() => {
    const rows = escalations.data || [];
    const query = search.trim().toLowerCase();
    return rows.filter(row => {
      const matchesFilter =
        filter === 'all'
        || (filter === 'executive' && row.escalation_level === 'executive')
        || (filter === 'critical' && row.risk_level === 'critical')
        || (filter === 'open' && row.status === 'open')
        || (filter === 'acknowledged' && row.status === 'acknowledged')
        || filter === 'missingDelay';
      const matchesQuery = !query || [
        row.title,
        row.owner_name,
        row.department_name,
        row.item_type,
        row.reason,
        row.status,
        row.risk_level
      ].some(value => value?.toLowerCase().includes(query));
      return matchesFilter && matchesQuery;
    });
  }, [escalations.data, filter, search]);
  const filteredDelayQueue = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (delayQueue.data || []).filter(row => !query || [
      row.title,
      row.owner_name,
      row.department_name,
      row.item_type,
      row.missing_reason,
      row.risk_level
    ].some(value => value?.toLowerCase().includes(query)));
  }, [delayQueue.data, search]);
  const resetEscalationFilters = () => {
    setFilter('all');
    setSearch('');
    setSelectedEscalation(null);
    setSelectedDelayReason(null);
  };

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
            {[
              { key: 'open' as const, label: 'Open escalations', value: summary.data.open_escalations, tone: 'warning' as const },
              { key: 'acknowledged' as const, label: 'Acknowledged escalations', value: summary.data.acknowledged_escalations, tone: 'normal' as const },
              { key: 'executive' as const, label: 'Executive escalations', value: summary.data.executive_escalations, tone: 'danger' as const },
              { key: 'critical' as const, label: 'Critical escalations', value: summary.data.critical_escalations, tone: 'danger' as const },
              { key: 'missingDelay' as const, label: 'Missing delay reasons', value: summary.data.missing_delay_reasons, tone: 'warning' as const }
            ].map(card => (
              <button key={card.key} type="button" className={`stat-card ${card.tone} ${filter === card.key ? 'active' : ''}`} onClick={() => setFilter(card.key)}>
                <div className="stat-value">{card.value}</div>
                <div className="stat-label">{card.label}</div>
              </button>
            ))}
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
          Before live use, complete the approved database change package. Later this refresh can be scheduled automatically through the controlled operations process.
        </div>
      </div>

      <div className="panel">
        <div className="split-header">
          <div className="panel-header">
            <h4>Active escalation queue</h4>
            <p>Open and acknowledged items needing management follow-up.</p>
          </div>
          <div className="toolbar">
            <span className="status-badge status-info">Active filter: {humanize(filter)}</span>
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search item, owner, department, reason" />
            <select value={filter} onChange={event => setFilter(event.target.value as typeof filter)}>
              <option value="all">All escalations</option>
              <option value="open">Open only</option>
              <option value="acknowledged">Acknowledged only</option>
              <option value="executive">Executive only</option>
              <option value="critical">Critical risk only</option>
              <option value="missingDelay">Missing delay reasons</option>
            </select>
            <button className="ghost-button" type="button" onClick={resetEscalationFilters}>Reset filters</button>
          </div>
        </div>
        <DataState loading={escalations.loading} error={escalations.error} empty={!filteredEscalations.length} emptyTitle="No escalation records match the selected filter" emptyMessage="Reset filters or broaden the search to review active governance follow-up.">
          <EntityTable<EscalationRow>
            rows={filteredEscalations}
            getRowKey={row => row.id}
            columns={[
              { key: 'level', header: 'Level', render: row => <StatusBadge status={humanize(row.escalation_level)} /> },
              { key: 'type', header: 'Type', render: row => humanize(row.item_type) },
              { key: 'title', header: 'Item', render: row => <button className="link-button" type="button" onClick={() => setSelectedEscalation(row)}><strong>{row.title}</strong></button> },
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
        {selectedEscalation ? (
          <div className="detail-panel">
            <div className="split-header">
              <div>
                <h4>Selected escalation detail</h4>
                <p>{selectedEscalation.title}</p>
              </div>
              <button className="ghost-button small" type="button" onClick={() => setSelectedEscalation(null)}>Clear selection</button>
            </div>
            <div className="detail-grid">
              <div><span>Level</span><strong>{humanize(selectedEscalation.escalation_level)}</strong></div>
              <div><span>Risk</span><strong>{humanize(selectedEscalation.risk_level)}</strong></div>
              <div><span>Status</span><strong>{humanize(selectedEscalation.status)}</strong></div>
              <div><span>Owner</span><strong>{selectedEscalation.owner_name || 'Unassigned'}</strong></div>
              <div><span>Department</span><strong>{selectedEscalation.department_name || 'Company-wide'}</strong></div>
              <div><span>Due</span><strong>{formatDate(selectedEscalation.due_date)}</strong></div>
              <div><span>Reason</span><strong>{selectedEscalation.reason}</strong></div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h4>Missing delay reason queue</h4>
          <p>Overdue controlled work must explain why it is late before it can be marked delayed.</p>
        </div>
        <DataState loading={delayQueue.loading} error={delayQueue.error} empty={!filteredDelayQueue.length} emptyTitle="No missing delay reasons match the selected filter" emptyMessage="Delay reason gaps will appear here when overdue controlled work lacks an explanation.">
          <EntityTable<DelayReasonQueueRow>
            rows={filteredDelayQueue}
            getRowKey={row => `${row.item_type}-${row.item_id}`}
            columns={[
              { key: 'type', header: 'Type', render: row => humanize(row.item_type) },
              { key: 'title', header: 'Item', render: row => <button className="link-button" type="button" onClick={() => setSelectedDelayReason(row)}><strong>{row.title}</strong></button> },
              { key: 'owner', header: 'Owner', render: row => row.owner_name || 'Unassigned' },
              { key: 'department', header: 'Department', render: row => row.department_name || 'Company-wide' },
              { key: 'due', header: 'Due', render: row => formatDate(row.due_date) },
              { key: 'risk', header: 'Risk', render: row => <span className={`risk-pill ${row.risk_level}`}>{humanize(row.risk_level)}</span> },
              { key: 'status', header: 'Current Status', render: row => <StatusBadge status={humanize(row.status)} /> },
              { key: 'reason', header: 'Control Gap', render: row => <span className="danger-text">{row.missing_reason}</span> }
            ]}
          />
        </DataState>
        {selectedDelayReason ? (
          <div className="detail-panel">
            <div className="split-header">
              <div>
                <h4>Missing delay reason guidance</h4>
                <p>{selectedDelayReason.title}</p>
              </div>
              <button className="ghost-button small" type="button" onClick={() => setSelectedDelayReason(null)}>Clear selection</button>
            </div>
            <div className="detail-grid">
              <div><span>Owner</span><strong>{selectedDelayReason.owner_name || 'Unassigned'}</strong></div>
              <div><span>Department</span><strong>{selectedDelayReason.department_name || 'Company-wide'}</strong></div>
              <div><span>Due</span><strong>{formatDate(selectedDelayReason.due_date)}</strong></div>
              <div><span>Risk</span><strong>{humanize(selectedDelayReason.risk_level)}</strong></div>
              <div><span>Control gap</span><strong>{selectedDelayReason.missing_reason}</strong></div>
              <div><span>Required explanation</span><strong>Owner or manager must record the delay reason in the source workflow.</strong></div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
