import { useI18n } from '../../i18n/I18nContext';
import type { SopRoleResponsibility } from '../../lib/policySopApi';
import { Plus, Trash2, ArrowUp, ArrowDown, Copy, Users, UserCheck } from 'lucide-react';

interface SopResponsibilitiesBuilderProps {
  responsibilities: SopRoleResponsibility[];
  onChange: (responsibilities: SopRoleResponsibility[]) => void;
  readOnly?: boolean;
}

export function SopResponsibilitiesBuilder({
  responsibilities,
  onChange,
  readOnly = false,
}: SopResponsibilitiesBuilderProps) {
  const { t } = useI18n();

  const handleAddResponsibility = () => {
    if (readOnly) return;
    const newSeq = responsibilities.length + 1;
    const newResp: SopRoleResponsibility = {
      sequence_number: newSeq,
      role_name: '',
      job_title: '',
      responsibility_en: '',
      responsibility_ar: '',
      accountable_for_en: '',
      accountable_for_ar: '',
    };
    onChange([...responsibilities, newResp]);
  };

  const handleDuplicateResponsibility = (index: number) => {
    if (readOnly) return;
    const target = responsibilities[index];
    const duplicated: SopRoleResponsibility = {
      ...target,
      id: undefined,
      role_name: target.role_name ? `${target.role_name} (Copy)` : '',
      sequence_number: index + 2,
    };

    const newResps = [
      ...responsibilities.slice(0, index + 1),
      duplicated,
      ...responsibilities.slice(index + 1),
    ].map((resp, idx) => ({
      ...resp,
      sequence_number: idx + 1,
    }));

    onChange(newResps);
  };

  const handleDeleteResponsibility = (index: number) => {
    if (readOnly) return;
    const newResps = responsibilities
      .filter((_, idx) => idx !== index)
      .map((resp, idx) => ({
        ...resp,
        sequence_number: idx + 1,
      }));
    onChange(newResps);
  };

  const handleMoveUp = (index: number) => {
    if (readOnly || index === 0) return;
    const newResps = [...responsibilities];
    const temp = newResps[index - 1];
    newResps[index - 1] = newResps[index];
    newResps[index] = temp;

    const resequenced = newResps.map((resp, idx) => ({
      ...resp,
      sequence_number: idx + 1,
    }));
    onChange(resequenced);
  };

  const handleMoveDown = (index: number) => {
    if (readOnly || index === responsibilities.length - 1) return;
    const newResps = [...responsibilities];
    const temp = newResps[index + 1];
    newResps[index + 1] = newResps[index];
    newResps[index] = temp;

    const resequenced = newResps.map((resp, idx) => ({
      ...resp,
      sequence_number: idx + 1,
    }));
    onChange(resequenced);
  };

  const handleUpdateResponsibility = (index: number, updates: Partial<SopRoleResponsibility>) => {
    if (readOnly) return;
    const newResps = responsibilities.map((resp, idx) => {
      if (idx === index) {
        return { ...resp, ...updates };
      }
      return resp;
    });
    onChange(newResps);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <span>{t('sop.responsibilities.title', 'Roles & Responsibilities Matrix')}</span>
            <span className="px-2 py-0.5 text-xs font-medium rounded bg-indigo-950 text-indigo-300 border border-indigo-800/50">
              {responsibilities.length} {t('sop.responsibilities.count', 'Roles')}
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {t('sop.responsibilities.subtitle', 'Define specific operational obligations, supervisory accountability, and delegated tasks for each clinical/operational role in this procedure.')}
          </p>
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={handleAddResponsibility}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow transition-colors active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{t('sop.responsibilities.addRole', 'Add Role Responsibility')}</span>
          </button>
        )}
      </div>

      {/* Empty State */}
      {responsibilities.length === 0 ? (
        <div className="p-8 text-center bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
          <Users className="w-10 h-10 text-slate-600 mx-auto mb-2 stroke-[1.5]" />
          <p className="text-sm font-medium text-slate-300">
            {t('sop.responsibilities.noRoles', 'No roles and responsibilities defined')}
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {t('sop.responsibilities.noRolesPrompt', 'Explicitly record which clinical roles execute, verify, supervise, and hold final operational accountability for this SOP.')}
          </p>
          {!readOnly && (
            <button
              type="button"
              onClick={handleAddResponsibility}
              className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{t('sop.responsibilities.addRole', 'Add Role Responsibility')}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {responsibilities.map((resp, index) => (
            <div
              key={resp.id || `temp-resp-${index}`}
              className="bg-slate-950 rounded-xl border border-slate-800 hover:border-slate-700 transition-all"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/50 rounded-t-xl border-b border-slate-800/80 gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-md bg-indigo-900/50 border border-indigo-700/60 font-mono text-xs font-bold text-indigo-200 shrink-0">
                    {resp.sequence_number}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-200">
                      {resp.role_name || resp.job_title || t('sop.responsibilities.unnamedRole', 'Unassigned Role')}
                    </span>
                    {resp.job_title && resp.role_name && (
                      <span className="text-[11px] text-slate-400">({resp.job_title})</span>
                    )}
                  </div>
                </div>

                {!readOnly && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      title={t('common.moveUp', 'Move up')}
                      className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveDown(index)}
                      disabled={index === responsibilities.length - 1}
                      title={t('common.moveDown', 'Move down')}
                      className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicateResponsibility(index)}
                      title={t('common.duplicate', 'Duplicate')}
                      className="p-1 text-slate-400 hover:text-indigo-300 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteResponsibility(index)}
                      title={t('common.delete', 'Delete')}
                      className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Card Body */}
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {t('sop.responsibilities.roleName', 'Role Name / Function')} <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={resp.role_name || ''}
                      onChange={(e) => handleUpdateResponsibility(index, { role_name: e.target.value })}
                      disabled={readOnly}
                      placeholder="e.g. Clinical Pharmacist, Charge Nurse, Cleanroom Officer"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {t('sop.responsibilities.jobTitle', 'Job Title (Optional Qualification)')}
                    </label>
                    <input
                      type="text"
                      value={resp.job_title || ''}
                      onChange={(e) => handleUpdateResponsibility(index, { job_title: e.target.value })}
                      disabled={readOnly}
                      placeholder="e.g. Senior Specialist Pharmacist"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                    />
                  </div>
                </div>

                {/* Core Responsibilities EN/AR */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {t('sop.responsibilities.responsibilityEn', 'Assigned Responsibilities (EN)')} <span className="text-rose-400">*</span>
                    </label>
                    <textarea
                      rows={2}
                      value={resp.responsibility_en}
                      onChange={(e) => handleUpdateResponsibility(index, { responsibility_en: e.target.value })}
                      disabled={readOnly}
                      dir="ltr"
                      placeholder="Verify chemotherapy calculations, check laboratory markers, and approve final dispensing."
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {t('sop.responsibilities.responsibilityAr', 'المسؤوليات المحددة (AR)')}
                    </label>
                    <textarea
                      rows={2}
                      value={resp.responsibility_ar || ''}
                      onChange={(e) => handleUpdateResponsibility(index, { responsibility_ar: e.target.value })}
                      disabled={readOnly}
                      dir="rtl"
                      placeholder="مطابقة حسابات الجرعات والتحقق من المؤشرات المخبرية والاعتماد النهائي لصرف الدواء."
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-60 text-right"
                    />
                  </div>
                </div>

                {/* Accountable For EN/AR */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-800/60">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{t('sop.responsibilities.accountableForEn', 'Accountable For / Final Oversight (EN)')}</span>
                    </label>
                    <input
                      type="text"
                      value={resp.accountable_for_en || ''}
                      onChange={(e) => handleUpdateResponsibility(index, { accountable_for_en: e.target.value })}
                      disabled={readOnly}
                      dir="ltr"
                      placeholder="e.g. Accurate dispensing verification log sign-off in EHR."
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{t('sop.responsibilities.accountableForAr', 'المساءلة النهائية / الإشراف (AR)')}</span>
                    </label>
                    <input
                      type="text"
                      value={resp.accountable_for_ar || ''}
                      onChange={(e) => handleUpdateResponsibility(index, { accountable_for_ar: e.target.value })}
                      disabled={readOnly}
                      dir="rtl"
                      placeholder="مثال: التوقيع النهائي لسجل التحقق في النظام الإلكتروني."
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500 text-right"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
