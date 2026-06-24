import { DataState } from '../components/DataState';
import { EmptySupabaseNotice } from '../components/EmptySupabaseNotice';
import { ModuleHeader } from '../components/ModuleHeader';
import { StatCard } from '../components/StatCard';
import { Heatmap, HorizontalBarChart, KpiGauge, MiniLineChart, RadarChart } from '../components/analytics/AnalyticsCharts';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import { getDepartmentRiskHeatmap, getGrcKpiScorecard, getMonthlyGrcTrend, getRadarControlProfile } from '../lib/grcApi';
import type { DepartmentRiskHeatmapRow } from '../types/domain';
import { isEmptyLiveObject } from '../lib/liveData';

function signalTone(score: number) {
  if (score >= 75) return 'danger' as const;
  if (score >= 50) return 'warning' as const;
  return undefined;
}

export function Analytics() {
  const { t, language } = useI18n();
  const scorecard = useAsyncData(getGrcKpiScorecard, []);
  const heatmap = useAsyncData(getDepartmentRiskHeatmap, []);
  const trend = useAsyncData(getMonthlyGrcTrend, []);
  const radar = useAsyncData(getRadarControlProfile, []);
  const scorecardData = isEmptyLiveObject(scorecard.data) ? null : scorecard.data;

  const topDepartments = (heatmap.data || []).slice(0, 5).map(row => ({
    label: row.department_name,
    value: Math.round(row.overall_pressure_score),
    level: row.signal_level
  }));

  return (
    <section className="page-section analytics-page">
      <EmptySupabaseNotice />
      <ModuleHeader
        eyebrow={t('analytics.eyebrow')}
        title={t('analytics.title')}
        subtitle={t('analytics.subtitle')}
      />

      <DataState
        loading={scorecard.loading}
        error={scorecard.error}
        empty={!scorecardData}
        emptyTitle="GRC scorecard is not available"
        emptyMessage="Live score values will appear after the analytics views are applied and records exist in your authorized scope."
      >
        {scorecardData ? (
          <>
            <div className="stats-grid analytics-score-grid">
              <StatCard label={t('analytics.executionHealth')} value={Math.round(scorecardData.execution_health_score)} tone={scorecardData.execution_health_score < 60 ? 'danger' : scorecardData.execution_health_score < 80 ? 'warning' : undefined} />
              <StatCard label={t('analytics.riskExposure')} value={Math.round(scorecardData.risk_exposure_score)} tone={signalTone(scorecardData.risk_exposure_score)} />
              <StatCard label={t('analytics.compliancePressure')} value={Math.round(scorecardData.compliance_pressure_score)} tone={signalTone(scorecardData.compliance_pressure_score)} />
              <StatCard label={t('analytics.ovrSafetySignal')} value={Math.round(scorecardData.ovr_safety_signal_score)} tone={signalTone(scorecardData.ovr_safety_signal_score)} />
              <StatCard label={t('analytics.evidenceDiscipline')} value={Math.round(scorecardData.evidence_discipline_score)} tone={scorecardData.evidence_discipline_score < 60 ? 'warning' : undefined} />
              <StatCard label={t('analytics.approvalBottleneck')} value={Math.round(scorecardData.approval_bottleneck_score)} tone={signalTone(scorecardData.approval_bottleneck_score)} />
            </div>

            <div className="analytics-gauge-grid">
              <KpiGauge label={t('analytics.executionHealth')} value={scorecardData.execution_health_score} hint={t('analytics.executionHint')} />
              <KpiGauge label={t('analytics.riskExposure')} value={scorecardData.risk_exposure_score} inverse hint={t('analytics.riskHint')} />
              <KpiGauge label={t('analytics.ovrSafetySignal')} value={scorecardData.ovr_safety_signal_score} inverse hint={t('analytics.ovrHint')} />
            </div>
          </>
        ) : null}
      </DataState>

      <div className="analytics-main-grid">
        <DataState loading={trend.loading} error={trend.error} empty={!trend.data?.length}>
          <MiniLineChart
            title={t('analytics.monthlyTrend')}
            description={t('analytics.monthlyTrendHint')}
            data={(trend.data || []).map(row => ({
              label: row.month_label,
              newProjects: row.new_projects,
              ovrReports: row.ovr_reports,
              newRisks: row.new_risks,
              auditFindings: row.new_audit_findings
            }))}
            series={[
              { key: 'newProjects', label: t('analytics.newProjects') },
              { key: 'ovrReports', label: t('analytics.ovrReports') },
              { key: 'newRisks', label: t('analytics.newRisks') }
            ]}
          />
        </DataState>

        <DataState loading={radar.loading} error={radar.error} empty={!radar.data?.length}>
          <RadarChart
            title={t('analytics.radarTitle')}
            description={t('analytics.radarHint')}
            axes={(radar.data || []).map(row => ({
              label: language === 'ar' ? row.dimension_label_ar : row.dimension_label_en,
              value: row.score
            }))}
          />
        </DataState>
      </div>

      <DataState loading={heatmap.loading} error={heatmap.error} empty={!heatmap.data?.length}>
        <Heatmap<DepartmentRiskHeatmapRow>
          title={t('analytics.heatmapTitle')}
          description={t('analytics.heatmapHint')}
          rows={heatmap.data || []}
          rowLabel={row => row.department_name}
          cells={[
            { key: 'execution', label: t('analytics.execution'), value: row => row.execution_pressure_score },
            { key: 'risk', label: t('analytics.risk'), value: row => row.risk_pressure_score },
            { key: 'compliance', label: t('analytics.compliance'), value: row => row.compliance_pressure_score },
            { key: 'ovr', label: t('analytics.ovr'), value: row => row.ovr_pressure_score },
            { key: 'overall', label: t('analytics.overall'), value: row => row.overall_pressure_score }
          ]}
        />
      </DataState>

      <div className="analytics-main-grid">
        <DataState loading={heatmap.loading} error={heatmap.error} empty={!heatmap.data?.length}>
          <HorizontalBarChart
            title={t('analytics.topPressure')}
            description={t('analytics.topPressureHint')}
            data={topDepartments}
          />
        </DataState>

        <DataState loading={trend.loading} error={trend.error} empty={!trend.data?.length}>
          <HorizontalBarChart
            title={t('analytics.majorOvrTrend')}
            description={t('analytics.majorOvrHint')}
            data={(trend.data || []).map(row => ({ label: row.month_label, value: row.major_ovrs, level: row.major_ovrs > 1 ? 'high' : row.major_ovrs > 0 ? 'medium' : 'low' }))}
          />
        </DataState>
      </div>
    </section>
  );
}
