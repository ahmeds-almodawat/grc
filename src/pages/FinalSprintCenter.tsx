import { useState } from 'react';
import { AlertTriangle, ArchiveRestore, CheckCircle2, ClipboardCheck, DatabaseBackup, FileCheck2, PackageCheck, RefreshCcw, Rocket, ShieldCheck, Sparkles, TestTubeDiagonal } from 'lucide-react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import { getFinalizationData, seedFinalReleaseDefaults } from '../lib/finalizationApi';
import { actionErrorMessage } from '../lib/privilegedAction';

function toneForStatus(status: string): 'good' | 'warning' | 'danger' | 'neutral' {
  if (['pass', 'passed', 'verified', 'ready', 'done', 'clear'].includes(status)) return 'good';
  if (['warning', 'conditional', 'watch', 'pending', 'in_progress', 'accepted_risk'].includes(status)) return 'warning';
  if (['blocked', 'fail', 'failed', 'critical'].includes(status)) return 'danger';
  return 'neutral';
}

export function FinalSprintCenter() {
  const { t } = useI18n();
  const { data, loading, error, refresh } = useAsyncData(getFinalizationData, []);
  const [actionError, setActionError] = useState('');

  const runSeed = async () => {
    setActionError('');
    try {
      await seedFinalReleaseDefaults();
      await refresh();
    } catch (actionFailure) {
      setActionError(actionErrorMessage(actionFailure));
    }
  };

  const score = data?.scorecard.goLiveScore ?? 0;
  const scoreTone = data?.scorecard.readySignal === 'ready' ? 'good' : data?.scorecard.readySignal === 'blocked' ? 'danger' : 'warning';
  const criticalGates = data?.gates.filter(g => g.goLiveBlocking && g.status !== 'pass' && g.status !== 'accepted_risk') ?? [];

  return (
    <div className="page-stack final-sprint-page">
      <section className="hero-panel final-sprint-hero">
        <div>
          <p className="eyebrow"><Sparkles size={15} /> {t('final.eyebrow')}</p>
          <h1>{t('final.title')}</h1>
          <p>{t('final.subtitle')}</p>
        </div>
        <div className="hero-actions">
          <button className="primary-button" onClick={runSeed} type="button">
            <PackageCheck size={16} />
            {t('final.seedDefaults')}
          </button>
          <button className="ghost-button" onClick={refresh} type="button">
            <RefreshCcw size={16} />
            {t('common.refresh', 'Refresh')}
          </button>
        </div>
      </section>

      {actionError && <div className="notice-banner danger">{actionError}</div>}

      <DataState loading={loading} error={error} empty={!data}>
        {data && (
          <>
            <div className="final-score-panel">
              <div className={`final-score-ring final-score-ring--${scoreTone}`}>
                <strong>{score}%</strong>
                <span>{t('final.goLiveScore')}</span>
              </div>
              <div className="final-score-copy">
                <h2>{data.scorecard.readySignal === 'ready' ? t('final.ready') : data.scorecard.readySignal === 'blocked' ? t('final.blocked') : t('final.conditional')}</h2>
                <p>{t('final.scoreExplanation')}</p>
                <div className="final-score-badges">
                  <StatusPill tone={toneForStatus(data.scorecard.readySignal)}>{data.scorecard.readySignal}</StatusPill>
                  <StatusPill tone={criticalGates.length ? 'danger' : 'good'}>{criticalGates.length} {t('final.blockingGates')}</StatusPill>
                  <StatusPill tone={data.scorecard.bilingualWarnings ? 'warning' : 'good'}>{data.scorecard.bilingualWarnings} {t('final.bilingualWarnings')}</StatusPill>
                </div>
              </div>
            </div>

            <div className="modern-grid modern-grid--six">
              <KpiTile label={t('final.blockers')} value={data.scorecard.blockers} tone={data.scorecard.blockers ? 'danger' : 'good'} />
              <KpiTile label={t('final.warnings')} value={data.scorecard.warnings} tone={data.scorecard.warnings ? 'warning' : 'good'} />
              <KpiTile label={t('final.passed')} value={data.scorecard.passed} tone="good" />
              <KpiTile label={t('final.pending')} value={data.scorecard.pending} tone="warning" />
              <KpiTile label={t('final.criticalIssues')} value={data.scorecard.openCriticalIssues} tone={data.scorecard.openCriticalIssues ? 'danger' : 'good'} />
              <KpiTile label={t('final.highIssues')} value={data.scorecard.openHighIssues} tone={data.scorecard.openHighIssues ? 'warning' : 'good'} />
            </div>

            <div className="modern-grid modern-grid--two">
              <ModernCard title={t('final.gatesTitle')} subtitle={t('final.gatesHint')}>
                <div className="final-gate-list">
                  {data.gates.map(gate => (
                    <div className={`final-gate-row final-gate-row--${toneForStatus(gate.status)}`} key={gate.id}>
                      <div className="final-gate-icon">{gate.goLiveBlocking ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}</div>
                      <div className="final-gate-main">
                        <strong>{gate.title}</strong>
                        <span>{gate.gateCode} · {gate.gateGroup} · {gate.ownerLabel ?? '—'}</span>
                        {gate.description ? <small>{gate.description}</small> : null}
                      </div>
                      <div className="final-gate-status">
                        <StatusPill tone={toneForStatus(gate.status)}>{gate.status}</StatusPill>
                        <StatusPill tone={toneForStatus(gate.severity)}>{gate.severity}</StatusPill>
                      </div>
                    </div>
                  ))}
                </div>
              </ModernCard>

              <ModernCard title={t('final.ownerClearance')} subtitle={t('final.ownerClearanceHint')}>
                <div className="final-owner-list">
                  {data.ownerClearance.map(owner => (
                    <div className="final-owner-row" key={owner.ownerLabel}>
                      <div>
                        <strong>{owner.ownerLabel}</strong>
                        <span>{owner.totalItems} {t('final.items')}</span>
                      </div>
                      <div className="final-owner-counts">
                        <span className="danger">{owner.blockedItems}</span>
                        <span className="warning">{owner.warningItems}</span>
                        <span className="good">{owner.passedItems}</span>
                      </div>
                      <StatusPill tone={toneForStatus(owner.clearanceSignal)}>{owner.clearanceSignal}</StatusPill>
                    </div>
                  ))}
                </div>
              </ModernCard>
            </div>

            <div className="modern-grid modern-grid--two">
              <ModernCard title={t('final.cutoverTitle')} subtitle={t('final.cutoverHint')}>
                <div className="final-timeline">
                  {data.cutover.map(task => (
                    <div className="final-timeline-row" key={task.id}>
                      <div className="final-timeline-dot"><Rocket size={15} /></div>
                      <div>
                        <span>{task.phaseName} · {task.plannedWindow ?? '—'}</span>
                        <strong>{task.title}</strong>
                        <small>{task.ownerLabel ?? '—'} · {task.rollbackNote ?? ''}</small>
                      </div>
                      <StatusPill tone={toneForStatus(task.status)}>{task.status}</StatusPill>
                    </div>
                  ))}
                </div>
              </ModernCard>

              <ModernCard title={t('final.acceptanceTitle')} subtitle={t('final.acceptanceHint')}>
                <div className="final-test-grid">
                  {data.tests.map(test => (
                    <div className="final-test-card" key={test.id}>
                      <div><TestTubeDiagonal size={16} /><StatusPill tone={toneForStatus(test.status)}>{test.status}</StatusPill></div>
                      <strong>{test.title}</strong>
                      <span>{test.testCode} · {test.testArea} · {test.persona ?? '—'}</span>
                      <small>{test.expectedResult}</small>
                    </div>
                  ))}
                </div>
              </ModernCard>
            </div>

            <ModernCard title={t('final.artifactsTitle')} subtitle={t('final.artifactsHint')}>
              <div className="final-artifact-grid">
                {data.artifacts.map(artifact => (
                  <div className="final-artifact-card" key={artifact.id}>
                    <div className="final-artifact-icon">
                      {artifact.artifactType === 'release_package' ? <ArchiveRestore size={18} /> : artifact.artifactType === 'qa_script' ? <ClipboardCheck size={18} /> : <FileCheck2 size={18} />}
                    </div>
                    <strong>{artifact.title}</strong>
                    <span>{artifact.artifactCode} · {artifact.artifactType}</span>
                    <small>{artifact.filePath ?? artifact.verificationNote ?? '—'}</small>
                    <StatusPill tone={toneForStatus(artifact.status)}>{artifact.status}</StatusPill>
                  </div>
                ))}
              </div>
            </ModernCard>

            <ModernCard title={t('final.fastestSafePath')} subtitle={t('final.fastestSafePathHint')}>
              <div className="final-safe-path">
                <div><DatabaseBackup size={18} /><strong>{t('final.path1')}</strong><span>{t('final.path1Text')}</span></div>
                <div><ShieldCheck size={18} /><strong>{t('final.path2')}</strong><span>{t('final.path2Text')}</span></div>
                <div><ClipboardCheck size={18} /><strong>{t('final.path3')}</strong><span>{t('final.path3Text')}</span></div>
                <div><CheckCircle2 size={18} /><strong>{t('final.path4')}</strong><span>{t('final.path4Text')}</span></div>
              </div>
            </ModernCard>
          </>
        )}
      </DataState>
    </div>
  );
}
