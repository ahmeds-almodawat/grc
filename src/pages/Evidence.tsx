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
  const [message, setMessage] = useState<string | null>(null);  const canGovernEvidence = auth.roles.some(
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
  const [actionModal, setActionModal] = useState<{ open: boolean; scope: 'legacy' | 'evidence' | 'waiver'; action: string; row: any } | null>(null);

  function openActionModal(scope: 'legacy' | 'evidence' | 'waiver', action: string, row: any) {
    if (scope === 'legacy' && action === 'accepted') {
      return handleLegacyReview(row, action, {});
    }
    if (scope === 'evidence' && (action === 'submit' || action === 'accept')) {
      return handleEvidenceAction(row, action, {});
    }
    setActionModal({ open: true, scope, action, row });
  }

  async function handleLegacyReview(row: any, status: 'accepted' | 'rejected' | 'needs_revision', payload: Record<string, any>) {
    const defaultNote = status === 'accepted' ? '' : 'Needs correction or additional evidence.';
    const note = status === 'accepted' ? undefined : (payload.note || defaultNote);
    if (status !== 'accepted' && !payload.note) return;
    setError(null);
    setMessage(null);
    setBusyId(row.id);
    setActionModal(null);
    try {
      await reviewEvidence(row.id, status, note || undefined);
      setMessage(`Evidence ${humanize(status)}.`);
      await refreshGovernanceData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to review evidence.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleEvidenceAction(row: any, action: 'submit' | 'accept' | 'reject' | 'revision' | 'supersede' | 'lock', payload: Record<string, any>) {
    const evidenceId = row.evidence_file_id;
    setError(null);
    setMessage(null);
    setBusyId(`${action}:${evidenceId}`);
    setActionModal(null);
    try {
      if (action === 'submit') {
        await submitEvidenceForReview({ evidence_file_id: evidenceId, note: 'Submitted from Evidence Governance Center.' });
      } else if (action === 'accept') {
        await acceptEvidence({ evidence_file_id: evidenceId, note: 'Accepted from Evidence Governance Center.' });
      } else if (action === 'reject') {
        const reason = payload.reason;
        if (!reason) return;
        await rejectEvidence({ evidence_file_id: evidenceId, reason, note: reason });
      } else if (action === 'revision') {
        const reason = payload.reason;
        if (!reason) return;
        await requestEvidenceRevision({ evidence_file_id: evidenceId, reason, note: reason });
      } else if (action === 'supersede') {
        const newEvidenceId = payload.newEvidenceId;
        if (!newEvidenceId) return;
        await supersedeEvidence({
          evidence_file_id: evidenceId,
          superseded_by_evidence_id: newEvidenceId,
          note: 'Superseded from Evidence Governance Center.',
        });
      } else if (action === 'lock') {
        const note = payload.note;
        if (!note) return;
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

  async function handleWaiverAction(row: any, action: 'request' | 'approve' | 'reject', payload: Record<string, any>) {
    setError(null);
    setMessage(null);
    setBusyId(`${action}:${row.requirement_id}`);
    setActionModal(null);
    try {
      if (action === 'request') {
        const reason = payload.reason;
        if (!reason) return;
        await requestEvidenceGateWaiver({
          requirement_id: row.requirement_id,
          linked_item_type: row.linked_item_type,
          linked_item_id: row.linked_item_id,
          waiver_reason: reason,
          audit_note: reason,
        });
      } else {
        const waiverId = payload.waiverId;
        if (!waiverId) return;
        const auditNote = payload.auditNote;
        if (!auditNote) return;
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
        eyebrow="Evidence Library"
        title="Evidence Library"
        subtitle="Review, classify, accept and track evidence used for audits, risks, compliance and approvals."
        action={(
          <div className="inline-actions">
            <button
              className="ghost-button"
              type="button"
              disabled={busyId === 'generate-pack'}
              onClick={() => void handleGeneratePackIndex()}
            >
              <PackageCheck size={16} /> {compactActionLabel('Generate pack index', busyId === 'generate-pack')}
            </button>          </div>
        )}
      />
      {error ? <div className="panel error-panel">{error}</div> : null}
      {message ? <div className="notice-banner">{message}</div> : null}

      <div className="module-grid">
        <div className="module-card warning"><strong>Review queue</strong><span>{metrics.queue} queued</span></div>
        <div className="module-card danger"><strong>Closure blocked</strong><span>{metrics.closureBlocked} blocked</span></div>
        <div className="module-card good"><strong>Accepted pack candidates</strong><span>{metrics.acceptedCandidates} accepted</span></div>
        <div className="module-card danger"><strong>Sensitive evidence</strong><span>{metrics.sensitive} sensitive</span></div>
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
      <div className="panel">
        <div className="panel-header">
          <h4><FileCheck2 size={18} /> Evidence review queue</h4>
        </div>
        <DataState
          loading={reviewQueue.loading}
          error={reviewQueue.error}
          empty={!reviewQueue.data?.length}
          emptyTitle="No governed evidence in review"
          emptyMessage="Files waiting for review, overdue review, revision, expiry or renewal will appear here after migration is applied."
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
                    <button className="ghost-button compact-button" disabled={actionDisabled} title="Submit for review" onClick={() => openActionModal('evidence', 'submit', row)}><Send size={14} /></button>
                    <button className="ghost-button compact-button" disabled={actionDisabled} title="Accept evidence" onClick={() => openActionModal('evidence', 'accept', row)}><ThumbsUp size={14} /></button>
                    <button className="ghost-button compact-button" disabled={actionDisabled} title="Request revision" onClick={() => openActionModal('evidence', 'revision', row)}><RotateCcw size={14} /></button>
                    <button className="ghost-button compact-button" disabled={actionDisabled} title="Reject evidence" onClick={() => openActionModal('evidence', 'reject', row)}><XCircle size={14} /></button>
                    <button className="ghost-button compact-button" disabled={actionDisabled || Boolean(row.locked_at)} title="Lock evidence" onClick={() => openActionModal('evidence', 'lock', row)}><Lock size={14} /></button>
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
                  <button className="ghost-button compact-button" disabled={actionDisabled} onClick={() => openActionModal('waiver', 'request', row)}>
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
                    <button className="ghost-button compact-button" disabled={actionDisabled} title="Approve waiver by id" onClick={() => openActionModal('waiver', 'approve', row)}><ThumbsUp size={14} /></button>
                    <button className="ghost-button compact-button" disabled={actionDisabled} title="Reject waiver by id" onClick={() => openActionModal('waiver', 'reject', row)}><XCircle size={14} /></button>
                  </div>
                ) : '-',
              },
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
              ? 'Evidence will appear after controlled work submits files for review.'
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
                    <button className="ghost-button compact-button" disabled={busyId === row.id} onClick={() => openActionModal('legacy', 'accepted', row)}>Accept</button>
                    <button className="ghost-button compact-button" disabled={busyId === row.id} onClick={() => openActionModal('legacy', 'needs_revision', row)}>Revise</button>
                    <button className="ghost-button compact-button" disabled={busyId === row.id} onClick={() => openActionModal('legacy', 'rejected', row)}>Reject</button>
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
                emptyMessage="Use the link action from workflow modules or the API bridge to link this file."
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
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => openActionModal('evidence', 'submit', selectedEvidence)}><Send size={16} /> Submit</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => openActionModal('evidence', 'accept', selectedEvidence)}><ThumbsUp size={16} /> Accept</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => openActionModal('evidence', 'reject', selectedEvidence)}><XCircle size={16} /> Reject</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => openActionModal('evidence', 'revision', selectedEvidence)}><RotateCcw size={16} /> Revision</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => openActionModal('evidence', 'supersede', selectedEvidence)}><RefreshCw size={16} /> Supersede</button>
                <button className="ghost-button" type="button" disabled={actionDisabled || Boolean(selectedEvidence.locked_at)} onClick={() => openActionModal('evidence', 'lock', selectedEvidence)}><Lock size={16} /> Lock</button>
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

          </section>
  );
}


