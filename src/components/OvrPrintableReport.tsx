import { useI18n } from '../i18n/I18nContext';
import { formatDate, humanize } from '../lib/format';
import type { EvidenceRow, OvrReportRow } from '../types/domain';

interface OvrPrintableReportProps {
  report: OvrReportRow;
  evidence: EvidenceRow[];
}

function valueOrDash(value: string | null | undefined) {
  return value?.trim() || '—';
}

function PrintedField({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'ovr-print-field ovr-print-field--wide' : 'ovr-print-field'}>
      <span>{label}</span>
      <strong>{value || '—'}</strong>
    </div>
  );
}

export function OvrPrintableReport({ report, evidence }: OvrPrintableReportProps) {
  const { language, t } = useI18n();
  const locale = language === 'ar' ? 'ar-SA' : 'en-GB';
  const generatedAt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
  const occurrenceDateTime = [formatDate(report.occurrence_date), report.occurrence_time].filter(Boolean).join(' · ');
  const department = language === 'ar' && report.departments?.name_ar
    ? report.departments.name_ar
    : report.departments?.name_en;
  const status = t(`status.${report.status}`, humanize(report.status));
  const category = t(`ovr.category.${report.occurrence_category}`, humanize(report.occurrence_category));
  const severity = report.severity_level ? t(`ovr.severity.${report.severity_level}`, humanize(report.severity_level)) : '—';

  return (
    <article className="governed-print-root ovr-print-report" dir={language === 'ar' ? 'rtl' : 'ltr'} aria-hidden="true">
      <header className="governed-print-header">
        <img src="/brand/almodawat-acc-logo.png" alt="Almodawat Assurance Control Center" />
        <div>
          <p>{t('ovr.print.brand', 'Almodawat Assurance Control Center')}</p>
          <h1>{t('ovr.print.title', 'Occurrence Variance Report')}</h1>
          <strong>{report.ovr_number || report.logging_number || report.id}</strong>
        </div>
      </header>

      <section className="governed-print-meta">
        <PrintedField label={t('ovr.print.generatedAt', 'Generated')} value={generatedAt} />
        <PrintedField label={t('ovr.print.reportNumber', 'Report number')} value={report.ovr_number || report.logging_number || report.id} />
      </section>

      <section className="governed-print-section">
        <h2>{t('ovr.print.occurrence', 'Occurrence details')}</h2>
        <div className="governed-print-grid">
          <PrintedField label={t('ovr.print.occurrenceDateTime', 'Occurrence date and time')} value={occurrenceDateTime} />
          <PrintedField label={t('ovr.location', 'Location')} value={valueOrDash(report.occurrence_location)} />
          <PrintedField label={t('common.department')} value={valueOrDash(department)} />
          <PrintedField label={t('ovr.category')} value={category} />
          <PrintedField label={t('ovr.severity')} value={severity} />
          <PrintedField label={t('common.status')} value={status} />
          <PrintedField label={t('ovr.print.factualDescription', 'Factual description')} value={report.brief_description} wide />
        </div>
      </section>

      <section className="governed-print-section">
        <h2>{t('ovr.print.reviewRecord', 'Review and response record')}</h2>
        <div className="governed-print-grid">
          <PrintedField label={t('ovr.supervisorInvestigation')} value={valueOrDash(report.supervisor_investigation)} wide />
          <PrintedField label={t('ovr.qualityComments')} value={valueOrDash(report.quality_manager_comments)} wide />
          <PrintedField label={t('ovr.referredResponse')} value={valueOrDash(report.referred_response)} wide />
          <PrintedField label={t('ovr.correctiveAction')} value={valueOrDash(report.corrective_action)} wide />
          <PrintedField label={t('ovr.finalVerdict')} value={valueOrDash(report.final_verdict)} wide />
        </div>
      </section>

      <section className="governed-print-section governed-print-break-safe">
        <h2>{t('ovr.print.evidenceList', 'Evidence list')}</h2>
        {evidence.length ? (
          <table>
            <thead><tr><th>{t('common.file')}</th><th>{t('common.type')}</th><th>{t('common.status')}</th><th>{t('common.date')}</th></tr></thead>
            <tbody>
              {evidence.map(item => (
                <tr key={item.id}>
                  <td>{item.file_name}</td>
                  <td>{item.file_type || '—'}</td>
                  <td>{t(`status.${item.status}`, humanize(item.status))}</td>
                  <td>{formatDate(item.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p>{t('ovr.print.noEvidence', 'No authorized evidence is linked to this report.')}</p>}
      </section>

      <section className="governed-print-section governed-print-break-safe">
        <h2>{t('ovr.print.workflowClosure', 'Key workflow and closure record')}</h2>
        <div className="governed-print-grid">
          <PrintedField label={t('ovr.print.reportedAt', 'Reported')} value={formatDate(report.created_at)} />
          <PrintedField label={t('common.status')} value={status} />
          <PrintedField label={t('ovr.print.qualityValidatedAt', 'Quality validated')} value={formatDate(report.quality_validated_at)} />
          <PrintedField label={t('ovr.print.finalVerdictAt', 'Final verdict issued')} value={formatDate(report.final_verdict_at)} />
          <PrintedField label={t('ovr.print.closureState', 'Closure state')} value={report.status === 'closed' ? t('status.closed') : t('ovr.print.notClosed', 'Not closed')} />
        </div>
      </section>
    </article>
  );
}
