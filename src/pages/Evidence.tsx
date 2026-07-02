import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  FileCheck2,
  FileSearch,
  Link2,
  Lock,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldAlert,
  ThumbsUp,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';
import { EntityTable } from '../components/EntityTable';
import { Modal } from '../components/Modal';
import { ModuleHeader } from '../components/ModuleHeader';
import { ScenarioFillButton } from '../components/ScenarioFillButton';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate, humanize } from '../lib/format';
import {
  acceptEvidence,
  approveEvidenceGateWaiver,
  generateEvidencePackIndex,
  getEvidenceChainOfCustody,
  getEvidenceClosureGateStatus,
  getEvidenceGapDashboard,
  getEvidencePackIndex,
  getEvidenceQueue,
  getEvidenceReviewQueue,
  getSensitiveEvidenceRegister,
  lockEvidence,
  rejectEvidence,
  rejectEvidenceGateWaiver,
  requestEvidenceGateWaiver,
  requestEvidenceRevision,
  reviewEvidence,
  submitEvidenceForReview,
  supersedeEvidence,
} from '../lib/grcApi';
import { useAsyncData } from '../hooks/useAsyncData';
import type {
  EvidenceChainOfCustodyRow,
  EvidenceClosureGateStatusRow,
  EvidenceGapDashboardRow,
  EvidencePackIndexRow,
  EvidenceReviewQueueRow,
  EvidenceRow,
  SensitiveEvidenceRegisterRow,
} from '../types/domain';
import { GrcTraceabilityMap } from '../components/v180/GrcTraceabilityMap';
import {
  createScenarioLabScenario,
  V99_SCENARIO_TAG,
} from '../lib/scenarioLab';
import { FrameworkCrosswalkBackbonePanel } from '../components/v210/FrameworkCrosswalkBackbonePanel';

import { AuditorEvidencePackPanel } from '../components/v240/AuditorEvidencePackPanel';

type EvidenceSelection = {
  evidence_file_id: string;
  evidence_code?: string | null;
  evidence_title?: string | null;
  file_name?: string | null;
  evidence_type?: string | null;
  sensitivity_level?: string | null;
  review_status?: string | null;
  reviewer_name?: string | null;
  owner_name?: string | null;
  expiry_date?: string | null;
  revision_required?: boolean | null;
  renewal_required?: boolean | null;
  locked_at?: string | null;
  created_at?: string | null;
};

function isPast(value: string | null | undefined) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

function evidenceTitle(row: EvidenceSelection) {
  return row.evidence_title || row.file_name || row.evidence_code || row.evidence_file_id;
}

