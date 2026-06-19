import { Eye, EyeOff, RefreshCcw, ShieldCheck } from 'lucide-react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import { getRlsPersonaLab } from '../lib/stabilizationApi';

function tone(status: string): 'good' | 'warning' | 'danger' | 'neutral' {
  if (['passed', 'pass'].includes(status)) return 'good';
  if (['warning', 'pending', 'not_tested'].includes(status)) return 'warning';
  if (['failed', 'fail'].includes(status)) return 'danger';
  return 'neutral';
}

export function RlsPersonaLab() {
  const { t, language } = useI18n();
  const { data, loading, error, refresh } = useAsyncData(getRlsPersonaLab, []);
  const total = data?.length ?? 0;
  const passed = data?.filter(row => row.personaStatus === 'passed').length ?? 0;
  const notTested = data?.filter(row => row.personaStatus === 'not_tested').length ?? 0;
  const failed = data?.filter(row => ['failed','warning'].includes(row.personaStatus)).length ?? 0;

  return (
    <div className="page-stack ultra-stabilization-page">
      <section className="hero-panel modern-hero">
        <div>
          <p className="eyebrow">{t('rlsLab.eyebrow')}</p>
          <h1>{t('rlsLab.title')}</h1>
          <p>{t('rlsLab.subtitle')}</p>
        </div>
        <button className="ghost-button" onClick={refresh}><RefreshCcw size={16} />{t('common.refresh', 'Refresh')}</button>
      </section>

      <DataState loading={loading} error={error} empty={!data?.length}>
        {data && (
          <>
            <div className="modern-grid modern-grid--four">
              <KpiTile label={t('rlsLab.personas')} value={total} />
              <KpiTile label={t('rlsLab.passed')} value={passed} tone="good" />
              <KpiTile label={t('rlsLab.notTested')} value={notTested} tone="warning" />
              <KpiTile label={t('rlsLab.failedWarning')} value={failed} tone={failed ? 'danger' : 'good'} />
            </div>

            <ModernCard title={t('rlsLab.matrix')} subtitle={t('rlsLab.matrixHint')}>
              <div className="persona-grid">
                {data.map(persona => (
                  <article className="persona-card" key={persona.id}>
                    <div className="persona-card__top">
                      <div className="persona-icon"><ShieldCheck size={18} /></div>
                      <div>
                        <strong>{language === 'ar' && persona.personaNameAr ? persona.personaNameAr : persona.personaNameEn}</strong>
                        <span>{persona.personaCode}</span>
                      </div>
                      <StatusPill tone={tone(persona.personaStatus)}>{persona.personaStatus}</StatusPill>
                    </div>
                    <div className="persona-meta">
                      <span>{persona.roleName}</span>
                      <span>{persona.accessScope}</span>
                      <span>{persona.testArea}</span>
                    </div>
                    <div className="expectation-box allowed">
                      <Eye size={16} />
                      <p>{persona.allowedExpectation}</p>
                    </div>
                    <div className="expectation-box denied">
                      <EyeOff size={16} />
                      <p>{persona.deniedExpectation}</p>
                    </div>
                    {persona.latestFailureNote && <small className="danger-text">{persona.latestFailureNote}</small>}
                  </article>
                ))}
              </div>
            </ModernCard>
          </>
        )}
      </DataState>
    </div>
  );
}
