import { X, Printer, Shield, CheckCircle } from 'lucide-react';
import { DetailedPolicyRecord } from '../../lib/policySopApi';
import { DocumentStatusBadge } from './DocumentStatusBadge';
import { DocumentVersionBadge } from './DocumentVersionBadge';
import { useI18n } from '../../i18n/I18nContext';
import { ControlledDocumentPrintRecord } from './ControlledDocumentPrintRecord';

interface PolicyPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  policy: DetailedPolicyRecord;
}

export function PolicyPreviewModal({
  isOpen,
  onClose,
  policy
}: PolicyPreviewModalProps) {
  const { t } = useI18n();

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        {/* Header Toolbar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <Shield className="text-indigo-600 dark:text-indigo-400" size={20} />
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t('policy.preview.title', 'Controlled Policy Document Preview')}
              </h3>
              <p className="text-xs text-slate-500 font-mono">{policy.document_code}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
            >
              <Printer size={14} />
              {t('common.print', 'Print')}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Document Body (A4 Style) */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-100/60 dark:bg-slate-950/60">
          <article
            className="governed-print-root governed-print-root--screen-preview controlled-document-print max-w-3xl mx-auto bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 space-y-8 print:border-none print:shadow-none"
            data-print-active="true"
          >
            {/* Institution Header */}
            <div className="border-b-2 border-slate-900 dark:border-slate-100 pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                    AL MODAWAT SPECIALIZED MEDICAL COMPANY
                  </h1>
                  <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400" dir="rtl">
                    شركة المداواة التخصصية الطبية
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-semibold">
                    Hospital Governance · Controlled Policy
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-base font-bold font-mono text-indigo-700 dark:text-indigo-400 block">
                    {policy.document_code}
                  </span>
                  <div className="flex items-center justify-end gap-2 mt-1">
                    <DocumentVersionBadge versionLabel={policy.version_label} isCurrent={policy.is_current_version} />
                    <DocumentStatusBadge status={policy.document_status} effectiveDate={policy.effective_date} />
                  </div>
                </div>
              </div>
            </div>

            {/* Document Title Header */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
                {policy.title_en}
              </h3>
              {policy.title_ar && (
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300" dir="rtl">
                  {policy.title_ar}
                </h4>
              )}
            </div>

            {/* Metadata Table */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs border-y border-slate-200 dark:border-slate-800 py-3">
              <div>
                <span className="text-slate-500 block">{t('policy.owner', 'Policy Owner')}</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{policy.document_owner_name || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">{t('common.department', 'Department')}</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{policy.department_name || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">{t('policy.effectiveDate', 'Effective Date')}</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{policy.effective_date || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">{t('policy.reviewDueDate', 'Next Review Date')}</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{policy.next_review_date || '—'}</span>
              </div>
            </div>

            <ControlledDocumentPrintRecord
              versionLabel={policy.version_label}
              versionNumber={policy.version_number}
              isCurrentVersion={policy.is_current_version}
              approvedBy={policy.approved_by}
              approvedAt={policy.approved_at}
            />

            {/* 1. Purpose */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b pb-1">
                1. Purpose & Objectives / الغرض والأهداف
              </h4>
              <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                {policy.purpose_en || 'No English purpose statement provided.'}
              </p>
              {policy.purpose_ar && (
                <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap mt-2" dir="rtl">
                  {policy.purpose_ar}
                </p>
              )}
            </div>

            {/* 2. Policy Statement */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b pb-1">
                2. Policy Statement / نص السياسة
              </h4>
              <div className="p-4 bg-indigo-50/40 dark:bg-indigo-950/20 border-l-4 border-indigo-500 rounded-r-lg">
                <p className="text-xs text-slate-900 dark:text-slate-100 font-medium leading-relaxed whitespace-pre-wrap">
                  {policy.policy_statement_en}
                </p>
                {policy.policy_statement_ar && (
                  <p className="text-xs text-slate-900 dark:text-slate-100 font-medium leading-relaxed whitespace-pre-wrap mt-2" dir="rtl">
                    {policy.policy_statement_ar}
                  </p>
                )}
              </div>
            </div>

            {/* 3. Scope & Principles */}
            {(policy.scope_en || policy.scope_ar || policy.principles_en || policy.principles_ar) && (
              <div className="space-y-4">
                {(policy.scope_en || policy.scope_ar) && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b pb-1">
                      3. Scope of Applicability / نطاق التطبيق
                    </h4>
                    <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                      {policy.scope_en}
                    </p>
                    {policy.scope_ar && (
                      <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed" dir="rtl">
                        {policy.scope_ar}
                      </p>
                    )}
                  </div>
                )}

                {(policy.principles_en || policy.principles_ar) && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b pb-1">
                      4. Governing Principles / المبادئ الحاكمة
                    </h4>
                    <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                      {policy.principles_en}
                    </p>
                    {policy.principles_ar && (
                      <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap" dir="rtl">
                        {policy.principles_ar}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 5. Requirements Table */}
            {policy.requirements.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b pb-1">
                  5. Mandatory Compliance Requirements / متطلبات الالتزام الإلزامية
                </h4>
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2 px-3 w-8">#</th>
                        <th className="py-2 px-3">Requirement / المتطلب</th>
                        <th className="py-2 px-3 w-32">Role / المسؤول</th>
                        <th className="py-2 px-3 w-24">Type / النوع</th>
                        <th className="py-2 px-3 w-36">Evidence / الدليل المتوقع</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {policy.requirements.map(req => (
                        <tr key={req.id || req.sequence_number}>
                          <td className="py-2 px-3 font-mono text-slate-500">{req.sequence_number}</td>
                          <td className="py-2 px-3">
                            <p className="font-medium text-slate-900 dark:text-slate-100">{req.requirement_statement_en}</p>
                            {req.requirement_statement_ar && (
                              <p className="text-slate-600 dark:text-slate-400 mt-0.5" dir="rtl">{req.requirement_statement_ar}</p>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{req.responsible_role || '—'}</td>
                          <td className="py-2 px-3">
                            {req.is_mandatory ? (
                              <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase">Mandatory</span>
                            ) : (
                              <span className="text-[10px] text-slate-500 uppercase">Guidance</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{req.expected_evidence_en || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 6. Exceptions & Escalation */}
            {(policy.exceptions_summary_en || policy.non_compliance_escalation_en) && (
              <div className="space-y-4 text-xs">
                {policy.exceptions_summary_en && (
                  <div className="space-y-1">
                    <h4 className="font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b pb-1">
                      6. Exceptions Governance / إدارة الاستثناءات
                    </h4>
                    <p className="text-slate-800 dark:text-slate-200">{policy.exceptions_summary_en}</p>
                  </div>
                )}
                {policy.non_compliance_escalation_en && (
                  <div className="space-y-1">
                    <h4 className="font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b pb-1">
                      7. Non-Compliance Escalation / إجراءات عدم الالتزام والتصعيد
                    </h4>
                    <p className="text-slate-800 dark:text-slate-200">{policy.non_compliance_escalation_en}</p>
                  </div>
                )}
              </div>
            )}
          </article>
        </div>
      </div>
    </div>
  );
}
