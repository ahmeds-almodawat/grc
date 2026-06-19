import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import {
  getV50BackupScorecard,
  getV50OptimizationQueue,
  getV50RestoreQueue,
  getV50ScaleScorecard,
  type V50BackupScorecard,
  type V50QueueItem,
  type V50ScaleScorecard,
} from '../lib/v50ScaleBackupApi';

export default function ScaleBackupRestoreCenter() {
  const { language } = useI18n();
  const lang = language;
  const [scale, setScale] = useState<V50ScaleScorecard | null>(null);
  const [backup, setBackup] = useState<V50BackupScorecard | null>(null);
  const [queue, setQueue] = useState<V50QueueItem[]>([]);
  const [restore, setRestore] = useState<any[]>([]);

  useEffect(() => {
    getV50ScaleScorecard().then(setScale);
    getV50BackupScorecard().then(setBackup);
    getV50OptimizationQueue().then(setQueue);
    getV50RestoreQueue().then(setRestore);
  }, []);

  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en);

  return (
    <div className="page-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">{t('v5.0 production controls', 'ضوابط الإنتاج v5.0')}</p>
          <h1>{t('Scale, Backup & Restore Center', 'مركز التوسع والنسخ الاحتياطي والاسترجاع')}</h1>
          <p>{t('Validate 1,000-user readiness, query optimization, production backups, and restore dry-runs.', 'تحقق من جاهزية 1000 مستخدم وتحسين الاستعلامات والنسخ الاحتياطي وتجارب الاسترجاع.')}</p>
        </div>
      </section>

      <div className="kpi-grid">
        <div className="kpi-card"><span>{t('Scale readiness', 'جاهزية التوسع')}</span><strong>{scale?.readiness_percent ?? 0}%</strong></div>
        <div className="kpi-card"><span>{t('Scale blockers', 'عوائق التوسع')}</span><strong>{scale?.blocked_controls ?? 0}</strong></div>
        <div className="kpi-card"><span>{t('Backup controls', 'ضوابط النسخ')}</span><strong>{backup?.backup_controls ?? 0}</strong></div>
        <div className="kpi-card"><span>{t('Restore dry-runs passed', 'تجارب الاسترجاع الناجحة')}</span><strong>{backup?.restore_dryruns_passed ?? 0}</strong></div>
      </div>

      <section className="panel-card">
        <h2>{t('Query optimization queue', 'قائمة تحسين الاستعلامات')}</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t('Object', 'العنصر')}</th><th>{t('Module', 'الوحدة')}</th><th>{t('Priority', 'الأولوية')}</th><th>{t('Status', 'الحالة')}</th><th>{t('Recommendation', 'التوصية')}</th></tr></thead>
            <tbody>{queue.map((row) => <tr key={row.id}><td>{row.object_name}</td><td>{row.page_or_module}</td><td>{row.priority}</td><td>{row.status}</td><td>{row.recommendation}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="panel-card">
        <h2>{t('Restore dry-run queue', 'قائمة تجارب الاسترجاع')}</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t('Job', 'المهمة')}</th><th>{t('Environment', 'البيئة')}</th><th>{t('Result', 'النتيجة')}</th><th>{t('Steps', 'الخطوات')}</th><th>{t('Owner', 'المسؤول')}</th></tr></thead>
            <tbody>{restore.map((row) => <tr key={row.id}><td>{lang === 'ar' ? row.title_ar : row.title_en}</td><td>{row.restore_environment}</td><td>{row.result}</td><td>{row.passed_steps}/{row.total_steps}</td><td>{row.owner_name}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
