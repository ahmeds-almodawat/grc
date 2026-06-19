import { useState } from 'react';
import { RefreshCcw, ShieldCheck, AlertTriangle, DatabaseZap, Languages, ServerCog } from 'lucide-react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import { getStabilizationCommandData, seedStagingValidationDefaults } from '../lib/stabilizationApi';
import { actionErrorMessage } from '../lib/privilegedAction';

function toneForStatus(status: string): 'good' | 'warning' | 'danger' | 'neutral' {
  if (['pass', 'passed', 'verified', 'healthy', 'ok', 'complete'].includes(status)) return 'good';
  if (['warning', 'watch', 'restore_test_needed', 'needs_review', 'pending'].includes(status)) return 'warning';
  if (['blocked', 'failed', 'critical', 'overdue', 'not_active', 'missing_ar', 'missing_en'].includes(status)) return 'danger';
  return 'neutral';
}

export function StagingValidationCenter() {
  const { t } = useI18n();
  const { data, loading, error, refresh } = useAsyncData(getStabilizationCommandData, []);
  const [actionError, setActionError] = useState('');

  const runSeed = async () => {
    setActionError('');
    try {
      await seedStagingValidationDefaults();
      await refresh();
    } catch (actionFailure) {
      setActionError(actionErrorMessage(actionFailure));
    }
  };

  const score = data?.summary.stagingReadinessScore ?? 0;
  const scoreTone = score >= 85 ? 'good' : score >= 70 ? 'warning' : 'danger';

  return (
    <div className="page-stack ultra-stabilization-page">
      <section className="hero-panel modern-hero">
        <div>
          <p className="eyebrow">{t('staging.eyebrow')}</p>
          <h1>{t('staging.title')}</h1>
          <p>{t('staging.subtitle')}</p>
        </div>
        <div className="hero-actions">
          <button className="primary-button" onClick={runSeed}>
            <DatabaseZap size={16} />
            {t('staging.seedDefaults')}
          </button>
          <button className="ghost-button" onClick={refresh}>
            <RefreshCcw size={16} />
            {t('common.refresh', 'Refresh')}
          </button>
        </div>
      </section>

      {actionError && <div className="notice-banner danger">{actionError}</div>}

      <DataState loading={loading} error={error} empty={!data}>
        {data && (
          <>
            <div className="modern-grid modern-grid--six">
              <KpiTile label={t('staging.readinessScore')} value={`${score}%`} tone={scoreTone} hint={t('staging.readinessHint')} />
              <KpiTile label={t('staging.blockers')} value={data.summary.blockedChecks} tone={data.summary.blockedChecks ? 'danger' : 'good'} />
              <KpiTile label={t('staging.warnings')} value={data.summary.warningChecks} tone={data.summary.warningChecks ? 'warning' : 'good'} />
              <KpiTile label={t('staging.passed')} value={data.summary.passedChecks} tone="good" />
              <KpiTile label={t('staging.criticalDefects')} value={data.summary.criticalOpenDefects} tone={data.summary.criticalOpenDefects ? 'danger' : 'good'} />
              <KpiTile label={t('staging.pending')} value={data.summary.pendingChecks} tone="warning" />
            </div>

            <div className="modern-grid modern-grid--two">
              <ModernCard
                title={t('staging.validationChecks')}
                subtitle={t('staging.validationChecksHint')}
              >
                <div className="ultra-list">
                  {data.checks.map(check => (
                    <div className="ultra-list-row" key={check.id}>
                      <div className="ultra-row-icon"><ShieldCheck size={17} /></div>
                      <div className="ultra-row-main">
                        <strong>{check.checkTitle}</strong>
                        <span>{check.checkArea} · {check.checkCode} · {check.ownerLabel ?? '—'}</span>
                        {check.resultNote && <small>{check.resultNote}</small>}
                      </div>
                      <div className="ultra-row-actions">
                        <StatusPill tone={toneForStatus(check.status)}>{check.status}</StatusPill>
                        <StatusPill tone={toneForStatus(check.severity)}>{check.severity}</StatusPill>
                      </div>
                    </div>
                  ))}
                </div>
              </ModernCard>

              <ModernCard title={t('staging.defectLog')} subtitle={t('staging.defectLogHint')}>
                <div className="ultra-list">
                  {data.defects.map(defect => (
                    <div className="ultra-list-row" key={defect.id}>
                      <div className="ultra-row-icon danger"><AlertTriangle size={17} /></div>
                      <div className="ultra-row-main">
                        <strong>{defect.title}</strong>
                        <span>{defect.defectCode} · {defect.area} · {defect.ownerLabel ?? '—'}</span>
                        {defect.description && <small>{defect.description}</small>}
                      </div>
                      <div className="ultra-row-actions">
                        <StatusPill tone={toneForStatus(defect.severity)}>{defect.severity}</StatusPill>
                        <StatusPill tone={toneForStatus(defect.status)}>{defect.status}</StatusPill>
                      </div>
                    </div>
                  ))}
                </div>
              </ModernCard>
            </div>

            <div className="modern-grid modern-grid--three">
              <ModernCard title={t('staging.quickRls')} subtitle={t('staging.quickRlsHint')}>
                <div className="metric-stack">
                  <div className="metric-line"><span>{t('staging.personas')}</span><strong>{data.personas.length}</strong></div>
                  <div className="metric-line"><span>{t('staging.notTested')}</span><strong>{data.personas.filter(p => p.personaStatus === 'not_tested').length}</strong></div>
                  <div className="metric-line"><span>{t('staging.failedWarning')}</span><strong>{data.personas.filter(p => ['failed','warning'].includes(p.personaStatus)).length}</strong></div>
                </div>
              </ModernCard>

              <ModernCard title={t('staging.quickBilingual')} subtitle={t('staging.quickBilingualHint')}>
                <div className="translation-meter">
                  <Languages size={24} />
                  <strong>{Math.round(data.translations.reduce((sum, row) => sum + row.coveragePercent, 0) / Math.max(data.translations.length, 1))}%</strong>
                  <span>{t('staging.avgCoverage')}</span>
                </div>
              </ModernCard>

              <ModernCard title={t('staging.quickBackup')} subtitle={t('staging.quickBackupHint')}>
                <div className="metric-stack">
                  <div className="metric-line"><span>{t('staging.strategies')}</span><strong>{data.backups.length}</strong></div>
                  <div className="metric-line"><span>{t('staging.needsRestore')}</span><strong>{data.backups.filter(b => b.backupSignal !== 'ok').length}</strong></div>
                  <div className="metric-line"><span>{t('staging.restoreRuns')}</span><strong>{data.restore.length}</strong></div>
                </div>
              </ModernCard>
            </div>

            <ModernCard title={t('staging.ultraStabilizationMap')} subtitle={t('staging.ultraStabilizationMapHint')}>
              <div className="ultra-roadmap">
                <div><ServerCog size={18} /><strong>{t('staging.mapMigrations')}</strong><span>{t('staging.mapMigrationsText')}</span></div>
                <div><ShieldCheck size={18} /><strong>{t('staging.mapRls')}</strong><span>{t('staging.mapRlsText')}</span></div>
                <div><Languages size={18} /><strong>{t('staging.mapBilingual')}</strong><span>{t('staging.mapBilingualText')}</span></div>
                <div><DatabaseZap size={18} /><strong>{t('staging.mapLoad')}</strong><span>{t('staging.mapLoadText')}</span></div>
              </div>
            </ModernCard>
          </>
        )}
      </DataState>
    </div>
  );
}
