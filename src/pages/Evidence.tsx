import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';
import { EntityTable } from '../components/EntityTable';
import { Modal } from '../components/Modal';
import { ModuleHeader } from '../components/ModuleHeader';
import { ScenarioFillButton } from '../components/ScenarioFillButton';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate, humanize } from '../lib/format';
import { getEvidenceQueue, reviewEvidence } from '../lib/grcApi';
import { useAsyncData } from '../hooks/useAsyncData';
import type { EvidenceRow } from '../types/domain';
import { GrcTraceabilityMap } from '../components/v180/GrcTraceabilityMap';
import {
  createScenarioLabScenario,
  V99_SCENARIO_TAG,
} from '../lib/scenarioLab';
import { FrameworkCrosswalkBackbonePanel } from '../components/v210/FrameworkCrosswalkBackbonePanel';

import { AuditorEvidencePackPanel } from '../components/v240/AuditorEvidencePackPanel';
export function Evidence() {
  const auth = useAuth();
  const evidence = useAsyncData(getEvidenceQueue, []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testFillOpen, setTestFillOpen] = useState(false);
  const [testFillBusy, setTestFillBusy] = useState(false);
  const [testFillMessage, setTestFillMessage] = useState<string | null>(null);
  const canReviewEvidence = auth.roles.some(
    role => ['super_admin', 'governance_admin', 'compliance_officer', 'department_manager'].includes(role.role)
  );

  async function createSyntheticEvidence() {
    setTestFillBusy(true);
    setTestFillMessage(null);
    try {
      const result = await createScenarioLabScenario('evidence');
      setTestFillMessage(`Synthetic evidence metadata created: ${result.id}`);
      await evidence.refresh();
    } catch (err) {
      setTestFillMessage(err instanceof Error ? err.message : 'Failed to create synthetic evidence.');
    } finally {
      setTestFillBusy(false);
    }
  }

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
        action={(
          <ScenarioFillButton
            label="Test-fill Evidence"
            onClick={() => setTestFillOpen(true)}
          />
        )}
      />

      <GrcTraceabilityMap context="evidence" />
      <FrameworkCrosswalkBackbonePanel context="evidence" />


      {error ? <div className="panel error-panel">{error}</div> : null}
      {testFillMessage ? <div className="notice-banner">{testFillMessage}</div> : null}

      <div className="panel two-column">
        <div>
          <h4>Evidence rule</h4>
          <p className="muted">Major project, compliance, audit and governance items should close only after required evidence is accepted.</p>
        </div>
        <div className="mini-card"><span>Storage bucket</span><strong>grc-evidence</strong></div>
      </div>

      <div className="panel">
        <div className="panel-header"><h4>Evidence review queue</h4></div>
        <DataState
          loading={evidence.loading}
          error={evidence.error}
          empty={!evidence.data?.length}
          emptyTitle="No evidence items in your scope"
          emptyMessage={
            canReviewEvidence
              ? 'Evidence will appear after controlled work submits files for review. Authorized administrators may use Scenario Lab for synthetic UAT metadata.'
              : 'No evidence records are currently assigned or visible to this read-only account.'
          }
        >
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
                render: row => canReviewEvidence && (row.status === 'submitted' || row.status === 'needs_revision') ? (
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

      <Modal
        open={testFillOpen}
        title="Synthetic evidence test fill"
        onClose={() => setTestFillOpen(false)}
      >
        <div className="form-grid">
          <div className="notice-banner full-width">
            This creates metadata-only synthetic evidence and a linked synthetic project.
            It does not upload confidential content.
          </div>
          <label className="field full-width">
            <span>File name</span>
            <input readOnly value={`${V99_SCENARIO_TAG}-synthetic-evidence.txt`} />
          </label>
          <label className="field full-width">
            <span>Description</span>
            <textarea
              readOnly
              value={`[${V99_SCENARIO_TAG}] Synthetic evidence metadata. No confidential content.`}
            />
          </label>
          <div className="form-actions full-width">
            <button className="ghost-button" type="button" onClick={() => setTestFillOpen(false)}>
              Cancel
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={testFillBusy}
              onClick={() => void createSyntheticEvidence()}
            >
              {testFillBusy ? 'Creating…' : 'Create synthetic record'}
            </button>
          </div>
        </div>
      </Modal>
    
      {/* v24.0 evidence integrity and auditor pack */}
      <AuditorEvidencePackPanel />

</section>
  );
}
