import React, { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import {
  SopAccreditationLink,
  SopInheritedAccreditation,
  fetchAccreditationClauses
} from '../../lib/policySopApi';
import {
  Award,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  BookOpen,
  Link2,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink
} from 'lucide-react';

interface SopAccreditationTraceabilityBuilderProps {
  accreditationLinks: SopAccreditationLink[];
  onChangeAccreditationLinks: (links: SopAccreditationLink[]) => void;
  inheritedAccreditations: SopInheritedAccreditation[];
  primaryPolicyDocumentCode?: string | null;
  primaryPolicyDocumentTitle?: string | null;
  primaryPolicyVersionLabel?: string | null;
  isReadOnly?: boolean;
}

interface AccreditationClauseOption {
  id: string;
  clause_code: string;
  clause_title: string;
  clause_title_ar?: string | null;
  framework: string;
  standard_code: string;
  criticality: string;
}

export const SopAccreditationTraceabilityBuilder: React.FC<SopAccreditationTraceabilityBuilderProps> = ({
  accreditationLinks,
  onChangeAccreditationLinks,
  inheritedAccreditations,
  primaryPolicyDocumentCode,
  primaryPolicyDocumentTitle,
  primaryPolicyVersionLabel,
  isReadOnly = false
}) => {
  const { t, language } = useI18n();
  const isRtl = language === 'ar';

  const [availableClauses, setAvailableClauses] = useState<AccreditationClauseOption[]>([]);
  const [loadingClauses, setLoadingClauses] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Form State
  const [selectedClauseId, setSelectedClauseId] = useState('');
  const [linkStrength, setLinkStrength] = useState<'primary' | 'supporting' | 'reference' | 'gap'>('primary');
  const [contextNoteEn, setContextNoteEn] = useState('');
  const [contextNoteAr, setContextNoteAr] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoadingClauses(true);
    fetchAccreditationClauses()
      .then((clauses: AccreditationClauseOption[]) => {
        if (mounted) {
          setAvailableClauses(clauses);
          setLoadingClauses(false);
        }
      })
      .catch((err: unknown) => {
        console.error('Failed to load accreditation clauses:', err);
        if (mounted) setLoadingClauses(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleOpenAddModal = (index?: number) => {
    if (index !== undefined && index >= 0 && index < accreditationLinks.length) {
      const item = accreditationLinks[index];
      setEditingIndex(index);
      setSelectedClauseId(item.clause_id);
      setLinkStrength(item.link_strength);
      setContextNoteEn(item.context_note_en || '');
      setContextNoteAr(item.context_note_ar || '');
    } else {
      setEditingIndex(null);
      setSelectedClauseId(availableClauses.length > 0 ? availableClauses[0].id : '');
      setLinkStrength('primary');
      setContextNoteEn('');
      setContextNoteAr('');
    }
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleSaveLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClauseId) {
      setFormError(isRtl ? 'يرجى اختيار معيار الاعتماد' : 'Please select an accreditation clause.');
      return;
    }

    const matchedClause = availableClauses.find(c => c.id === selectedClauseId);

    // Duplicate check
    const isDuplicate = accreditationLinks.some((link, idx) => {
      if (editingIndex !== null && idx === editingIndex) return false;
      return link.clause_id === selectedClauseId;
    });

    if (isDuplicate) {
      setFormError(isRtl ? 'تم ربط هذا المعيار مسبقاً في هذا الإجراء' : 'This clause is already mapped in this SOP.');
      return;
    }

    const newLink: SopAccreditationLink = {
      id: editingIndex !== null ? accreditationLinks[editingIndex].id : undefined,
      sequence_number: editingIndex !== null ? accreditationLinks[editingIndex].sequence_number : accreditationLinks.length + 1,
      clause_id: selectedClauseId,
      clause_code: matchedClause?.clause_code || null,
      clause_title: matchedClause?.clause_title || null,
      clause_title_ar: matchedClause?.clause_title_ar || null,
      framework: matchedClause?.framework || 'CBAHI',
      standard_code: matchedClause?.standard_code || 'STANDARD',
      criticality: matchedClause?.criticality || 'medium',
      link_strength: linkStrength,
      context_note_en: contextNoteEn.trim() || null,
      context_note_ar: contextNoteAr.trim() || null
    };

    if (editingIndex !== null) {
      const updated = [...accreditationLinks];
      updated[editingIndex] = newLink;
      onChangeAccreditationLinks(updated);
    } else {
      onChangeAccreditationLinks([...accreditationLinks, newLink]);
    }

    setIsAddModalOpen(false);
  };

  const handleDelete = (index: number) => {
    const updated = accreditationLinks
      .filter((_, idx) => idx !== index)
      .map((item, idx) => ({ ...item, sequence_number: idx + 1 }));
    onChangeAccreditationLinks(updated);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === accreditationLinks.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...accreditationLinks];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    const resequenced = updated.map((item, idx) => ({
      ...item,
      sequence_number: idx + 1
    }));
    onChangeAccreditationLinks(resequenced);
  };

  const getStrengthBadge = (strength: 'primary' | 'supporting' | 'reference' | 'gap') => {
    switch (strength) {
      case 'primary':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-950/60 text-purple-300 border border-purple-800/60">
            <Award className="w-3 h-3 mr-1 rtl:ml-1 rtl:mr-0" />
            {isRtl ? 'معيار رئيسي (Primary)' : 'Primary Clause'}
          </span>
        );
      case 'supporting':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-950/60 text-blue-300 border border-blue-800/60">
            <Link2 className="w-3 h-3 mr-1 rtl:ml-1 rtl:mr-0" />
            {isRtl ? 'معيار داعم (Supporting)' : 'Supporting Clause'}
          </span>
        );
      case 'reference':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
            <BookOpen className="w-3 h-3 mr-1 rtl:ml-1 rtl:mr-0" />
            {isRtl ? 'مرجع (Reference)' : 'Reference'}
          </span>
        );
      case 'gap':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/60">
            <AlertCircle className="w-3 h-3 mr-1 rtl:ml-1 rtl:mr-0" />
            {isRtl ? 'فجوة محددة (Gap)' : 'Identified Gap'}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* 1. Inherited from Governing Policy */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-semibold text-slate-100">
                {isRtl ? 'معايير الاعتماد الموروثة من السياسة الحاكمة' : 'Accreditation Clauses Inherited from Governing Policy'}
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {primaryPolicyDocumentCode ? (
                <span>
                  {isRtl
                    ? `موروث تلقائياً من متطلبات السياسة الحاكمة (${primaryPolicyDocumentCode} - ${primaryPolicyDocumentTitle || ''} v${primaryPolicyVersionLabel || '1.0'}).`
                    : `Inherited automatically from parent policy requirements (${primaryPolicyDocumentCode} - ${primaryPolicyDocumentTitle || ''} v${primaryPolicyVersionLabel || '1.0'}).`}
                </span>
              ) : (
                <span>
                  {isRtl
                    ? 'هذا الإجراء غير مرتبط بسياسة حاكمة أو لا توجد متطلبات سياسة مرتبطة بمعايير.'
                    : 'This SOP is not linked to a parent policy or the parent policy has no mapped clauses.'}
                </span>
              )}
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-950/60 text-indigo-300 border border-indigo-800/60 self-start sm:self-auto">
            {inheritedAccreditations.length} {isRtl ? 'معايير موروثة' : 'Inherited Clauses'}
          </span>
        </div>

        {inheritedAccreditations.length === 0 ? (
          <div className="text-center py-6 px-4 border border-dashed border-slate-800 rounded-lg bg-slate-950/30">
            <BookOpen className="w-6 h-6 text-slate-600 mx-auto mb-2 opacity-60" />
            <p className="text-sm text-slate-400">
              {isRtl
                ? 'لا توجد معايير اعتماد موروثة من السياسة الحاكمة.'
                : 'No accreditation clauses inherited from the governing policy.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left rtl:text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-medium bg-slate-950/40">
                  <th className="py-2.5 px-3 w-28">{isRtl ? 'الإطار / المعيار' : 'Framework / Std'}</th>
                  <th className="py-2.5 px-3 w-32">{isRtl ? 'رمز البند' : 'Clause Code'}</th>
                  <th className="py-2.5 px-3">{isRtl ? 'عنوان البند المعياري' : 'Clause Title'}</th>
                  <th className="py-2.5 px-3">{isRtl ? 'بيان متطلب السياسة' : 'Governing Policy Requirement'}</th>
                  <th className="py-2.5 px-3 w-24 text-center">{isRtl ? 'الأهمية' : 'Criticality'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {inheritedAccreditations.map((item, idx) => (
                  <tr key={`${item.clause_id}-${idx}`} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-3">
                      <span className="font-mono text-[11px] font-semibold text-indigo-300 bg-indigo-950/50 px-1.5 py-0.5 rounded border border-indigo-900/50">
                        {item.framework} ({item.standard_code})
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-200">{item.clause_code}</td>
                    <td className="py-3 px-3 font-medium text-slate-200">
                      {isRtl ? item.clause_title_ar || item.clause_title : item.clause_title}
                    </td>
                    <td className="py-3 px-3 text-slate-300">
                      {isRtl ? item.policy_requirement_ar || item.policy_requirement_en || '-' : item.policy_requirement_en || item.policy_requirement_ar || '-'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 uppercase">
                        {item.criticality}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 2. Direct SOP Accreditation Traceability */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-purple-400" />
              <h3 className="text-base font-semibold text-slate-100">
                {isRtl ? 'معايير الاعتماد المرتبطة مباشرة بالإجراء (Direct Accreditation)' : 'Directly Mapped Accreditation Standards'}
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {isRtl
                ? 'ربط مباشر لبنود معايير الاعتماد (CBAHI, JCI, ISO, MOH) مع تحديد قوة الارتباط والسياق التشغيلي.'
                : 'Version-scoped direct mappings linking this specific SOP to regulatory accreditation standards with link strength classification.'}
            </p>
          </div>
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => handleOpenAddModal()}
              disabled={loadingClauses || availableClauses.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition shadow-sm disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              {isRtl ? 'إضافة معيار اعتماد' : 'Add Clause Mapping'}
            </button>
          )}
        </div>

        {accreditationLinks.length === 0 ? (
          <div className="text-center py-8 px-4 border border-dashed border-slate-800 rounded-lg bg-slate-950/30">
            <Award className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-60" />
            <p className="text-sm font-medium text-slate-400">
              {isRtl ? 'لم يتم ربط أي بنود اعتماد مباشرة بهذا الإجراء بعد' : 'No direct accreditation clauses mapped to this SOP version.'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {isRtl
                ? 'انقر على "إضافة معيار اعتماد" لربط البنود الرقابية ذات العلاقة المباشرة.'
                : 'Map relevant accreditation standards to prove compliance readiness.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left rtl:text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-medium bg-slate-950/40">
                  <th className="py-2.5 px-3 w-12 text-center">#</th>
                  <th className="py-2.5 px-3 w-32">{isRtl ? 'الإطار / المعيار' : 'Framework / Std'}</th>
                  <th className="py-2.5 px-3 w-32">{isRtl ? 'رمز البند' : 'Clause Code'}</th>
                  <th className="py-2.5 px-3">{isRtl ? 'عنوان البند المعياري' : 'Clause Title'}</th>
                  <th className="py-2.5 px-3 w-40">{isRtl ? 'قوة الارتباط' : 'Link Strength'}</th>
                  <th className="py-2.5 px-3">{isRtl ? 'ملاحظات السياق' : 'Context Note'}</th>
                  {!isReadOnly && <th className="py-2.5 px-3 w-24 text-center">{isRtl ? 'إجراءات' : 'Actions'}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {accreditationLinks.map((item, idx) => (
                  <tr key={item.id || `acc-${idx}`} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-3 text-center font-mono text-slate-500">{item.sequence_number}</td>
                    <td className="py-3 px-3">
                      <span className="font-mono text-[11px] font-semibold text-purple-300 bg-purple-950/50 px-1.5 py-0.5 rounded border border-purple-900/50">
                        {item.framework || 'STD'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-200">{item.clause_code || 'CLAUSE'}</td>
                    <td className="py-3 px-3 font-medium text-slate-200">
                      {isRtl ? item.clause_title_ar || item.clause_title || '-' : item.clause_title || item.clause_title_ar || '-'}
                    </td>
                    <td className="py-3 px-3">{getStrengthBadge(item.link_strength)}</td>
                    <td className="py-3 px-3 text-slate-300">
                      {isRtl ? item.context_note_ar || item.context_note_en || '-' : item.context_note_en || item.context_note_ar || '-'}
                    </td>
                    {!isReadOnly && (
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleMove(idx, 'up')}
                            disabled={idx === 0}
                            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30"
                            title={isRtl ? 'تحريك لأعلى' : 'Move Up'}
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMove(idx, 'down')}
                            disabled={idx === accreditationLinks.length - 1}
                            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30"
                            title={isRtl ? 'تحريك لأسفل' : 'Move Down'}
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(idx)}
                            className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-950/40"
                            title={isRtl ? 'حذف' : 'Remove'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Clause Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-base font-semibold text-slate-100">
                {editingIndex !== null ? (isRtl ? 'تعديل رابط الاعتماد' : 'Edit Clause Mapping') : (isRtl ? 'إضافة رابط معيار اعتماد' : 'Map Accreditation Clause')}
              </h4>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-950/50 border border-red-800 rounded-lg text-xs text-red-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveLink} className="space-y-4">
              {/* Clause Selection */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {isRtl ? 'اختر البند المعياري *' : 'Select Accreditation Clause *'}
                </label>
                <select
                  value={selectedClauseId}
                  onChange={e => setSelectedClauseId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                  required
                >
                  <option value="" disabled>
                    {isRtl ? '-- اختر من سجل المعايير --' : '-- Select from Accreditation Catalog --'}
                  </option>
                  {availableClauses.map(c => (
                    <option key={c.id} value={c.id}>
                      [{c.framework}] {c.clause_code} — {c.clause_title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Link Strength */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {isRtl ? 'قوة الارتباط المعياري *' : 'Link Strength *'}
                </label>
                <select
                  value={linkStrength}
                  onChange={e => setLinkStrength(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                  required
                >
                  <option value="primary">{isRtl ? 'معيار رئيسي (Primary - Direct fulfillment of standard)' : 'Primary (Direct fulfillment of standard)'}</option>
                  <option value="supporting">{isRtl ? 'معيار داعم (Supporting - Secondary / Partial alignment)' : 'Supporting (Secondary / Partial alignment)'}</option>
                  <option value="reference">{isRtl ? 'مرجع استرشادي (Reference - Best-practice citation)' : 'Reference (Best-practice citation)'}</option>
                  <option value="gap">{isRtl ? 'فجوة امتثال (Identified Gap - Requires corrective action)' : 'Identified Gap (Requires corrective action)'}</option>
                </select>
              </div>

              {/* Context Note EN */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {isRtl ? 'ملاحظة السياق (English)' : 'Context Note (English)'}
                </label>
                <textarea
                  value={contextNoteEn}
                  onChange={e => setContextNoteEn(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                  placeholder="Explain how this SOP complies with or implements the clause..."
                />
              </div>

              {/* Context Note AR */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {isRtl ? 'ملاحظة السياق (العربية)' : 'Context Note (Arabic)'}
                </label>
                <textarea
                  value={contextNoteAr}
                  onChange={e => setContextNoteAr(e.target.value)}
                  rows={2}
                  dir="rtl"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                  placeholder="بيان كيفية امتثال الإجراء لهذا المعيار..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-medium text-white shadow-sm"
                >
                  {isRtl ? 'حفظ الرابط' : 'Save Mapping'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
