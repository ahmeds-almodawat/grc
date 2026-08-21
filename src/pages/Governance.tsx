import { useState } from 'react';
import { DataState } from '../components/DataState';
import { EntityTable } from '../components/EntityTable';
import { DecisionForm } from '../components/GrcForms';
import { Modal } from '../components/Modal';
import { ModuleHeader } from '../components/ModuleHeader';
import { StatusBadge } from '../components/StatusBadge';
import { departmentName, formatDate, humanize, ownerName } from '../lib/format';
import { getDepartments, getGovernanceDecisions, getOrganizations, getProfiles } from '../lib/grcApi';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import type { GovernanceDecisionRow } from '../types/domain';

export function Governance() {
  const { t } = useI18n();
  const [formOpen, setFormOpen] = useState(false);
  const [decisionFormDirty, setDecisionFormDirty] = useState(false);
  const [decisionFormSubmitting, setDecisionFormSubmitting] = useState(false);
  const decisions = useAsyncData(getGovernanceDecisions, []);
  const departments = useAsyncData(getDepartments, []);
  const profiles = useAsyncData(getProfiles, []);
  const organizations = useAsyncData(getOrganizations, []);
  const organizationId = organizations.data?.[0]?.id || '';
  const decisionRows = decisions.data || [];
  const metrics = {
    register: decisionRows.length,
    highPriority: decisionRows.filter(r => r.priority === 'critical' || r.priority === 'high').length,
    overdue: decisionRows.filter(r => r.due_date && new Date(r.due_date).getTime() < Date.now() && r.status !== 'closed' && r.status !== 'completed').length,
    open: decisionRows.filter(r => r.status === 'open' || r.status === 'in_progress').length,
    closed: decisionRows.filter(r => r.status === 'closed' || r.status === 'completed').length,
  };

  const openDecisionForm = () => {
    setDecisionFormDirty(false);
    setDecisionFormSubmitting(false);
    setFormOpen(true);
  };

  const closeDecisionForm = () => {
    setFormOpen(false);
    setDecisionFormDirty(false);
    setDecisionFormSubmitting(false);
  };

  return (
    <section className="page-section">
      <ModuleHeader
        eyebrow={t('governance.eyebrow', 'Governance')}
        title={t('governance.title', 'Governance Decisions Register')}
        subtitle={t('governance.subtitle', 'Track decisions, owners, due dates, priority, status and follow-up.')}
        action={<button className="primary-button" onClick={openDecisionForm}>{t('governance.newDecision', 'New Decision')}</button>}
      />

      <div className="module-grid">
        <div className="module-card"><strong>{t('governance.totalDecisions', 'Total decisions')}</strong><span>{metrics.register} {t('governance.decisions', 'decisions')}</span></div>
        <div className="module-card danger"><strong>{t('governance.highPriority', 'High priority')}</strong><span>{metrics.highPriority} {t('governance.criticalHigh', 'critical/high')}</span></div>
        <div className="module-card danger"><strong>{t('common.overdue', 'Overdue')}</strong><span>{metrics.overdue} {t('common.overdue', 'overdue')}</span></div>
        <div className="module-card warning"><strong>{t('status.open', 'Open')}</strong><span>{metrics.open} {t('status.open', 'open')}</span></div>
        <div className="module-card good"><strong>{t('status.closed', 'Closed')}</strong><span>{metrics.closed} {t('status.closed', 'closed')}</span></div>
      </div>

      <div className="panel">
        <div className="panel-header"><h4>{t('governance.register', 'Governance decisions register')}</h4></div>
        <DataState loading={decisions.loading} error={decisions.error} empty={!decisions.data?.length}>
          <EntityTable<GovernanceDecisionRow>
            rows={decisions.data || []}
            getRowKey={row => row.id}
            columns={[
              { key: 'code', header: t('common.code', 'Code'), render: row => row.decision_code || '—' },
              { key: 'title', header: t('governance.decision', 'Decision'), render: row => <strong>{row.title}</strong> },
              { key: 'department', header: t('common.department', 'Department'), render: row => departmentName(row.departments) },
              { key: 'owner', header: t('common.owner', 'Owner'), render: row => ownerName(row.owner) },
              { key: 'due', header: t('common.due', 'Due'), render: row => formatDate(row.due_date) },
              { key: 'status', header: t('common.status', 'Status'), render: row => <StatusBadge status={humanize(row.status)} /> },
              { key: 'priority', header: t('common.priority', 'Priority'), render: row => humanize(row.priority) },
              { key: 'risk', header: t('common.risk', 'Risk'), render: row => <span className={`risk-pill ${row.risk_level}`}>{humanize(row.risk_level)}</span> }
            ]}
          />
        </DataState>
      </div>

      <Modal
        open={formOpen}
        title={t('governance.createTitle', 'Create governance decision')}
        isDirty={decisionFormDirty}
        isSubmitting={decisionFormSubmitting}
        onClose={closeDecisionForm}
      >
        <DecisionForm
          organizationId={organizationId}
          departments={departments.data || []}
          profiles={profiles.data || []}
          onDirtyChange={setDecisionFormDirty}
          onSubmittingChange={setDecisionFormSubmitting}
          onCancel={closeDecisionForm}
          onCreated={() => {
            closeDecisionForm();
            void decisions.refresh();
          }}
        />
      </Modal>
    </section>
  );
}
