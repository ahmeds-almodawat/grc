import { useState } from 'react';
import { DataState } from '../components/DataState';
import { EntityTable } from '../components/EntityTable';
import { Modal } from '../components/Modal';
import { ModuleHeader } from '../components/ModuleHeader';
import { StatusBadge } from '../components/StatusBadge';
import { ApprovalRequestForm, EvidenceUploadForm, StatusUpdateForm, WorkControlButtons } from '../components/WorkItemControls';
import { formatDate, humanize } from '../lib/format';
import { getMyWork, getProfiles } from '../lib/grcApi';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import type { MyWorkRow } from '../types/domain';

type ActiveControl =
  | { mode: 'status'; row: MyWorkRow }
  | { mode: 'evidence'; row: MyWorkRow }
  | { mode: 'approval'; row: MyWorkRow }
  | null;

export function MyWork() {
  const { t } = useI18n();
  const work = useAsyncData(getMyWork, []);
  const profiles = useAsyncData(getProfiles, []);
  const [activeControl, setActiveControl] = useState<ActiveControl>(null);

  function closeAndRefresh() {
    setActiveControl(null);
    void work.refresh();
  }

  return (
    <section className="page-section">
      <ModuleHeader
        eyebrow={t('myWork.eyebrow')}
        title={t('myWork.title')}
        subtitle={t('myWork.subtitle')}
      />

      <div className="panel two-column">
        <div>
          <h4>{t('myWork.usageRule')}</h4>
          <p className="muted">{t('myWork.usageRuleText')}</p>
        </div>
        <div className="mini-card"><span>{t('myWork.escalation')}</span><strong>{t('myWork.escalationPath')}</strong></div>
      </div>

      <div className="panel">
        <div className="panel-header"><h4>{t('myWork.openWork')}</h4></div>
        <DataState loading={work.loading} error={work.error} empty={!work.data?.length}>
          <EntityTable<MyWorkRow>
            rows={work.data || []}
            getRowKey={row => `${row.item_type}-${row.id}`}
            columns={[
              { key: 'type', header: t('common.type'), render: row => t(`itemType.${row.item_type}`, humanize(row.item_type)) },
              { key: 'title', header: t('myWork.assignedWork'), render: row => <strong>{row.title}</strong> },
              { key: 'project', header: t('common.project'), render: row => row.project_title || '—' },
              { key: 'department', header: t('common.department'), render: row => row.department_name || t('common.companyWide') },
              { key: 'due', header: t('common.due'), render: row => formatDate(row.due_date) },
              { key: 'status', header: t('common.status'), render: row => <StatusBadge status={t(`status.${row.status}`, humanize(row.status))} /> },
              { key: 'progress', header: t('common.progress'), render: row => `${row.progress_percent ?? 0}%` },
              {
                key: 'actions',
                header: t('myWork.controls'),
                render: row => <WorkControlButtons onStatus={() => setActiveControl({ mode: 'status', row })} onEvidence={() => setActiveControl({ mode: 'evidence', row })} onApproval={() => setActiveControl({ mode: 'approval', row })} />
              }
            ]}
          />
        </DataState>
      </div>

      <Modal open={Boolean(activeControl)} title={activeControl ? activeControl.row.title : t('myWork.controlItem')} onClose={() => setActiveControl(null)}>
        {activeControl?.mode === 'status' ? (
          <StatusUpdateForm itemType={activeControl.row.item_type} itemId={activeControl.row.id} currentStatus={activeControl.row.status} currentProgress={activeControl.row.progress_percent} onCancel={() => setActiveControl(null)} onUpdated={closeAndRefresh} />
        ) : null}
        {activeControl?.mode === 'evidence' ? (
          <EvidenceUploadForm organizationId={activeControl.row.organization_id} itemType={activeControl.row.item_type} itemId={activeControl.row.id} onCancel={() => setActiveControl(null)} onUploaded={closeAndRefresh} />
        ) : null}
        {activeControl?.mode === 'approval' ? (
          <ApprovalRequestForm organizationId={activeControl.row.organization_id} itemType={activeControl.row.item_type} itemId={activeControl.row.id} profiles={profiles.data || []} onCancel={() => setActiveControl(null)} onRequested={closeAndRefresh} />
        ) : null}
      </Modal>
    </section>
  );
}
