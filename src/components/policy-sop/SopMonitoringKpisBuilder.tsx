import { useI18n } from '../../i18n/I18nContext';
import type { SopMonitoringKpi } from '../../lib/policySopApi';
import { Plus, Trash2, ArrowUp, ArrowDown, Copy, Activity, Target, Clock, UserCheck } from 'lucide-react';

interface SopMonitoringKpisBuilderProps {
  kpis: SopMonitoringKpi[];
  profiles: Array<{ id: string; full_name: string; email: string; job_title: string | null }>;
  onChange: (kpis: SopMonitoringKpi[]) => void;
  readOnly?: boolean;
}

export function SopMonitoringKpisBuilder({
  kpis,
  profiles,
  onChange,
  readOnly = false,
}: SopMonitoringKpisBuilderProps) {
  const { t } = useI18n();

  const handleAddKpi = () => {
    if (readOnly) return;
    const newSeq = kpis.length + 1;
    const newKpi: SopMonitoringKpi = {
      sequence_number: newSeq,
      kpi_name_en: '',
      kpi_name_ar: '',
      target_value: '',
      measurement_frequency: 'Monthly',
      owner_id: null,
      owner_name: null,
      description_en: '',
      description_ar: '',
    };
    onChange([...kpis, newKpi]);
  };

  const handleDuplicateKpi = (index: number) => {
    if (readOnly) return;
    const target = kpis[index];
    const duplicated: SopMonitoringKpi = {
      ...target,
      id: undefined,
      kpi_name_en: target.kpi_name_en ? `${target.kpi_name_en} (Copy)` : '',
      sequence_number: index + 2,
    };

    const newKpis = [
      ...kpis.slice(0, index + 1),
      duplicated,
      ...kpis.slice(index + 1),
    ].map((kpi, idx) => ({
      ...kpi,
      sequence_number: idx + 1,
    }));

    onChange(newKpis);
  };

  const handleDeleteKpi = (index: number) => {
    if (readOnly) return;
    const newKpis = kpis
      .filter((_, idx) => idx !== index)
      .map((kpi, idx) => ({
        ...kpi,
        sequence_number: idx + 1,
      }));
    onChange(newKpis);
  };

  const handleMoveUp = (index: number) => {
    if (readOnly || index === 0) return;
    const newKpis = [...kpis];
    const temp = newKpis[index - 1];
    newKpis[index - 1] = newKpis[index];
    newKpis[index] = temp;

    const resequenced = newKpis.map((kpi, idx) => ({
      ...kpi,
      sequence_number: idx + 1,
    }));
    onChange(resequenced);
  };

  const handleMoveDown = (index: number) => {
    if (readOnly || index === kpis.length - 1) return;
    const newKpis = [...kpis];
    const temp = newKpis[index + 1];
    newKpis[index + 1] = newKpis[index];
    newKpis[index] = temp;

    const resequenced = newKpis.map((kpi, idx) => ({
      ...kpi,
      sequence_number: idx + 1,
    }));
    onChange(resequenced);
  };

  const handleUpdateKpi = (index: number, updates: Partial<SopMonitoringKpi>) => {
    if (readOnly) return;
    const newKpis = kpis.map((kpi, idx) => {
      if (idx === index) {
        return { ...kpi, ...updates };
      }
      return kpi;
    });
    onChange(newKpis);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <span>{t('sop.kpis.title', 'Monitoring & Performance Indicators (KPIs)')}</span>
            <span className="px-2 py-0.5 text-xs font-medium rounded bg-indigo-950 text-indigo-300 border border-indigo-800/50">
              {kpis.length} {t('sop.kpis.count', 'Indicators')}
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {t('sop.kpis.subtitle', 'Configure clinical and process quality indicators, audit targets, measurement frequencies, and responsible monitoring leads.')}
          </p>
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={handleAddKpi}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow transition-colors active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{t('sop.kpis.addIndicator', 'Add Monitoring Indicator')}</span>
          </button>
        )}
      </div>

      {/* Empty State */}
      {kpis.length === 0 ? (
        <div className="p-8 text-center bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
          <Activity className="w-10 h-10 text-slate-600 mx-auto mb-2 stroke-[1.5]" />
          <p className="text-sm font-medium text-slate-300">
            {t('sop.kpis.noIndicators', 'No monitoring KPIs configured')}
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {t('sop.kpis.noIndicatorsPrompt', 'Establish quantitative targets, compliance rates, and audit intervals to ensure procedural quality control and accreditation readiness.')}
          </p>
          {!readOnly && (
            <button
              type="button"
              onClick={handleAddKpi}
              className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{t('sop.kpis.addIndicator', 'Add Monitoring Indicator')}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {kpis.map((kpi, index) => (
            <div
              key={kpi.id || `temp-kpi-${index}`}
              className="bg-slate-950 rounded-xl border border-slate-800 hover:border-slate-700 transition-all"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/50 rounded-t-xl border-b border-slate-800/80 gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-md bg-indigo-900/50 border border-indigo-700/60 font-mono text-xs font-bold text-indigo-200 shrink-0">
                    {kpi.sequence_number}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-200">
                      {kpi.kpi_name_en || kpi.kpi_name_ar || t('sop.kpis.unnamedKpi', 'Untitled Indicator')}
                    </span>
                    {kpi.target_value && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 text-[10px] font-mono font-medium">
                        <Target className="w-3 h-3 text-emerald-400" />
                        <span>{kpi.target_value}</span>
                      </span>
                    )}
                    {kpi.measurement_frequency && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-medium">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{kpi.measurement_frequency}</span>
                      </span>
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
                      disabled={index === kpis.length - 1}
                      title={t('common.moveDown', 'Move down')}
                      className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicateKpi(index)}
                      title={t('common.duplicate', 'Duplicate')}
                      className="p-1 text-slate-400 hover:text-indigo-300 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteKpi(index)}
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
                {/* Row 1: KPI Name EN/AR */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {t('sop.kpis.kpiNameEn', 'Indicator / Metric Name (EN)')} <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={kpi.kpi_name_en}
                      onChange={(e) => handleUpdateKpi(index, { kpi_name_en: e.target.value })}
                      disabled={readOnly}
                      placeholder="e.g. Chemotherapy Double-Check Compliance Rate"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {t('sop.kpis.kpiNameAr', 'اسم المؤشر / المقياس (AR)')}
                    </label>
                    <input
                      type="text"
                      value={kpi.kpi_name_ar || ''}
                      onChange={(e) => handleUpdateKpi(index, { kpi_name_ar: e.target.value })}
                      disabled={readOnly}
                      dir="rtl"
                      placeholder="مثال: نسبة الالتزام بالتحقق المزدوج لجرعات الكيماوي"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-60 text-right"
                    />
                  </div>
                </div>

                {/* Row 2: Target, Frequency, Owner */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {t('sop.kpis.targetValue', 'Target / Threshold')} <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={kpi.target_value}
                      onChange={(e) => handleUpdateKpi(index, { target_value: e.target.value })}
                      disabled={readOnly}
                      placeholder="e.g. ≥ 98%, 100%, < 15 min"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-60 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {t('sop.kpis.frequency', 'Measurement Frequency')} <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={kpi.measurement_frequency}
                      onChange={(e) => handleUpdateKpi(index, { measurement_frequency: e.target.value })}
                      disabled={readOnly}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                    >
                      <option value="Daily">{t('common.daily', 'Daily')}</option>
                      <option value="Weekly">{t('common.weekly', 'Weekly')}</option>
                      <option value="Monthly">{t('common.monthly', 'Monthly')}</option>
                      <option value="Quarterly">{t('common.quarterly', 'Quarterly')}</option>
                      <option value="Biannual">{t('common.biannual', 'Biannual')}</option>
                      <option value="Annual">{t('common.annual', 'Annual')}</option>
                      <option value="Per Batch / Event">{t('sop.kpis.perBatch', 'Per Batch / Event')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {t('sop.kpis.monitoringOwner', 'Monitoring Lead / Owner')}
                    </label>
                    <select
                      value={kpi.owner_id || ''}
                      onChange={(e) => {
                        const val = e.target.value || null;
                        const prof = profiles.find(p => p.id === val);
                        handleUpdateKpi(index, {
                          owner_id: val,
                          owner_name: prof?.full_name || null,
                        });
                      }}
                      disabled={readOnly}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                    >
                      <option value="">{t('common.unassigned', 'Unassigned')}</option>
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name} {p.job_title ? `(${p.job_title})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 3: Description EN/AR */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-800/60">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      {t('sop.kpis.descriptionEn', 'Audit Method / Calculation Formula (EN)')}
                    </label>
                    <textarea
                      rows={2}
                      value={kpi.description_en || ''}
                      onChange={(e) => handleUpdateKpi(index, { description_en: e.target.value })}
                      disabled={readOnly}
                      dir="ltr"
                      placeholder="Sample 100% of high-alert chemotherapy EHR records. Formula: (Verified Orders / Total Orders) * 100."
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      {t('sop.kpis.descriptionAr', 'طريقة القياس / معادلة الاحتساب (AR)')}
                    </label>
                    <textarea
                      rows={2}
                      value={kpi.description_ar || ''}
                      onChange={(e) => handleUpdateKpi(index, { description_ar: e.target.value })}
                      disabled={readOnly}
                      dir="rtl"
                      placeholder="تدقيق كامل أوامر العلاج الكيماوي عالي الخطورة. المعادلة: (الأوامر المدققة / إجمالي الأوامر) * 100."
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-60 text-right"
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
