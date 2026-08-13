import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  FileCheck2,
  FileSearch,
  Link2,
  Lock,
  PackageCheck,
  Printer,
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
import { GovernedEvidenceAccess } from '../components/GovernedEvidenceAccess';
import { formatDate, humanize } from '../lib/format';
import {
  acceptEvidence,
  approveEvidenceGateWaiver,
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
import { useI18n } from '../i18n/I18nContext';
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

export interface EvidencePackGroup {
  key: string;
  linkedItemType: EvidencePackIndexRow['linked_item_type'];
  linkedItemId: string;
  linkedItemTitle: string | null;
  rows: EvidencePackIndexRow[];
}

export function groupEvidencePackRows(rows: EvidencePackIndexRow[]): EvidencePackGroup[] {
  const groups = new Map<string, EvidencePackGroup>();
  for (const row of rows) {
    const key = `${row.linked_item_type}:${row.linked_item_id}:${row.linked_item_title || ''}`;
    const existing = groups.get(key);
    if (existing) {
      existing.rows.push(row);
    } else {
      groups.set(key, {
        key,
        linkedItemType: row.linked_item_type,
        linkedItemId: row.linked_item_id,
        linkedItemTitle: row.linked_item_title,
        rows: [row],
      });
    }
  }
  return [...groups.values()].sort((left, right) =>
    `${left.linkedItemType}:${left.linkedItemTitle || left.linkedItemId}`.localeCompare(
      `${right.linkedItemType}:${right.linkedItemTitle || right.linkedItemId}`,
    )
  );
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
  const { t } = useI18n();
  return (
    <DataState
      loading={false}
      empty={!rows.length}
      emptyTitle={t('evidence.chainEmptyTitle')}
      emptyMessage={t('evidence.chainEmptyMessage')}
    >
      <EntityTable<EvidenceChainOfCustodyRow>
        rows={rows}
        getRowKey={row => row.event_id || row.id || `${row.evidence_file_id}:${row.event_type}:${row.created_at}`}
        columns={[
          { key: 'event', header: t('common.event'), render: row => t(`evidence.event.${row.event_type}`, humanize(row.event_type)) },
          { key: 'status', header: t('common.status'), render: row => `${t(`status.${row.from_status}`, humanize(row.from_status))} ← ${t(`status.${row.to_status}`, humanize(row.to_status))}` },
          { key: 'actor', header: t('common.actor'), render: row => row.actor_id || '-' },
          { key: 'note', header: t('common.note'), render: row => row.note || '-' },
          { key: 'date', header: t('common.date'), render: row => formatDate(row.created_at) },
        ]}
      />
    </DataState>
  );
}

export function Evidence() {
  const { t } = useI18n();
  const auth = useAuth();
  const legacyEvidence = useAsyncData(getEvidenceQueue, []);
  const reviewQueue = useAsyncData(getEvidenceReviewQueue, []);
  const gaps = useAsyncData(getEvidenceGapDashboard, []);
  const gates = useAsyncData(getEvidenceClosureGateStatus, []);
  const packIndex = useAsyncData(getEvidencePackIndex, []);
  const sensitiveRegister = useAsyncData(getSensitiveEvidenceRegister, []);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceSelection | null>(null);
  const [selectedPackKey, setSelectedPackKey] = useState<string | null>(null);
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
  const packGroups = useMemo(() => groupEvidencePackRows(packIndex.data || []), [packIndex.data]);
  const selectedPack = packGroups.find(group => group.key === selectedPackKey) || null;

  const warnings = useMemo(() => {
    const queueRows = reviewQueue.data || [];
    const sensitiveRows = sensitiveRegister.data || [];
    const warningRows = [
      {
        id: 'overdue-review',
        show: queueRows.some(row => row.queue_reason === 'overdue_review' || isPast(row.review_due_date)),
        title: t('evidence.warning.overdueTitle'),
        body: t('evidence.warning.overdueBody'),
      },
      {
        id: 'rejected-revision',
        show: queueRows.some(row => row.review_status === 'rejected' || row.revision_required),
        title: t('evidence.warning.revisionTitle'),
        body: t('evidence.warning.revisionBody'),
      },
      {
        id: 'expired-evidence',
        show: queueRows.some(row => isPast(row.expiry_date)) || sensitiveRows.some(row => isPast(row.expiry_date)),
        title: t('evidence.warning.expiredTitle'),
        body: t('evidence.warning.expiredBody'),
      },
      {
        id: 'missing-closure',
        show: Boolean(gaps.data?.length),
        title: t('evidence.warning.missingTitle'),
        body: t('evidence.warning.missingBody'),
      },
      {
        id: 'sensitive-review',
        show: Boolean(sensitiveRows.length),
        title: t('evidence.warning.sensitiveTitle'),
        body: t('evidence.warning.sensitiveBody'),
      },
    ];
    return warningRows.filter(row => row.show);
  }, [gaps.data?.length, reviewQueue.data, sensitiveRegister.data, t]);

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
      setMessage(t('evidence.reviewCompleted').replace('{status}', t(`status.${status}`, humanize(status))));
      await refreshGovernanceData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('evidence.reviewFailed'));
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
      setMessage(t('evidence.actionCompleted').replace('{action}', t(`evidence.action.${action}`, humanize(action))).replace('{evidence}', evidenceTitle(row)));
      await refreshGovernanceData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('evidence.actionFailed'));
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
      setMessage(t('evidence.waiverCompleted').replace('{action}', t(`evidence.action.${action}`, humanize(action))));
      await refreshGovernanceData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('evidence.waiverFailed'));
    } finally {
      setBusyId(null);
    }
  }
  function printPack(group: EvidencePackGroup) {
    setSelectedPackKey(group.key);
    window.requestAnimationFrame(() => window.print());
  }

  const actionDisabled = !canGovernEvidence || Boolean(busyId);

  return (
    <section className="page-section">
      <ModuleHeader
        eyebrow={t('evidence.eyebrow')}
        title={t('evidence.title')}
        subtitle={t('evidence.subtitle')}
      />
      {error ? <div className="panel error-panel">{error}</div> : null}
      {message ? <div className="notice-banner">{message}</div> : null}

      <div className="module-grid">
        <div className="module-card warning"><strong>{t('evidence.reviewQueue')}</strong><span>{metrics.queue} {t('status.queued')}</span></div>
        <div className="module-card danger"><strong>{t('evidence.closureBlocked')}</strong><span>{metrics.closureBlocked} {t('status.blocked')}</span></div>
        <div className="module-card good"><strong>{t('evidence.acceptedCandidates')}</strong><span>{metrics.acceptedCandidates} {t('status.accepted')}</span></div>
        <div className="module-card danger"><strong>{t('evidence.sensitiveEvidence')}</strong><span>{metrics.sensitive} {t('evidence.sensitive')}</span></div>
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
          {t('evidence.noWarnings')}
        </div>
      )}
      <div className="panel evidence-pack-panel">
        <div className="panel-header">
          <div>
            <h4><PackageCheck size={18} /> {t('evidence.pack.title', 'Evidence packs')}</h4>
            <p>{t('evidence.pack.subtitle', 'Governed metadata grouped by the linked work item. File access remains private and individually authorized.')}</p>
          </div>
        </div>
        <DataState
          loading={packIndex.loading}
          error={packIndex.error}
          empty={!packGroups.length}
          emptyTitle={t('evidence.pack.emptyTitle', 'No evidence packs')}
          emptyMessage={t('evidence.pack.empty', 'No linked evidence is available for this pack.')}
        >
          <div className="evidence-pack-grid">
            {packGroups.map(group => (
              <article className="evidence-pack-card" key={group.key}>
                <header>
                  <div>
                    <span>{t(`itemType.${group.linkedItemType}`, humanize(group.linkedItemType))}</span>
                    <h5>{group.linkedItemTitle || group.linkedItemId}</h5>
                  </div>
                  <button className="ghost-button compact-button" type="button" onClick={() => printPack(group)}>
                    <Printer size={14} /> {t('evidence.pack.printIndex', 'Print Index')}
                  </button>
                </header>
                <div className="evidence-pack-files">
                  {group.rows.map(row => (
                    <div className="evidence-pack-file" key={`${group.key}:${row.evidence_file_id}`}>
                      <div className="evidence-pack-file__meta">
                        <strong>{row.evidence_title || row.file_name}</strong>
                        <span>{row.evidence_code} · {t(`status.${row.review_status}`, humanize(row.review_status))}</span>
                      </div>
                      <dl className="evidence-pack-file__details">
                        <div><dt>{t('evidence.pack.fileType', 'File type')}</dt><dd>{humanize(row.evidence_type)}</dd></div>
                        <div><dt>{t('evidence.pack.sensitivity', 'Sensitivity')}</dt><dd>{t(`evidence.sensitivity.${row.sensitivity_level}`, humanize(row.sensitivity_level))}</dd></div>
                        <div><dt>{t('evidence.pack.reviewer', 'Reviewer')}</dt><dd>{row.reviewer_name || '—'}</dd></div>
                        <div><dt>{t('evidence.pack.reviewedAt', 'Reviewed')}</dt><dd>{formatDate(row.reviewed_at)}</dd></div>
                        <div><dt>{t('evidence.pack.primary', 'Primary evidence')}</dt><dd>{row.is_primary ? t('common.yes') : t('common.no')}</dd></div>
                        <div><dt>{t('evidence.pack.requiredClosure', 'Required for closure')}</dt><dd>{row.required_for_closure ? t('common.yes') : t('common.no')}</dd></div>
                        <div><dt>{t('evidence.pack.requiredAcceptance', 'Required for acceptance')}</dt><dd>{row.required_for_acceptance ? t('common.yes') : t('common.no')}</dd></div>
                        <div><dt>{t('evidence.pack.requiredApproval', 'Required for approval')}</dt><dd>{row.required_for_approval ? t('common.yes') : t('common.no')}</dd></div>
                        <div><dt>{t('evidence.pack.requiredTreatment', 'Required for treatment')}</dt><dd>{row.required_for_treatment ? t('common.yes') : t('common.no')}</dd></div>
                      </dl>
                      <GovernedEvidenceAccess
                        evidenceId={row.evidence_file_id}
                        fileName={row.file_name}
                        fileType={row.evidence_type}
                        description={row.evidence_title}
                      />
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </DataState>
      </div>

      {selectedPack ? (
        <article className="governed-print-root evidence-pack-print" aria-hidden="true">
          <header className="governed-print-header">
            <img src="/brand/almodawat-acc-logo.png" alt="Almodawat Assurance Control Center" />
            <div>
              <p>{t('evidence.pack.printBrand', 'Almodawat Assurance Control Center')}</p>
              <h1>{t('evidence.pack.printTitle', 'Governed Evidence Pack Index')}</h1>
              <strong>{selectedPack.linkedItemTitle || selectedPack.linkedItemId}</strong>
            </div>
          </header>
          <section className="governed-print-meta">
            <DetailValue label={t('common.type')} value={t(`itemType.${selectedPack.linkedItemType}`, humanize(selectedPack.linkedItemType))} />
            <DetailValue label={t('evidence.pack.recordCount', 'Evidence records')} value={selectedPack.rows.length} />
          </section>
          <div className="evidence-pack-print__records">
            {selectedPack.rows.map(row => (
              <section className="governed-print-break-safe evidence-pack-print__record" key={row.evidence_file_id}>
                <h2>{row.evidence_code} · {row.evidence_title}</h2>
                <div className="governed-print-grid">
                  <DetailValue label={t('common.file')} value={row.file_name} />
                  <DetailValue label={t('evidence.pack.fileType', 'File type')} value={humanize(row.evidence_type)} />
                  <DetailValue label={t('common.status')} value={t(`status.${row.review_status}`, humanize(row.review_status))} />
                  <DetailValue label={t('evidence.pack.sensitivity', 'Sensitivity')} value={t(`evidence.sensitivity.${row.sensitivity_level}`, humanize(row.sensitivity_level))} />
                  <DetailValue label={t('evidence.pack.reviewer', 'Reviewer')} value={row.reviewer_name || '—'} />
                  <DetailValue label={t('evidence.pack.reviewedAt', 'Reviewed')} value={formatDate(row.reviewed_at)} />
                  <DetailValue label={t('evidence.pack.linkedAt', 'Linked')} value={formatDate(row.linked_at)} />
                  <DetailValue label={t('evidence.pack.primary', 'Primary evidence')} value={row.is_primary ? t('common.yes') : t('common.no')} />
                  <DetailValue label={t('evidence.pack.requiredClosure', 'Required for closure')} value={row.required_for_closure ? t('common.yes') : t('common.no')} />
                  <DetailValue label={t('evidence.pack.requiredAcceptance', 'Required for acceptance')} value={row.required_for_acceptance ? t('common.yes') : t('common.no')} />
                  <DetailValue label={t('evidence.pack.requiredApproval', 'Required for approval')} value={row.required_for_approval ? t('common.yes') : t('common.no')} />
                  <DetailValue label={t('evidence.pack.requiredTreatment', 'Required for treatment')} value={row.required_for_treatment ? t('common.yes') : t('common.no')} />
                </div>
              </section>
            ))}
          </div>
          <p>{t('evidence.pack.metadataOnly', 'This index contains governed metadata only. It does not include evidence file contents.')}</p>
        </article>
      ) : null}
      <div className="panel">
        <div className="panel-header">
          <h4><FileCheck2 size={18} /> {t('evidence.reviewQueue')}</h4>
        </div>
        <DataState
          loading={reviewQueue.loading}
          error={reviewQueue.error}
          empty={!reviewQueue.data?.length}
          emptyTitle={t('evidence.reviewEmptyTitle')}
          emptyMessage={t('evidence.reviewEmptyMessage')}
        >
          <EntityTable<EvidenceReviewQueueRow>
            rows={reviewQueue.data || []}
            getRowKey={row => row.evidence_file_id}
            columns={[
              { key: 'title', header: t('common.evidence'), render: row => <button className="link-button" type="button" onClick={() => setSelectedEvidence(row)}>{evidenceTitle(row)}</button> },
              { key: 'type', header: t('common.type'), render: row => t(`evidence.type.${row.evidence_type}`, humanize(row.evidence_type)) },
              { key: 'sensitivity', header: t('evidence.sensitivity'), render: row => <StatusBadge status={t(`evidence.sensitivity.${row.sensitivity_level}`, humanize(row.sensitivity_level))} /> },
              { key: 'status', header: t('evidence.review'), render: row => <StatusBadge status={t(`status.${row.review_status}`, humanize(row.review_status))} /> },
              { key: 'due', header: t('evidence.reviewDue'), render: row => formatDate(row.review_due_date) },
              { key: 'expiry', header: t('evidence.expiry'), render: row => formatDate(row.expiry_date) },
              { key: 'reason', header: t('evidence.queueReason'), render: row => t(`evidence.queueReason.${row.queue_reason}`, humanize(row.queue_reason)) },
              {
                key: 'actions',
                header: t('common.actions'),
                render: row => canGovernEvidence ? (
                  <div className="inline-actions">
                    <button className="ghost-button compact-button" disabled={actionDisabled} title={t('evidence.submitForReview')} onClick={() => openActionModal('evidence', 'submit', row)}><Send size={14} /></button>
                    <button className="ghost-button compact-button" disabled={actionDisabled} title={t('evidence.acceptEvidence')} onClick={() => openActionModal('evidence', 'accept', row)}><ThumbsUp size={14} /></button>
                    <button className="ghost-button compact-button" disabled={actionDisabled} title={t('evidence.requestRevision')} onClick={() => openActionModal('evidence', 'revision', row)}><RotateCcw size={14} /></button>
                    <button className="ghost-button compact-button" disabled={actionDisabled} title={t('evidence.rejectEvidence')} onClick={() => openActionModal('evidence', 'reject', row)}><XCircle size={14} /></button>
                    <button className="ghost-button compact-button" disabled={actionDisabled || Boolean(row.locked_at)} title={t('evidence.lockEvidence')} onClick={() => openActionModal('evidence', 'lock', row)}><Lock size={14} /></button>
                  </div>
                ) : '-'
              },
            ]}
          />
        </DataState>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h4><ShieldAlert size={18} /> {t('evidence.gapDashboard')}</h4>
        </div>
        <DataState
          loading={gaps.loading}
          error={gaps.error}
          empty={!gaps.data?.length}
          emptyTitle={t('evidence.gapsEmptyTitle')}
          emptyMessage={t('evidence.gapsEmptyMessage')}
        >
          <EntityTable<EvidenceGapDashboardRow>
            rows={gaps.data || []}
            getRowKey={row => row.requirement_id}
            columns={[
              { key: 'item', header: t('common.item'), render: row => `${t(`itemType.${row.linked_item_type}`, humanize(row.linked_item_type))} ${row.linked_item_id.slice(0, 8)}` },
              { key: 'requirement', header: t('evidence.requirement'), render: row => <strong>{row.requirement_title}</strong> },
              { key: 'gate', header: t('evidence.gate'), render: row => t(`evidence.gate.${row.required_for_gate}`, humanize(row.required_for_gate)) },
              { key: 'count', header: t('status.accepted'), render: row => `${row.accepted_evidence_count} / ${row.minimum_accepted_files}` },
              { key: 'status', header: t('evidence.gateStatus'), render: row => <StatusBadge status={t(`status.${row.gate_status}`, humanize(row.gate_status))} /> },
              { key: 'gap', header: t('evidence.gap'), render: row => t(`evidence.gap.${row.gap_reason}`, humanize(row.gap_reason)) },
              {
                key: 'waiver',
                header: t('evidence.waiver'),
                render: row => canGovernEvidence ? (
                  <button className="ghost-button compact-button" disabled={actionDisabled} onClick={() => openActionModal('waiver', 'request', row)}>
                    <Link2 size={14} /> {t('common.request')}
                  </button>
                ) : '-',
              },
            ]}
          />
        </DataState>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h4><FileSearch size={18} /> {t('evidence.closureGateStatus')}</h4>
        </div>
        <DataState
          loading={gates.loading}
          error={gates.error}
          empty={!gates.data?.length}
          emptyTitle={t('evidence.gatesEmptyTitle')}
          emptyMessage={t('evidence.gatesEmptyMessage')}
        >
          <EntityTable<EvidenceClosureGateStatusRow>
            rows={gates.data || []}
            getRowKey={row => row.requirement_id}
            columns={[
              { key: 'item', header: t('common.item'), render: row => t(`itemType.${row.linked_item_type}`, humanize(row.linked_item_type)) },
              { key: 'requirement', header: t('evidence.requirement'), render: row => row.requirement_title },
              { key: 'gate', header: t('evidence.gate'), render: row => t(`evidence.gate.${row.required_for_gate}`, humanize(row.required_for_gate)) },
              { key: 'accepted', header: t('status.accepted'), render: row => `${row.accepted_evidence_count} / ${row.minimum_accepted_files}` },
              { key: 'waiver', header: t('evidence.waiver'), render: row => row.waiver_active ? <StatusBadge status={t('status.waived')} /> : '-' },
              { key: 'close', header: t('evidence.allowed'), render: row => <StatusBadge status={row.can_close ? t('evidence.canClose') : t('status.blocked')} /> },
              {
                key: 'actions',
                header: t('common.actions'),
                render: row => canGovernEvidence ? (
                  <div className="inline-actions">
                    <button className="ghost-button compact-button" disabled={actionDisabled} title={t('evidence.approveWaiver')} onClick={() => openActionModal('waiver', 'approve', row)}><ThumbsUp size={14} /></button>
                    <button className="ghost-button compact-button" disabled={actionDisabled} title={t('evidence.rejectWaiver')} onClick={() => openActionModal('waiver', 'reject', row)}><XCircle size={14} /></button>
                  </div>
                ) : '-',
              },
            ]}
          />
        </DataState>
      </div>

      <div className="panel">
        <div className="panel-header"><h4>{t('evidence.legacyQueue')}</h4></div>
        <DataState
          loading={legacyEvidence.loading}
          error={legacyEvidence.error}
          empty={!legacyEvidence.data?.length}
          emptyTitle={t('evidence.legacyEmptyTitle')}
          emptyMessage={
            canGovernEvidence
              ? t('evidence.legacyEmptyGovern')
              : t('evidence.legacyEmptyReadonly')
          }
        >
          <EntityTable<EvidenceRow>
            rows={legacyEvidence.data || []}
            getRowKey={row => row.id}
            columns={[
              { key: 'type', header: t('common.type'), render: row => t(`itemType.${row.item_type}`, humanize(row.item_type)) },
              { key: 'item', header: t('evidence.relatedItem'), render: row => <strong>{row.item_title}</strong> },
              { key: 'file', header: t('common.file'), render: row => <GovernedEvidenceAccess evidenceId={row.id} fileName={row.file_name} fileType={row.file_type} fileSize={row.file_size} description={row.description} /> },
              { key: 'uploaded', header: t('evidence.uploadedBy'), render: row => row.uploaded_by_name || '-' },
              { key: 'date', header: t('common.date'), render: row => formatDate(row.created_at) },
              { key: 'status', header: t('common.status'), render: row => <StatusBadge status={t(`status.${row.status}`, humanize(row.status))} /> },
              {
                key: 'review',
                header: t('evidence.review'),
                render: row => canGovernEvidence && (row.status === 'submitted' || row.status === 'needs_revision') ? (
                  <div className="inline-actions">
                    <button className="ghost-button compact-button" disabled={busyId === row.id} onClick={() => openActionModal('legacy', 'accepted', row)}>{t('evidence.accept')}</button>
                    <button className="ghost-button compact-button" disabled={busyId === row.id} onClick={() => openActionModal('legacy', 'needs_revision', row)}>{t('evidence.revise')}</button>
                    <button className="ghost-button compact-button" disabled={busyId === row.id} onClick={() => openActionModal('legacy', 'rejected', row)}>{t('evidence.reject')}</button>
                  </div>
                ) : '-'
              }
            ]}
          />
        </DataState>
      </div>

      <Modal
        size="xl"
        open={Boolean(selectedEvidence)}
        title={t('evidence.detail')}
        onClose={() => setSelectedEvidence(null)}
      >
        {selectedEvidence ? (
          <div className="form-grid">
            <div className="detail-grid full-width">
              <DetailValue label={t('common.evidence')} value={evidenceTitle(selectedEvidence)} />
              <DetailValue label={t('common.code')} value={selectedEvidence.evidence_code} />
              <DetailValue label={t('common.file')} value={selectedEvidence.file_name} />
              {selectedEvidence.file_name ? <div className="full-width"><GovernedEvidenceAccess evidenceId={selectedEvidence.evidence_file_id} fileName={selectedEvidence.file_name} /></div> : null}
              <DetailValue label={t('common.type')} value={t(`evidence.type.${selectedEvidence.evidence_type}`, humanize(selectedEvidence.evidence_type))} />
              <DetailValue label={t('evidence.sensitivity')} value={t(`evidence.sensitivity.${selectedEvidence.sensitivity_level}`, humanize(selectedEvidence.sensitivity_level))} />
              <DetailValue label={t('evidence.reviewStatus')} value={t(`status.${selectedEvidence.review_status}`, humanize(selectedEvidence.review_status))} />
              <DetailValue label={t('common.owner')} value={selectedEvidence.owner_name} />
              <DetailValue label={t('evidence.reviewer')} value={selectedEvidence.reviewer_name} />
              <DetailValue label={t('evidence.revision')} value={selectedEvidence.revision_required ? t('common.required') : t('common.notRequired')} />
              <DetailValue label={t('evidence.expiry')} value={formatDate(selectedEvidence.expiry_date)} />
              <DetailValue label={t('evidence.renewal')} value={selectedEvidence.renewal_required ? t('common.required') : t('common.notRequired')} />
              <DetailValue label={t('evidence.lock')} value={selectedEvidence.locked_at ? `${t('status.locked')} ${formatDate(selectedEvidence.locked_at)}` : t('status.unlocked')} />
            </div>

            <div className="panel full-width">
              <div className="panel-header"><h4>{t('evidence.linkedItems')}</h4></div>
              <DataState
                loading={false}
                empty={!selectedLinks.length}
                emptyTitle={t('evidence.linksEmptyTitle')}
                emptyMessage={t('evidence.linksEmptyMessage')}
              >
                <EntityTable<EvidencePackIndexRow>
                  rows={selectedLinks}
                  getRowKey={row => `${row.linked_item_type}:${row.linked_item_id}`}
                  columns={[
                    { key: 'type', header: t('common.type'), render: row => t(`itemType.${row.linked_item_type}`, humanize(row.linked_item_type)) },
                    { key: 'title', header: t('common.title'), render: row => row.linked_item_title || row.linked_item_id },
                    { key: 'required', header: t('evidence.requiredFor'), render: row => [row.required_for_closure && t('evidence.gate.closure'), row.required_for_acceptance && t('evidence.gate.acceptance'), row.required_for_approval && t('evidence.gate.approval'), row.required_for_treatment && t('evidence.gate.treatment')].filter(Boolean).join('، ') || '-' },
                  ]}
                />
              </DataState>
            </div>

            <div className="panel full-width">
              <div className="panel-header"><h4>{t('evidence.waiverGateStatus')}</h4></div>
              <DataState
                loading={false}
                empty={!selectedGates.length}
                emptyTitle={t('evidence.linkedGatesEmptyTitle')}
                emptyMessage={t('evidence.linkedGatesEmptyMessage')}
              >
                <EntityTable<EvidenceClosureGateStatusRow>
                  rows={selectedGates}
                  getRowKey={row => row.requirement_id}
                  columns={[
                    { key: 'requirement', header: t('evidence.requirement'), render: row => row.requirement_title },
                    { key: 'gate', header: t('evidence.gate'), render: row => t(`evidence.gate.${row.required_for_gate}`, humanize(row.required_for_gate)) },
                    { key: 'status', header: t('common.status'), render: row => <StatusBadge status={t(`status.${row.gate_status}`, humanize(row.gate_status))} /> },
                    { key: 'close', header: t('evidence.allowed'), render: row => row.can_close ? t('common.yes') : t('common.no') },
                  ]}
                />
              </DataState>
            </div>

            <div className="panel full-width">
              <div className="panel-header">
                <h4>{t('evidence.actionControls')}</h4>
              </div>
              <div className="inline-actions">
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => openActionModal('evidence', 'submit', selectedEvidence)}><Send size={16} /> {t('evidence.submit')}</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => openActionModal('evidence', 'accept', selectedEvidence)}><ThumbsUp size={16} /> {t('evidence.accept')}</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => openActionModal('evidence', 'reject', selectedEvidence)}><XCircle size={16} /> {t('evidence.reject')}</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => openActionModal('evidence', 'revision', selectedEvidence)}><RotateCcw size={16} /> {t('evidence.revision')}</button>
                <button className="ghost-button" type="button" disabled={actionDisabled} onClick={() => openActionModal('evidence', 'supersede', selectedEvidence)}><RefreshCw size={16} /> {t('evidence.supersede')}</button>
                <button className="ghost-button" type="button" disabled={actionDisabled || Boolean(selectedEvidence.locked_at)} onClick={() => openActionModal('evidence', 'lock', selectedEvidence)}><Lock size={16} /> {t('evidence.lock')}</button>
              </div>
              {!canGovernEvidence ? <p className="muted">{t('evidence.readonlyRole')}</p> : null}
            </div>

            <div className="panel full-width">
              <div className="panel-header"><h4>{t('evidence.chainOfCustody')}</h4></div>
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


function EvidenceActionForm({ state, evidenceList, onClose, onConfirm }: { state: any, evidenceList: any[], onClose: () => void, onConfirm: (p: Record<string, any>) => void }) {
  const { t } = useI18n();
  const [payload, setPayload] = useState<Record<string, any>>({});

  const isReject = state.action === 'rejected' || state.action === 'reject' || state.action === 'needs_revision' || state.action === 'revision';

  const missingFields: string[] = [];
  if (state.scope === 'legacy' && !payload.note) missingFields.push(t('evidence.reviewNote'));
  if (state.scope === 'evidence' && state.action === 'reject' && !payload.reason) missingFields.push(t('evidence.rejectionReason'));
  if (state.scope === 'evidence' && state.action === 'revision' && !payload.reason) missingFields.push(t('evidence.revisionReason'));
  if (state.scope === 'evidence' && state.action === 'supersede' && !payload.newEvidenceId) missingFields.push(t('evidence.replacementEvidence'));
  if (state.scope === 'evidence' && state.action === 'lock' && !payload.note) missingFields.push(t('evidence.lockNote'));
  if (state.scope === 'waiver' && state.action === 'request' && !payload.reason) missingFields.push(t('evidence.waiverReason'));
  if (state.scope === 'evidence' && state.action === 'classify' && !payload.sensitivity) missingFields.push(t('evidence.sensitivityLevel'));

  const isValid = missingFields.length === 0;

  const selectedTitle = state.row ? `${state.row.evidence_code ? state.row.evidence_code + ' - ' : ''}${state.row.evidence_title || state.row.item_title || state.row.file_name}` : t('common.unknown');

  return (
    <div className="panel" style={{ padding: '24px', border: 'none', margin: 0 }}>
       <div style={{ marginBottom: '16px' }}>
         <strong>{t('common.action')}: {t(`evidence.action.${state.action}`, humanize(state.action))}</strong><br/>
         <small>{t('common.evidence')}: {selectedTitle}</small>
       </div>

       {state.scope === 'legacy' && (
         <div className="field-group">
           <label>{t('evidence.reviewNote')} *</label>
           <textarea autoFocus value={payload.note || ''} onChange={e => setPayload({...payload, note: e.target.value})} />
         </div>
       )}
       {state.scope === 'evidence' && state.action === 'reject' && (
         <div className="field-group">
           <label>{t('evidence.rejectionReason')} *</label>
           <input autoFocus value={payload.reason || ''} onChange={e => setPayload({...payload, reason: e.target.value})} />
         </div>
       )}
       {state.scope === 'evidence' && state.action === 'revision' && (
         <div className="field-group">
           <label>{t('evidence.revisionReason')} *</label>
           <input autoFocus value={payload.reason || ''} onChange={e => setPayload({...payload, reason: e.target.value})} />
         </div>
       )}
       {state.scope === 'evidence' && state.action === 'supersede' && (
         <div className="field-group">
           <label>{t('evidence.replacementEvidence')} *</label>
           <select autoFocus value={payload.newEvidenceId || ''} onChange={e => setPayload({...payload, newEvidenceId: e.target.value})}>
             <option value="">{t('evidence.selectReplacement')}</option>
             {evidenceList.filter(e => e.id !== state.row.evidence_file_id).map(e => <option key={e.id} value={e.id}>{e.evidence_code ? e.evidence_code + ' - ' : ''}{e.evidence_title || e.item_title || e.file_name}</option>)}
           </select>
         </div>
       )}
       {state.scope === 'evidence' && state.action === 'lock' && (
         <div className="field-group">
           <label>{t('evidence.lockNote')} *</label>
           <input autoFocus value={payload.note || ''} onChange={e => setPayload({...payload, note: e.target.value})} />
         </div>
       )}
       {state.scope === 'evidence' && state.action === 'classify' && (
         <div className="field-group">
           <label>{t('evidence.sensitivityClassification')} *</label>
           <select autoFocus value={payload.sensitivity || ''} onChange={e => setPayload({...payload, sensitivity: e.target.value})}>
             <option value="">{t('evidence.selectSensitivity')}</option>
             <option value="public">{t('evidence.sensitivity.public')}</option>
             <option value="internal">{t('evidence.sensitivity.internal')}</option>
             <option value="confidential">{t('evidence.sensitivity.confidential')}</option>
             <option value="restricted">{t('evidence.sensitivity.restricted')}</option>
           </select>
         </div>
       )}
       {state.scope === 'waiver' && state.action === 'request' && (
         <div className="field-group">
           <label>{t('evidence.waiverReason')} *</label>
           <input autoFocus value={payload.reason || ''} onChange={e => setPayload({...payload, reason: e.target.value})} />
         </div>
       )}
       {state.scope === 'waiver' && (state.action === 'approve' || state.action === 'reject') && (
         <>
           <div className="field-group">
             <label>{t('evidence.waiverId')} *</label>
             <div className="notice-banner warning">{t('evidence.noSelectableRecords')}</div>
           </div>
           <div className="field-group">
             <label>{t('evidence.auditNote')} *</label>
             <input value={payload.auditNote || ''} onChange={e => setPayload({...payload, auditNote: e.target.value})} />
           </div>
         </>
       )}
       {isReject && <div className="notice-banner danger" style={{ marginTop: '16px' }}>{t('evidence.negativeActionWarning')}</div>}

       {!isValid && <div className="notice-banner warning" style={{ marginTop: '16px' }}>{t('evidence.missingFields')}: {missingFields.join('، ')}</div>}

       <div className="form-actions" style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
         <button className="ghost-button" onClick={onClose}>{t('common.cancel')}</button>
         {(state.scope === 'waiver' && (state.action === 'approve' || state.action === 'reject')) || !isValid ? (
           <button className="primary-button" disabled>{t('evidence.confirmAction')}</button>
         ) : (
           <button className="primary-button" onClick={() => onConfirm(payload)}>{t('evidence.confirmAction')}</button>
         )}
       </div>
    </div>
  );
}
