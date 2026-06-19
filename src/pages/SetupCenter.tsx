import { useMemo, useState, type CSSProperties } from 'react';
import { CheckCircle2, CircleAlert, CircleDashed, ClipboardList, FileDown, Rocket, ShieldCheck, UsersRound } from 'lucide-react';
import { ModuleHeader } from '../components/ModuleHeader';
import { StatCard } from '../components/StatCard';
import { DataState } from '../components/DataState';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import { getSetupReadiness, getTrainingChecklist, type SetupReadinessRow } from '../lib/onboardingApi';

const areaIcons = {
  organization: <UsersRound size={18} />,
  users: <ShieldCheck size={18} />,
  workflow: <ClipboardList size={18} />,
  risk: <CircleAlert size={18} />,
  ovr: <CircleAlert size={18} />,
  backup: <FileDown size={18} />,
  reports: <ClipboardList size={18} />
};

function csvEscape(value: unknown) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replaceAll('"', '""')}"` : str;
}

function downloadReadiness(rows: SetupReadinessRow[], lang: 'en' | 'ar') {
  const headers = ['area', 'severity', 'complete', 'title', 'description', 'current_count', 'target_count', 'action_hint'];
  const csvRows = rows.map(row => [
    row.area,
    row.severity,
    row.is_complete ? 'yes' : 'no',
    lang === 'ar' ? row.title_ar : row.title_en,
    lang === 'ar' ? row.description_ar : row.description_en,
    row.current_count,
    row.target_count,
    lang === 'ar' ? row.action_hint_ar : row.action_hint_en
  ]);
  const csv = [headers, ...csvRows].map(line => line.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'grc_setup_readiness.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export function SetupCenter() {
  const { t, language } = useI18n();
  const [activeArea, setActiveArea] = useState<string>('all');
  const readiness = useAsyncData(getSetupReadiness, []);
  const training = useAsyncData(getTrainingChecklist, []);

  const rows = readiness.data ?? [];
  const filteredRows = activeArea === 'all' ? rows : rows.filter(row => row.area === activeArea);
  const completed = rows.filter(row => row.is_complete).length;
  const critical = rows.filter(row => row.severity === 'critical' && !row.is_complete).length;
  const warnings = rows.filter(row => row.severity === 'warning' && !row.is_complete).length;
  const readinessScore = rows.length ? Math.round((completed / rows.length) * 100) : 0;
  const areas = useMemo(() => ['all', ...Array.from(new Set(rows.map(row => row.area)))], [rows]);

  return (
    <section className="page-section setup-page">
      <ModuleHeader
        eyebrow={t('setup.eyebrow')}
        title={t('setup.title')}
        subtitle={t('setup.subtitle')}
        action={
          <button className="primary-button" onClick={() => downloadReadiness(rows, language)}>
            <FileDown size={16} /> {t('setup.exportChecklist')}
          </button>
        }
      />

      <div className="setup-hero panel modern-gradient-panel">
        <div>
          <p className="eyebrow">{t('setup.rolloutMode')}</p>
          <h4>{t('setup.rolloutTitle')}</h4>
          <p>{t('setup.rolloutText')}</p>
        </div>
        <div className="readiness-ring" style={{ '--score': readinessScore } as CSSProperties}>
          <strong>{readinessScore}%</strong>
          <span>{t('setup.ready')}</span>
        </div>
      </div>

      <div className="stats-grid compact-grid">
        <StatCard label={t('setup.readinessScore')} value={`${readinessScore}%`} tone={readinessScore >= 80 ? 'success' : 'warning'} />
        <StatCard label={t('setup.completedChecks')} value={`${completed}/${rows.length || 0}`} tone="success" />
        <StatCard label={t('setup.criticalGaps')} value={critical} tone={critical ? 'danger' : 'success'} />
        <StatCard label={t('setup.warningGaps')} value={warnings} tone={warnings ? 'warning' : 'success'} />
      </div>

      <DataState loading={readiness.loading} error={readiness.error}>
        <div className="panel">
          <div className="split-header">
            <div className="panel-header">
              <h4>{t('setup.readinessChecklist')}</h4>
              <p>{t('setup.readinessHint')}</p>
            </div>
            <div className="segmented-control">
              {areas.map(area => (
                <button key={area} className={activeArea === area ? 'active' : ''} onClick={() => setActiveArea(area)}>
                  {area === 'all' ? t('setup.allAreas') : t(`setup.area.${area}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="setup-checklist-grid">
            {filteredRows.map(row => (
              <article key={row.check_key} className={`setup-check-card ${row.severity} ${row.is_complete ? 'complete' : ''}`}>
                <div className="setup-check-icon">
                  {row.is_complete ? <CheckCircle2 size={20} /> : row.severity === 'critical' ? <CircleAlert size={20} /> : <CircleDashed size={20} />}
                </div>
                <div>
                  <div className="setup-check-topline">
                    <span>{areaIcons[row.area]}</span>
                    <strong>{language === 'ar' ? row.title_ar : row.title_en}</strong>
                  </div>
                  <p>{language === 'ar' ? row.description_ar : row.description_en}</p>
                  <div className="setup-progress-line">
                    <span style={{ width: `${Math.min(100, Math.round((row.current_count / Math.max(1, row.target_count)) * 100))}%` }} />
                  </div>
                  <small>{row.current_count} / {row.target_count} · {language === 'ar' ? row.action_hint_ar : row.action_hint_en}</small>
                </div>
              </article>
            ))}
          </div>
        </div>
      </DataState>

      <DataState loading={training.loading} error={training.error}>
        <div className="panel">
          <div className="panel-header">
            <h4>{t('setup.trainingPlan')}</h4>
            <p>{t('setup.trainingHint')}</p>
          </div>
          <div className="training-grid">
            {(training.data ?? []).map(item => (
              <article key={item.id} className="training-card">
                <Rocket size={20} />
                <div>
                  <span>{t(`setup.audience.${item.audience}`)}</span>
                  <strong>{language === 'ar' ? item.title_ar : item.title_en}</strong>
                  <p>{language === 'ar' ? item.objective_ar : item.objective_en}</p>
                  <small>{item.estimated_minutes} {t('setup.minutes')}</small>
                </div>
              </article>
            ))}
          </div>
        </div>
      </DataState>
    </section>
  );
}
