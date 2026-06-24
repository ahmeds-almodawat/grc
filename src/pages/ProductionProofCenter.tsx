import { useState } from 'react';
import {
  ArchiveRestore,
  CheckCircle2,
  ClipboardCheck,
  DatabaseBackup,
  Download,
  FileArchive,
  Gauge,
  GitMerge,
  RefreshCcw,
  Rocket,
  ShieldCheck,
  TestTubeDiagonal,
  Users,
} from 'lucide-react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import { getProductionProofData, seedProductionProofDefaults } from '../lib/productionProofApi';
import { actionErrorMessage } from '../lib/privilegedAction';

type Tone = 'good' | 'warning' | 'danger' | 'neutral';

const copy = {
  en: {
    eyebrow: 'Final production proof',
    title: 'Production Proof Center',
    subtitle: 'One screen to finish fast without taking unsafe shortcuts: fresh install proof, RLS proof, OVR proof, backup proof, pilot waves and release artifacts.',
    seed: 'Seed proof defaults',
    export: 'Export proof JSON',
    score: 'Proof score',
    blockers: 'Hard blockers',
    warnings: 'Warnings',
    passed: 'Passed',
    pending: 'Pending',
    unsafe: 'Unsafe to launch',
    artifacts: 'Artifacts',
    pilotReady: 'Pilot waves ready',
    blockerBoard: 'Final blocker board',
    blockerHint: 'These gates decide if the platform is safe for pilot or full rollout.',
    criticalPath: 'Fastest safe critical path',
    criticalHint: 'Complete in this order; do not add more features before these are green.',
    artifactBoard: 'Release artifact board',
    artifactHint: 'Evidence and release files that must exist before pilot acceptance.',
    pilotBoard: 'Pilot rollout waves',
    pilotHint: 'A controlled rollout limits change risk by expanding only after each pilot wave is accepted.',
    commands: 'Finish commands',
    commandsHint: 'Run these after applying all patches in your local project.',
    ruleTitle: 'Stop rules',
    ruleHint: 'If any of these fail, do not launch to all staff.',
    rule1: 'No fresh Supabase proof = no go-live.',
    rule2: 'No RLS persona proof = no employee rollout.',
    rule3: 'No OVR end-to-end proof = no Quality launch.',
    rule4: 'No restore dry-run = no production data migration.',
    noPath: 'No path provided',
  },
  ar: {
    eyebrow: 'إثبات الإنتاج النهائي',
    title: 'مركز إثبات الجاهزية للإنتاج',
    subtitle: 'شاشة واحدة للإنهاء السريع بدون اختصارات خطرة: إثبات التثبيت الجديد، إثبات الصلاحيات، إثبات OVR، إثبات النسخ، مراحل التشغيل التجريبي، وحزم الإصدار.',
    seed: 'تعبئة بيانات الإثبات',
    export: 'تصدير إثبات JSON',
    score: 'درجة الإثبات',
    blockers: 'معوقات حاسمة',
    warnings: 'تنبيهات',
    passed: 'مجتاز',
    pending: 'معلق',
    unsafe: 'غير آمن للإطلاق',
    artifacts: 'الحزم',
    pilotReady: 'مراحل جاهزة',
    blockerBoard: 'لوحة المعوقات النهائية',
    blockerHint: 'هذه البوابات تحدد إن كانت المنصة آمنة للتجربة أو الإطلاق العام.',
    criticalPath: 'أسرع مسار حرج آمن',
    criticalHint: 'أنهِها بهذا الترتيب؛ لا تضف خصائص جديدة قبل أن تصبح خضراء.',
    artifactBoard: 'لوحة حزم الإصدار',
    artifactHint: 'ملفات الأدلة والإصدار المطلوبة قبل قبول التشغيل التجريبي.',
    pilotBoard: 'مراحل التشغيل التجريبي',
    pilotHint: 'التشغيل المتدرج يمنع إرباك 1000 موظف دفعة واحدة.',
    commands: 'أوامر الإنهاء',
    commandsHint: 'شغّلها بعد تطبيق كل التصحيحات في مشروعك المحلي.',
    ruleTitle: 'قواعد الإيقاف',
    ruleHint: 'إذا فشل أي منها، لا تطلق المنصة لكل الموظفين.',
    rule1: 'لا يوجد إثبات Supabase جديد = لا إطلاق.',
    rule2: 'لا يوجد إثبات صلاحيات RLS = لا تشغيل للموظفين.',
    rule3: 'لا يوجد إثبات OVR كامل = لا إطلاق للجودة.',
    rule4: 'لا يوجد اختبار استعادة = لا ترحيل بيانات إنتاج.',
    noPath: 'لا يوجد مسار',
  },
};

