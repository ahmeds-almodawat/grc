import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Landmark,
  Search,
} from 'lucide-react';
import { DataState } from '../components/DataState';
import { EntityTable } from '../components/EntityTable';
import { DecisionForm } from '../components/GrcForms';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { MetricCard } from '../components/ui/MetricCard';
import { PageHeader } from '../components/ui/PageHeader';
import { departmentName, formatDate, humanize, ownerName } from '../lib/format';
import { getDepartments, getGovernanceDecisions, getOrganizations, getProfiles } from '../lib/grcApi';
import {
  listGovernedPolicies,
  listGovernedSops,
  type GovernedPolicyCatalogRow,
  type GovernedSopCatalogRow,
} from '../lib/policySopApi';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import type { PageNavigator } from '../routes/pageLocation';
import type { GovernanceDecisionRow } from '../types/domain';

interface GovernanceProps {
  setPage: PageNavigator;
}

interface GovernedDocumentRow {
  id: string;
  kind: 'Policy' | 'SOP';
  code: string;
  title: string;
  status: string;
  departmentId: string | null;
  department: string | null;
  owner: string | null;
  version: string | null;
  nextReviewDate: string | null;
}

const activeStatuses = new Set(['approved', 'active']);
const pendingStatuses = new Set(['under_review', 'pending_approval']);

function daysUntil(value: string | null) {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
}

function toDocumentRow(
  row: GovernedPolicyCatalogRow | GovernedSopCatalogRow,
  kind: GovernedDocumentRow['kind'],
): GovernedDocumentRow {
  return {
    id: row.document_id,
    kind,
    code: row.document_code || 'UNASSIGNED',
    title: row.document_title,
    status: row.document_status,
    departmentId: row.department_id,
    department: row.department_name,
    owner: row.document_owner_name,
    version: row.version_label,
    nextReviewDate: row.next_review_date,
  };
}

