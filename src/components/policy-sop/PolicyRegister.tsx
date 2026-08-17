import { useState, useMemo } from 'react';
import { Search, Plus, Filter, RotateCcw, FileText, ChevronRight, AlertCircle, Building2, User, Calendar } from 'lucide-react';
import { GovernedPolicyCatalogRow } from '../../lib/policySopApi';
import { DocumentStatusBadge } from './DocumentStatusBadge';
import { DocumentVersionBadge } from './DocumentVersionBadge';
import { useI18n } from '../../i18n/I18nContext';

interface PolicyRegisterProps {
  policies: GovernedPolicyCatalogRow[];
  departments: Array<{ id: string; name: string; code: string }>;
  onSelectPolicy: (documentId: string, versionId?: string) => void;
  onCreatePolicy: () => void;
  loading?: boolean;
}

export function PolicyRegister({
  policies,
  departments,
  onSelectPolicy,
  onCreatePolicy,
  loading = false
}: PolicyRegisterProps) {
  const { t } = useI18n();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [reviewDueFilter, setReviewDueFilter] = useState<boolean>(false);
  const [sortField, setSortField] = useState<'document_code' | 'title' | 'effective_date' | 'status'>('document_code');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const filteredPolicies = useMemo(() => {
    return policies.filter(p => {
      // Search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const codeMatch = p.document_code?.toLowerCase().includes(query);
        const titleEnMatch = p.document_title?.toLowerCase().includes(query) || p.version_title_en?.toLowerCase().includes(query);
        const titleArMatch = p.version_title_ar?.includes(query);
        if (!codeMatch && !titleEnMatch && !titleArMatch) return false;
      }

      // Status
      if (statusFilter !== 'all' && p.document_status !== statusFilter) {
        return false;
      }

      // Department
      if (departmentFilter !== 'all' && p.department_id !== departmentFilter) {
        return false;
      }

      // Review Due within 30 days
      if (reviewDueFilter) {
        if (!p.next_review_date) return false;
        const reviewDate = new Date(p.next_review_date);
        const now = new Date();
        const diffDays = (reviewDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 30) return false;
      }

      return true;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortField === 'document_code') {
        comparison = (a.document_code || '').localeCompare(b.document_code || '');
      } else if (sortField === 'title') {
        comparison = (a.document_title || '').localeCompare(b.document_title || '');
      } else if (sortField === 'effective_date') {
        comparison = (a.effective_date || '').localeCompare(b.effective_date || '');
      } else if (sortField === 'status') {
        comparison = (a.document_status || '').localeCompare(b.document_status || '');
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [policies, searchTerm, statusFilter, departmentFilter, reviewDueFilter, sortField, sortDirection]);

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDepartmentFilter('all');
    setReviewDueFilter(false);
  };

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all' || departmentFilter !== 'all' || reviewDueFilter;

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={t('policy.register.searchPlaceholder', 'Search by policy number, English or Arabic title...')}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
          />
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={onCreatePolicy}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-sm transition-colors"
        >
          <Plus size={16} />
          {t('policy.register.newPolicy', 'New Policy')}
        </button>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">{t('policy.filter.allStatuses', 'All Statuses')}</option>
          <option value="draft">{t('policy.status.draft', 'Draft')}</option>
          <option value="under_review">{t('policy.status.under_review', 'Under Review')}</option>
          <option value="approved">{t('policy.status.approved', 'Approved')}</option>
          <option value="active">{t('policy.status.active', 'Active / Effective')}</option>
          <option value="superseded">{t('policy.status.superseded', 'Superseded')}</option>
          <option value="retired">{t('policy.status.retired', 'Retired')}</option>
        </select>

        {/* Department Filter */}
        <select
          value={departmentFilter}
          onChange={e => setDepartmentFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">{t('policy.filter.allDepartments', 'All Departments')}</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>
              {d.name} {d.code ? `(${d.code})` : ''}
            </option>
          ))}
        </select>

        {/* Review Due Button Filter */}
        <button
          type="button"
          onClick={() => setReviewDueFilter(!reviewDueFilter)}
          className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
            reviewDueFilter
              ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          {t('policy.filter.reviewDueOnly', 'Review Due Soon (< 30d)')}
        </button>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <RotateCcw size={12} />
            {t('common.clearFilters', 'Clear Filters')}
          </button>
        )}

        <span className="ml-auto text-xs text-slate-500 font-medium">
          {t('common.showingResults', `Showing ${filteredPolicies.length} of ${policies.length} policies`)}
        </span>
      </div>

      {/* Policy Table / Cards */}
      {loading ? (
        <div className="p-12 text-center text-slate-400">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent mb-3" />
          <p className="text-xs">{t('common.loading', 'Loading policies...')}</p>
        </div>
      ) : filteredPolicies.length === 0 ? (
        <div className="p-12 text-center border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm">
          <FileText size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {hasActiveFilters ? t('policy.register.noFilteredResults', 'No policies matching selected filters') : t('policy.register.emptyRegisterTitle', 'No Governed Policies Registered')}
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            {hasActiveFilters
              ? t('policy.register.tryAdjustingFilters', 'Try clearing or modifying your filter criteria.')
              : t('policy.register.emptyRegisterDesc', 'Create your first governed institutional policy to establish hospital-wide compliance standards.')}
          </p>
          {!hasActiveFilters && (
            <button
              type="button"
              onClick={onCreatePolicy}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors"
            >
              <Plus size={16} />
              {t('policy.register.newPolicy', 'New Policy')}
            </button>
          )}
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800 select-none">
                <tr>
                  <th className="py-3 px-4 w-36 cursor-pointer" onClick={() => { setSortField('document_code'); setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                    {t('policy.code', 'Policy Number')}
                  </th>
                  <th className="py-3 px-4 cursor-pointer" onClick={() => { setSortField('title'); setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                    {t('policy.title', 'Policy Title & Objectives')}
                  </th>
                  <th className="py-3 px-4 w-40">{t('common.department', 'Department')}</th>
                  <th className="py-3 px-4 w-32">{t('policy.owner', 'Owner')}</th>
                  <th className="py-3 px-4 w-28 cursor-pointer" onClick={() => { setSortField('status'); setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                    {t('common.status', 'Status')}
                  </th>
                  <th className="py-3 px-4 w-32 cursor-pointer" onClick={() => { setSortField('effective_date'); setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                    {t('policy.effectiveDate', 'Effective Date')}
                  </th>
                  <th className="py-3 px-4 w-12 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredPolicies.map(row => (
                  <tr
                    key={row.document_id}
                    onClick={() => onSelectPolicy(row.document_id, row.version_id || undefined)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors group"
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-indigo-700 dark:text-indigo-400">
                      {row.document_code || 'DRAFT'}
                      <div className="mt-0.5">
                        <DocumentVersionBadge versionLabel={row.version_label} versionNumber={row.version_number} isCurrent={row.is_current_version ?? false} />
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {row.document_title || row.version_title_en}
                      </div>
                      {row.version_title_ar && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5" dir="rtl">
                          {row.version_title_ar}
                        </div>
                      )}
                      {row.requirement_count > 0 && (
                        <div className="text-[10px] text-slate-400 mt-1">
                          {row.requirement_count} {t('policy.requirementsCount', 'governed requirements')}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {row.department_name ? (
                        <span className="inline-flex items-center gap-1">
                          <Building2 size={12} className="text-slate-400" />
                          {row.department_name}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">{t('common.unassigned', 'Unassigned')}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {row.document_owner_name ? (
                        <span className="inline-flex items-center gap-1">
                          <User size={12} className="text-slate-400" />
                          {row.document_owner_name}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">{t('common.unassigned', 'Unassigned')}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <DocumentStatusBadge status={row.document_status} effectiveDate={row.effective_date} />
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      <div>{row.effective_date || '—'}</div>
                      {row.next_review_date && (
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Calendar size={10} />
                          {t('policy.reviewDue', 'Review')}: {row.next_review_date}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-600 dark:text-slate-700 dark:group-hover:text-indigo-400 transition-colors inline-block" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
