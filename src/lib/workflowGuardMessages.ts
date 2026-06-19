export type GuardMessageKey =
  | 'delay_reason_required'
  | 'accepted_evidence_required'
  | 'self_approval_blocked'
  | 'quality_closure_required'
  | 'audit_review_required'
  | 'return_reason_required';

export const workflowGuardMessages: Record<GuardMessageKey, { en: string; ar: string }> = {
  delay_reason_required: {
    en: 'Delay reason is required before marking this item delayed.',
    ar: 'يجب تسجيل سبب التأخير قبل تحويل البند إلى متأخر.',
  },
  accepted_evidence_required: {
    en: 'Accepted evidence is required before closure.',
    ar: 'يجب وجود دليل مقبول قبل الإغلاق.',
  },
  self_approval_blocked: {
    en: 'Self-approval is not allowed.',
    ar: 'لا يسمح بالاعتماد الذاتي.',
  },
  quality_closure_required: {
    en: 'Quality closure is required before closing this OVR.',
    ar: 'يجب إغلاق بلاغ OVR من قبل الجودة.',
  },
  audit_review_required: {
    en: 'Audit review is required before closing this finding.',
    ar: 'يجب مراجعة التدقيق قبل إغلاق هذه الملاحظة.',
  },
  return_reason_required: {
    en: 'Return reason is required before sending back for clarification.',
    ar: 'يجب تسجيل سبب الإرجاع قبل إعادة البند للتوضيح.',
  },
};

export function translateGuardError(message: string, language: 'en' | 'ar') {
  const normalized = message.toLowerCase();
  if (normalized.includes('delay reason')) return workflowGuardMessages.delay_reason_required[language];
  if (normalized.includes('accepted evidence')) return workflowGuardMessages.accepted_evidence_required[language];
  if (normalized.includes('self-approval')) return workflowGuardMessages.self_approval_blocked[language];
  if (normalized.includes('quality closure')) return workflowGuardMessages.quality_closure_required[language];
  if (normalized.includes('audit review')) return workflowGuardMessages.audit_review_required[language];
  if (normalized.includes('return reason')) return workflowGuardMessages.return_reason_required[language];
  return message;
}