export function Governance({ setPage }: GovernanceProps) {
  const { t } = useI18n();
  const [formOpen, setFormOpen] = useState(false);
  const [decisionFormDirty, setDecisionFormDirty] = useState(false);
  const [decisionFormSubmitting, setDecisionFormSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const decisions = useAsyncData(getGovernanceDecisions, []);
  const departments = useAsyncData(getDepartments, []);
  const profiles = useAsyncData(getProfiles, []);
  const organizations = useAsyncData(getOrganizations, []);
  const policies = useAsyncData(listGovernedPolicies, []);
  const sops = useAsyncData(listGovernedSops, []);
  const organizationId = organizations.data?.[0]?.id || '';
  const decisionRows = decisions.data || [];

  const documentRows = useMemo(() => [
    ...(policies.data || []).map((row) => toDocumentRow(row, 'Policy')),
    ...(sops.data || []).map((row) => toDocumentRow(row, 'SOP')),
  ], [policies.data, sops.data]);

  const filteredDocuments = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return documentRows.filter((row) => {
      if (query && !`${row.code} ${row.title} ${row.owner || ''}`.toLowerCase().includes(query)) return false;
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (departmentFilter !== 'all' && row.departmentId !== departmentFilter) return false;
      return true;
    });
  }, [departmentFilter, documentRows, searchTerm, statusFilter]);

  const metrics = {
    policies: policies.data?.length || 0,
    sops: sops.data?.length || 0,
    active: documentRows.filter((row) => activeStatuses.has(row.status)).length,
    pending: documentRows.filter((row) => pendingStatuses.has(row.status)).length,
    reviewsDue: documentRows.filter((row) => {
      const days = daysUntil(row.nextReviewDate);
      return days !== null && days >= 0 && days <= 30;
    }).length,
    overdue: documentRows.filter((row) => {
      const days = daysUntil(row.nextReviewDate);
      return days !== null && days < 0;
    }).length,
  };

  const statusOverview = [
    { label: t('status.active', 'Active / Effective'), value: metrics.active, tone: 'success' },
    { label: t('status.inReview', 'In review / approval'), value: metrics.pending, tone: 'info' },
    { label: t('governance.reviewsDue', 'Reviews due in 30 days'), value: metrics.reviewsDue, tone: 'warning' },
    { label: t('common.overdue', 'Overdue reviews'), value: metrics.overdue, tone: 'danger' },
  ];
  const maxOverviewValue = Math.max(1, ...statusOverview.map((item) => item.value));
  const documentsLoading = policies.loading || sops.loading;
  const documentsError = policies.error || sops.error;

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
    <section className="page-section ui2-governance-hub">
      <PageHeader
        eyebrow={t('governance.eyebrow', 'Governance command')}
        title={t('governance.hubTitle', 'Governance Hub')}
        subtitle={t('governance.hubSubtitle', 'Institutional policy, procedure, review, and decision oversight in one governed workspace.')}
        breadcrumbs={[{ label: t('nav.home', 'Home') }, { label: t('nav.governance', 'Governance') }]}
        icon={<Landmark size={20} />}
        actions={(
          <button className="platform-primary-button" type="button" onClick={openDecisionForm}>
            <ClipboardCheck size={15} />{t('governance.newDecision', 'New Decision')}
          </button>
        )}
      />

      <div className="platform-metric-grid ui2-governance-metrics">
        <MetricCard label={t('policy.totalPolicies', 'Governed Policies')} value={metrics.policies} icon={<FileText size={18} />} loading={policies.loading} onClick={() => setPage('documents')} />
        <MetricCard label={t('sop.totalSops', 'Standard Operating Procedures')} value={metrics.sops} icon={<BookOpen size={18} />} tone="purple" loading={sops.loading} onClick={() => setPage('sops')} />
        <MetricCard label={t('governance.pending', 'Pending review / approval')} value={metrics.pending} icon={<CalendarClock size={18} />} tone="info" loading={documentsLoading} onClick={() => setPage('approvals')} />
        <MetricCard label={t('governance.reviewsDue', 'Reviews due in 30 days')} value={metrics.reviewsDue} icon={<AlertTriangle size={18} />} tone="warning" loading={documentsLoading} onClick={() => setPage('smartReviews')} />
        <MetricCard label={t('common.overdue', 'Overdue reviews')} value={metrics.overdue} icon={<AlertTriangle size={18} />} tone="danger" loading={documentsLoading} onClick={() => setPage('smartReviews')} />
      </div>

      <div className="ui2-governance-grid">
        <section className="ui2-surface ui2-governance-overview" aria-labelledby="governance-status-title">
          <div className="ui2-section-heading">
            <div><p>{t('governance.documentControl', 'Document control')}</p><h2 id="governance-status-title">{t('governance.statusOverview', 'Lifecycle status overview')}</h2></div>
            <span>{documentRows.length} {t('governance.governedRecords', 'governed records')}</span>
          </div>
          <div className="ui2-status-overview">
            {statusOverview.map((item) => (
              <div className="ui2-status-row" key={item.label}>
                <span>{item.label}</span><strong>{item.value}</strong>
                <div aria-hidden="true"><span className={`is-${item.tone}`} style={{ width: `${Math.max(4, (item.value / maxOverviewValue) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
        </section>

        <section className="ui2-surface ui2-quick-access" aria-labelledby="governance-quick-title">
          <div className="ui2-section-heading"><div><p>{t('governance.workspace', 'Workspace')}</p><h2 id="governance-quick-title">{t('governance.quickAccess', 'Quick access')}</h2></div></div>
          <div className="ui2-quick-access__grid">
            <button type="button" onClick={() => setPage('documents')}><FileText size={17} /><span><strong>{t('nav.policies', 'Policy Register')}</strong><small>{metrics.policies} {t('governance.records', 'records')}</small></span><ArrowRight className="directional-icon" size={15} /></button>
            <button type="button" onClick={() => setPage('sops')}><BookOpen size={17} /><span><strong>{t('nav.sops', 'SOP Register')}</strong><small>{metrics.sops} {t('governance.records', 'records')}</small></span><ArrowRight className="directional-icon" size={15} /></button>
            <button type="button" onClick={() => setPage('smartReviews')}><CalendarClock size={17} /><span><strong>{t('governance.reviewCalendar', 'Review Calendar')}</strong><small>{metrics.reviewsDue + metrics.overdue} {t('governance.attentionItems', 'attention items')}</small></span><ArrowRight className="directional-icon" size={15} /></button>
            <button type="button" onClick={() => setPage('trainingGovernance')}><GraduationCap size={17} /><span><strong>{t('nav.trainingGovernance', 'Training Governance')}</strong><small>{t('governance.trainingLink', 'Linked obligations')}</small></span><ArrowRight className="directional-icon" size={15} /></button>
          </div>
        </section>
      </div>

      <section className="ui2-surface ui2-document-portfolio" aria-labelledby="governance-portfolio-title">
        <div className="ui2-section-heading">
          <div><p>{t('governance.portfolio', 'Governed portfolio')}</p><h2 id="governance-portfolio-title">{t('governance.documentRegister', 'Policy and SOP lifecycle register')}</h2></div>
          <span>{filteredDocuments.length} / {documentRows.length}</span>
        </div>
        <div className="ui2-filter-row">
          <label className="ui2-search-field"><Search size={15} /><span className="sr-only">{t('common.search', 'Search')}</span><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={t('governance.searchDocuments', 'Search code, title, or owner')} /></label>
          <label><span>{t('common.status', 'Status')}</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">{t('common.allStatuses', 'All statuses')}</option><option value="draft">{t('status.draft', 'Draft')}</option><option value="under_review">{t('status.underReview', 'Under review')}</option><option value="pending_approval">{t('status.pendingApproval', 'Pending approval')}</option><option value="approved">{t('status.approved', 'Approved')}</option><option value="active">{t('status.active', 'Active')}</option></select></label>
          <label><span>{t('common.department', 'Department')}</span><select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}><option value="all">{t('common.allDepartments', 'All departments')}</option>{(departments.data || []).map((department) => <option value={department.id} key={department.id}>{department.name_en}</option>)}</select></label>
        </div>
        <DataState loading={documentsLoading} error={documentsError} empty={!filteredDocuments.length}>
          <EntityTable<GovernedDocumentRow>
            rows={filteredDocuments}
            getRowKey={(row) => `${row.kind}-${row.id}`}
            columns={[
              { key: 'type', header: t('common.type', 'Type'), render: (row) => <span className={`ui2-document-kind is-${row.kind.toLowerCase()}`}>{row.kind}</span> },
              { key: 'document', header: t('governance.document', 'Document'), render: (row) => <button className="ui2-document-link" type="button" onClick={() => setPage(row.kind === 'Policy' ? 'documents' : 'sops')}><span>{row.code}</span><strong>{row.title}</strong></button> },
              { key: 'department', header: t('common.department', 'Department'), render: (row) => row.department ? <span className="ui2-inline-meta"><Building2 size={13} />{row.department}</span> : '—' },
              { key: 'owner', header: t('common.owner', 'Owner'), render: (row) => row.owner || '—' },
              { key: 'version', header: t('common.version', 'Version'), render: (row) => row.version || '—' },
              { key: 'review', header: t('common.nextReview', 'Next review'), render: (row) => formatDate(row.nextReviewDate) },
              { key: 'status', header: t('common.status', 'Status'), render: (row) => <StatusBadge status={humanize(row.status)} /> },
            ]}
          />
        </DataState>
      </section>

      <div className="ui2-governance-grid ui2-governance-grid--activity">
        <section className="ui2-surface" aria-labelledby="governance-decisions-title">
          <div className="ui2-section-heading"><div><p>{t('governance.decisions', 'Decisions')}</p><h2 id="governance-decisions-title">{t('governance.register', 'Governance decisions register')}</h2></div><span>{decisionRows.length}</span></div>
          <DataState loading={decisions.loading} error={decisions.error} empty={!decisionRows.length}>
            <EntityTable<GovernanceDecisionRow>
              rows={decisionRows}
              getRowKey={(row) => row.id}
              columns={[
                { key: 'code', header: t('common.code', 'Code'), render: (row) => row.decision_code || '—' },
                { key: 'title', header: t('governance.decision', 'Decision'), render: (row) => <strong>{row.title}</strong> },
                { key: 'department', header: t('common.department', 'Department'), render: (row) => departmentName(row.departments) },
                { key: 'owner', header: t('common.owner', 'Owner'), render: (row) => ownerName(row.owner) },
                { key: 'due', header: t('common.due', 'Due'), render: (row) => formatDate(row.due_date) },
                { key: 'status', header: t('common.status', 'Status'), render: (row) => <StatusBadge status={humanize(row.status)} /> },
              ]}
            />
          </DataState>
        </section>

        <aside className="ui2-surface ui2-activity-feed" aria-labelledby="governance-activity-title">
          <div className="ui2-section-heading"><div><p>{t('governance.monitoring', 'Monitoring')}</p><h2 id="governance-activity-title">{t('governance.recentActivity', 'Recent governed activity')}</h2></div><Activity size={17} /></div>
          {decisionRows.length ? (
            <ol>{decisionRows.slice(0, 6).map((decision) => (
              <li key={decision.id}>
                <span className={decision.status === 'completed' || decision.status === 'closed' ? 'is-complete' : 'is-open'}>{decision.status === 'completed' || decision.status === 'closed' ? <CheckCircle2 size={14} /> : <CalendarClock size={14} />}</span>
                <div><strong>{decision.title}</strong><small>{decision.decision_code || t('governance.decision', 'Decision')} · {formatDate(decision.due_date)}</small></div>
              </li>
            ))}</ol>
          ) : <p className="ui2-empty-copy">{t('governance.noActivity', 'No governed decision activity is available for the current scope.')}</p>}
        </aside>
      </div>

      <Modal open={formOpen} title={t('governance.createTitle', 'Create governance decision')} isDirty={decisionFormDirty} isSubmitting={decisionFormSubmitting} onClose={closeDecisionForm}>
        <DecisionForm
          organizationId={organizationId}
          departments={departments.data || []}
          profiles={profiles.data || []}
          onDirtyChange={setDecisionFormDirty}
          onSubmittingChange={setDecisionFormSubmitting}
          onCancel={closeDecisionForm}
          onCreated={() => { closeDecisionForm(); void decisions.refresh(); }}
        />
      </Modal>
    </section>
  );
}
