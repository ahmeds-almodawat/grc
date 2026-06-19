
import { useState } from 'react';
import { RefreshCcw, Zap, TriangleAlert, BellRing, CalendarClock } from 'lucide-react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import { useAsyncData } from '../hooks/useAsyncData';
import { getAutomationRules, getAutomationSummary, getExecutiveExceptions, refreshAutomationIntelligence } from '../lib/automationApi';
import { useI18n } from '../i18n/I18nContext';
import { actionErrorMessage } from '../lib/privilegedAction';

const tone = (value: string) => value === 'critical' ? 'danger' : value === 'high' || value === 'stale' ? 'warning' : value === 'healthy' ? 'good' : 'neutral';

export function AutomationIntelligenceCenter() {
  const { t, language } = useI18n();
  const summary = useAsyncData(getAutomationSummary, []);
  const rules = useAsyncData(getAutomationRules, []);
  const exceptions = useAsyncData(getExecutiveExceptions, []);
  const [actionError, setActionError] = useState('');
  const s = summary.data;

  const refresh = async () => {
    setActionError('');
    try {
      await refreshAutomationIntelligence();
      await Promise.all([summary.refresh(), rules.refresh(), exceptions.refresh()]);
    } catch (actionFailure) {
      setActionError(actionErrorMessage(actionFailure));
    }
  };

  return (
    <section className="page-section automation-page">
      <div className="section-heading command-hero automation-hero">
        <div>
          <p className="eyebrow">{t('automation.eyebrow')}</p>
          <h3>{t('automation.title')}</h3>
          <p className="section-subtitle">{t('automation.subtitle')}</p>
        </div>
        <button className="primary-button" onClick={refresh}><RefreshCcw size={16} /> {t('automation.refresh')}</button>
      </div>

      {actionError && <div className="notice-banner danger">{actionError}</div>}

      <div className="stats-grid">
        <KpiTile label={t('automation.activeRules')} value={s?.activeRules ?? 0} hint={t('automation.activeRulesHint')} />
        <KpiTile label={t('automation.reviewsDue')} value={s?.reviewsDue7Days ?? 0} tone={(s?.reviewsDue7Days ?? 0) > 0 ? 'warning' : 'good'} />
        <KpiTile label={t('automation.kriBreaches')} value={s?.kriBreaches30Days ?? 0} tone={(s?.criticalKriBreaches30Days ?? 0) > 0 ? 'danger' : 'warning'} />
        <KpiTile label={t('automation.exceptionRules')} value={s?.executiveExceptionRules ?? 0} />
      </div>

      <div className="two-column-grid">
        <ModernCard title={t('automation.ruleCatalog')} subtitle={t('automation.ruleCatalogHint')}>
          <DataState loading={rules.loading} error={rules.error} empty={!rules.data?.length}>
            <div className="automation-rule-list">
              {(rules.data ?? []).map(rule => (
                <article className="automation-rule-card" key={rule.id}>
                  <div className="automation-rule-head">
                    <strong><Zap size={16} /> {language === 'ar' ? rule.titleAr : rule.titleEn}</strong>
                    <StatusPill tone={tone(rule.priority)}>{rule.priority}</StatusPill>
                  </div>
                  <p>{rule.ruleType} → {rule.actionType}</p>
                  <div className="automation-meta-row">
                    <span>{t('automation.health')}: <b>{rule.ruleHealth}</b></span>
                    <span>{t('automation.runs')}: <b>{rule.runCount}</b></span>
                  </div>
                  <code>{JSON.stringify(rule.conditionJson)}</code>
                </article>
              ))}
            </div>
          </DataState>
        </ModernCard>

        <ModernCard title={t('automation.executiveExceptions')} subtitle={t('automation.executiveExceptionsHint')}>
          <DataState loading={exceptions.loading} error={exceptions.error} empty={!exceptions.data?.length}>
            <div className="exception-list">
              {(exceptions.data ?? []).map(item => (
                <article className="exception-card" key={item.id}>
                  <div className="exception-icon"><TriangleAlert size={18} /></div>
                  <div>
                    <div className="automation-rule-head"><strong>{language === 'ar' ? item.titleAr : item.titleEn}</strong><StatusPill tone={tone(item.severity)}>{item.severity}</StatusPill></div>
                    <p>{language === 'ar' ? item.triggerDescriptionAr : item.triggerDescriptionEn}</p>
                    <div className="automation-meta-row"><span><BellRing size={14} /> SLA {item.responseSlaHours ?? '-'}h</span><span><CalendarClock size={14} /> {item.area}</span></div>
                  </div>
                </article>
              ))}
            </div>
          </DataState>
        </ModernCard>
      </div>
    </section>
  );
}
