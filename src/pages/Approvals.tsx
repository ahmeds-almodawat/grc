import { useMemo, useState } from 'react';
import { DataState } from '../components/DataState';
import { EntityTable } from '../components/EntityTable';
import { ModuleHeader } from '../components/ModuleHeader';
import { StatusBadge } from '../components/StatusBadge';
import { decideApproval } from '../lib/grcApi';
import { formatDate, humanize } from '../lib/format';
import { getApprovals } from '../lib/grcApi';
import { useAsyncData } from '../hooks/useAsyncData';
import type { ApprovalRow } from '../types/domain';

type ApprovalFilter = 'all' | 'pending' | 'approved' | 'rejected';

export function Approvals() {
  const approvals = useAsyncData(getApprovals, []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ApprovalFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRow | null>(null);
  const rows = approvals.data || [];
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter(row => {
      const matchesFilter = activeFilter === 'all' || row.status === activeFilter;
      const matchesQuery = !query || [
        row.item_type,
        row.item_title,
        row.requested_by_name,
        row.approver_name,
        row.status
      ].some(value => value?.toLowerCase().includes(query));
      return matchesFilter && matchesQuery;
    });
  }, [activeFilter, rows, search]);
  const resetApprovalFilters = () => {
    setActiveFilter('all');
    setSearch('');
    setSelectedApproval(null);
  };

  async function handleDecision(row: ApprovalRow, status: 'approved' | 'rejected') {
    const defaultNote = status === 'approved' ? 'Approved from approval center.' : 'Rejected from approval center.';
    const note = status === 'rejected' ? window.prompt('Rejection reason', defaultNote) : window.prompt('Approval note', defaultNote);
    if (note === null) return;
    setError(null);
    setBusyId(row.id);
    try {
      await decideApproval(row.id, status, note || defaultNote);
      void approvals.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update approval.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="page-section">
      <ModuleHeader
        eyebrow="Approval center"
        title="Pending approvals for closure, evidence, projects and governance actions"
        subtitle="Controlled work should not close by itself. Approval decisions are recorded and auditable."
      />

      {error ? <div className="panel error-panel">{error}</div> : null}

      {rows.length ? (
        <div className="stats-grid">
          {([
            ['all', 'All approvals', rows.length, 'normal'],
            ['pending', 'Pending decisions', rows.filter(row => row.status === 'pending').length, 'warning'],
            ['approved', 'Approved', rows.filter(row => row.status === 'approved').length, 'success'],
            ['rejected', 'Rejected', rows.filter(row => row.status === 'rejected').length, 'danger']
          ] as const).map(card => (
            <button key={card[0]} type="button" className={`stat-card ${card[3]} ${activeFilter === card[0] ? 'active' : ''}`} onClick={() => setActiveFilter(card[0])}>
              <div className="stat-value">{card[2]}</div>
              <div className="stat-label">{card[1]}</div>
            </button>
          ))}
        </div>
      ) : null}

      <div className="panel">
        <div className="split-header">
          <div className="panel-header">
            <h4>Approval queue</h4>
            <p>Showing {filteredRows.length} of {rows.length} approvals. Card filters do not approve or reject work.</p>
          </div>
          <div className="toolbar">
            <span className="status-badge status-info">Active filter: {humanize(activeFilter)}</span>
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search item, requester, approver, status" />
            <button className="ghost-button" type="button" onClick={resetApprovalFilters}>Reset filters</button>
          </div>
        </div>
        <DataState loading={approvals.loading} error={approvals.error} empty={!filteredRows.length} emptyTitle="No approvals match the selected filter" emptyMessage="Reset filters or broaden the search to review the approval queue.">
          <EntityTable<ApprovalRow>
            rows={filteredRows}
            getRowKey={row => row.id}
            columns={[
              { key: 'type', header: 'Type', render: row => humanize(row.item_type) },
              { key: 'item', header: 'Item', render: row => <button className="link-button" type="button" onClick={() => setSelectedApproval(row)}><strong>{row.item_title}</strong></button> },
              { key: 'requested', header: 'Requested By', render: row => row.requested_by_name || '—' },
              { key: 'approver', header: 'Approver', render: row => row.approver_name || '—' },
              { key: 'date', header: 'Requested', render: row => formatDate(row.requested_at) },
              { key: 'status', header: 'Status', render: row => <StatusBadge status={humanize(row.status)} /> },
              {
                key: 'actions',
                header: 'Decision',
                render: row => row.status === 'pending' ? (
                  <div className="inline-actions">
                    <button className="ghost-button compact-button" disabled={busyId === row.id} onClick={() => void handleDecision(row, 'approved')}>Approve</button>
                    <button className="ghost-button compact-button" disabled={busyId === row.id} onClick={() => void handleDecision(row, 'rejected')}>Reject</button>
                  </div>
                ) : '—'
              }
            ]}
          />
        </DataState>
        {selectedApproval ? (
          <div className="detail-panel">
            <div className="split-header">
              <div>
                <h4>Selected approval detail</h4>
                <p>{selectedApproval.item_title}</p>
              </div>
              <button className="ghost-button small" type="button" onClick={() => setSelectedApproval(null)}>Clear selection</button>
            </div>
            <div className="detail-grid">
              <div><span>Type</span><strong>{humanize(selectedApproval.item_type)}</strong></div>
              <div><span>Status</span><strong>{humanize(selectedApproval.status)}</strong></div>
              <div><span>Requested by</span><strong>{selectedApproval.requested_by_name || '—'}</strong></div>
              <div><span>Approver</span><strong>{selectedApproval.approver_name || '—'}</strong></div>
              <div><span>Requested</span><strong>{formatDate(selectedApproval.requested_at)}</strong></div>
              <div><span>Decision path</span><strong>{selectedApproval.status === 'pending' ? 'Decision must be made through the approval action buttons.' : 'Decision is already recorded.'}</strong></div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
