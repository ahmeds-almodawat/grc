import { useState } from 'react';
import { DataState } from '../components/DataState';
import { EntityTable } from '../components/EntityTable';
import { ModuleHeader } from '../components/ModuleHeader';
import { StatusBadge } from '../components/StatusBadge';
import { decideApproval } from '../lib/grcApi';
import { formatDate, humanize } from '../lib/format';
import { getApprovals } from '../lib/grcApi';
import { useAsyncData } from '../hooks/useAsyncData';
import type { ApprovalRow } from '../types/domain';

export function Approvals() {
  const approvals = useAsyncData(getApprovals, []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

      <div className="panel">
        <div className="panel-header"><h4>Approval queue</h4></div>
        <DataState loading={approvals.loading} error={approvals.error} empty={!approvals.data?.length}>
          <EntityTable<ApprovalRow>
            rows={approvals.data || []}
            getRowKey={row => row.id}
            columns={[
              { key: 'type', header: 'Type', render: row => humanize(row.item_type) },
              { key: 'item', header: 'Item', render: row => <strong>{row.item_title}</strong> },
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
      </div>
    </section>
  );
}
