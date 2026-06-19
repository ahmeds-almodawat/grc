import { useState } from 'react';
import {
  AlertTriangle,
  ArchiveRestore,
  CheckCircle2,
  ClipboardCheck,
  DatabaseBackup,
  Download,
  Gauge,
  Languages,
  PackageCheck,
  PlayCircle,
  RefreshCcw,
  Rocket,
  ShieldCheck,
  Sparkles,
  TestTubeDiagonal,
  Users,
} from 'lucide-react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import { getProductionFinishData, seedProductionFinishDefaults } from '../lib/productionReadinessApi';
import { actionErrorMessage } from '../lib/privilegedAction';

function tone(status: string): 'good' | 'warning' | 'danger' | 'neutral' {
  if (['go', 'pass', 'passed', 'ready', 'accepted', 'accepted_risk', 'pilot_only'].includes(status)) return 'good';
  if (['conditional', 'warning', 'pending', 'in_progress', 'needs_review', 'not_started'].includes(status)) return 'warning';
  if (['blocked', 'rejected', 'failed'].includes(status)) return 'danger';
  return 'neutral';
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ');
}

export function ProductionFinishCenter() {
  const { t } = useI18n();
  const { data, loading, error, refresh } = useAsyncData(getProductionFinishData, []);
  const [actionError, setActionError] = useState('');

  const runSeed = async () => {
    setActionError('');
    try {
      await seedProductionFinishDefaults();
      await refresh();
    } catch (actionFailure) {
      setActionError(actionErrorMessage(actionFailure));
    }
  };

  const score = data?.scorecard.goLiveScore ?? 0;
  const readiness = data?.scorecard.readinessSignal ?? 'blocked';
  const blockers = data?.controls.filter(item => item.goLiveBlocking && item.status === 'blocked') ?? [];
  const fastPath = data?.controls.filter(item => item.goLiveBlocking).slice(0, 8) ?? [];

  const exportSummary = () => {
    if (!data) return;
    const payload = {
      generatedAt: new Date().toISOString(),
      scorecard: data.scorecard,
      blockers: data.controls.filter(item => item.status === 'blocked'),
      warnings: data.controls.filter(item => item.status === 'warning' || item.status === 'pending'),
      modules: data.modules,
      supportHandover: data.handover,
      pilotAcceptance: data.pilot,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `grc-final-production-readiness-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-stack production-finish-page">
      <section className="production-finish-hero">
        <div className="production-finish-hero__copy">
          <p className="eyebrow"><Sparkles size={15} /> {t('productionFinish.eyebrow')}</p>
          <h1>{t('productionFinish.title')}</h1>
          <p>{t('productionFinish.subtitle')}</p>
          <div className="production-finish-hero__actions">
            <button className="primary-button" type="button" onClick={runSeed}>
              <PackageCheck size={16} /> {t('productionFinish.seed')}
            </button>
            <button className="ghost-button" type="button" onClick={refresh}>
              <RefreshCcw size={16} /> {t('common.refresh')}
            </button>
            <button className="ghost-button" type="button" onClick={exportSummary} disabled={!data}>
              <Download size={16} /> {t('productionFinish.export')}
            </button>
          </div>
        </div>
        <div className={`production-finish-score production-finish-score--${tone(readiness)}`}>
          <strong>{score}%</strong>
          <span>{t('productionFinish.score')}</span>
          <StatusPill tone={tone(readiness)}>{statusLabel(readiness)}</StatusPill>
        </div>
      </section>

      {actionError && <div className="notice-banner danger">{actionError}</div>}

      <DataState loading={loading} error={error} empty={!data}>
        {data && (
          <>
            <div className="modern-grid modern-grid--six">
              <KpiTile label={t('productionFinish.blockers')} value={data.scorecard.blockingItems} tone={data.scorecard.blockingItems ? 'danger' : 'good'} />
              <KpiTile label={t('productionFinish.warnings')} value={data.scorecard.warnings} tone={data.scorecard.warnings ? 'warning' : 'good'} />
              <KpiTile label={t('productionFinish.passed')} value={data.scorecard.passedItems} tone="good" />
              <KpiTile label={t('productionFinish.pending')} value={data.scorecard.pendingItems} tone={data.scorecard.pendingItems ? 'warning' : 'good'} />
              <KpiTile label={t('productionFinish.modulesReady')} value={`${data.scorecard.modulesReady}/${data.scorecard.modulesTotal}`} tone={data.scorecard.modulesReady === data.scorecard.modulesTotal ? 'good' : 'warning'} />
              <KpiTile label={t('productionFinish.supportReady')} value={`${data.scorecard.supportOwnersReady}/${data.scorecard.supportOwnersTotal}`} tone={data.scorecard.supportOwnersReady === data.scorecard.supportOwnersTotal ? 'good' : 'warning'} />
            </div>

            {blockers.length ? (
              <ModernCard title={t('productionFinish.blockerBoard')} subtitle={t('productionFinish.blockerBoardHint')}>
                <div className="production-blocker-list">
                  {blockers.map(item => (
                    <div className="production-blocker-row" key={item.id}>
                      <div className="production-blocker-icon"><AlertTriangle size={18} /></div>
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.controlCode} · {item.controlGroup} · {item.ownerLabel}</span>
                        <small>{item.description}</small>
                      </div>
                      <StatusPill tone="danger">{statusLabel(item.status)}</StatusPill>
                    </div>
                  ))}
                </div>
              </ModernCard>
            ) : null}

            <div className="modern-grid modern-grid--two">
              <ModernCard title={t('productionFinish.fastPath')} subtitle={t('productionFinish.fastPathHint')}>
                <div className="production-fast-path">
                  {fastPath.map((item, index) => (
                    <div className={`production-fast-step production-fast-step--${tone(item.status)}`} key={item.id}>
                      <span>{index + 1}</span>
                      <div>
                        <strong>{item.title}</strong>
                        <small>{item.evidenceNote || item.description}</small>
                      </div>
                      <StatusPill tone={tone(item.status)}>{statusLabel(item.status)}</StatusPill>
                    </div>
                  ))}
                </div>
              </ModernCard>

              <ModernCard title={t('productionFinish.moduleMap')} subtitle={t('productionFinish.moduleMapHint')}>
                <div className="production-module-map">
                  {data.modules.map(module => (
                    <div className="production-module-row" key={module.id}>
                      <div>
                        <strong>{module.moduleName}</strong>
                        <span>{module.workspaceGroup} · {module.ownerLabel}</span>
                        <small>{module.remainingWork}</small>
                      </div>
                      <div className="production-module-progress" aria-label={`${module.readinessPercent}%`}>
                        <span style={{ width: `${module.readinessPercent}%` }} />
                      </div>
                      <StatusPill tone={tone(module.status)}>{statusLabel(module.status)}</StatusPill>
                    </div>
                  ))}
                </div>
              </ModernCard>
            </div>

            <div className="modern-grid modern-grid--two">
              <ModernCard title={t('productionFinish.handover')} subtitle={t('productionFinish.handoverHint')}>
                <div className="production-handover-grid">
                  {data.handover.map(item => (
                    <div className="production-handover-card" key={item.id}>
                      <div><Users size={17} /><StatusPill tone={tone(item.status)}>{statusLabel(item.status)}</StatusPill></div>
                      <strong>{item.supportArea}</strong>
                      <span>{item.ownerLabel} / {item.backupOwnerLabel}</span>
                      <small>{item.notes}</small>
                      <div className="handover-checks">
                        <StatusPill tone={item.runbookReady ? 'good' : 'warning'}>{t('productionFinish.runbook')}</StatusPill>
                        <StatusPill tone={item.escalationPathReady ? 'good' : 'warning'}>{t('productionFinish.escalationPath')}</StatusPill>
                      </div>
                    </div>
                  ))}
                </div>
              </ModernCard>

              <ModernCard title={t('productionFinish.pilot')} subtitle={t('productionFinish.pilotHint')}>
                <div className="production-pilot-list">
                  {data.pilot.map(item => (
                    <div className="production-pilot-row" key={item.id}>
                      <div className="production-pilot-icon">
                        {item.status === 'accepted' ? <CheckCircle2 size={17} /> : item.status === 'blocked' ? <AlertTriangle size={17} /> : <PlayCircle size={17} />}
                      </div>
                      <div>
                        <strong>{item.pilotArea}</strong>
                        <span>{item.acceptanceOwner} · {item.targetDate ?? t('productionFinish.noDate')}</span>
                        <small>{item.acceptanceNote}</small>
                      </div>
                      <StatusPill tone={tone(item.status)}>{statusLabel(item.status)}</StatusPill>
                    </div>
                  ))}
                </div>
              </ModernCard>
            </div>

            <ModernCard title={t('productionFinish.commandments')} subtitle={t('productionFinish.commandmentsHint')}>
              <div className="production-commandment-grid">
                <div><DatabaseBackup size={18} /><strong>{t('productionFinish.cmd.backup')}</strong><span>{t('productionFinish.cmd.backupText')}</span></div>
                <div><ShieldCheck size={18} /><strong>{t('productionFinish.cmd.rls')}</strong><span>{t('productionFinish.cmd.rlsText')}</span></div>
                <div><TestTubeDiagonal size={18} /><strong>{t('productionFinish.cmd.pilot')}</strong><span>{t('productionFinish.cmd.pilotText')}</span></div>
                <div><Languages size={18} /><strong>{t('productionFinish.cmd.arabic')}</strong><span>{t('productionFinish.cmd.arabicText')}</span></div>
                <div><ArchiveRestore size={18} /><strong>{t('productionFinish.cmd.restore')}</strong><span>{t('productionFinish.cmd.restoreText')}</span></div>
                <div><ClipboardCheck size={18} /><strong>{t('productionFinish.cmd.signoff')}</strong><span>{t('productionFinish.cmd.signoffText')}</span></div>
              </div>
            </ModernCard>
          </>
        )}
      </DataState>
    </div>
  );
}
