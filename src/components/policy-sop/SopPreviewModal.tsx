import { useI18n } from '../../i18n/I18nContext';
import type { DetailedSopRecord } from '../../lib/policySopApi';
import { X, Printer, BookOpen, ShieldAlert, GraduationCap, CheckCircle2 } from 'lucide-react';
import { DocumentStatusBadge } from './DocumentStatusBadge';
import { DocumentVersionBadge } from './DocumentVersionBadge';

interface SopPreviewModalProps {
  sop: DetailedSopRecord;
  onClose: () => void;
}

export function SopPreviewModal({ sop, onClose }: SopPreviewModalProps) {
  const { t } = useI18n();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-8">
        {/* Modal Toolbar */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-semibold text-indigo-400 bg-indigo-950/60 px-2.5 py-1 rounded border border-indigo-800/40">
              {sop.document_code}
            </span>
            <h2 className="text-sm font-semibold text-slate-100">
              {t('sop.preview.title')}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t('common.print')}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Controlled Document Container */}
        <div className="p-8 max-h-[80vh] overflow-y-auto bg-slate-900/50 space-y-8 text-slate-100 font-sans">
          {/* Institutional Document Header Box */}
          <div className="border border-slate-700 rounded-xl p-6 bg-slate-950/70 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400">
                  STANDARD OPERATING PROCEDURE
                </span>
                <h1 className="text-xl font-bold text-white mt-1">{sop.title_en}</h1>
                {sop.title_ar && (
                  <h2 className="text-lg font-semibold text-slate-300 mt-1" dir="rtl">
                    {sop.title_ar}
                  </h2>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <DocumentVersionBadge versionLabel={sop.version_label} isCurrent={sop.is_current_version} />
                <DocumentStatusBadge status={sop.document_status} effectiveDate={sop.effective_date} />
              </div>
            </div>

            {/* Document Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block">{t('sop.code')}</span>
                <span className="font-mono font-semibold text-slate-200">{sop.document_code}</span>
              </div>
              <div>
                <span className="text-slate-400 block">{t('sop.process')}</span>
                <span className="font-semibold text-slate-200">{sop.process_name_en || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">{t('sop.processOwner')}</span>
                <span className="font-semibold text-slate-200">{sop.process_owner_name || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">{t('policy.department')}</span>
                <span className="font-semibold text-slate-200">{sop.department_name || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">{t('policy.effectiveDate')}</span>
                <span className="font-semibold text-slate-200">{sop.effective_date || 'Pending'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">{t('policy.reviewDueDate')}</span>
                <span className="font-semibold text-slate-200">{sop.next_review_date || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">{t('policy.criticality')}</span>
                <span className="capitalize font-semibold text-slate-200">{sop.criticality_level}</span>
              </div>
              <div>
                <span className="text-slate-400 block">{t('policy.confidentiality')}</span>
                <span className="capitalize font-semibold text-slate-200">{sop.confidentiality_level}</span>
              </div>
            </div>

            {/* Governing Policy Reference Banner */}
            <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-800/40 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-400" />
                <span className="font-semibold text-indigo-200">{t('sop.governingPolicy')}:</span>
                {sop.governance_link_state === 'linked' && sop.primary_policy_document_code ? (
                  <span className="text-indigo-300">
                    {sop.primary_policy_document_code} - {sop.primary_policy_document_title} (v{sop.primary_policy_version_label || '1.0'})
                  </span>
                ) : (
                  <span className="text-slate-400 capitalize">{sop.governance_link_state?.replace('_', ' ')}</span>
                )}
              </div>
            </div>
          </div>

          {/* Purpose & Scope */}
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1 mb-2">
                1. {t('sop.tab.purposeAndScope')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <h4 className="font-semibold text-slate-300 mb-1">Purpose (EN)</h4>
                  <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{sop.purpose_en || '—'}</p>
                </div>
                {sop.purpose_ar && (
                  <div dir="rtl" className="text-right">
                    <h4 className="font-semibold text-slate-300 mb-1">الغرض (AR)</h4>
                    <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{sop.purpose_ar}</p>
                  </div>
                )}
              </div>
            </div>

            {sop.scope_en && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <h4 className="font-semibold text-slate-300 mb-1">Scope (EN)</h4>
                    <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{sop.scope_en}</p>
                  </div>
                  {sop.scope_ar && (
                    <div dir="rtl" className="text-right">
                      <h4 className="font-semibold text-slate-300 mb-1">نطاق التطبيق (AR)</h4>
                      <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{sop.scope_ar}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Procedure Steps Table */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1 mb-3">
              2. {t('sop.procedure.title')}
            </h3>

            {sop.procedure_steps.length === 0 ? (
              <p className="text-xs text-slate-500 italic">{t('sop.procedure.noSteps')}</p>
            ) : (
              <div className="space-y-3">
                {sop.procedure_steps.map((step) => (
                  <div key={step.id || step.sequence_number} className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800/60 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-indigo-400">Step {step.sequence_number}</span>
                        <span className="text-slate-300 font-semibold">• {step.responsible_role}</span>
                        {step.criticality === 'critical' && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-rose-300 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-800/40 font-bold">
                            <ShieldAlert className="w-3 h-3 text-rose-400" />
                            <span>CCP</span>
                          </span>
                        )}
                      </div>
                      {step.timing_sla_en && (
                        <span className="text-[11px] text-slate-400">{step.timing_sla_en}</span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      <div>
                        <p className="text-slate-200 leading-relaxed">{step.action_instruction_en}</p>
                        {step.expected_evidence_record_en && (
                          <div className="mt-2 text-[11px] text-slate-400">
                            <span className="font-semibold text-slate-300">Expected Evidence:</span> {step.expected_evidence_record_en}
                          </div>
                        )}
                      </div>
                      {step.action_instruction_ar && (
                        <div dir="rtl" className="text-right">
                          <p className="text-slate-200 leading-relaxed">{step.action_instruction_ar}</p>
                          {step.expected_evidence_record_ar && (
                            <div className="mt-2 text-[11px] text-slate-400">
                              <span className="font-semibold text-slate-300">الدليل المتوقع:</span> {step.expected_evidence_record_ar}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {step.is_decision_point && (
                      <div className="mt-2 p-2 rounded bg-purple-950/30 border border-purple-800/30 text-[11px] text-purple-200">
                        <span className="font-semibold">Decision Criteria:</span> {step.decision_criteria_en}
                        {step.decision_criteria_ar && <span className="block mt-0.5" dir="rtl">{step.decision_criteria_ar}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Training & Governance Settings */}
          <div className="border-t border-slate-800 pt-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div>
              <h3 className="font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-indigo-400" />
                <span>Training & Competency</span>
              </h3>
              <ul className="space-y-1 text-slate-400">
                <li>Training Required: {sop.training_required ? 'Yes' : 'No'}</li>
                <li>Competency Assessment: {sop.competency_assessment_required ? 'Yes' : 'No'}</li>
                <li>Renewal Cycle: Every {sop.training_renewal_months || 12} months</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                <span>Acknowledgment & Attestation</span>
              </h3>
              <ul className="space-y-1 text-slate-400">
                <li>Acknowledgment Required: {sop.acknowledgment_required ? 'Yes' : 'No'}</li>
                <li>SLA for Sign-off: {sop.acknowledgment_sla_days || 30} days</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
