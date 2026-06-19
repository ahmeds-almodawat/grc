import { useState } from 'react';
import {
  ArchiveRestore,
  CheckCircle2,
  ClipboardCheck,
  DatabaseBackup,
  Download,
  FileArchive,
  FileCheck2,
  Gauge,
  Languages,
  PackageCheck,
  RefreshCcw,
  Rocket,
  ShieldCheck,
  Sparkles,
  TestTubeDiagonal,
} from 'lucide-react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import { getReleaseFactoryData, seedReleaseFactoryDefaults } from '../lib/consolidationApi';
import { actionErrorMessage } from '../lib/privilegedAction';

function tone(status: string): 'good' | 'warning' | 'danger' | 'neutral' {
  if (['go', 'passed', 'pass', 'ready', 'generated', 'verified', 'approved', 'signed_off', 'accepted_risk'].includes(status)) return 'good';
  if (['conditional', 'warning', 'pending', 'in_progress', 'draft', 'not_started'].includes(status)) return 'warning';
  if (['blocked', 'failed', 'rejected'].includes(status)) return 'danger';
  return 'neutral';
}

function label(status: string) {
  return status.replace(/_/g, ' ');
}

function exportJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function groupIcon(group: string) {
  if (group === 'migration') return <FileArchive size={18} />;
  if (group === 'security') return <ShieldCheck size={18} />;
  if (group === 'backup') return <DatabaseBackup size={18} />;
  if (group === 'bilingual') return <Languages size={18} />;
  if (group === 'quality') return <ClipboardCheck size={18} />;
  if (group === 'ui') return <Sparkles size={18} />;
  return <CheckCircle2 size={18} />;
}

