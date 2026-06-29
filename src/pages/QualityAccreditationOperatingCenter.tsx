import { useEffect, useMemo, useState } from 'react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import {
  getQualityAccreditationOperatingSummary,
  getQualityAccreditationRequirementDashboard,
  getQualityIndicatorDashboard,
  getQualityRcaCapaDashboard,
  getQualityTracerRoundDashboard,
  type QualityAccreditationOperatingSummary,
  type QualityAccreditationRequirementRow,
  type QualityIndicatorDashboardRow,
  type QualityRcaCapaDashboardRow,
  type QualityTracerRoundDashboardRow,
} from '../lib/qualityAccreditationOperatingApi';
import { getLiveResultMessage, isLive, type LiveResult } from '../lib/liveResult';

type Tone = 'neutral' | 'good' | 'warning' | 'danger';

const emptySummary: LiveResult<QualityAccreditationOperatingSummary> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No quality/accreditation operating summary loaded yet.',
};

const emptyRequirements: LiveResult<QualityAccreditationRequirementRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No accreditation operating requirements loaded yet.',
};

const emptyIndicators: LiveResult<QualityIndicatorDashboardRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No quality indicators loaded yet.',
};

const emptyTracers: LiveResult<QualityTracerRoundDashboardRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No tracer rounds loaded yet.',
};

const emptyRca: LiveResult<QualityRcaCapaDashboardRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No RCA/CAPA cases loaded yet.',
};

function rows<T>(result: LiveResult<T[]>): T[] {
  return isLive(result) ? result.data : [];
}

function readinessTone(status: string): Tone {
  if (status === 'ready') return 'good';
  if (status === 'evidence_submitted' || status === 'in_progress') return 'warning';
  if (status === 'not_ready' || status === 'accepted_risk') return 'danger';
  return 'neutral';
}

function signalTone(signal?: string | null): Tone {
  if (signal === 'on_target') return 'good';
  if (signal === 'watch' || signal === 'due_soon') return 'warning';
  if (signal === 'off_target' || signal === 'overdue' || signal === 'high_priority') return 'danger';
  return 'neutral';
}

function severityTone(severity: string): Tone {
  if (severity === 'critical' || severity === 'high') return 'danger';
  if (severity === 'medium') return 'warning';
  return 'neutral';
}

