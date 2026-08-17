import { useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Shield, CheckCircle, HelpCircle } from 'lucide-react';
import { PolicyRequirement } from '../../lib/policySopApi';
import { useI18n } from '../../i18n/I18nContext';

interface PolicyRequirementBuilderProps {
  requirements: PolicyRequirement[];
  onChange: (requirements: PolicyRequirement[]) => void;
  controls?: Array<{ id: string; code: string; title: string }>;
  clauses?: Array<{ id: string; clause_number: string; title: string }>;
  readOnly?: boolean;
}

export function PolicyRequirementBuilder({
  requirements,
  onChange,
  controls = [],
  clauses = [],
  readOnly = false
}: PolicyRequirementBuilderProps) {
  const { t } = useI18n();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(requirements.length > 0 ? 0 : null);

  const handleAdd = () => {
    const newReq: PolicyRequirement = {
      sequence_number: requirements.length + 1,
      requirement_statement_en: '',
      requirement_statement_ar: '',
      responsible_role: '',
      is_mandatory: true,
      expected_evidence_en: '',
      expected_evidence_ar: '',
      mapped_control_id: null,
      linked_accreditation_clause_id: null,
      monitoring_frequency: 'annual'
    };
    const next = [...requirements, newReq];
    onChange(next);
    setExpandedIndex(next.length - 1);
  };

  const handleRemove = (index: number) => {
    const next = requirements.filter((_, i) => i !== index).map((r, i) => ({
      ...r,
      sequence_number: i + 1
    }));
    onChange(next);
    if (expandedIndex === index) {
      setExpandedIndex(next.length > 0 ? Math.max(0, index - 1) : null);
    } else if (expandedIndex !== null && expandedIndex > index) {
      setExpandedIndex(expandedIndex - 1);
    }
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= requirements.length) return;
    const items = [...requirements];
    const temp = items[index];
    items[index] = items[target];
    items[target] = temp;
    const resequenced = items.map((r, i) => ({ ...r, sequence_number: i + 1 }));
    onChange(resequenced);
    setExpandedIndex(target);
  };

  const handleUpdate = (index: number, patch: Partial<PolicyRequirement>) => {
    const next = [...requirements];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Shield size={16} className="text-indigo-600 dark:text-indigo-400" />
            {t('policy.requirements.title', 'Policy Requirements & Controls')}
            <span className="text-xs font-normal text-slate-500">({requirements.length})</span>
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('policy.requirements.subtitle', 'Define mandatory compliance rules, mapped controls, and expected evidence records.')}
          </p>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={handleAdd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800 transition-colors"
          >
            <Plus size={14} />
            {t('policy.requirements.add', 'Add Requirement')}
          </button>
        )}
      </div>

      {requirements.length === 0 ? (
        <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
          <HelpCircle size={32} className="mx-auto text-slate-400 mb-2" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t('policy.requirements.emptyTitle', 'No policy requirements defined yet')}
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {t('policy.requirements.emptyDesc', 'Add structured requirements to map institutional controls, assign responsibilities, and specify audit evidence.')}
          </p>
          {!readOnly && (
            <button
              type="button"
              onClick={handleAdd}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
            >
              <Plus size={14} />
              {t('policy.requirements.addFirst', 'Add First Requirement')}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {requirements.map((req, idx) => {
            const isExpanded = expandedIndex === idx;
            return (
              <div
                key={req.id || `req-${idx}`}
                className={`border rounded-xl transition-all duration-200 ${
                  isExpanded
                    ? 'border-indigo-300 bg-white dark:bg-slate-900 shadow-sm dark:border-indigo-800'
                    : 'border-slate-200 bg-slate-50/50 dark:bg-slate-900/40 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                {/* Header Row */}
                <div
                  className="flex items-center justify-between p-3 cursor-pointer select-none"
                  onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs font-mono font-bold">
                      {req.sequence_number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          {req.requirement_statement_en || t('policy.requirements.unnamed', 'Untitled Requirement')}
                        </span>
                        {req.is_mandatory ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
                            {t('policy.mandatory', 'Mandatory')}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            {t('policy.guidance', 'Guidance')}
                          </span>
                        )}
                        {req.responsible_role && (
                          <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                            {req.responsible_role}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {!readOnly && (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMove(idx, 'up')}
                        className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                        title={t('common.moveUp', 'Move Up')}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === requirements.length - 1}
                        onClick={() => handleMove(idx, 'down')}
                        className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                        title={t('common.moveDown', 'Move Down')}
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(idx)}
                        className="p-1 text-rose-500 hover:text-rose-700 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title={t('common.delete', 'Delete')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Expanded Edit Form */}
                {isExpanded && (
                  <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-4 bg-slate-50/50 dark:bg-slate-900/70">
                    {/* Bilingual Statements */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          {t('policy.requirementEn', 'Requirement Statement (English)')} *
                        </label>
                        <textarea
                          rows={2}
                          value={req.requirement_statement_en}
                          disabled={readOnly}
                          onChange={e => handleUpdate(idx, { requirement_statement_en: e.target.value })}
                          dir="ltr"
                          placeholder="e.g. All staff must complete two-factor authentication verification..."
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          {t('policy.requirementAr', 'Requirement Statement (Arabic)')}
                        </label>
                        <textarea
                          rows={2}
                          value={req.requirement_statement_ar || ''}
                          disabled={readOnly}
                          onChange={e => handleUpdate(idx, { requirement_statement_ar: e.target.value })}
                          dir="rtl"
                          placeholder="مثال: يجب على جميع الموظفين إتمام التحقق الثنائي..."
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                    </div>

                    {/* Roles & Mandatory */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          {t('policy.responsibleRole', 'Responsible Role')}
                        </label>
                        <input
                          type="text"
                          value={req.responsible_role || ''}
                          disabled={readOnly}
                          onChange={e => handleUpdate(idx, { responsible_role: e.target.value })}
                          placeholder="e.g. Clinical Staff, Department Head"
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          {t('policy.complianceNature', 'Compliance Nature')}
                        </label>
                        <select
                          value={req.is_mandatory ? 'mandatory' : 'guidance'}
                          disabled={readOnly}
                          onChange={e => handleUpdate(idx, { is_mandatory: e.target.value === 'mandatory' })}
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                          <option value="mandatory">{t('policy.mandatory', 'Mandatory Obligation')}</option>
                          <option value="guidance">{t('policy.guidance', 'Guidance / Recommended')}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          {t('policy.monitoringFrequency', 'Monitoring Frequency')}
                        </label>
                        <select
                          value={req.monitoring_frequency || 'annual'}
                          disabled={readOnly}
                          onChange={e => handleUpdate(idx, { monitoring_frequency: e.target.value })}
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                          <option value="continuous">{t('policy.freq.continuous', 'Continuous / Real-Time')}</option>
                          <option value="monthly">{t('policy.freq.monthly', 'Monthly')}</option>
                          <option value="quarterly">{t('policy.freq.quarterly', 'Quarterly')}</option>
                          <option value="semi_annual">{t('policy.freq.semiAnnual', 'Semi-Annual')}</option>
                          <option value="annual">{t('policy.freq.annual', 'Annual')}</option>
                          <option value="ad_hoc">{t('policy.freq.adHoc', 'Ad-Hoc / On Incident')}</option>
                        </select>
                      </div>
                    </div>

                    {/* Mapped Control & Accreditation Clause Selectors */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          {t('policy.mappedControl', 'Mapped GRC Control')}
                        </label>
                        <select
                          value={req.mapped_control_id || ''}
                          disabled={readOnly}
                          onChange={e => handleUpdate(idx, { mapped_control_id: e.target.value || null })}
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                          <option value="">{t('policy.noControlMapped', '-- No Control Mapped --')}</option>
                          {controls.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.code} - {c.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          {t('policy.linkedAccreditationClause', 'Linked Accreditation Clause')}
                        </label>
                        <select
                          value={req.linked_accreditation_clause_id || ''}
                          disabled={readOnly}
                          onChange={e => handleUpdate(idx, { linked_accreditation_clause_id: e.target.value || null })}
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                          <option value="">{t('policy.noClauseMapped', '-- No Accreditation Clause Mapped --')}</option>
                          {clauses.map(cl => (
                            <option key={cl.id} value={cl.id}>
                              {cl.clause_number} - {cl.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Expected Evidence Record (EN/AR) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          {t('policy.expectedEvidenceEn', 'Expected Evidence Record (EN)')}
                        </label>
                        <input
                          type="text"
                          value={req.expected_evidence_en || ''}
                          disabled={readOnly}
                          onChange={e => handleUpdate(idx, { expected_evidence_en: e.target.value })}
                          dir="ltr"
                          placeholder="e.g. Audit log export, Sign-off sheet..."
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          {t('policy.expectedEvidenceAr', 'Expected Evidence Record (AR)')}
                        </label>
                        <input
                          type="text"
                          value={req.expected_evidence_ar || ''}
                          disabled={readOnly}
                          onChange={e => handleUpdate(idx, { expected_evidence_ar: e.target.value })}
                          dir="rtl"
                          placeholder="مثال: تقرير سجل التدقيق، كشف التوقيعات..."
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
