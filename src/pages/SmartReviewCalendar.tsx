
import { CalendarClock, CheckCircle2, Download } from 'lucide-react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import { useAsyncData } from '../hooks/useAsyncData';
import { getRecurringReviewQueue } from '../lib/automationApi';
import { exportRows } from '../lib/exportUtils';
import { useI18n } from '../i18n/I18nContext';

const tone = (status: string) => status === 'overdue' ? 'danger' : status === 'due' || status === 'due_soon' ? 'warning' : status === 'completed' ? 'good' : 'neutral';

export function SmartReviewCalendar() {
  const { t, language } = useI18n();
  const reviews = useAsyncData(getRecurringReviewQueue, []);
  const rows = reviews.data ?? [];

  return (
    <section className="page-section automation-page">
      <div className="section-heading command-hero">
        <div>
          <p className="eyebrow">{t('reviews.eyebrow')}</p>
          <h3>{t('reviews.title')}</h3>
          <p className="section-subtitle">{t('reviews.subtitle')}</p>
        </div>
        <button className="primary-button" onClick={() => exportRows('smart_review_calendar', rows as unknown as Record<string, unknown>[], 'csv')}><Download size={16} /> CSV</button>
      </div>
      <div className="stats-grid">
        <KpiTile label={t('reviews.total')} value={rows.length} />
        <KpiTile label={t('reviews.overdue')} value={rows.filter(r => r.computedStatus === 'overdue').length} tone="danger" />
        <KpiTile label={t('reviews.dueSoon')} value={rows.filter(r => r.computedStatus === 'due_soon' || r.computedStatus === 'due').length} tone="warning" />
        <KpiTile label={t('reviews.completed')} value={rows.filter(r => r.computedStatus === 'completed').length} tone="good" />
      </div>
      <ModernCard title={t('reviews.queue')} subtitle={t('reviews.queueHint')}>
        <DataState loading={reviews.loading} error={reviews.error} empty={!rows.length}>
          <div className="review-timeline">
            {rows.map(row => (
              <article className={`review-card ${row.computedStatus}`} key={row.id}>
                <div className="review-date"><CalendarClock size={16} /><strong>{row.nextDueDate}</strong><span>{row.frequency}</span></div>
                <div className="review-main">
                  <div className="automation-rule-head"><strong>{language === 'ar' ? row.titleAr : row.titleEn}</strong><StatusPill tone={tone(row.computedStatus)}>{row.computedStatus}</StatusPill></div>
                  <p>{row.area} · {language === 'ar' ? row.departmentNameAr : row.departmentNameEn}</p>
                  <div className="automation-meta-row"><span>{t('reviews.owner')}: {language === 'ar' ? row.ownerNameAr : row.ownerNameEn}</span><span>{t('reviews.reviewer')}: {language === 'ar' ? row.reviewerNameAr : row.reviewerNameEn}</span></div>
                </div>
                <CheckCircle2 size={18} className="review-check" />
              </article>
            ))}
          </div>
        </DataState>
      </ModernCard>
    </section>
  );
}
