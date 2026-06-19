import { useState } from 'react';
import { DatabaseBackup, PlayCircle, RefreshCw } from 'lucide-react';
import { DataState } from '../components/DataState';
import { StatusBadge } from '../components/StatusBadge';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import { formatDate } from '../lib/format';
import { getRestoreDryRuns, startRestoreDryRun } from '../lib/releaseOpsApi';
import { actionErrorMessage } from '../lib/privilegedAction';

export function RestoreDryRunCenter() {
  const { language } = useI18n();
  const text = language === 'ar' ? ar : en;
  const runs = useAsyncData(getRestoreDryRuns, []);
  const [actionError, setActionError] = useState('');
  const rows = runs.data ?? [];
  const passed = rows.filter(row => row.status === 'passed').length;
  const failed = rows.filter(row => row.status === 'failed').length;
  const planned = rows.filter(row => row.status === 'planned' || row.status === 'running').length;

  const start = async () => {
    setActionError('');
    try {
      await startRestoreDryRun('Production readiness restore dry-run');
      await runs.refresh();
    } catch (actionFailure) {
      setActionError(actionErrorMessage(actionFailure));
    }
  };

  return (
    <section className="page-section">
      <div className="section-heading command-hero">
        <div><p className="eyebrow">{text.eyebrow}</p><h3>{text.title}</h3><p className="section-subtitle">{text.subtitle}</p></div>
        <div className="button-row"><button className="ghost-button" onClick={runs.refresh}><RefreshCw size={16} /> {text.refresh}</button><button className="primary-button" onClick={start}><PlayCircle size={16} /> {text.start}</button></div>
      </div>
      {actionError && <div className="notice-banner danger">{actionError}</div>}
      <div className="stats-grid">
        <div className="stat-card success"><DatabaseBackup size={20} /><div className="stat-value">{passed}</div><div className="stat-label">{text.passed}</div></div>
        <div className="stat-card warning"><DatabaseBackup size={20} /><div className="stat-value">{planned}</div><div className="stat-label">{text.planned}</div></div>
        <div className="stat-card danger"><DatabaseBackup size={20} /><div className="stat-value">{failed}</div><div className="stat-label">{text.failed}</div></div>
      </div>
      <div className="panel">
        <div className="panel-header"><h4>{text.drills}</h4><p>{text.drillsHint}</p></div>
        <DataState loading={runs.loading} error={runs.error} empty={!rows.length}>
          <div className="warning-stack">
            {rows.map(row => (
              <div className={`warning-card restore-card ${row.status}`} key={row.id}>
                <div className="split-header"><strong>{row.scenarioName}</strong><StatusBadge status={row.status} /></div>
                <p>{row.resultSummary}</p>
                <div className="command-meta"><span>{row.backupPackageId}</span><span>{row.startedAt ? formatDate(row.startedAt) : text.notStarted}</span><span>{row.evidenceFile || text.noEvidence}</span></div>
              </div>
            ))}
          </div>
        </DataState>
      </div>
    </section>
  );
}
const en = { eyebrow: 'Backup assurance', title: 'Restore Dry-run Center', subtitle: 'Track restore drills so backups are proven, not only exported.', refresh: 'Refresh', start: 'Start dry-run', passed: 'Passed', planned: 'Planned/running', failed: 'Failed', drills: 'Restore drill board', drillsHint: 'A production release should have at least one recent passed restore dry-run.', notStarted: 'Not started', noEvidence: 'No evidence file' };
const ar = { eyebrow: 'ضمان النسخ الاحتياطي', title: 'مركز تجربة الاستعادة', subtitle: 'تابع تجارب الاستعادة حتى تكون النسخ مثبتة وليست مجرد تصدير.', refresh: 'تحديث', start: 'بدء تجربة', passed: 'ناجحة', planned: 'مخططة/جارية', failed: 'فاشلة', drills: 'لوحة تجارب الاستعادة', drillsHint: 'يفضل ألا يتم التشغيل الفعلي قبل وجود تجربة استعادة ناجحة حديثة.', notStarted: 'لم يبدأ', noEvidence: 'لا يوجد ملف دليل' };
