import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Building2,
  Calendar,
  ChevronRight,
  GraduationCap,
  Layers,
  Plus,
  User,
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import type { GovernedSopCatalogRow } from '../../lib/policySopApi';
import { StatusBadge } from '../StatusBadge';
import { FilterBar, SearchField } from '../ui/FilterBar';
import { Pagination, ResponsiveTable, type ResponsiveTableColumn } from '../ui/ResponsiveTable';
import { LoadingState, SystemState } from '../ui/SystemState';
import { DocumentVersionBadge } from './DocumentVersionBadge';

interface SopRegisterProps {
  sops: GovernedSopCatalogRow[];
  departments: Array<{ id: string; name: string; code: string }>;
  onSelectSop: (sop: GovernedSopCatalogRow) => void;
  onCreateSop: () => void;
  loading?: boolean;
}

type SortField = 'code' | 'title' | 'effective_date' | 'review_date' | 'status';
const PAGE_SIZE = 8;

export function SopRegister({ sops, departments, onSelectSop, onCreateSop, loading = false }: SopRegisterProps) {
  const { t } = useI18n();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [linkStateFilter, setLinkStateFilter] = useState('all');
  const [trainingFilter, setTrainingFilter] = useState('all');
  const [reviewDueFilter, setReviewDueFilter] = useState(false);
  const [sortField, setSortField] = useState<SortField>('code');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  const filteredSops = useMemo(() => sops.filter((sop) => {
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      const value = `${sop.document_code || ''} ${sop.title_en || sop.document_title || ''} ${sop.title_ar || ''} ${sop.process_name_en || ''} ${sop.process_name_ar || ''} ${sop.primary_policy_document_code || ''}`.toLowerCase();
      if (!value.includes(query)) return false;
    }
    if (statusFilter !== 'all' && sop.document_status !== statusFilter) return false;
    if (departmentFilter !== 'all' && sop.department_id !== departmentFilter) return false;
    if (linkStateFilter !== 'all' && sop.governance_link_state !== linkStateFilter) return false;
    if (trainingFilter === 'required' && !sop.training_required) return false;
    if (trainingFilter === 'not_required' && sop.training_required) return false;
    if (reviewDueFilter) {
      if (!sop.next_review_date) return false;
      const daysUntilReview = (new Date(sop.next_review_date).getTime() - Date.now()) / 86_400_000;
      if (daysUntilReview > 30) return false;
    }
    return true;
  }).sort((left, right) => {
    let comparison = 0;
    if (sortField === 'code') comparison = (left.document_code || '').localeCompare(right.document_code || '');
    if (sortField === 'title') comparison = (left.title_en || left.document_title || '').localeCompare(right.title_en || right.document_title || '');
    if (sortField === 'effective_date') comparison = (left.effective_date || '').localeCompare(right.effective_date || '');
    if (sortField === 'review_date') comparison = (left.next_review_date || '').localeCompare(right.next_review_date || '');
    if (sortField === 'status') comparison = left.document_status.localeCompare(right.document_status);
    return sortDirection === 'asc' ? comparison : -comparison;
  }), [departmentFilter, linkStateFilter, reviewDueFilter, searchTerm, sops, sortDirection, sortField, statusFilter, trainingFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredSops.length / PAGE_SIZE));
  const pageRows = filteredSops.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [departmentFilter, linkStateFilter, reviewDueFilter, searchTerm, sortDirection, sortField, statusFilter, trainingFilter]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const hasActiveFilters = Boolean(searchTerm.trim() || statusFilter !== 'all' || departmentFilter !== 'all' || linkStateFilter !== 'all' || trainingFilter !== 'all' || reviewDueFilter);
  const activeFilterCount = [statusFilter !== 'all', departmentFilter !== 'all', linkStateFilter !== 'all', trainingFilter !== 'all', reviewDueFilter].filter(Boolean).length;
  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDepartmentFilter('all');
    setLinkStateFilter('all');
    setTrainingFilter('all');
    setReviewDueFilter(false);
  };

  const statusLabel = (status: GovernedSopCatalogRow['document_status']) => {
    const labels: Partial<Record<GovernedSopCatalogRow['document_status'], string>> = {
      draft: t('policy.status.draft', 'Draft'),
      under_review: t('policy.status.under_review', 'Under Review'),
      pending_approval: t('policy.status.pending_approval', 'Pending Approval'),
      approved: t('policy.status.approved', 'Approved'),
      active: t('policy.status.active', 'Active / Effective'),
      under_revision: t('policy.status.under_revision', 'Under Revision'),
      expired: t('policy.status.expired', 'Expired'),
      superseded: t('policy.status.superseded', 'Superseded'),
      retired: t('policy.status.retired', 'Retired'),
      rejected: t('policy.status.rejected', 'Rejected'),
      cancelled: t('policy.status.cancelled', 'Cancelled'),
    };
    return labels[status] || status.replaceAll('_', ' ');
  };

  const statusTone = (status: GovernedSopCatalogRow['document_status']) => {
    if (status === 'active' || status === 'approved') return 'success' as const;
    if (status === 'under_review' || status === 'pending_approval' || status === 'under_revision') return 'warning' as const;
    if (status === 'expired' || status === 'retired' || status === 'rejected' || status === 'cancelled') return 'danger' as const;
    if (status === 'draft') return 'info' as const;
    return 'neutral' as const;
  };

  const columns: ResponsiveTableColumn<GovernedSopCatalogRow>[] = [
    {
      key: 'code',
      header: t('sop.code', 'SOP Number'),
      primary: true,
      render: (row) => <button className="platform-table-link platform-policy-code" type="button" onClick={() => onSelectSop(row)}><strong>{row.document_code || 'DRAFT'}</strong><small>{row.version_label || row.version_number || '—'}</small></button>,
    },
    {
      key: 'title',
      header: t('sop.titleAndProcess', 'SOP Title & Process'),
      render: (row) => <button className="platform-table-link platform-policy-title" type="button" onClick={() => onSelectSop(row)}><strong>{row.title_en || row.document_title}</strong>{row.title_ar ? <small dir="rtl">{row.title_ar}</small> : null}<small>{row.process_name_en || '—'}{row.department_name ? ` · ${row.department_name}` : ''}</small></button>,
    },
    {
      key: 'policy',
      header: t('sop.governingPolicy', 'Governing Policy'),
      render: (row) => row.governance_link_state === 'linked' && row.primary_policy_document_code ? <span className="platform-sop-policy-link"><BookOpen size={13} />{row.primary_policy_document_code}<small>v{row.primary_policy_version_number || 1}.0</small></span> : <StatusBadge status={row.governance_link_state || 'not applicable'} tone={row.governance_link_state === 'legacy_pending' ? 'warning' : 'neutral'} />,
    },
    {
      key: 'owner',
      header: t('policy.owner', 'Owner'),
      hideOnMobile: true,
      render: (row) => <span className="platform-table-meta"><User size={12} />{row.process_owner_name || row.document_owner_name || t('common.unassigned', 'Unassigned')}</span>,
    },
    {
      key: 'execution',
      header: t('sop.stepsAndTraining', 'Steps & Training'),
      render: (row) => <span className="platform-sop-execution"><span><Layers size={12} />{row.step_count || 0} {t('sop.stepsCount', 'steps')}</span>{row.training_required ? <span><GraduationCap size={12} />{t('sop.training.badge', 'Training')}</span> : null}</span>,
    },
    {
      key: 'version',
      header: t('common.version', 'Version'),
      hideOnMobile: true,
      render: (row) => <DocumentVersionBadge versionLabel={row.version_label || `${row.version_number}.0`} isCurrent={row.is_current_version ?? false} />,
    },
    {
      key: 'review',
      header: t('common.nextReview', 'Next review'),
      render: (row) => <span className="platform-policy-date"><span>{row.next_review_date || '—'}</span>{row.effective_date ? <small><Calendar size={10} />{t('policy.effectiveDate', 'Effective')}: {row.effective_date}</small> : null}</span>,
    },
    {
      key: 'status',
      header: t('common.status', 'Status'),
      render: (row) => <StatusBadge status={statusLabel(row.document_status)} tone={statusTone(row.document_status)} />,
    },
    {
      key: 'open',
      header: t('common.actions', 'Actions'),
      hideOnMobile: true,
      className: 'platform-table-action-column',
      render: (row) => <button className="platform-icon-button directional-icon" type="button" onClick={() => onSelectSop(row)} aria-label={`${t('common.open', 'Open')} ${row.document_code || row.document_title}`}><ChevronRight size={16} /></button>,
    },
  ];

  return (
    <div className="platform-policy-register platform-sop-register">
      <div className="platform-register-toolbar">
        <SearchField value={searchTerm} onChange={setSearchTerm} label={t('sop.register.searchLabel', 'Search SOPs')} placeholder={t('sop.register.searchPlaceholder', 'Search SOP number, title, process, or governing policy...')} />
        <button type="button" onClick={onCreateSop} className="platform-primary-button"><Plus size={15} /><span>{t('sop.register.newSop', 'New SOP')}</span></button>
      </div>

      <FilterBar activeCount={activeFilterCount} onReset={hasActiveFilters ? resetFilters : undefined} resetLabel={t('common.clearFilters', 'Clear Filters')} advancedLabel={t('common.advancedFilters', 'Advanced filters')} advanced={(
        <>
          <select value={trainingFilter} onChange={(event) => setTrainingFilter(event.target.value)} aria-label={t('sop.filter.trainingLabel', 'Filter by training requirement')}><option value="all">{t('sop.filter.allTraining', 'All training states')}</option><option value="required">{t('sop.training.requiredOnly', 'Training required')}</option><option value="not_required">{t('sop.training.noneRequired', 'Training not required')}</option></select>
        </>
      )}>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label={t('policy.filter.statusLabel', 'Filter by status')}><option value="all">{t('policy.filter.allStatuses', 'All statuses')}</option><option value="draft">{t('policy.status.draft', 'Draft')}</option><option value="under_review">{t('policy.status.under_review', 'Under Review')}</option><option value="pending_approval">{t('policy.status.pending_approval', 'Pending Approval')}</option><option value="approved">{t('policy.status.approved', 'Approved')}</option><option value="active">{t('policy.status.active', 'Active')}</option><option value="retired">{t('policy.status.retired', 'Retired')}</option></select>
        <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} aria-label={t('policy.filter.departmentLabel', 'Filter by department')}><option value="all">{t('policy.filter.allDepartments', 'All departments')}</option>{departments.map((department) => <option value={department.id} key={department.id}>{department.name} {department.code ? `(${department.code})` : ''}</option>)}</select>
        <button type="button" className={`platform-secondary-button ${reviewDueFilter ? 'is-active' : ''}`} onClick={() => setReviewDueFilter((value) => !value)} aria-pressed={reviewDueFilter}>{t('policy.filter.reviewDueOnly', 'Review due soon (< 30d)')}</button>
        <select value={linkStateFilter} onChange={(event) => setLinkStateFilter(event.target.value)} aria-label={t('sop.filter.linkStateLabel', 'Policy Linkage')}><option value="all">{t('sop.filter.allLinkStates', 'All policy link states')}</option><option value="linked">{t('sop.linkState.linked', 'Linked')}</option><option value="legacy_pending">{t('sop.linkState.legacy_pending', 'Legacy pending')}</option><option value="not_applicable">{t('sop.linkState.not_applicable', 'Not applicable')}</option></select>
        <select value={sortField} onChange={(event) => setSortField(event.target.value as SortField)} aria-label={t('sop.sort.label', 'Sort SOPs')}><option value="code">{t('sop.code', 'SOP Number')}</option><option value="title">{t('policy.title', 'Title')}</option><option value="effective_date">{t('policy.effectiveDate', 'Effective date')}</option><option value="review_date">{t('common.nextReview', 'Next review')}</option><option value="status">{t('common.status', 'Status')}</option></select>
        <button type="button" className="platform-icon-button" onClick={() => setSortDirection((value) => value === 'asc' ? 'desc' : 'asc')} aria-label={sortDirection === 'asc' ? t('common.sortDescending', 'Sort descending') : t('common.sortAscending', 'Sort ascending')}>{sortDirection === 'asc' ? <ArrowUp size={15} /> : <ArrowDown size={15} />}</button>
        <span className="platform-register-result-count">{t('common.showingResults', `Showing ${filteredSops.length} of ${sops.length} SOPs`)}</span>
      </FilterBar>

      {loading ? <LoadingState label={t('common.loading', 'Loading SOPs...')} /> : filteredSops.length === 0 ? (
        <SystemState variant={hasActiveFilters ? 'no-results' : 'empty'} title={hasActiveFilters ? t('sop.register.noSopsFound', 'No SOPs match selected filters') : t('sop.register.emptyTitle', 'No Governed SOPs Registered')} message={hasActiveFilters ? t('sop.register.tryChangingFilters', 'Try clearing or modifying your filter criteria.') : t('sop.register.emptyPrompt', 'Create the first governed SOP to document exact operational execution.')} action={!hasActiveFilters ? <button type="button" className="platform-primary-button" onClick={onCreateSop}><Plus size={15} />{t('sop.register.newSop', 'New SOP')}</button> : undefined} />
      ) : (
        <>
          <ResponsiveTable columns={columns} rows={pageRows} getRowKey={(row) => row.document_id} ariaLabel={t('sop.register.tableLabel', 'Governed SOP register')} renderMobileActions={(row) => <button className="platform-icon-button directional-icon" type="button" onClick={() => onSelectSop(row)} aria-label={`${t('common.open', 'Open')} ${row.document_code || row.document_title}`}><ChevronRight size={16} /></button>} />
          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label={t('sop.register.pagination', 'SOP register pagination')} summary={t('common.pageSummary', `Page ${page} of ${pageCount} · ${filteredSops.length} records`)} />
        </>
      )}
    </div>
  );
}
