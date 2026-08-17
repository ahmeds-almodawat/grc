import React, { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import {
  SopRiskLink,
  SopDerivedControl,
  fetchActiveRisks
} from '../../lib/policySopApi';
import {
  AlertTriangle,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Shield,
  Layers,
  FileText,
  Info,
  CheckCircle2,
  X
} from 'lucide-react';

interface SopRiskTraceabilityBuilderProps {
  riskLinks: SopRiskLink[];
  onChangeRiskLinks: (links: SopRiskLink[]) => void;
  derivedControls: SopDerivedControl[];
  organizationId: string;
  isReadOnly?: boolean;
}

interface ActiveRiskOption {
  id: string;
  risk_code: string;
  title: string;
  status: string;
  risk_level: string;
  department_name?: string | null;
}

export const SopRiskTraceabilityBuilder: React.FC<SopRiskTraceabilityBuilderProps> = ({
  riskLinks,
  onChangeRiskLinks,
  derivedControls,
  organizationId,
  isReadOnly = false
}) => {
  const { t, language } = useI18n();
  const isRtl = language === 'ar';

  const [availableRisks, setAvailableRisks] = useState<ActiveRiskOption[]>([]);
  const [loadingRisks, setLoadingRisks] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Form State for Add/Edit
  const [selectedRiskId, setSelectedRiskId] = useState('');
  const [relationshipType, setRelationshipType] = useState<'mitigates' | 'risk_if_not_followed' | 'operational_context'>('mitigates');
  const [contextNoteEn, setContextNoteEn] = useState('');
  const [contextNoteAr, setContextNoteAr] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (organizationId) {
      setLoadingRisks(true);
      fetchActiveRisks(organizationId)
        .then((risks: ActiveRiskOption[]) => {
          if (mounted) {
            setAvailableRisks(risks);
            setLoadingRisks(false);
          }
        })
        .catch((err: unknown) => {
          console.error('Failed to load risks:', err);
          if (mounted) setLoadingRisks(false);
        });
    }
    return () => {
      mounted = false;
    };
  }, [organizationId]);

  const handleOpenAddModal = (index?: number) => {
    if (index !== undefined && index >= 0 && index < riskLinks.length) {
      const item = riskLinks[index];
      setEditingIndex(index);
      setSelectedRiskId(item.risk_id);
      setRelationshipType(item.relationship_type);
      setContextNoteEn(item.context_note_en || '');
      setContextNoteAr(item.context_note_ar || '');
    } else {
      setEditingIndex(null);
      setSelectedRiskId(availableRisks.length > 0 ? availableRisks[0].id : '');
      setRelationshipType('mitigates');
      setContextNoteEn('');
      setContextNoteAr('');
    }
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleSaveRiskLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRiskId) {
      setFormError(isRtl ? 'يرجى اختيار الخطر' : 'Please select a risk.');
      return;
    }

    const matchedRisk = availableRisks.find(r => r.id === selectedRiskId);

    // Check for duplicates
    const isDuplicate = riskLinks.some((link, idx) => {
      if (editingIndex !== null && idx === editingIndex) return false;
      return link.risk_id === selectedRiskId && link.relationship_type === relationshipType;
    });

    if (isDuplicate) {
      setFormError(isRtl ? 'تم ربط هذا الخطر بنفس نوع العلاقة مسبقاً' : 'This risk is already mapped with the same relationship type.');
      return;
    }

    const newLink: SopRiskLink = {
      id: editingIndex !== null ? riskLinks[editingIndex].id : undefined,
      sequence_number: editingIndex !== null ? riskLinks[editingIndex].sequence_number : riskLinks.length + 1,
      risk_id: selectedRiskId,
      risk_code: matchedRisk?.risk_code || null,
      risk_title: matchedRisk?.title || null,
      risk_status: matchedRisk?.status || 'open',
      risk_level: matchedRisk?.risk_level || 'medium',
      relationship_type: relationshipType,
      context_note_en: contextNoteEn.trim() || null,
      context_note_ar: contextNoteAr.trim() || null
    };

    if (editingIndex !== null) {
      const updated = [...riskLinks];
      updated[editingIndex] = newLink;
      onChangeRiskLinks(updated);
    } else {
      onChangeRiskLinks([...riskLinks, newLink]);
    }

    setIsAddModalOpen(false);
  };

  const handleDelete = (index: number) => {
    const updated = riskLinks
      .filter((_, idx) => idx !== index)
      .map((item, idx) => ({ ...item, sequence_number: idx + 1 }));
    onChangeRiskLinks(updated);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === riskLinks.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...riskLinks];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    const resequenced = updated.map((item, idx) => ({
      ...item,
      sequence_number: idx + 1
    }));
    onChangeRiskLinks(resequenced);
  };

  const getRelationshipBadge = (type: 'mitigates' | 'risk_if_not_followed' | 'operational_context') => {
    switch (type) {
      case 'mitigates':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
            <Shield className="w-3 h-3 mr-1 rtl:ml-1 rtl:mr-0" />
            {isRtl ? 'يحد من الخطر' : 'Mitigates Risk'}
          </span>
        );
      case 'risk_if_not_followed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/60">
            <AlertTriangle className="w-3 h-3 mr-1 rtl:ml-1 rtl:mr-0" />
            {isRtl ? 'مخاطر عدم الالتزام' : 'Risk if Not Followed'}
          </span>
        );
      case 'operational_context':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-950/60 text-blue-300 border border-blue-800/60">
            <Info className="w-3 h-3 mr-1 rtl:ml-1 rtl:mr-0" />
            {isRtl ? 'سياق تشغيلي' : 'Operational Context'}
          </span>
        );
      default:
        return null;
    }
  };

  const getCriticalityBadge = (level: string | null | undefined) => {
    const l = (level || 'medium').toLowerCase();
    if (l === 'critical') {
      return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-950/60 text-red-300 border border-red-800/60">{isRtl ? 'حرج' : 'Critical'}</span>;
    }
    if (l === 'high') {
      return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-950/60 text-orange-300 border border-orange-800/60">{isRtl ? 'عالي' : 'High'}</span>;
    }
    if (l === 'medium') {
      return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/60">{isRtl ? 'متوسط' : 'Medium'}</span>;
    }
    return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-900 text-slate-400 border border-slate-700">{isRtl ? 'منخفض' : 'Low'}</span>;
  };

  return (
    <div className="space-y-8" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* 1. Direct SOP Risk Traceability */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-semibold text-slate-100">
                {isRtl ? 'المخاطر المرتبطة مباشرة بالإجراء (Direct Risks)' : 'Directly Mapped Enterprise Risks'}
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {isRtl
                ? 'ربط الإجراء بسجل المخاطر المؤسسية، مع تحديد دلالة العلاقة (يحد من الخطر، خطر عدم التطبيق، أو سياق تشغيلي).'
                : 'Version-scoped risk mappings identifying mitigated hazards, failure-to-follow exposures, and operational contexts.'}
            </p>
          </div>
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => handleOpenAddModal()}
              disabled={loadingRisks || availableRisks.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition shadow-sm disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              {isRtl ? 'إضافة رابط مخاطر' : 'Add Risk Mapping'}
            </button>
          )}
        </div>

        {riskLinks.length === 0 ? (
          <div className="text-center py-8 px-4 border border-dashed border-slate-800 rounded-lg bg-slate-950/30">
            <AlertTriangle className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-60" />
            <p className="text-sm font-medium text-slate-400">
              {isRtl ? 'لم يتم ربط أي مخاطر بهذا الإجراء بعد' : 'No direct enterprise risks mapped to this SOP version yet.'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {isRtl
                ? 'انقر على "إضافة رابط مخاطر" لربط المخاطر المؤسسية ذات الصلة.'
                : 'Map relevant enterprise risks to document mitigation governance.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left rtl:text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-medium bg-slate-950/40">
                  <th className="py-2.5 px-3 w-12 text-center">#</th>
                  <th className="py-2.5 px-3">{isRtl ? 'رمز الخطر والعنوان' : 'Risk Code & Title'}</th>
                  <th className="py-2.5 px-3 w-40">{isRtl ? 'نوع العلاقة' : 'Relationship Semantic'}</th>
                  <th className="py-2.5 px-3 w-28">{isRtl ? 'المستوى / الحالة' : 'Severity / Status'}</th>
                  <th className="py-2.5 px-3">{isRtl ? 'ملاحظات السياق' : 'Context Note'}</th>
                  {!isReadOnly && <th className="py-2.5 px-3 w-24 text-center">{isRtl ? 'إجراءات' : 'Actions'}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {riskLinks.map((item, idx) => (
                  <tr key={item.id || `risk-${idx}`} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-3 text-center font-mono text-slate-500">{item.sequence_number}</td>
                    <td className="py-3 px-3 font-medium text-slate-200">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-indigo-300 font-bold bg-indigo-950/50 px-1.5 py-0.5 rounded border border-indigo-900/50 text-[11px]">
                          {item.risk_code || 'RISK'}
                        </span>
                        <span>{item.risk_title || isRtl ? 'خطر مرتبط' : 'Mapped Risk'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">{getRelationshipBadge(item.relationship_type)}</td>
                    <td className="py-3 px-3">
                      <div className="flex flex-col gap-1">
                        <div>{getCriticalityBadge(item.risk_level)}</div>
                        <span className="text-[10px] text-slate-500 uppercase">{item.risk_status}</span>
                      </div>
                    </td>
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
                            disabled={idx === riskLinks.length - 1}
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

      {/* 2. Derived Step Controls Summary */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-sky-400" />
              <h3 className="text-base font-semibold text-slate-100">
                {isRtl ? 'الضوابط الرقابية المشتقة من خطوات الإجراء' : 'Controls Derived from Procedure Steps'}
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {isRtl
                ? 'تجميع آلي للضوابط الرقابية المحددة في خطوات الإجراء التفصيلية، مع إبراز خطوات التنفيذ.'
                : 'Automatically derived distinct controls associated with procedure steps in this SOP version.'}
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-sky-950/60 text-sky-300 border border-sky-800/60">
            {derivedControls.length} {isRtl ? 'ضوابط مشتقة' : 'Derived Controls'}
          </span>
        </div>

        {derivedControls.length === 0 ? (
          <div className="text-center py-6 px-4 border border-dashed border-slate-800 rounded-lg bg-slate-950/30">
            <Info className="w-6 h-6 text-slate-600 mx-auto mb-2 opacity-60" />
            <p className="text-sm text-slate-400">
              {isRtl
                ? 'لم يتم تحديد أي ضوابط رقابية في خطوات هذا الإجراء بعد.'
                : 'No controls mapped in procedure steps yet. Add controls to individual procedure steps in the Procedure tab.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left rtl:text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-medium bg-slate-950/40">
                  <th className="py-2.5 px-3 w-32">{isRtl ? 'رمز الضابط' : 'Control Code'}</th>
                  <th className="py-2.5 px-3">{isRtl ? 'عنوان الضابط الرقابي' : 'Control Title'}</th>
                  <th className="py-2.5 px-3 w-32">{isRtl ? 'النوع' : 'Control Type'}</th>
                  <th className="py-2.5 px-3 w-28 text-center">{isRtl ? 'ضابط رئيسي' : 'Key Control'}</th>
                  <th className="py-2.5 px-3 w-40">{isRtl ? 'خطوات التنفيذ' : 'Step Provenance'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {derivedControls.map((ctrl, idx) => (
                  <tr key={ctrl.control_id || `ctrl-${idx}`} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-sky-300">
                      {ctrl.control_code || 'CTRL'}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-200">{ctrl.control_title}</td>
                    <td className="py-3 px-3 text-slate-400 capitalize">{ctrl.control_type}</td>
                    <td className="py-3 px-3 text-center">
                      {ctrl.key_control ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-950/60 text-purple-300 border border-purple-800/60">
                          {isRtl ? 'رئيسي' : 'Key'}
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1">
                        {ctrl.step_sequences.map(seq => (
                          <span
                            key={seq}
                            className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700"
                          >
                            {isRtl ? `خطوة ${seq}` : `Step ${seq}`}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Risk Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-base font-semibold text-slate-100">
                {editingIndex !== null ? (isRtl ? 'تعديل رابط الخطر' : 'Edit Risk Mapping') : (isRtl ? 'إضافة رابط خطر جديد' : 'Map Enterprise Risk')}
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

            <form onSubmit={handleSaveRiskLink} className="space-y-4">
              {/* Risk Selection */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {isRtl ? 'اختر الخطر المؤسسي *' : 'Select Enterprise Risk *'}
                </label>
                <select
                  value={selectedRiskId}
                  onChange={e => setSelectedRiskId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  required
                >
                  <option value="" disabled>
                    {isRtl ? '-- اختر من سجل المخاطر --' : '-- Select from Active Risk Register --'}
                  </option>
                  {availableRisks.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.risk_code} — {r.title} ({r.risk_level.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Relationship Semantic */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {isRtl ? 'نوع العلاقة والدلالة الرقابية *' : 'Relationship Semantic *'}
                </label>
                <select
                  value={relationshipType}
                  onChange={e => setRelationshipType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  required
                >
                  <option value="mitigates">{isRtl ? 'يحد من الخطر (Mitigates Risk)' : 'Mitigates Risk (SOP implements controls to reduce risk)'}</option>
                  <option value="risk_if_not_followed">{isRtl ? 'مخاطر عدم الالتزام (Risk if Not Followed)' : 'Risk if Not Followed (Hazard arising from procedure non-compliance)'}</option>
                  <option value="operational_context">{isRtl ? 'سياق تشغيلي (Operational Context)' : 'Operational Context (Relevant operational background)'}</option>
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
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  placeholder="Explain why this risk is linked to the procedure..."
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
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  placeholder="بيان سبب ربط هذا الخطر بالإجراء..."
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
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white shadow-sm"
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