function EvidenceActionForm({ state, onClose, onConfirm }: { state: any, onClose: () => void, onConfirm: (p: Record<string, any>) => void }) {
  const [payload, setPayload] = useState<Record<string, any>>({});

  const isReject = state.action === 'rejected' || state.action === 'reject' || state.action === 'needs_revision' || state.action === 'revision';

  return (
    <div className="panel" style={{ padding: '24px', border: 'none', margin: 0 }}>
       {state.scope === 'legacy' && (
         <div className="field-group">
           <label>Review Note *</label>
           <textarea autoFocus value={payload.note || ''} onChange={e => setPayload({...payload, note: e.target.value})} />
         </div>
       )}
       {state.scope === 'evidence' && state.action === 'reject' && (
         <div className="field-group">
           <label>Rejection Reason *</label>
           <input autoFocus value={payload.reason || ''} onChange={e => setPayload({...payload, reason: e.target.value})} />
         </div>
       )}
       {state.scope === 'evidence' && state.action === 'revision' && (
         <div className="field-group">
           <label>Revision Reason *</label>
           <input autoFocus value={payload.reason || ''} onChange={e => setPayload({...payload, reason: e.target.value})} />
         </div>
       )}
       {state.scope === 'evidence' && state.action === 'supersede' && (
         <div className="field-group">
           <label>Replacement Evidence File ID *</label>
           <input autoFocus value={payload.newEvidenceId || ''} onChange={e => setPayload({...payload, newEvidenceId: e.target.value})} />
         </div>
       )}
       {state.scope === 'evidence' && state.action === 'lock' && (
         <div className="field-group">
           <label>Lock Note *</label>
           <input autoFocus value={payload.note || ''} onChange={e => setPayload({...payload, note: e.target.value})} />
         </div>
       )}
       {state.scope === 'waiver' && state.action === 'request' && (
         <div className="field-group">
           <label>Waiver Reason *</label>
           <input autoFocus value={payload.reason || ''} onChange={e => setPayload({...payload, reason: e.target.value})} />
         </div>
       )}
       {state.scope === 'waiver' && (state.action === 'approve' || state.action === 'reject') && (
         <>
           <div className="field-group">
             <label>Waiver ID *</label>
             <input autoFocus value={payload.waiverId || ''} onChange={e => setPayload({...payload, waiverId: e.target.value})} />
           </div>
           <div className="field-group">
             <label>Audit Note *</label>
             <input value={payload.auditNote || ''} onChange={e => setPayload({...payload, auditNote: e.target.value})} />
           </div>
         </>
       )}
       {isReject && <div className="notice-banner danger" style={{ marginTop: '16px' }}>This is a destructive or negative action. Please provide a clear reason.</div>}
       <div className="form-actions" style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
         <button className="ghost-button" onClick={onClose}>Cancel</button>
         <button className="primary-button" onClick={() => onConfirm(payload)}>Confirm Action</button>
       </div>
    </div>
  );
}
