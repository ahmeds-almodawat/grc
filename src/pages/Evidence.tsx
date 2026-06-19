import { useState } from 'react';
import { DataState } from '../components/DataState';
import { EntityTable } from '../components/EntityTable';
import { ModuleHeader } from '../components/ModuleHeader';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate, humanize } from '../lib/format';
import { getEvidenceQueue, reviewEvidence } from '../lib/grcApi';
import { useAsyncData } from '../hooks/useAsyncData';
import type { EvidenceRow } from '../types/domain';

export function Evidence() {
  const evidence = useAsyncData(getEvidenceQueue, []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleReview(row: EvidenceRow, status: 'accepted' | 'rejected' | 'needs_revision') {
    const defaultNote = status === 'accepted' ? '' : 'Needs correction or additional evidence.';
    const note = status === 'accepted' ? undefined : window.prompt('Evidence review note', defaultNote);
    if (note === null) return;
    setError(null);
    setBusyId(row.id);
    try {
      await reviewEvidence(row.id, status, note || defaultNote || undefined);
      void evidence.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to review evidence.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="page-section">
      <ModuleHeader
        eyebrow="Evidence center"
        title="Submitted evidence, review status and closure proof"
        subtitle="No evidence means the work should not be considered fully closed. Review results are recorded in the audit trail."
      />

      {error ? <div className="panel error-panel">{error}</div> : null}

      <div className="panel two-column">
        <div>
          <h4>Evidence rule</h4>
          <p className="muted">Major project, compliance, audit and governance items should close only after required evidence is accepted.</p>
        </div>
        <div className="mini-card"><span>Storage bucket</span><strong>grc-evidence</strong></div>
      </div>

      <div className="panel">
        <div className="panel-header"><h4>Evidence review queue</h4></div>
        <DataState loading={evidence.loading} error={evidence.error} empty={!evidence.data?.length}>
          <EntityTable<EvidenceRow>
            rows={evidence.data || []}
            getRowKey={row => row.id}
            columns={[
              { key: 'type', header: 'Type', render: row => humanize(row.item_type) },
              { key: 'item', header: 'Related Item', render: row => <strong>{row.item_title}</strong> },
              { key: 'file', header: 'File', render: row => row.file_name },
              { key: 'uploaded', header: 'Uploaded By', render: row => row.uploaded_by_name || '—' },
              { key: 'date', header: 'Date', render: row => formatDate(row.created_at) },
              { key: 'status', header: 'Status', render: row => <StatusBadge status={humanize(row.status)} /> },
              {
                key: 'review',
                header: 'Review',
                render: row => row.status === 'submitted' || row.status === 'needs_revision' ? (
                  <div className="inline-actions">
                    <button className="ghost-button compact-button" disabled={busyId === row.id} onClick={() => void handleReview(row, 'accepted')}>Accept</button>
                    <button className="ghost-button compact-button" disabled={busyId === row.id} onClick={() => void handleReview(row, 'needs_revision')}>Revise</button>
                    <button className="ghost-button compact-button" disabled={busyId === row.id} onClick={() => void handleReview(row, 'rejected')}>Reject</button>
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