export function ReleaseFactoryCenter() {
  const { t } = useI18n();
  const { data, loading, error, refresh } = useAsyncData(getReleaseFactoryData, []);
  const [actionError, setActionError] = useState('');

  const seed = async () => {
    setActionError('');
    try {
      await seedReleaseFactoryDefaults();
      await refresh();
    } catch (actionFailure) {
      setActionError(actionErrorMessage(actionFailure));
    }
  };

  const blockers = data?.checks.filter(check => check.status === 'blocked') ?? [];
  const criticalPath = data?.checks.filter(check => check.severity === 'critical').slice(0, 8) ?? [];
  const signal = data?.scorecard.readySignal ?? 'blocked';

  return (
    <div className="page-stack release-factory-page">
      <section className="release-factory-hero">
        <div>
          <p className="eyebrow"><Rocket size={15} /> {t('releaseFactory.eyebrow')}</p>
          <h1>{t('releaseFactory.title')}</h1>
          <p>{t('releaseFactory.subtitle')}</p>
          <div className="release-factory-actions">
            <button className="primary-button" type="button" onClick={seed}>
              <PackageCheck size={16} /> {t('releaseFactory.seed')}
            </button>
            <button className="ghost-button" type="button" onClick={refresh}>
              <RefreshCcw size={16} /> {t('common.refresh')}
            </button>
            <button className="ghost-button" type="button" disabled={!data} onClick={() => data && exportJson(`grc-release-factory-${new Date().toISOString().slice(0, 10)}.json`, data)}>
              <Download size={16} /> {t('releaseFactory.export')}
            </button>
          </div>
        </div>
        <div className={`release-factory-score release-factory-score--${tone(signal)}`}>
          <strong>{data?.scorecard.finalScore ?? 0}%</strong>
          <span>{t('releaseFactory.finalScore')}</span>
          <StatusPill tone={tone(signal)}>{label(signal)}</StatusPill>
        </div>
      </section>

      {actionError && <div className="notice-banner danger">{actionError}</div>}

      <DataState loading={loading} error={error} empty={!data}>
        {data && (
          <>
            <div className="modern-grid modern-grid--six">
              <KpiTile label={t('releaseFactory.blocked')} value={data.scorecard.blockedChecks} tone={data.scorecard.blockedChecks ? 'danger' : 'good'} />
              <KpiTile label={t('releaseFactory.warnings')} value={data.scorecard.warningChecks} tone={data.scorecard.warningChecks ? 'warning' : 'good'} />
              <KpiTile label={t('releaseFactory.passed')} value={data.scorecard.passedChecks} tone="good" />
              <KpiTile label={t('releaseFactory.pending')} value={data.scorecard.pendingChecks} tone={data.scorecard.pendingChecks ? 'warning' : 'good'} />
              <KpiTile label={t('releaseFactory.migration')} value={data.scorecard.migrationChecks} tone="neutral" />
              <KpiTile label={t('releaseFactory.handover')} value={data.scorecard.handoverChecks} tone="neutral" />
            </div>

            {blockers.length ? (
              <ModernCard title={t('releaseFactory.blockerBoard')} subtitle={t('releaseFactory.blockerBoardHint')}>
                <div className="release-factory-blockers">
                  {blockers.map(item => (
                    <div className="release-factory-blocker" key={item.id}>
                      <div className="release-factory-blocker__icon">{groupIcon(item.checkGroup)}</div>
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.checkCode} · {item.checkGroup} · {item.ownerLabel}</span>
                        <small>{item.evidenceNote || item.description}</small>
                      </div>
                      <StatusPill tone="danger">{label(item.status)}</StatusPill>
                    </div>
                  ))}
                </div>
              </ModernCard>
            ) : null}

            <div className="modern-grid modern-grid--two">
              <ModernCard title={t('releaseFactory.criticalPath')} subtitle={t('releaseFactory.criticalPathHint')}>
                <div className="release-factory-path">
                  {criticalPath.map((item, index) => (
                    <div className={`release-factory-path__step release-factory-path__step--${tone(item.status)}`} key={item.id}>
                      <span>{index + 1}</span>
                      <div>
                        <strong>{item.title}</strong>
                        <small>{item.description}</small>
                      </div>
                      <StatusPill tone={tone(item.status)}>{label(item.status)}</StatusPill>
                    </div>
                  ))}
                </div>
              </ModernCard>

              <ModernCard title={t('releaseFactory.packages')} subtitle={t('releaseFactory.packagesHint')}>
                <div className="release-factory-packages">
                  {data.packages.map(item => (
                    <div className="release-factory-package" key={item.id}>
                      <FileCheck2 size={18} />
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.packageCode} · {item.packageType}</span>
                        <small>{item.filePath || item.checksumNote || t('releaseFactory.noFile')}</small>
                      </div>
                      <StatusPill tone={tone(item.status)}>{label(item.status)}</StatusPill>
                    </div>
                  ))}
                </div>
              </ModernCard>
            </div>

            <div className="modern-grid modern-grid--two">
              <ModernCard title={t('releaseFactory.signoffs')} subtitle={t('releaseFactory.signoffsHint')}>
                <div className="release-factory-signoffs">
                  {data.signoffs.map(item => (
                    <div className="release-factory-signoff" key={item.id}>
                      <div className={`release-factory-mini-meter release-factory-mini-meter--${tone(item.status)}`}><Gauge size={16} /></div>
                      <div>
                        <strong>{item.signoffArea}</strong>
                        <span>{item.ownerLabel}</span>
                        <small>{item.evidenceNote}</small>
                      </div>
                      <StatusPill tone={tone(item.status)}>{label(item.status)}</StatusPill>
                    </div>
                  ))}
                </div>
              </ModernCard>

              <ModernCard title={t('releaseFactory.finishCommands')} subtitle={t('releaseFactory.finishCommandsHint')}>
                <div className="release-factory-command-list">
                  <code>npm run migrations:bundle</code>
                  <code>npm run audit:routes</code>
                  <code>npm run audit:i18n</code>
                  <code>npm run final:handover</code>
                  <code>npm run final:all</code>
                </div>
                <div className="release-factory-note">
                  <ArchiveRestore size={18} />
                  <span>{t('releaseFactory.commandNote')}</span>
                </div>
              </ModernCard>
            </div>
          </>
        )}
      </DataState>
    </div>
  );
}
