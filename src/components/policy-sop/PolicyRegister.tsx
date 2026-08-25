import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Building2, Calendar, ChevronRight, Plus, User } from 'lucide-react';
import type { GovernedPolicyCatalogRow } from '../../lib/policySopApi';
import { useI18n } from '../../i18n/I18nContext';
import { StatusBadge } from '../StatusBadge';
import { FilterBar, SearchField } from '../ui/FilterBar';
import { Pagination, ResponsiveTable, type ResponsiveTableColumn } from '../ui/ResponsiveTable';
import { LoadingState, SystemState } from '../ui/SystemState';

interface PolicyRegisterProps {
  policies: GovernedPolicyCatalogRow[];
  departments: Array<{ id: string; name: string; code: string }>;
  onSelectPolicy: (documentId: string, versionId?: string) => void;
  onCreatePolicy: () => void;
  loading?: boolean;
}

type SortField = 'document_code' | 'title' | 'effective_date' | 'status';
const PAGE_SIZE = 8;

export function PolicyRegister({
  policies,
  departments,
  onSelectPolicy,
  onCreatePolicy,
  loading = false,
}: PolicyRegisterProps) {
  const { t } = useI18n();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [reviewDueFilter, setReviewDueFilter] = useState(false);
  const [sortField, setSortField] = useState<SortField>('document_code');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  const filteredPolicies = useMemo(() => policies.filter((policy) => {
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      const codeMatch = policy.document_code?.toLowerCase().includes(query);
      const titleEnMatch = policy.document_title?.toLowerCase().includes(query)
        || policy.version_title_en?.toLowerCase().includes(query);
      const titleArMatch = policy.version_title_ar?.includes(query);
      if (!codeMatch && !titleEnMatch && !titleArMatch) return false;
    }

    if (statusFilter !== 'all' && policy.document_status !== statusFilter) return false;
    if (departmentFilter !== 'all' && policy.department_id !== departmentFilter) return false;

    if (reviewDueFilter) {
      if (!policy.next_review_date) return false;
      const diffDays = (new Date(policy.next_review_date).getTime() - Date.now()) / (1000 * 3600 * 24);
      if (diffDays > 30) return false;
    }

    return true;
  }).sort((left, right) => {
    let comparison = 0;
    if (sortField === 'document_code') comparison = (left.document_code || '').localeCompare(right.document_code || '');
    if (sortField === 'title') comparison = (left.document_title || '').localeCompare(right.document_title || '');
    if (sortField === 'effective_date') comparison = (left.effective_date || '').localeCompare(right.effective_date || '');
    if (sortField === 'status') comparison = (left.document_status || '').localeCompare(right.document_status || '');
    return sortDirection === 'asc' ? comparison : -comparison;
  }), [policies, searchTerm, statusFilter, departmentFilter, reviewDueFilter, sortField, sortDirection]);

  const pageCount = Math.max(1, Math.ceil(filteredPolicies.length / PAGE_SIZE));
  const pageRows = filteredPolicies.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [departmentFilter, reviewDueFilter, searchTerm, sortDirection, sortField, statusFilter]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDepartmentFilter('all');
    setReviewDueFilter(false);
  };

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all' || departmentFilter !== 'all' || reviewDueFilter;
  const activeFilterCount = [statusFilter !== 'all', departmentFilter !== 'all', reviewDueFilter].filter(Boolean).length;

  const statusLabel = (status: GovernedPolicyCatalogRow['document_status']) => {
    const labels: Partial<Record<GovernedPolicyCatalogRow['document_status'], string>> = {
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
    return labels[status] ?? status.replaceAll('_', ' ');
  };

  const statusTone = (status: GovernedPolicyCatalogRow['document_status']) => {
    if (status === 'active' || status === 'approved') return 'success' as const;
    if (status === 'under_review' || status === 'pending_approval' || status === 'under_revision') return 'warning' as const;
    if (status === 'expired' || status === 'retired' || status === 'rejected' || status === 'cancelled') return 'danger' as const;
    if (status === 'draft') return 'info' as const;
    return 'neutral' as const;
  };

  const openPolicy = (row: GovernedPolicyCatalogRow) => onSelectPolicy(row.document_id, row.version_id || undefined);

  const columns: ResponsiveTableColumn<GovernedPolicyCatalogRow>[] = [
    {
      key: 'document_code',
      header: t('policy.code', 'Policy Number'),
      primary: true,
      className: 'platform-policy-code-column',
      render: (row) => (
        <button className="platform-table-link platform-policy-code" type="button" onClick={() => openPolicy(row)}>
          <strong>{row.document_code || 'DRAFT'}</strong>
          <small className={row.is_current_version ? 'is-current' : ''}>{row.version_label || row.version_number || '—'}</small>
        </button>
      ),
    },
    {
      key: 'title',
      header: t('policy.title', 'Policy Title & Objectives'),
      render: (row) => (
        <button className="platform-table-link platform-policy-title" type="button" onClick={() => openPolicy(row)}>
          <strong>{row.document_title || row.version_title_en}</strong>
          {row.version_title_ar ? <small dir="rtl">{row.version_title_ar}</small> : null}
          {row.requirement_count > 0 ? <small>{row.requirement_count} {t('policy.requirementsCount', 'governed requirements')}</small> : null}
        </button>
      ),
    },
    {
      key: 'department',
      header: t('common.department', 'Department'),
      render: (row) => row.department_name
        ? <span className="platform-table-meta"><Building2 size={12} aria-hidden="true" />{row.department_name}</span>
        : <span className="platform-muted-value">{t('common.unassigned', 'Unassigned')}</span>,
    },
    {
      key: 'owner',
      header: t('policy.owner', 'Owner'),
      hideOnMobile: true,
      render: (row) => row.document_owner_name
        ? <span className="platform-table-meta"><User size={12} aria-hidden="true" />{row.document_owner_name}</span>
        : <span className="platform-muted-value">{t('common.unassigned', 'Unassigned')}</span>,
    },
    {
      key: 'status',
      header: t('common.status', 'Status'),
      render: (row) => <StatusBadge status={statusLabel(row.document_status)} tone={statusTone(row.document_status)} />,
    },
    {
      key: 'effective_date',
      header: t('policy.effectiveDate', 'Effective Date'),
      render: (row) => (
        <span className="platform-policy-date">
          <span>{row.effective_date || '—'}</span>
          {row.next_review_date ? <small><Calendar size={10} aria-hidden="true" />{t('policy.reviewDue', 'Review')}: {row.next_review_date}</small> : null}
        </span>
      ),
    },
    {
      key: 'open',
      header: t('common.actions', 'Actions'),
      hideOnMobile: true,
      className: 'platform-table-action-column',
      render: (row) => (
        <button className="platform-icon-button directional-icon" type="button" onClick={() => openPolicy(row)} aria-label={`${t('common.open', 'Open')} ${row.document_code || row.document_title}`}>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      ),
    },
  ];

  return (
    <div className="platform-policy-register">
      <div className="platform-register-toolbar">
        <SearchField
          value={searchTerm}
          onChange={setSearchTerm}
          label={t('policy.register.searchLabel', 'Search policies')}
          placeholder={t('policy.register.searchPlaceholder', 'Search by policy number, English or Arabic title...')}
        />
        <button type="button" onClick={onCreatePolicy} className="platform-primary-button">
          <Plus size={15} aria-hidden="true" />
          <span>{t('policy.register.newPolicy', 'New Policy')}</span>
        </button>
      </div>

      <FilterBar
        activeCount={activeFilterCount}
        onReset={hasActiveFilters ? resetFilters : undefined}
        resetLabel={t('common.clearFilters', 'Clear Filters')}
      >
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label={t('policy.filter.statusLabel', 'Filter by status')}>
          <option value="all">{t('policy.filter.allStatuses', 'All Statuses')}</option>
          <option value="draft">{t('policy.status.draft', 'Draft')}</option>
          <option value="under_review">{t('policy.status.under_review', 'Under Review')}</option>
          <option value="approved">{t('policy.status.approved', 'Approved')}</option>
          <option value="active">{t('policy.status.active', 'Active / Effective')}</option>
          <option value="superseded">{t('policy.status.superseded', 'Superseded')}</option>
          <option value="retired">{t('policy.status.retired', 'Retired')}</option>
        </select>
        <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} aria-label={t('policy.filter.departmentLabel', 'Filter by department')}>
          <option value="all">{t('policy.filter.allDepartments', 'All Departments')}</option>
          {departments.map((department) => <option key={department.id} value={department.id}>{department.name} {department.code ? `(${department.code})` : ''}</option>)}
        </select>
        <button type="button" onClick={() => setReviewDueFilter((value) => !value)} className={`platform-secondary-button ${reviewDueFilter ? 'is-active' : ''}`} aria-pressed={reviewDueFilter}>
          {t('policy.filter.reviewDueOnly', 'Review Due Soon (< 30d)')}
        </button>
        <select value={sortField} onChange={(event) => setSortField(event.target.value as SortField)} aria-label={t('policy.sort.label', 'Sort policies')}>
          <option value="document_code">{t('policy.code', 'Policy Number')}</option>
          <option value="title">{t('policy.title', 'Policy Title')}</option>
          <option value="effective_date">{t('policy.effectiveDate', 'Effective Date')}</option>
          <option value="status">{t('common.status', 'Status')}</option>
        </select>
        <button type="button" className="platform-icon-button" onClick={() => setSortDirection((value) => value === 'asc' ? 'desc' : 'asc')} aria-label={sortDirection === 'asc' ? t('common.sortDescending', 'Sort descending') : t('common.sortAscending', 'Sort ascending')}>
          {sortDirection === 'asc' ? <ArrowUp size={15} aria-hidden="true" /> : <ArrowDown size={15} aria-hidden="true" />}
        </button>
        <span className="platform-register-result-count">{t('common.showingResults', `Showing ${filteredPolicies.length} of ${policies.length} policies`)}</span>
      </FilterBar>

      {loading ? (
        <LoadingState label={t('common.loading', 'Loading policies...')} />
      ) : filteredPolicies.length === 0 ? (
        <SystemState
          variant={hasActiveFilters ? 'no-results' : 'empty'}
          title={hasActiveFilters ? t('policy.register.noFilteredResults', 'No policies matching selected filters') : t('policy.register.emptyRegisterTitle', 'No Governed Policies Registered')}
          message={hasActiveFilters ? t('policy.register.tryAdjustingFilters', 'Try clearing or modifying your filter criteria.') : t('policy.register.emptyRegisterDesc', 'Create your first governed institutional policy to establish hospital-wide compliance standards.')}
          action={!hasActiveFilters ? <button type="button" onClick={onCreatePolicy} className="platform-primary-button"><Plus size={15} aria-hidden="true" />{t('policy.register.newPolicy', 'New Policy')}</button> : undefined}
        />
      ) : (
        <>
          <ResponsiveTable
            columns={columns}
            rows={pageRows}
            getRowKey={(row) => row.document_id}
            ariaLabel={t('policy.register.tableLabel', 'Governed policy register')}
            renderMobileActions={(row) => (
              <button className="platform-icon-button directional-icon" type="button" onClick={() => openPolicy(row)} aria-label={`${t('common.open', 'Open')} ${row.document_code || row.document_title}`}>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            )}
          />
          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label={t('policy.register.pagination', 'Policy register pagination')} summary={t('common.pageSummary', `Page ${page} of ${pageCount} · ${filteredPolicies.length} records`)} />
        </>
      )}
    </div>
  );
}