function compactActionLabel(label: string, busy: boolean) {
  return busy ? 'Working' : label;
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: 'warning' | 'danger' | 'success';
}) {
  return (
    <div className={`stat-card ${tone || ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function DetailValue({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value || '-'}</strong>
    </div>
  );
}

function ChainOfCustodyTable({ rows }: { rows: EvidenceChainOfCustodyRow[] }) {
  return (
    <DataState
      loading={false}
      empty={!rows.length}
      emptyTitle="No chain of custody events"
      emptyMessage="Review, link, lock, waiver and pack events will appear here after governed evidence actions run."
    >
      <EntityTable<EvidenceChainOfCustodyRow>
        rows={rows}
        getRowKey={row => row.event_id || row.id || `${row.evidence_file_id}:${row.event_type}:${row.created_at}`}
        columns={[
          { key: 'event', header: 'Event', render: row => humanize(row.event_type) },
          { key: 'status', header: 'Status', render: row => `${humanize(row.from_status)} -> ${humanize(row.to_status)}` },
          { key: 'actor', header: 'Actor', render: row => row.actor_id || '-' },
          { key: 'note', header: 'Note', render: row => row.note || '-' },
          { key: 'date', header: 'Date', render: row => formatDate(row.created_at) },
        ]}
      />
    </DataState>
  );
}

export function Evidence() {
  const auth = useAuth();
  const legacyEvidence = useAsyncData(getEvidenceQueue, []);
  const reviewQueue = useAsyncData(getEvidenceReviewQueue, []);
  const gaps = useAsyncData(getEvidenceGapDashboard, []);
  const gates = useAsyncData(getEvidenceClosureGateStatus, []);
  const packIndex = useAsyncData(getEvidencePackIndex, []);
  const sensitiveRegister = useAsyncData(getSensitiveEvidenceRegister, []);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceSelection | null>(null);
  const chainOfCustody = useAsyncData(
    () => selectedEvidence ? getEvidenceChainOfCustody(selectedEvidence.evidence_file_id) : Promise.resolve([]),
    [selectedEvidence?.evidence_file_id]
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [testFillOpen, setTestFillOpen] = useState(false);
  const [testFillBusy, setTestFillBusy] = useState(false);
  const [testFillMessage, setTestFillMessage] = useState<string | null>(null);
  const canGovernEvidence = auth.roles.some(
    role => ['super_admin', 'governance_admin', 'compliance_officer', 'department_manager', 'auditor'].includes(role.role)
  );

  const metrics = useMemo(() => {
    const queueRows = reviewQueue.data || [];
    const gateRows = gates.data || [];
    const sensitiveRows = sensitiveRegister.data || [];
    return {
      queue: queueRows.length,
      closureBlocked: gateRows.filter(row => !row.can_close).length,
      acceptedCandidates: (packIndex.data || []).filter(row => row.review_status === 'accepted').length,
      sensitive: sensitiveRows.length,
    };
  }, [gates.data, packIndex.data, reviewQueue.data, sensitiveRegister.data]);

  const warnings = useMemo(() => {
    const queueRows = reviewQueue.data || [];
    const sensitiveRows = sensitiveRegister.data || [];
    const warningRows = [
      {
        id: 'overdue-review',
        show: queueRows.some(row => row.queue_reason === 'overdue_review' || isPast(row.review_due_date)),
        title: 'Evidence overdue for review',
        body: 'One or more files are waiting past their review date and should not be relied on for closure.',
      },
      {
        id: 'rejected-revision',
        show: queueRows.some(row => row.review_status === 'rejected' || row.revision_required),
        title: 'Evidence rejected or revision required',
        body: 'Rejected evidence must be revised or superseded before it can satisfy a governed gate.',
      },
      {
        id: 'expired-evidence',
        show: queueRows.some(row => isPast(row.expiry_date)) || sensitiveRows.some(row => isPast(row.expiry_date)),
        title: 'Evidence expired',
        body: 'Expired evidence does not satisfy closure, approval, treatment, or audit gates unless a valid waiver exists.',
      },
      {
        id: 'missing-closure',
        show: Boolean(gaps.data?.length),
        title: 'Evidence required for closure missing',
        body: 'Some workflow items have active evidence requirements that are not satisfied by accepted evidence.',
      },
      {
        id: 'sensitive-review',
        show: Boolean(sensitiveRows.length),
        title: 'Sensitive evidence requires controlled review',
        body: 'Sensitive or highly sensitive evidence needs ownership, reviewer separation, classification reason, and expiry tracking.',
      },
    ];
    return warningRows.filter(row => row.show);
  }, [gaps.data?.length, reviewQueue.data, sensitiveRegister.data]);

  const selectedLinks = useMemo(() => {
    if (!selectedEvidence) return [];
    return (packIndex.data || []).filter(row => row.evidence_file_id === selectedEvidence.evidence_file_id);
  }, [packIndex.data, selectedEvidence]);

  const selectedGates = useMemo(() => {
    if (!selectedLinks.length) return [];
    const linkKeys = new Set(selectedLinks.map(row => `${row.linked_item_type}:${row.linked_item_id}`));
    return (gates.data || []).filter(row => linkKeys.has(`${row.linked_item_type}:${row.linked_item_id}`));
  }, [gates.data, selectedLinks]);

  async function refreshGovernanceData() {
    await Promise.all([
      legacyEvidence.refresh(),
      reviewQueue.refresh(),
      gaps.refresh(),
      gates.refresh(),
      packIndex.refresh(),
      sensitiveRegister.refresh(),
      chainOfCustody.refresh(),
    ]);
  }

  async function createSyntheticEvidence() {
    setTestFillBusy(true);
    setTestFillMessage(null);
    try {
      const result = await createScenarioLabScenario('evidence');
      setTestFillMessage(`Synthetic evidence metadata created: ${result.id}`);
      await refreshGovernanceData();
    } catch (err) {
      setTestFillMessage(err instanceof Error ? err.message : 'Failed to create synthetic evidence.');
    } finally {
      setTestFillBusy(false);
    }
  }

  async function handleLegacyReview(row: EvidenceRow, status: 'accepted' | 'rejected' | 'needs_revision') {
    const defaultNote = status === 'accepted' ? '' : 'Needs correction or additional evidence.';
    const note = status === 'accepted' ? undefined : window.prompt('Evidence review note', defaultNote);
    if (note === null) return;
    setError(null);
    setMessage(null);
    setBusyId(row.id);
    try {
      await reviewEvidence(row.id, status, note || defaultNote || undefined);
      setMessage(`Evidence ${humanize(status)}.`);
      await refreshGovernanceData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to review evidence.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleEvidenceAction(row: EvidenceSelection, action: 'submit' | 'accept' | 'reject' | 'revision' | 'supersede' | 'lock') {
    const evidenceId = row.evidence_file_id;
    setError(null);
    setMessage(null);
    setBusyId(`${action}:${evidenceId}`);
    try {
      if (action === 'submit') {
        await submitEvidenceForReview({ evidence_file_id: evidenceId, note: 'Submitted from Evidence Governance Center.' });
      } else if (action === 'accept') {
        await acceptEvidence({ evidence_file_id: evidenceId, note: 'Accepted from Evidence Governance Center.' });
      } else if (action === 'reject') {
        const reason = window.prompt('Rejection reason', 'Evidence does not satisfy the requirement.');
        if (reason === null) return;
        await rejectEvidence({ evidence_file_id: evidenceId, reason, note: reason });
      } else if (action === 'revision') {
        const reason = window.prompt('Revision reason', 'Attach a corrected or more complete evidence version.');
        if (reason === null) return;
        await requestEvidenceRevision({ evidence_file_id: evidenceId, reason, note: reason });
      } else if (action === 'supersede') {
        const newEvidenceId = window.prompt('Replacement evidence file id');
        if (!newEvidenceId) return;
        await supersedeEvidence({
          evidence_file_id: evidenceId,
          superseded_by_evidence_id: newEvidenceId,
          note: 'Superseded from Evidence Governance Center.',
        });
      } else if (action === 'lock') {
        const note = window.prompt('Lock note', 'Locked for audit-ready evidence pack.');
        if (note === null) return;
        await lockEvidence({ evidence_file_id: evidenceId, note });
      }
      setMessage(`${humanize(action)} action completed for ${evidenceTitle(row)}.`);
      await refreshGovernanceData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Evidence action failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleWaiverAction(row: EvidenceClosureGateStatusRow | EvidenceGapDashboardRow, action: 'request' | 'approve' | 'reject') {
    setError(null);
    setMessage(null);
    setBusyId(`${action}:${row.requirement_id}`);
    try {
      if (action === 'request') {
        const reason = window.prompt('Waiver reason', 'Temporary waiver requested with compensating control.');
        if (!reason) return;
        await requestEvidenceGateWaiver({
          requirement_id: row.requirement_id,
          linked_item_type: row.linked_item_type,
          linked_item_id: row.linked_item_id,
          waiver_reason: reason,
          audit_note: reason,
        });
      } else {
        const waiverId = window.prompt('Waiver id');
        if (!waiverId) return;
        const auditNote = window.prompt('Audit note', action === 'approve' ? 'Waiver approved with documented rationale.' : 'Waiver rejected; evidence remains required.');
        if (auditNote === null) return;
        if (action === 'approve') {
          await approveEvidenceGateWaiver({ waiver_id: waiverId, audit_note: auditNote });
        } else {
          await rejectEvidenceGateWaiver({ waiver_id: waiverId, audit_note: auditNote });
        }
      }
      setMessage(`Evidence waiver ${action} action completed.`);
      await refreshGovernanceData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Evidence waiver action failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleGeneratePackIndex() {
    setError(null);
    setMessage(null);
    setBusyId('generate-pack');
    try {
      await generateEvidencePackIndex();
      setMessage('Evidence pack index generated.');
      await refreshGovernanceData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate evidence pack index.');
    } finally {
      setBusyId(null);
    }
  }

  const actionDisabled = !canGovernEvidence || Boolean(busyId);

  return (
    <section className="page-section">
      <ModuleHeader
        eyebrow="Patch 23 Evidence governance"
        title="Evidence Governance Center"
        subtitle="Controlled proof for Risk, OVR, audit findings, compliance, projects, tasks, approvals, CAPA and action plans."
        action={(
          <div className="inline-actions">
            <button
              className="ghost-button"
              type="button"
              disabled={busyId === 'generate-pack'}
              onClick={() => void handleGeneratePackIndex()}
            >
              <PackageCheck size={16} /> {compactActionLabel('Generate pack index', busyId === 'generate-pack')}
            </button>
            <ScenarioFillButton
              label="Test-fill Evidence"
              onClick={() => setTestFillOpen(true)}
            />
          </div>
        )}
      />

      <GrcTraceabilityMap context="evidence" />
      <FrameworkCrosswalkBackbonePanel context="evidence" />

      {error ? <div className="panel error-panel">{error}</div> : null}
      {message ? <div className="notice-banner">{message}</div> : null}
      {testFillMessage ? <div className="notice-banner">{testFillMessage}</div> : null}

      <div className="operations-kpi-grid">
        <MetricCard label="Review queue" value={metrics.queue} tone={metrics.queue ? 'warning' : 'success'} />
        <MetricCard label="Closure gates blocked" value={metrics.closureBlocked} tone={metrics.closureBlocked ? 'danger' : 'success'} />
        <MetricCard label="Accepted pack candidates" value={metrics.acceptedCandidates} tone={metrics.acceptedCandidates ? 'success' : undefined} />
        <MetricCard label="Sensitive register" value={metrics.sensitive} tone={metrics.sensitive ? 'warning' : undefined} />
      </div>

      {warnings.length ? (
        <div className="warning-stack">
          {warnings.map(warning => (
            <div className="warning-card" key={warning.id}>
              <strong><AlertTriangle size={16} /> {warning.title}</strong>
              <p>{warning.body}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="notice-banner">
          No governed evidence warnings are currently visible in your RLS scope.
        </div>
      )}

      <div className="panel two-column">
        <div>
          <h4>Evidence rule</h4>
          <p className="muted">Closure, approval, acceptance, treatment and audit readiness should use accepted, current, non-expired evidence or an approved waiver.</p>
        </div>
        <div className="mini-card"><span>Storage bucket</span><strong>grc-evidence</strong></div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h4><FileCheck2 size={18} /> Evidence review queue</h4>
        </div>
        <DataState
          loading={reviewQueue.loading}
          error={reviewQueue.error}
          empty={!reviewQueue.data?.length}
          emptyTitle="No governed evidence in review"
          emptyMessage="Files waiting for review, overdue review, revision, expiry or renewal will appear here after Patch 23 migration is applied."
        >
          <EntityTable<EvidenceReviewQueueRow>
            rows={reviewQueue.data || []}
            getRowKey={row => row.evidence_file_id}
            columns={[
              { key: 'title', header: 'Evidence', render: row => <button className="link-button" type="button" onClick={() => setSelectedEvidence(row)}>{evidenceTitle(row)}</button> },
              { key: 'type', header: 'Type', render: row => humanize(row.evidence_type) },
              { key: 'sensitivity', header: 'Sensitivity', render: row => <StatusBadge status={humanize(row.sensitivity_level)} /> },
              { key: 'status', header: 'Review', render: row => <StatusBadge status={humanize(row.review_status)} /> },
              { key: 'due', header: 'Review due', render: row => formatDate(row.review_due_date) },
              { key: 'expiry', header: 'Expiry', render: row => formatDate(row.expiry_date) },
              { key: 'reason', header: 'Queue reason', render: row => humanize(row.queue_reason) },
              {
                key: 'actions',
                header: 'Actions',
                render: row => canGovernEvidence ? (
                  <div className="inline-actions">
                    <button className="ghost-button compact-button" disabled={actionDisabled} title="Submit for review" onClick={() => void handleEvidenceAction(row, 'submit')}><Send size={14} /></button>
                    <button className="ghost-button compact-button" disabled={actionDisabled} title="Accept evidence" onClick={() => void handleEvidenceAction(row, 'accept')}><ThumbsUp size={14} /></button>
                    <button className="ghost-button compact-button" disabled={actionDisabled} title="Request revision" onClick={() => void handleEvidenceAction(row, 'revision')}><RotateCcw size={14} /></button>
                    <button className="ghost-button compact-button" disabled={actionDisabled} title="Reject evidence" onClick={() => void handleEvidenceAction(row, 'reject')}><XCircle size={14} /></button>
                    <button className="ghost-button compact-button" disabled={actionDisabled || Boolean(row.locked_at)} title="Lock evidence" onClick={() => void handleEvidenceAction(row, 'lock')}><Lock size={14} /></button>
                  </div>
                ) : '-'
              },
            ]}
          />
        </DataState>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h4><ShieldAlert size={18} /> Evidence gap dashboard</h4>
        </div>
        <DataState
          loading={gaps.loading}
          error={gaps.error}
          empty={!gaps.data?.length}
          emptyTitle="No evidence gaps"
          emptyMessage="All visible active evidence requirements are satisfied or waived."
        >
          <EntityTable<EvidenceGapDashboardRow>
            rows={gaps.data || []}
            getRowKey={row => row.requirement_id}
            columns={[
              { key: 'item', header: 'Item', render: row => `${humanize(row.linked_item_type)} ${row.linked_item_id.slice(0, 8)}` },
              { key: 'requirement', header: 'Requirement', render: row => <strong>{row.requirement_title}</strong> },
              { key: 'gate', header: 'Gate', render: row => humanize(row.required_for_gate) },
              { key: 'count', header: 'Accepted', render: row => `${row.accepted_evidence_count} / ${row.minimum_accepted_files}` },
              { key: 'status', header: 'Gate status', render: row => <StatusBadge status={humanize(row.gate_status)} /> },
              { key: 'gap', header: 'Gap', render: row => humanize(row.gap_reason) },
              {
                key: 'waiver',
                header: 'Waiver',
                render: row => canGovernEvidence ? (
                  <button className="ghost-button compact-button" disabled={actionDisabled} onClick={() => void handleWaiverAction(row, 'request')}>
                    <Link2 size={14} /> Request
                  </button>
                ) : '-',
              },
            ]}
          />
        </DataState>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h4><FileSearch size={18} /> Evidence closure gate status</h4>
        </div>
        <DataState
          loading={gates.loading}
          error={gates.error}
          empty={!gates.data?.length}
          emptyTitle="No active evidence gates"
          emptyMessage="Closure, approval, acceptance, treatment and audit gates appear once requirements are created."
        >
          <EntityTable<EvidenceClosureGateStatusRow>
            rows={gates.data || []}
            getRowKey={row => row.requirement_id}
            columns={[
              { key: 'item', header: 'Item', render: row => humanize(row.linked_item_type) },
              { key: 'requirement', header: 'Requirement', render: row => row.requirement_title },
              { key: 'gate', header: 'Gate', render: row => humanize(row.required_for_gate) },
              { key: 'accepted', header: 'Accepted', render: row => `${row.accepted_evidence_count} / ${row.minimum_accepted_files}` },
              { key: 'waiver', header: 'Waiver', render: row => row.waiver_active ? <StatusBadge status="Waived" /> : '-' },
              { key: 'close', header: 'Allowed', render: row => <StatusBadge status={row.can_close ? 'Can close' : 'Blocked'} /> },
              {
                key: 'actions',
                header: 'Actions',
                render: row => canGovernEvidence ? (
                  <div className="inline-actions">
                    <button className="ghost-button compact-button" disabled={actionDisabled} title="Approve waiver by id" onClick={() => void handleWaiverAction(row, 'approve')}><ThumbsUp size={14} /></button>
                    <button className="ghost-button compact-button" disabled={actionDisabled} title="Reject waiver by id" onClick={() => void handleWaiverAction(row, 'reject')}><XCircle size={14} /></button>
                  </div>
                ) : '-',
              },
            ]}
          />
        </DataState>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h4><PackageCheck size={18} /> Evidence pack index</h4>
        </div>
        <DataState
          loading={packIndex.loading}
          error={packIndex.error}
          empty={!packIndex.data?.length}
          emptyTitle="No linked evidence pack candidates"
          emptyMessage="Linked evidence for audit, board, regulatory and closure packs will appear here."
        >
          <EntityTable<EvidencePackIndexRow>
            rows={packIndex.data || []}
            getRowKey={row => `${row.linked_item_type}:${row.linked_item_id}:${row.evidence_file_id}`}
            columns={[
              { key: 'item', header: 'Linked item', render: row => `${humanize(row.linked_item_type)} - ${row.linked_item_title || row.linked_item_id.slice(0, 8)}` },
              { key: 'evidence', header: 'Evidence', render: row => <button className="link-button" type="button" onClick={() => setSelectedEvidence(row)}>{evidenceTitle(row)}</button> },
              { key: 'status', header: 'Review', render: row => <StatusBadge status={humanize(row.review_status)} /> },
              { key: 'reviewer', header: 'Reviewer', render: row => row.reviewer_name || row.reviewer_id || '-' },
              { key: 'flags', header: 'Required for', render: row => [row.required_for_closure && 'closure', row.required_for_acceptance && 'acceptance', row.required_for_approval && 'approval', row.required_for_treatment && 'treatment'].filter(Boolean).join(', ') || '-' },
              { key: 'linked', header: 'Linked at', render: row => formatDate(row.linked_at) },
            ]}
          />
        </DataState>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h4><ShieldAlert size={18} /> Sensitive evidence register</h4>
        </div>
        <DataState
          loading={sensitiveRegister.loading}
          error={sensitiveRegister.error}
          empty={!sensitiveRegister.data?.length}
          emptyTitle="No sensitive evidence visible"
          emptyMessage="Sensitive and highly sensitive evidence appears here with owner, reviewer, expiry and lock status."
        >
          <EntityTable<SensitiveEvidenceRegisterRow>
            rows={sensitiveRegister.data || []}
            getRowKey={row => row.evidence_file_id}
            columns={[
              { key: 'evidence', header: 'Evidence', render: row => <button className="link-button" type="button" onClick={() => setSelectedEvidence(row)}>{evidenceTitle(row)}</button> },
              { key: 'sensitivity', header: 'Sensitivity', render: row => <StatusBadge status={humanize(row.sensitivity_level)} /> },
              { key: 'reason', header: 'Classification reason', render: row => row.classification_reason || '-' },
              { key: 'owner', header: 'Owner', render: row => row.owner_name || row.evidence_owner_id || '-' },
              { key: 'reviewer', header: 'Reviewer', render: row => row.reviewer_name || row.reviewer_id || '-' },
              { key: 'expiry', header: 'Expiry', render: row => formatDate(row.expiry_date) },
              { key: 'lock', header: 'Lock', render: row => row.locked_at ? <StatusBadge status="Locked" /> : '-' },
            ]}
          />
        </DataState>
      </div>

      <div className="panel">
        <div className="panel-header"><h4>Legacy evidence queue compatibility</h4></div>
        <DataState
          loading={legacyEvidence.loading}
          error={legacyEvidence.error}
          empty={!legacyEvidence.data?.length}
          emptyTitle="No legacy evidence items in your scope"
          emptyMessage={
            canGovernEvidence
              ? 'Evidence will appear after controlled work submits files for review. Authorized administrators may use Scenario Lab for synthetic UAT metadata.'
              : 'No evidence records are currently assigned or visible to this read-only account.'
          }
        >
          <EntityTable<EvidenceRow>
            rows={legacyEvidence.data || []}
            getRowKey={row => row.id}
            columns={[
              { key: 'type', header: 'Type', render: row => humanize(row.item_type) },
              { key: 'item', header: 'Related Item', render: row => <strong>{row.item_title}</strong> },
              { key: 'file', header: 'File', render: row => row.file_name },
              { key: 'uploaded', header: 'Uploaded By', render: row => row.uploaded_by_name || '-' },
              { key: 'date', header: 'Date', render: row => formatDate(row.created_at) },
              { key: 'status', header: 'Status', render: row => <StatusBadge status={humanize(row.status)} /> },
              {
                key: 'review',
                header: 'Review',
                render: row => canGovernEvidence && (row.status === 'submitted' || row.status === 'needs_revision') ? (
                  <div className="inline-actions">
                    <button className="ghost-button compact-button" disabled={busyId === row.id} onClick={() => void handleLegacyReview(row, 'accepted')}>Accept</button>
                    <button className="ghost-button compact-button" disabled={busyId === row.id} onClick={() => void handleLegacyReview(row, 'needs_revision')}>Revise</button>
                    <button className="ghost-button compact-button" disabled={busyId === row.id} onClick={() => void handleLegacyReview(row, 'rejected')}>Reject</button>
                  </div>
                ) : '-'
              }
            ]}
          />
        </DataState>
      </div>

      <Modal
        open={Boolean(selectedEvidence)}
        title="Evidence detail"
        onClose={() => setSelectedEvidence(null)}
      >
        {selectedEvidence ? (
          <div className="form-grid">
            <div className="detail-grid full-width">
              <DetailValue label="Evidence" value={evidenceTitle(selectedEvidence)} />
              <DetailValue label="Code" value={selectedEvidence.evidence_code} />
              <DetailValue label="File" value={selectedEvidence.file_name} />
              <DetailValue label="Type" value={humanize(selectedEvidence.evidence_type)} />
              <DetailValue label="Sensitivity" value={humanize(selectedEvidence.sensitivity_level)} />
              <DetailValue label="Review status" value={humanize(selectedEvidence.review_status)} />
              <DetailValue label="Owner" value={selectedEvidence.owner_name} />
              <DetailValue label="Reviewer" value={selectedEvidence.reviewer_name} />
              <DetailValue label="Revision" value={selectedEvidence.revision_required ? 'Required' : 'Not required'} />
              <DetailValue label="Expiry" value={formatDate(selectedEvidence.expiry_date)} />
              <DetailValue label="Renewal" value={selectedEvidence.renewal_required ? 'Required' : 'Not required'} />
              <DetailValue label="Lock" value={selectedEvidence.locked_at ? `Locked ${formatDate(selectedEvidence.locked_at)}` : 'Unlocked'} />
            </div>

            <div className="panel full-width">
              <div className="panel-header"><h4>Linked items</h4></div>
              <DataState
                loading={false}
                empty={!selectedLinks.length}
                emptyTitle="No linked items"
                emptyMessage="Use the Patch 23 link action from workflow modules or the API bridge to link this file."
              >
                <EntityTable<EvidencePackIndexRow>
                  rows={selectedLinks}
                  getRowKey={row => `${row.linked_item_type}:${row.linked_item_id}`}
                  columns={[
                    { key: 'type', header: 'Type', render: row => humanize(row.linked_item_type) },
                    { key: 'title', header: 'Title', render: row => row.linked_item_title || row.linked_item_id },
                    { key: 'required', header: 'Required for', render: row => [row.required_for_closure && 'closure', row.required_for_acceptance && 'acceptance', row.required_for_approval && 'approval', row.required_for_treatment && 'treatment'].filter(Boolean).join(', ') || '-' },
                  ]}
                />
              </DataState>
            </div>

            <div className="panel full-width">
              <div className="panel-header"><h4>Waiver and closure gate status</h4></div>
              <DataState
                loading={false}
                empty={!selectedGates.length}
                emptyTitle="No linked gates"
                emptyMessage="Evidence gate rows appear after requirements exist for linked workflow items."
              >
                <EntityTable<EvidenceClosureGateStatusRow>
                  rows={selectedGates}
                  getRowKey={row => row.requirement_id}
                  columns={[
                    { key: 'requirement', header: 'Requirement', render: row => row.requirement_title },
                    { key: 'gate', header: 'Gate', render: row => humanize(row.required_for_gate) },
                    { key: 'status', header: 'Status', render: row => <StatusBadge status={humanize(row.gate_status)} /> },
                    { key: 'close', header: 'Allowed', render: row => row.can_close ? 'Yes' : 'No' },
                  ]}
                />
              </DataState>
            </div>

            <div className="panel full-width">
              <div className="panel-header">
                <h4>Action controls</h4>
              </div>
              <div className="inline-actions">
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => void handleEvidenceAction(selectedEvidence, 'submit')}><Send size={16} /> Submit</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => void handleEvidenceAction(selectedEvidence, 'accept')}><ThumbsUp size={16} /> Accept</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => void handleEvidenceAction(selectedEvidence, 'reject')}><XCircle size={16} /> Reject</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => void handleEvidenceAction(selectedEvidence, 'revision')}><RotateCcw size={16} /> Revision</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => void handleEvidenceAction(selectedEvidence, 'supersede')}><RefreshCw size={16} /> Supersede</button>
                <button className="ghost-button" type="button" disabled={actionDisabled || Boolean(selectedEvidence.locked_at)} onClick={() => void handleEvidenceAction(selectedEvidence, 'lock')}><Lock size={16} /> Lock</button>
              </div>
              {!canGovernEvidence ? <p className="muted">Your current role can view governed evidence but cannot perform state transitions.</p> : null}
            </div>

            <div className="panel full-width">
              <div className="panel-header"><h4>Chain of custody</h4></div>
              <DataState
                loading={chainOfCustody.loading}
                error={chainOfCustody.error}
                empty={false}
              >
                <ChainOfCustodyTable rows={chainOfCustody.data || []} />
              </DataState>
            </div>
          </div>
        ) : null}
      </Modal>

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
              {testFillBusy ? 'Creating...' : 'Create synthetic record'}
            </button>
          </div>
        </div>
      </Modal>

      <AuditorEvidencePackPanel />
    </section>
  );
}
