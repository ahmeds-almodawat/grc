import { useMemo, useState } from 'react';
import { DataState } from '../components/DataState';
import { EntityTable } from '../components/EntityTable';
import { ModuleHeader } from '../components/ModuleHeader';
import { StatusBadge } from '../components/StatusBadge';
import { GovernedEvidenceAccess } from '../components/GovernedEvidenceAccess';
import { decideApproval, getEvidenceForItem } from '../lib/grcApi';
import { formatDate, humanize } from '../lib/format';
import { getApprovals } from '../lib/grcApi';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import type { ApprovalRow } from '../types/domain';

type ApprovalFilter = 'all' | 'pending' | 'approved' | 'rejected';

export function Approvals() {
  const { t } = useI18n();
  const approvals = useAsyncData(getApprovals, []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ApprovalFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRow | null>(null);
  const approvalEvidence = useAsyncData(
    () => selectedApproval && ['project', 'milestone', 'task'].includes(selectedApproval.item_type)
      ? getEvidenceForItem(selectedApproval.item_type as 'project' | 'milestone' | 'task', selectedApproval.item_id)
      : Promise.resolve([]),
    [selectedApproval?.id],
  );
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
    const defaultNote = status === 'approved' ? t('approvals.defaultApprovalNote') : t('approvals.defaultRejectionNote');
    const note = status === 'rejected' ? window.prompt(t('approvals.rejectionReason'), defaultNote) : window.prompt(t('approvals.approvalNote'), defaultNote);
    if (note === null) return;
    setError(null);
    setBusyId(row.id);
    try {
      await decideApproval(row.id, status, note || defaultNote);
      void approvals.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('approvals.updateFailed'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="page-section">
      <ModuleHeader
        eyebrow={t('approvals.eyebrow')}
        title={t('approvals.title')}
        subtitle={t('approvals.subtitle')}
      />

      {error ? <div className="panel error-panel">{error}</div> : null}

      {rows.length ? (
        <div className="stats-grid">
          {([
            ['all', t('approvals.all'), rows.length, 'normal'],
            ['pending', t('approvals.pendingDecisions'), rows.filter(row => row.status === 'pending').length, 'warning'],
            ['approved', t('status.approved'), rows.filter(row => row.status === 'approved').length, 'success'],
            ['rejected', t('status.rejected'), rows.filter(row => row.status === 'rejected').length, 'danger']
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
            <h4>{t('approvals.queue')}</h4>
            <p>{t('approvals.showing', `${filteredRows.length} of ${rows.length}`).replace('{shown}', String(filteredRows.length)).replace('{total}', String(rows.length))}</p>
          </div>
          <div className="toolbar">
            <span className="status-badge status-info">{t('common.activeFilter')}: {t(`approvals.filter.${activeFilter}`, humanize(activeFilter))}</span>
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder={t('approvals.searchPlaceholder')} />
            <button className="ghost-button" type="button" onClick={resetApprovalFilters}>{t('common.resetFilters')}</button>
          </div>
        </div>
        <DataState loading={approvals.loading} error={approvals.error} empty={!filteredRows.length} emptyTitle={t('approvals.emptyTitle')} emptyMessage={t('approvals.emptyMessage')}>
          <EntityTable<ApprovalRow>
            rows={filteredRows}
            getRowKey={row => row.id}
            columns={[
              { key: 'type', header: t('common.type'), render: row => t(`itemType.${row.item_type}`, humanize(row.item_type)) },
              { key: 'item', header: t('common.item'), render: row => <button className="link-button" type="button" onClick={() => setSelectedApproval(row)}><strong>{row.item_title}</strong></button> },
              { key: 'requested', header: t('approvals.requestedBy'), render: row => row.requested_by_name || '—' },
              { key: 'approver', header: t('approvals.approver'), render: row => row.approver_name || '—' },
              { key: 'date', header: t('approvals.requested'), render: row => formatDate(row.requested_at) },
              { key: 'status', header: t('common.status'), render: row => <StatusBadge status={t(`status.${row.status}`, humanize(row.status))} /> },
              {
                key: 'actions',
                header: t('approvals.decision'),
                render: row => row.status === 'pending' ? (
                  <div className="inline-actions">
                    <button className="ghost-button compact-button" disabled={busyId === row.id} onClick={() => void handleDecision(row, 'approved')}>{t('approvals.approve')}</button>
                    <button className="ghost-button compact-button" disabled={busyId === row.id} onClick={() => void handleDecision(row, 'rejected')}>{t('approvals.reject')}</button>
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
                <h4>{t('approvals.selectedDetail')}</h4>
                <p>{selectedApproval.item_title}</p>
              </div>
              <button className="ghost-button small" type="button" onClick={() => setSelectedApproval(null)}>{t('common.clearSelection')}</button>
            </div>
            <div className="detail-grid">
              <div><span>{t('common.type')}</span><strong>{t(`itemType.${selectedApproval.item_type}`, humanize(selectedApproval.item_type))}</strong></div>
              <div><span>{t('common.status')}</span><strong>{t(`status.${selectedApproval.status}`, humanize(selectedApproval.status))}</strong></div>
              <div><span>{t('approvals.requestedBy')}</span><strong>{selectedApproval.requested_by_name || '—'}</strong></div>
              <div><span>{t('approvals.approver')}</span><strong>{selectedApproval.approver_name || '—'}</strong></div>
              <div><span>{t('approvals.requested')}</span><strong>{formatDate(selectedApproval.requested_at)}</strong></div>
              <div><span>{t('approvals.decisionPath')}</span><strong>{selectedApproval.status === 'pending' ? t('approvals.decisionPending') : t('approvals.decisionRecorded')}</strong></div>
            </div>
            <h5>{t('common.evidence')}</h5>
            <DataState loading={approvalEvidence.loading} error={approvalEvidence.error} empty={!approvalEvidence.data?.length} emptyMessage={t('approvals.noEvidence', 'No governed evidence is linked to this approval item.')}>
              <div className="governed-evidence-list">
                {(approvalEvidence.data || []).map(file => <GovernedEvidenceAccess key={file.id} evidenceId={file.id} fileName={file.file_name} fileType={file.file_type} fileSize={file.file_size} description={file.description} />)}
              </div>
            </DataState>
          </div>
        ) : null}
      </div>
    </section>
  );
}
