import { Archive, ClipboardCheck, FileText } from 'lucide-react';
import type { SopProcedureStep } from '../../lib/policySopApi';
import { useI18n } from '../../i18n/I18nContext';
import { StatusBadge } from '../StatusBadge';
import { SystemState } from '../ui/SystemState';

interface SopFormsRecordsPanelProps {
  steps: SopProcedureStep[];
}

export function SopFormsRecordsPanel({ steps }: SopFormsRecordsPanelProps) {
  const { t, language } = useI18n();
  const rows = steps.filter((step) => step.expected_evidence_record_en || step.expected_evidence_record_ar);

  return (
    <section className="ui2-forms-records" data-testid="sop-forms-records">
      <div className="ui2-section-heading">
        <div><p>{t('sop.records.evidenceContract', 'Evidence contract')}</p><h3>{t('sop.records.title', 'Forms & Records')}</h3></div>
        <span>{rows.length} {t('sop.records.linkedRecords', 'linked records')}</span>
      </div>
      <p className="ui2-section-intro">{t('sop.records.subtitle', 'Version-scoped records expected from governed procedure steps. Update record requirements in the Procedure Builder.')}</p>
      {rows.length === 0 ? (
        <SystemState variant="empty" title={t('sop.records.emptyTitle', 'No forms or records mapped')} message={t('sop.records.emptyMessage', 'Add an expected evidence record to a procedure step to establish this evidence contract.')} />
      ) : (
        <div className="ui2-record-grid">
          {rows.map((step) => (
            <article key={step.id || step.sequence_number}>
              <header><span><Archive size={15} />{t('sop.step', 'Step')} {step.sequence_number}</span><StatusBadge status={step.criticality} tone={step.criticality === 'critical' || step.criticality === 'high' ? 'danger' : 'neutral'} /></header>
              <h4>{language === 'ar' ? step.expected_evidence_record_ar || step.expected_evidence_record_en : step.expected_evidence_record_en || step.expected_evidence_record_ar}</h4>
              <dl><div><dt><ClipboardCheck size={13} />{t('sop.responsibleRole', 'Responsible role')}</dt><dd>{step.responsible_role || '—'}</dd></div><div><dt><FileText size={13} />{t('sop.sourceInstruction', 'Source instruction')}</dt><dd>{language === 'ar' ? step.action_instruction_ar || step.action_instruction_en : step.action_instruction_en}</dd></div><div><dt>{t('sop.timingSla', 'Timing / SLA')}</dt><dd>{language === 'ar' ? step.timing_sla_ar || step.timing_sla_en || '—' : step.timing_sla_en || step.timing_sla_ar || '—'}</dd></div></dl>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
