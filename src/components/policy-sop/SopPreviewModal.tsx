import { useI18n } from '../../i18n/I18nContext';
import type { DetailedSopRecord } from '../../lib/policySopApi';
import { X, Printer, BookOpen, ShieldAlert, GraduationCap, CheckCircle2, Shield, Award, Layers, AlertTriangle, Link2 } from 'lucide-react';
import { DocumentStatusBadge } from './DocumentStatusBadge';
import { DocumentVersionBadge } from './DocumentVersionBadge';
import { ControlledDocumentPrintRecord } from './ControlledDocumentPrintRecord';

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
        <article
          className="governed-print-root governed-print-root--screen-preview controlled-document-print p-8 max-h-[80vh] overflow-y-auto bg-slate-900/50 space-y-8 text-slate-100 font-sans"
          data-print-active="true"
        >
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
                    {sop.primary_policy_document_code} - {sop.primary_policy_document_title} ({sop.primary_policy_version_label || t('controlledPrint.notRecorded')})
                  </span>
                ) : (
                  <span className="text-slate-400 capitalize">{sop.governance_link_state?.replace('_', ' ')}</span>
                )}
              </div>
            </div>
          </div>

          <ControlledDocumentPrintRecord
            versionLabel={sop.version_label}
            versionNumber={sop.version_number}
            isCurrentVersion={sop.is_current_version}
            approvedBy={sop.approved_by}
            approvedAt={sop.approved_at}
            signOffRequired={sop.acknowledgment_required}
          />

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

          {/* Definitions & Abbreviations */}
          {sop.definitions && sop.definitions.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1 mb-3">
                2. {t('sop.tab.definitions')}
              </h3>
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-3 py-2 w-12 text-center">#</th>
                      <th className="px-3 py-2 w-28">Abbreviation</th>
                      <th className="px-3 py-2 w-1/3">Term</th>
                      <th className="px-3 py-2">Definition</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {sop.definitions.map((def) => (
                      <tr key={def.id || def.sequence_number} className="hover:bg-slate-900/30">
                        <td className="px-3 py-2 text-center font-mono text-slate-400">{def.sequence_number}</td>
                        <td className="px-3 py-2 font-mono font-semibold text-indigo-300">{def.abbreviation || '—'}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-100">{def.term_en || '—'}</div>
                          {def.term_ar && <div className="text-[11px] text-slate-400 mt-0.5" dir="rtl">{def.term_ar}</div>}
                        </td>
                        <td className="px-3 py-2">
                          <div className="text-slate-200 leading-relaxed">{def.definition_en}</div>
                          {def.definition_ar && <div className="text-[11px] text-slate-400 mt-0.5" dir="rtl">{def.definition_ar}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Roles & Responsibilities Matrix */}
          {sop.role_responsibilities && sop.role_responsibilities.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1 mb-3">
                3. {t('sop.tab.responsibilities')}
              </h3>
              <div className="space-y-3">
                {sop.role_responsibilities.map((resp) => (
                  <div key={resp.id || resp.sequence_number} className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800/60 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-indigo-400">Role {resp.sequence_number}</span>
                        <span className="text-slate-200 font-semibold">• {resp.role_name || resp.job_title}</span>
                        {resp.job_title && resp.role_name && (
                          <span className="text-[11px] text-slate-400">({resp.job_title})</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      <div>
                        <div className="font-semibold text-slate-400 text-[11px] mb-0.5">Assigned Responsibilities:</div>
                        <p className="text-slate-200 leading-relaxed">{resp.responsibility_en}</p>
                        {resp.accountable_for_en && (
                          <div className="mt-2 text-[11px] text-slate-400">
                            <span className="font-semibold text-slate-300">Accountable For:</span> {resp.accountable_for_en}
                          </div>
                        )}
                      </div>
                      {(resp.responsibility_ar || resp.accountable_for_ar) && (
                        <div dir="rtl" className="text-right">
                          <div className="font-semibold text-slate-400 text-[11px] mb-0.5">المسؤوليات المحددة:</div>
                          {resp.responsibility_ar && <p className="text-slate-200 leading-relaxed">{resp.responsibility_ar}</p>}
                          {resp.accountable_for_ar && (
                            <div className="mt-2 text-[11px] text-slate-400">
                              <span className="font-semibold text-slate-300">المساءلة النهائية:</span> {resp.accountable_for_ar}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Procedure Steps Table */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1 mb-3">
              4. {t('sop.procedure.title')}
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

          {/* Risks & Controls Traceability */}
          {((sop.risk_links && sop.risk_links.length > 0) || (sop.derived_controls && sop.derived_controls.length > 0)) && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1 mb-2">
                5. Risks & Controls Traceability
              </h3>

              {sop.risk_links && sop.risk_links.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                      <tr>
                        <th className="px-3 py-2 w-12 text-center">#</th>
                        <th className="px-3 py-2 w-1/4">Risk Code & Title</th>
                        <th className="px-3 py-2 w-32">Relationship</th>
                        <th className="px-3 py-2 w-24">Severity</th>
                        <th className="px-3 py-2">Context Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-200">
                      {sop.risk_links.map((rl) => (
                        <tr key={rl.id || rl.sequence_number} className="hover:bg-slate-900/30">
                          <td className="px-3 py-2 text-center font-mono text-slate-400">{rl.sequence_number}</td>
                          <td className="px-3 py-2">
                            <span className="font-mono font-bold text-indigo-300 mr-1.5">[{rl.risk_code || 'RISK'}]</span>
                            <span>{rl.risk_title}</span>
                          </td>
                          <td className="px-3 py-2 capitalize text-slate-300">{rl.relationship_type?.replace(/_/g, ' ')}</td>
                          <td className="px-3 py-2 uppercase text-slate-400">{rl.risk_level || 'medium'}</td>
                          <td className="px-3 py-2 text-slate-300">{rl.context_note_en || rl.context_note_ar || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {sop.derived_controls && sop.derived_controls.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                      <tr>
                        <th className="px-3 py-2 w-28">Control Code</th>
                        <th className="px-3 py-2">Derived Control Title</th>
                        <th className="px-3 py-2 w-28">Type</th>
                        <th className="px-3 py-2 w-24 text-center">Key Control</th>
                        <th className="px-3 py-2 w-36">Step References</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-200">
                      {sop.derived_controls.map((ctrl) => (
                        <tr key={ctrl.control_id} className="hover:bg-slate-900/30">
                          <td className="px-3 py-2 font-mono font-bold text-sky-300">{ctrl.control_code || 'CTRL'}</td>
                          <td className="px-3 py-2 font-medium text-slate-100">{ctrl.control_title}</td>
                          <td className="px-3 py-2 capitalize text-slate-400">{ctrl.control_type}</td>
                          <td className="px-3 py-2 text-center text-purple-300">{ctrl.key_control ? 'Yes' : 'No'}</td>
                          <td className="px-3 py-2 text-slate-400">Steps {ctrl.step_sequences?.join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Accreditation & Standards Alignment */}
          {((sop.inherited_accreditations && sop.inherited_accreditations.length > 0) || (sop.accreditation_links && sop.accreditation_links.length > 0)) && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1 mb-2">
                6. Accreditation & Regulatory Alignment
              </h3>

              {sop.inherited_accreditations && sop.inherited_accreditations.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                      <tr>
                        <th className="px-3 py-2 w-28">Framework</th>
                        <th className="px-3 py-2 w-28">Clause Code</th>
                        <th className="px-3 py-2">Inherited Clause Title</th>
                        <th className="px-3 py-2">Policy Requirement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-200">
                      {sop.inherited_accreditations.map((item, idx) => (
                        <tr key={`${item.clause_id}-${idx}`} className="hover:bg-slate-900/30">
                          <td className="px-3 py-2 font-semibold text-indigo-300">{item.framework} ({item.standard_code})</td>
                          <td className="px-3 py-2 font-mono font-bold text-slate-200">{item.clause_code}</td>
                          <td className="px-3 py-2 font-medium text-slate-100">{item.clause_title}</td>
                          <td className="px-3 py-2 text-slate-300">{item.policy_requirement_en || item.policy_requirement_ar || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {sop.accreditation_links && sop.accreditation_links.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                      <tr>
                        <th className="px-3 py-2 w-12 text-center">#</th>
                        <th className="px-3 py-2 w-28">Framework</th>
                        <th className="px-3 py-2 w-28">Clause Code</th>
                        <th className="px-3 py-2">Direct Clause Title</th>
                        <th className="px-3 py-2 w-28">Strength</th>
                        <th className="px-3 py-2">Context Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-200">
                      {sop.accreditation_links.map((al) => (
                        <tr key={al.id || al.sequence_number} className="hover:bg-slate-900/30">
                          <td className="px-3 py-2 text-center font-mono text-slate-400">{al.sequence_number}</td>
                          <td className="px-3 py-2 font-semibold text-purple-300">{al.framework || 'STD'}</td>
                          <td className="px-3 py-2 font-mono font-bold text-slate-200">{al.clause_code || 'CLAUSE'}</td>
                          <td className="px-3 py-2 font-medium text-slate-100">{al.clause_title || '—'}</td>
                          <td className="px-3 py-2 capitalize text-purple-200">{al.link_strength}</td>
                          <td className="px-3 py-2 text-slate-300">{al.context_note_en || al.context_note_ar || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Monitoring & Performance Indicators */}
          {sop.monitoring_kpis && sop.monitoring_kpis.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1 mb-3">
                7. {t('sop.tab.monitoring')}
              </h3>
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-3 py-2 w-12 text-center">#</th>
                      <th className="px-3 py-2 w-1/3">Indicator Name</th>
                      <th className="px-3 py-2 w-28">Target</th>
                      <th className="px-3 py-2 w-28">Frequency</th>
                      <th className="px-3 py-2 w-36">Owner</th>
                      <th className="px-3 py-2">Calculation / Audit Method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {sop.monitoring_kpis.map((kpi) => (
                      <tr key={kpi.id || kpi.sequence_number} className="hover:bg-slate-900/30">
                        <td className="px-3 py-2 text-center font-mono text-slate-400">{kpi.sequence_number}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-100">{kpi.kpi_name_en}</div>
                          {kpi.kpi_name_ar && <div className="text-[11px] text-slate-400 mt-0.5" dir="rtl">{kpi.kpi_name_ar}</div>}
                        </td>
                        <td className="px-3 py-2 font-mono font-semibold text-emerald-300">{kpi.target_value}</td>
                        <td className="px-3 py-2 text-slate-300">{kpi.measurement_frequency}</td>
                        <td className="px-3 py-2 text-slate-300">{kpi.owner_name || 'Unassigned'}</td>
                        <td className="px-3 py-2">
                          <div className="text-slate-300 leading-relaxed">{kpi.description_en || '—'}</div>
                          {kpi.description_ar && <div className="text-[11px] text-slate-400 mt-0.5" dir="rtl">{kpi.description_ar}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
        </article>
      </div>
    </div>
  );
}
