import { useMemo, useState } from 'react';
import { BriefcaseBusiness, CheckCircle2, Download, FileText, Printer, RefreshCcw } from 'lucide-react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import { useAsyncData } from '../hooks/useAsyncData';
import { createBoardPackSnapshot, getBoardPackSummary, getDepartmentScorecards, getScenarioMatrix } from '../lib/enterpriseApi';
import { exportRows, printRows } from '../lib/exportUtils';
import { useI18n } from '../i18n/I18nContext';
import { actionErrorMessage } from '../lib/privilegedAction';

export function BoardPackCenter() {
  const { t, direction, language } = useI18n();
  const [message, setMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const summary = useAsyncData(getBoardPackSummary, []);
  const scorecards = useAsyncData(getDepartmentScorecards, []);
  const scenarios = useAsyncData(getScenarioMatrix, []);
  const data = summary.data;

  const boardRows = useMemo(() => data ? [{
    asOfDate: data.asOfDate,
    activeProjects: data.activeProjects,
    highOpenRisks: data.highOpenRisks,
    complianceDue30Days: data.complianceDue30Days,
    openAuditFindings: data.openAuditFindings,
    openOvrs: data.openOvrs,
    pendingApprovals: data.pendingApprovals,
    evidenceReviews: data.evidenceReviews,
    avgDepartmentControlScore: data.avgDepartmentControlScore,
    departmentsAtRisk: data.departmentsAtRisk
  }] : [], [data]);

  async function snapshot() {
    setMessage('');
    setActionError('');
    try {
      const id = await createBoardPackSnapshot(`Executive Board Pack ${new Date().toISOString().slice(0, 10)}`);
      setMessage(`${t('board.snapshotCreated')}: ${id}`);
    } catch (actionFailure) {
      setActionError(actionErrorMessage(actionFailure));
    }
  }

  return (
    <section className="page-section enterprise-page">
      <div className="section-heading ultra-hero enterprise-hero">
        <div>
          <p className="eyebrow">{t('board.eyebrow')}</p>
          <h3>{t('board.title')}</h3>
          <p className="section-subtitle">{t('board.subtitle')}</p>
        </div>
        <div className="command-hero-actions">
          <button className="ghost-button" onClick={() => summary.refresh()}><RefreshCcw size={16} /> {t('common.refresh', 'Refresh')}</button>
          <button className="primary-button" onClick={snapshot}><BriefcaseBusiness size={16} /> {t('board.createSnapshot')}</button>
        </div>
      </div>

      {message && <div className="success-banner"><CheckCircle2 size={16} /> {message}</div>}
      {actionError && <div className="notice-banner danger">{actionError}</div>}

      <DataState loading={summary.loading} error={summary.error} empty={!data}>
        {data && (
          <div className="ultra-release-grid enterprise-kpi-grid">
            <div className="release-score-card">
              <div className="release-ring">
                <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="48" className="ring-bg"/><circle cx="60" cy="60" r="48" className="ring-progress" style={{ strokeDashoffset: 301 - (301 * (data.avgDepartmentControlScore || 0)) / 100 }} /><text x="60" y="65" textAnchor="middle">{data.avgDepartmentControlScore ?? 0}%</text></svg>
              </div>
              <div><h4>{t('board.controlScore')}</h4><p>{language === 'ar' ? data.organizationNameAr : data.organizationNameEn}</p></div>
            </div>
            <KpiTile label={t('board.activeProjects')} value={data.activeProjects} />
            <KpiTile label={t('board.highRisks')} value={data.highOpenRisks} tone="danger" />
            <KpiTile label={t('board.openOvrs')} value={data.openOvrs} tone="warning" />
            <KpiTile label={t('board.pendingApprovals')} value={data.pendingApprovals} tone="warning" />
            <KpiTile label={t('board.deptsAtRisk')} value={data.departmentsAtRisk} tone="danger" />
          </div>
        )}
      </DataState>

      <div className="enterprise-actions-row">
        <button className="ghost-button" onClick={() => exportRows('executive_board_pack_summary', boardRows, 'csv')}><Download size={16} /> CSV</button>
        <button className="ghost-button" onClick={() => exportRows('executive_board_pack_summary', boardRows, 'json')}><FileText size={16} /> JSON</button>
        <button className="ghost-button" onClick={() => printRows(t('board.title'), boardRows, direction)}><Printer size={16} /> {t('reports.print')}</button>
      </div>

      <div className="two-column align-start">
        <ModernCard title={t('board.departmentScorecards')} subtitle={t('board.departmentScorecardsHint')}>
          <DataState loading={scorecards.loading} error={scorecards.error} empty={!scorecards.data?.length}>
            <div className="scorecard-stack">
              {(scorecards.data ?? []).slice(0, 6).map(card => (
                <article className={`department-scorecard ${card.signal}`} key={card.departmentId}>
                  <div>
                    <h4>{language === 'ar' ? card.departmentNameAr : card.departmentNameEn}</h4>
                    <p>{card.latestExecutiveNote || t('board.noExecutiveNote')}</p>
                  </div>
                  <div className="scorecard-metrics">
                    <strong>{card.controlScore}%</strong>
                    <StatusPill tone={card.signal === 'critical' || card.signal === 'at_risk' ? 'danger' : card.signal === 'watch' ? 'warning' : 'good'}>{card.signal}</StatusPill>
                    <span>{card.overdueTasks} {t('board.overdueTasks')}</span>
                  </div>
                </article>
              ))}
            </div>
          </DataState>
        </ModernCard>

        <ModernCard title={t('board.scenarios')} subtitle={t('board.scenariosHint')}>
          <DataState loading={scenarios.loading} error={scenarios.error} empty={!scenarios.data?.length}>
            <div className="scenario-list">
              {(scenarios.data ?? []).map(item => (
                <article className={`scenario-card ${item.exposureLevel}`} key={item.id}>
                  <div className="scenario-head">
                    <strong>{language === 'ar' ? item.titleAr : item.titleEn}</strong>
                    <span>{item.exposureScore}/25</span>
                  </div>
                  <p>{item.mitigationSummary}</p>
                  <div className="scenario-triggers">{item.triggerIndicators?.slice(0, 3).map(trigger => <span key={trigger}>{trigger}</span>)}</div>
                </article>
              ))}
            </div>
          </DataState>
        </ModernCard>
      </div>
    </section>
  );
}