export function QualityAccreditationOperatingCenter() {
  const [summary, setSummary] = useState<LiveResult<QualityAccreditationOperatingSummary>>(emptySummary);
  const [requirements, setRequirements] = useState<LiveResult<QualityAccreditationRequirementRow[]>>(emptyRequirements);
  const [indicators, setIndicators] = useState<LiveResult<QualityIndicatorDashboardRow[]>>(emptyIndicators);
  const [tracers, setTracers] = useState<LiveResult<QualityTracerRoundDashboardRow[]>>(emptyTracers);
  const [rcaCases, setRcaCases] = useState<LiveResult<QualityRcaCapaDashboardRow[]>>(emptyRca);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const [summaryResult, requirementResult, indicatorResult, tracerResult, rcaResult] = await Promise.all([
        getQualityAccreditationOperatingSummary(),
        getQualityAccreditationRequirementDashboard(),
        getQualityIndicatorDashboard(),
        getQualityTracerRoundDashboard(),
        getQualityRcaCapaDashboard(),
      ]);

      if (!mounted) return;
      setSummary(summaryResult);
      setRequirements(requirementResult);
      setIndicators(indicatorResult);
      setTracers(tracerResult);
      setRcaCases(rcaResult);
      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const summaryData = isLive(summary) ? summary.data : null;
  const requirementRows = rows(requirements);
  const indicatorRows = rows(indicators);
  const tracerRows = rows(tracers);
  const rcaRows = rows(rcaCases);

  const nonLiveMessages = useMemo(() => ([summary, requirements, indicators, tracers, rcaCases] as LiveResult<unknown>[])
    .filter(result => !isLive(result))
    .map(result => getLiveResultMessage(result))
    .filter((message, index, all) => all.indexOf(message) === index), [indicators, rcaCases, requirements, summary, tracers]);

  const hasAnyData = Boolean(summaryData)
    || requirementRows.length > 0
    || indicatorRows.length > 0
    || tracerRows.length > 0
    || rcaRows.length > 0;

  const gapScoreCount = summaryData?.gap_score_count ?? requirementRows.reduce((total, row) => total + row.gap_count, 0);
  const openObservationCount = summaryData?.open_observation_count ?? tracerRows.reduce((total, row) => total + row.open_observation_count, 0);
  const openRcaCount = summaryData?.open_rca_capa_count ?? rcaRows.filter(row => !['closed', 'accepted_risk'].includes(row.case_status)).length;

  return (
    <div className="page-stack quality-accreditation-operating-center">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Accreditation and quality operating layer</p>
          <h1>Run survey readiness as daily hospital work</h1>
          <p className="section-subtitle">
            Licensed standards import governance, requirement owners, measurable element scoring, tracer rounds, quality indicators, OVR/RCA/CAPA linkage, committee decisions, and evidence packs.
          </p>
        </div>
      </section>

      <DataState
        loading={loading}
        empty={!loading && !hasAnyData}
        emptyTitle="Patch 6 operating layer is installed, but no live records are loaded yet"
        emptyMessage={nonLiveMessages[0] ?? 'Load licensed standards, assign requirement owners, start tracers, and connect quality indicators to activate this workspace.'}
      >
        <div className="kpi-grid">
          <KpiTile label="Requirements" value={summaryData?.requirement_operation_count ?? requirementRows.length} hint="Owned operating requirements" />
          <KpiTile label="Ready" value={summaryData?.ready_requirement_count ?? requirementRows.filter(row => ['ready', 'evidence_submitted'].includes(row.readiness_status)).length} hint="Ready or evidence submitted" tone="good" />
          <KpiTile label="Gaps" value={gapScoreCount} hint="Partially met / not met scores" tone={gapScoreCount > 0 ? 'warning' : 'good'} />
          <KpiTile label="Indicators" value={summaryData?.indicator_count ?? indicatorRows.length} hint="Quality and safety metrics" />
          <KpiTile label="Open observations" value={openObservationCount} hint="Tracer findings needing action" tone={openObservationCount > 0 ? 'warning' : 'good'} />
          <KpiTile label="RCA/CAPA" value={openRcaCount} hint="Open corrective action loops" tone={openRcaCount > 0 ? 'danger' : 'good'} />
        </div>

        <ModernCard
          title="Accreditation requirement operating queue"
          subtitle="Department ownership, applicability, readiness, measurable element scoring, evidence status, and workflow linkage. No copyrighted standard text is embedded by default."
        >
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Requirement</th>
                  <th>Standard</th>
                  <th>Department</th>
                  <th>Owner</th>
                  <th>Applicability</th>
                  <th>Readiness</th>
                  <th>Gaps</th>
                  <th>Evidence</th>
                  <th>Target survey</th>
                </tr>
              </thead>
              <tbody>
                {requirementRows.slice(0, 100).map(row => (
                  <tr key={`${row.standard_code}-${row.requirement_reference}`}>
                    <td><strong>{row.requirement_reference}</strong><br /><small>{row.requirement_title ?? 'Untitled requirement'}</small></td>
                    <td>{row.standard_code}{row.chapter_code ? ` / ${row.chapter_code}` : ''}</td>
                    <td>{row.department_name ?? 'Unassigned'}</td>
                    <td>{row.owner_name ?? 'Unassigned'}</td>
                    <td>{row.applicability_status}</td>
                    <td><StatusPill tone={readinessTone(row.readiness_status)}>{row.readiness_status}</StatusPill></td>
                    <td>{row.gap_count}</td>
                    <td>{row.evidence_submitted_count}</td>
                    <td>{row.target_survey_date ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard
          title="Quality indicator dashboard"
          subtitle="Quality, patient safety, infection control, clinical, operational, and accreditation indicators with target signals."
        >
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Indicator</th>
                  <th>Domain</th>
                  <th>Owner</th>
                  <th>Measured</th>
                  <th>Target</th>
                  <th>Period</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {indicatorRows.slice(0, 100).map(row => (
                  <tr key={row.indicator_code}>
                    <td><strong>{row.indicator_code}</strong><br /><small>{row.indicator_name}</small></td>
                    <td>{row.indicator_domain}</td>
                    <td>{row.owner_name ?? 'Unassigned'}</td>
                    <td>{row.measured_value ?? '-'}</td>
                    <td>{row.target_value ?? '-'}</td>
                    <td>{row.period_end ?? '-'}</td>
                    <td><StatusPill tone={signalTone(row.performance_signal)}>{row.performance_signal}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard
          title="Tracer rounds"
          subtitle="Patient, system, department, document, and environment tracers with observations and high-risk findings."
        >
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Tracer</th>
                  <th>Type</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Round date</th>
                  <th>Lead</th>
                  <th>Observations</th>
                  <th>High risk</th>
                </tr>
              </thead>
              <tbody>
                {tracerRows.slice(0, 100).map(row => (
                  <tr key={row.tracer_code}>
                    <td><strong>{row.tracer_code}</strong><br /><small>{row.tracer_title}</small></td>
                    <td>{row.tracer_type}</td>
                    <td>{row.department_name ?? 'Unassigned'}</td>
                    <td>{row.tracer_status}</td>
                    <td>{row.round_date ?? '-'}</td>
                    <td>{row.lead_reviewer_name ?? 'Unassigned'}</td>
                    <td>{row.open_observation_count} / {row.observation_count}</td>
                    <td><StatusPill tone={row.high_risk_observation_count > 0 ? 'danger' : 'good'}>{row.high_risk_observation_count}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard
          title="RCA / CAPA operating loop"
          subtitle="OVR, tracer, mock survey, indicator breach, and audit finding cases linked to RCA, corrective actions, retesting, and effectiveness."
        >
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Case</th>
                  <th>Source</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Severity</th>
                  <th>Effectiveness</th>
                  <th>Owner</th>
                  <th>Due</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {rcaRows.slice(0, 100).map(row => (
                  <tr key={row.case_code}>
                    <td><strong>{row.case_code}</strong><br /><small>{row.case_title}</small></td>
                    <td>{row.source_type}{row.source_reference ? ` / ${row.source_reference}` : ''}</td>
                    <td>{row.department_name ?? 'Unassigned'}</td>
                    <td>{row.case_status}</td>
                    <td><StatusPill tone={severityTone(row.severity)}>{row.severity}</StatusPill></td>
                    <td>{row.effectiveness_status}</td>
                    <td>{row.owner_name ?? 'Unassigned'}</td>
                    <td>{row.due_date ?? '-'}</td>
                    <td><StatusPill tone={signalTone(row.case_signal)}>{row.case_signal}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>
      </DataState>
    </div>
  );
}
