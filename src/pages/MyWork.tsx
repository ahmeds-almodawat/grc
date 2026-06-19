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
import type { MyWorkRow } from '../types/domain';

type ActiveControl =
  | { mode: 'status'; row: MyWorkRow }
  | { mode: 'evidence'; row: MyWorkRow }
  | { mode: 'approval'; row: MyWorkRow }
  | null;

export function MyWork() {
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
        eyebrow="Employee workspace"
        title="My assigned milestones, tasks, due dates and evidence requirements"
        subtitle="This view is designed for normal employees and task owners. They can update progress, upload evidence and request approval without seeing unrelated company work."
      />

      <div className="panel two-column">
        <div>
          <h4>Usage rule</h4>
          <p className="muted">Employees should not see all company projects. They should see only assigned work, comments, evidence requests and due dates.</p>
        </div>
        <div className="mini-card"><span>Escalation</span><strong>Due soon → Overdue → Manager → Sponsor</strong></div>
      </div>

      <div className="panel">
        <div className="panel-header"><h4>Open work</h4></div>
        <DataState loading={work.loading} error={work.error} empty={!work.data?.length}>
          <EntityTable<MyWorkRow>
            rows={work.data || []}
            getRowKey={row => `${row.item_type}-${row.id}`}
            columns={[
              { key: 'type', header: 'Type', render: row => humanize(row.item_type) },
              { key: 'title', header: 'Assigned Work', render: row => <strong>{row.title}</strong> },
              { key: 'project', header: 'Project', render: row => row.project_title || '—' },
              { key: 'department', header: 'Department', render: row => row.department_name || 'Company-wide' },
              { key: 'due', header: 'Due', render: row => formatDate(row.due_date) },
              { key: 'status', header: 'Status', render: row => <StatusBadge status={humanize(row.status)} /> },
              { key: 'progress', header: 'Progress', render: row => `${row.progress_percent ?? 0}%` },
              {
                key: 'actions',
                header: 'Controls',
                render: row => <WorkControlButtons onStatus={() => setActiveControl({ mode: 'status', row })} onEvidence={() => setActiveControl({ mode: 'evidence', row })} onApproval={() => setActiveControl({ mode: 'approval', row })} />
              }
            ]}
          />
        </DataState>
      </div>

      <Modal open={Boolean(activeControl)} title={activeControl ? activeControl.row.title : 'Control item'} onClose={() => setActiveControl(null)}>
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