function tone(status: string): Tone {
  if (['go', 'passed', 'ready', 'accepted', 'generated', 'verified', 'approved'].includes(status)) return 'good';
  if (['warning', 'pending', 'in_progress', 'draft', 'not_started'].includes(status)) return 'warning';
  if (['blocked', 'missing', 'failed'].includes(status)) return 'danger';
  return 'neutral';
}

function label(status: string) {
  return status.replace(/_/g, ' ');
}

function iconFor(group: string) {
  if (group === 'database') return <DatabaseBackup size={18} />;
  if (group === 'security') return <ShieldCheck size={18} />;
  if (group === 'quality') return <ClipboardCheck size={18} />;
  if (group === 'backup') return <ArchiveRestore size={18} />;
  if (group === 'rollout') return <Users size={18} />;
  if (group === 'consolidation') return <GitMerge size={18} />;
  return <CheckCircle2 size={18} />;
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

export function ProductionProofCenter() {
  const { language, t } = useI18n();
  const c = copy[language];
  const { data, loading, error, refresh } = useAsyncData(getProductionProofData, []);
  const [actionError, setActionError] = useState('');

  const seed = async () => {
    setActionError('');
    try {
      await seedProductionProofDefaults();
      await refresh();
    } catch (actionFailure) {
      setActionError(actionErrorMessage(actionFailure));
    }
  };

  const hardGates = data?.gates.filter(gate => gate.severity === 'hard_gate') ?? [];
  const blockers = data?.gates.filter(gate => gate.status === 'blocked') ?? [];
  const scoreTone = tone(data?.scorecard.goLiveSignal ?? 'blocked');

  return (
    <div className="page-stack production-proof-page">
      <section className="production-proof-hero">
        <div>
          <p className="eyebrow"><Rocket size={15} /> {c.eyebrow}</p>
          <h1>{c.title}</h1>
          <p>{c.subtitle}</p>
          <div className="release-factory-actions">
            <button className="primary-button" type="button" onClick={seed}><CheckCircle2 size={16} /> {c.seed}</button>
            <button className="ghost-button" type="button" onClick={refresh}><RefreshCcw size={16} /> {t('common.refresh', 'Refresh')}</button>
            <button className="ghost-button" type="button" disabled={!data} onClick={() => data && exportJson(`grc-production-proof-${new Date().toISOString().slice(0, 10)}.json`, data)}><Download size={16} /> {c.export}</button>
          </div>
        </div>
        <div className={`production-proof-score production-proof-score--${scoreTone}`}>
          <Gauge size={30} />
          <strong>{data?.scorecard.proofScore ?? 0}%</strong>
          <span>{c.score}</span>
          <StatusPill tone={scoreTone}>{label(data?.scorecard.goLiveSignal ?? 'blocked')}</StatusPill>
        </div>
      </section>

      {actionError && <div className="notice-banner danger">{actionError}</div>}

      <DataState loading={loading} error={error} empty={!data}>
        {data && (
          <>
            <div className="modern-grid modern-grid--six">
              <KpiTile label={c.blockers} value={data.scorecard.blockedGates} tone={data.scorecard.blockedGates ? 'danger' : 'good'} />
              <KpiTile label={c.warnings} value={data.scorecard.warningGates} tone={data.scorecard.warningGates ? 'warning' : 'good'} />
              <KpiTile label={c.passed} value={data.scorecard.passedGates} tone="good" />
              <KpiTile label={c.pending} value={data.scorecard.pendingGates} tone={data.scorecard.pendingGates ? 'warning' : 'good'} />
              <KpiTile label={c.artifacts} value={data.scorecard.consolidatedArtifacts} tone="neutral" />
              <KpiTile label={c.pilotReady} value={data.scorecard.pilotWaveReady} tone={data.scorecard.unsafeToLaunch ? 'warning' : 'good'} />
            </div>

            {blockers.length ? (
              <ModernCard title={c.blockerBoard} subtitle={c.blockerHint}>
                <div className="production-proof-list">
                  {blockers.map(gate => (
                    <div className="production-proof-row production-proof-row--danger" key={gate.id}>
                      <div className="production-proof-icon">{iconFor(gate.gateGroup)}</div>
                      <div>
                        <strong>{gate.title}</strong>
                        <span>{gate.gateCode} · {gate.gateGroup} · {gate.ownerLabel}</span>
                        <small>{gate.fastAction || gate.description}</small>
                      </div>
                      <StatusPill tone="danger">{label(gate.status)}</StatusPill>
                    </div>
                  ))}
                </div>
              </ModernCard>
            ) : null}

            <div className="modern-grid modern-grid--two">
              <ModernCard title={c.criticalPath} subtitle={c.criticalHint}>
                <div className="production-proof-timeline">
                  {hardGates.map((gate, index) => (
                    <div className={`production-proof-step production-proof-step--${tone(gate.status)}`} key={gate.id}>
                      <span>{index + 1}</span>
                      <div>
                        <strong>{gate.title}</strong>
                        <small>{gate.fastAction}</small>
                      </div>
                      <StatusPill tone={tone(gate.status)}>{label(gate.status)}</StatusPill>
                    </div>
                  ))}
                </div>
              </ModernCard>

              <ModernCard title={c.ruleTitle} subtitle={c.ruleHint}>
                <div className="production-proof-rules">
                  {[c.rule1, c.rule2, c.rule3, c.rule4].map(rule => (
                    <div key={rule}><ShieldCheck size={17} /><span>{rule}</span></div>
                  ))}
                </div>
              </ModernCard>
            </div>

            <div className="modern-grid modern-grid--two">
              <ModernCard title={c.artifactBoard} subtitle={c.artifactHint}>
                <div className="production-proof-list">
                  {data.artifacts.map(item => (
                    <div className="production-proof-row" key={item.id}>
                      <FileArchive size={18} />
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.artifactCode} · {item.artifactType} · {item.ownerLabel}</span>
                        <small>{item.targetPath || c.noPath}</small>
                      </div>
                      <StatusPill tone={tone(item.status)}>{label(item.status)}</StatusPill>
                    </div>
                  ))}
                </div>
              </ModernCard>

              <ModernCard title={c.pilotBoard} subtitle={c.pilotHint}>
                <div className="production-proof-list">
                  {data.pilotWaves.map(item => (
                    <div className="production-proof-row" key={item.id}>
                      <TestTubeDiagonal size={18} />
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.waveCode} · {item.acceptanceOwner}</span>
                        <small>{item.participantScope}</small>
                      </div>
                      <StatusPill tone={tone(item.status)}>{label(item.status)}</StatusPill>
                    </div>
                  ))}
                </div>
              </ModernCard>
            </div>

            <ModernCard title={c.commands} subtitle={c.commandsHint}>
              <div className="release-factory-command-list production-proof-command-grid">
                <code>npm run final:all</code>
                <code>npm run proof:production</code>
                <code>npm run bundle:production-proof</code>
                <code>npm run release:bundle</code>
              </div>
            </ModernCard>
          </>
        )}
      </DataState>
    </div>
  );
}
