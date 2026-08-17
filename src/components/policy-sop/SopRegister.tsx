import { useState, useMemo } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import type { GovernedSopCatalogRow } from '../../lib/policySopApi';
import { DocumentStatusBadge } from './DocumentStatusBadge';
import { DocumentVersionBadge } from './DocumentVersionBadge';
import { 
  FileText, 
  Search, 
  Filter, 
  Plus, 
  RotateCcw, 
  GraduationCap, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  BookOpen
} from 'lucide-react';

interface SopRegisterProps {
  sops: GovernedSopCatalogRow[];
  departments: Array<{ id: string; name: string; code: string }>;
  onSelectSop: (sop: GovernedSopCatalogRow) => void;
  onCreateSop: () => void;
  loading?: boolean;
}

export function SopRegister({
  sops,
  departments,
  onSelectSop,
  onCreateSop,
  loading = false,
}: SopRegisterProps) {
  const { t } = useI18n();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [linkStateFilter, setLinkStateFilter] = useState('all');
  const [trainingFilter, setTrainingFilter] = useState('all');
  const [reviewDueFilter, setReviewDueFilter] = useState(false);
  const [sortBy, setSortBy] = useState<'code' | 'title' | 'effective_date' | 'review_date' | 'status'>('code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filteredSops = useMemo(() => {
    return sops.filter((sop) => {
      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesCode = sop.document_code?.toLowerCase().includes(query);
        const matchesEn = sop.title_en?.toLowerCase().includes(query) || sop.document_title?.toLowerCase().includes(query);
        const matchesAr = sop.title_ar?.toLowerCase().includes(query);
        const matchesProcess = sop.process_name_en?.toLowerCase().includes(query) || sop.process_name_ar?.toLowerCase().includes(query);
        const matchesPolicy = sop.primary_policy_document_code?.toLowerCase().includes(query);
        if (!matchesCode && !matchesEn && !matchesAr && !matchesProcess && !matchesPolicy) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all' && sop.document_status !== statusFilter) {
        return false;
      }

      // Department filter
      if (departmentFilter !== 'all' && sop.department_id !== departmentFilter) {
        return false;
      }

      // Link state filter
      if (linkStateFilter !== 'all' && sop.governance_link_state !== linkStateFilter) {
        return false;
      }

      // Training filter
      if (trainingFilter === 'required' && !sop.training_required) return false;
      if (trainingFilter === 'not_required' && sop.training_required) return false;

      // Review due filter (< 30 days or past)
      if (reviewDueFilter) {
        if (!sop.next_review_date) return false;
        const reviewDate = new Date(sop.next_review_date);
        const now = new Date();
        const daysUntilReview = (reviewDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
        if (daysUntilReview > 30) return false;
      }

      return true;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'code') {
        comparison = (a.document_code || '').localeCompare(b.document_code || '');
      } else if (sortBy === 'title') {
        comparison = (a.title_en || a.document_title || '').localeCompare(b.title_en || b.document_title || '');
      } else if (sortBy === 'effective_date') {
        comparison = (a.effective_date || '').localeCompare(b.effective_date || '');
      } else if (sortBy === 'review_date') {
        comparison = (a.next_review_date || '').localeCompare(b.next_review_date || '');
      } else if (sortBy === 'status') {
        comparison = (a.document_status || '').localeCompare(b.document_status || '');
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [sops, searchTerm, statusFilter, departmentFilter, linkStateFilter, trainingFilter, reviewDueFilter, sortBy, sortOrder]);

  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
    statusFilter !== 'all' ||
    departmentFilter !== 'all' ||
    linkStateFilter !== 'all' ||
    trainingFilter !== 'all' ||
    reviewDueFilter
  );

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDepartmentFilter('all');
    setLinkStateFilter('all');
    setTrainingFilter('all');
    setReviewDueFilter(false);
  };

  return (
    <div className="space-y-6">
      {/* Register Controls Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800 backdrop-blur-sm">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('sop.register.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
          />
        </div>

        {/* New SOP Action Button */}
        <button
          onClick={onCreateSop}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg shadow-sm transition-all shadow-indigo-500/20 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>{t('sop.register.newSop')}</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 p-4 bg-slate-900/30 rounded-xl border border-slate-800/80">
        {/* Status Dropdown */}
        <div>
          <label htmlFor="sop-filter-status" className="block text-xs font-semibold text-slate-400 mb-1">
            {t('policy.filter.statusLabel')}
          </label>
          <select
            id="sop-filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">{t('policy.filter.allStatuses')}</option>
            <option value="draft">{t('policy.status.draft')}</option>
            <option value="under_review">{t('policy.status.under_review')}</option>
            <option value="approved">{t('policy.status.approved')}</option>
            <option value="active">{t('policy.status.active')}</option>
            <option value="superseded">{t('policy.status.superseded')}</option>
            <option value="retired">{t('policy.status.retired')}</option>
          </select>
        </div>

        {/* Department Dropdown */}
        <div>
          <label htmlFor="sop-filter-department" className="block text-xs font-semibold text-slate-400 mb-1">
            {t('policy.filter.departmentLabel')}
          </label>
          <select
            id="sop-filter-department"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">{t('policy.filter.allDepartments')}</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name} ({dept.code})
              </option>
            ))}
          </select>
        </div>

        {/* Policy Linkage Dropdown */}
        <div>
          <label htmlFor="sop-filter-link-state" className="block text-xs font-semibold text-slate-400 mb-1">
            {t('sop.filter.linkStateLabel')}
          </label>
          <select
            id="sop-filter-link-state"
            value={linkStateFilter}
            onChange={(e) => setLinkStateFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">{t('sop.filter.allLinkStates')}</option>
            <option value="linked">{t('sop.linkState.linked')}</option>
            <option value="legacy_pending">{t('sop.linkState.legacy_pending')}</option>
            <option value="not_applicable">{t('sop.linkState.not_applicable')}</option>
          </select>
        </div>

        {/* Training Requirement Dropdown */}
        <div>
          <label htmlFor="sop-filter-training" className="block text-xs font-semibold text-slate-400 mb-1">
            {t('sop.filter.trainingLabel')}
          </label>
          <select
            id="sop-filter-training"
            value={trainingFilter}
            onChange={(e) => setTrainingFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">{t('sop.filter.allTraining')}</option>
            <option value="required">{t('sop.training.requiredOnly')}</option>
            <option value="not_required">{t('sop.training.noneRequired')}</option>
          </select>
        </div>

        {/* Review Due & Reset */}
        <div className="flex items-end gap-2">
          <label className="flex-1 flex items-center gap-2 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 cursor-pointer hover:bg-slate-900 transition-colors select-none">
            <input
              type="checkbox"
              checked={reviewDueFilter}
              onChange={(e) => setReviewDueFilter(e.target.checked)}
              className="rounded border-slate-700 text-indigo-600 focus:ring-0 w-3.5 h-3.5"
            />
            <span>{t('policy.filter.reviewDueOnly')}</span>
          </label>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              title={t('common.resetFilters')}
              className="p-2 text-slate-400 hover:text-slate-200 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Results Meta */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <div>
          <span>{filteredSops.length}</span> {t('sop.register.resultsCount')}
        </div>
        <div className="flex items-center gap-2">
          <span>{t('common.sortBy')}:</span>
          <button
            onClick={() => {
              if (sortBy === 'code') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
              else { setSortBy('code'); setSortOrder('asc'); }
            }}
            className={`px-2 py-0.5 rounded ${sortBy === 'code' ? 'text-indigo-400 bg-indigo-950/50 border border-indigo-800/60' : 'hover:text-slate-200'}`}
          >
            {t('policy.code')} {sortBy === 'code' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button
            onClick={() => {
              if (sortBy === 'title') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
              else { setSortBy('title'); setSortOrder('asc'); }
            }}
            className={`px-2 py-0.5 rounded ${sortBy === 'title' ? 'text-indigo-400 bg-indigo-950/50 border border-indigo-800/60' : 'hover:text-slate-200'}`}
          >
            {t('policy.title')} {sortBy === 'title' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button
            onClick={() => {
              if (sortBy === 'effective_date') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
              else { setSortBy('effective_date'); setSortOrder('desc'); }
            }}
            className={`px-2 py-0.5 rounded ${sortBy === 'effective_date' ? 'text-indigo-400 bg-indigo-950/50 border border-indigo-800/60' : 'hover:text-slate-200'}`}
          >
            {t('policy.effectiveDate')} {sortBy === 'effective_date' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
        </div>
      </div>

      {/* SOPs Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">{t('sop.code')}</th>
                <th className="py-3.5 px-4">{t('sop.titleAndProcess')}</th>
                <th className="py-3.5 px-4">{t('sop.governingPolicy')}</th>
                <th className="py-3.5 px-4">{t('policy.owner')}</th>
                <th className="py-3.5 px-4">{t('sop.stepsAndTraining')}</th>
                <th className="py-3.5 px-4">{t('policy.version')}</th>
                <th className="py-3.5 px-4">{t('policy.status')}</th>
                <th className="py-3.5 px-4 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {filteredSops.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText className="w-8 h-8 text-slate-600 stroke-[1.5]" />
                      <p className="text-sm font-medium text-slate-300">{t('sop.register.noSopsFound')}</p>
                      <p className="text-xs text-slate-500 max-w-sm">
                        {hasActiveFilters ? t('sop.register.tryChangingFilters') : t('sop.register.emptyPrompt')}
                      </p>
                      {!hasActiveFilters && (
                        <button
                          onClick={onCreateSop}
                          className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{t('sop.register.newSop')}</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSops.map((sop) => {
                  const isReviewOverdue = sop.next_review_date && new Date(sop.next_review_date) < new Date();
                  return (
                    <tr
                      key={sop.document_id}
                      onClick={() => onSelectSop(sop)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      {/* SOP Number */}
                      <td className="py-3.5 px-4 font-mono text-xs font-medium text-indigo-300 group-hover:text-indigo-200">
                        {sop.document_code || 'UNASSIGNED'}
                      </td>

                      {/* Title & Process Name */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-200 group-hover:text-white line-clamp-1">
                          {sop.title_en || sop.document_title}
                        </div>
                        {sop.title_ar && (
                          <div className="text-xs text-slate-400 line-clamp-1" dir="rtl">
                            {sop.title_ar}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                          <span className="text-slate-500">{t('sop.process')}:</span>
                          <span className="text-slate-300">{sop.process_name_en || '—'}</span>
                          {sop.department_name && (
                            <span className="text-slate-500">• {sop.department_name}</span>
                          )}
                        </div>
                      </td>

                      {/* Governing Policy */}
                      <td className="py-3.5 px-4">
                        {sop.governance_link_state === 'linked' && sop.primary_policy_document_code ? (
                          <div className="flex items-center gap-1.5 text-xs text-indigo-300 bg-indigo-950/40 px-2 py-1 rounded border border-indigo-900/50 max-w-[200px] truncate">
                            <BookOpen className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
                            <span className="font-mono">{sop.primary_policy_document_code}</span>
                            <span className="text-slate-400 text-[10px]">v{sop.primary_policy_version_number || 1}.0</span>
                          </div>
                        ) : sop.governance_link_state === 'legacy_pending' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-950/50 text-amber-300 border border-amber-800/40">
                            <AlertCircle className="w-3 h-3 text-amber-400" />
                            {t('sop.linkState.legacy_pending')}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">
                            {t('sop.linkState.not_applicable')}
                          </span>
                        )}
                      </td>

                      {/* Process Owner / Custodian */}
                      <td className="py-3.5 px-4 text-xs text-slate-300">
                        <div>{sop.process_owner_name || sop.document_owner_name || '—'}</div>
                      </td>

                      {/* Steps & Training Metadata */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium border border-slate-700/50">
                            {sop.step_count || 0} {t('sop.stepsCount')}
                          </span>
                          {sop.training_required && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/40 text-[11px]" title={t('sop.training.requiredBadge')}>
                              <GraduationCap className="w-3 h-3 text-blue-400" />
                              <span>{t('sop.training.badge')}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Version */}
                      <td className="py-3.5 px-4">
                        <DocumentVersionBadge
                          versionLabel={sop.version_label || `${sop.version_number}.0`}
                          isCurrent={sop.is_current_version ?? false}
                        />
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <DocumentStatusBadge
                          status={sop.document_status}
                          effectiveDate={sop.effective_date}
                        />
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 group-hover:text-indigo-300 transition-colors">
                          <span>{t('common.open')}</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
