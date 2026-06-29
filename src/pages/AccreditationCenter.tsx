import { useEffect, useMemo, useState } from 'react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import {
  getAccreditationGapDashboard,
  getAccreditationReadinessSummary,
  getAccreditationRequirementMatrix,
  type AccreditationGapDashboardRow,
  type AccreditationReadinessSummary,
  type AccreditationRequirementMatrixRow,
} from '../lib/accreditationApi';
import { getLiveResultMessage, isLive, type LiveResult } from '../lib/liveResult';

const emptySummary: LiveResult<AccreditationReadinessSummary[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No accreditation summary loaded yet.',
};

const emptyMatrix: LiveResult<AccreditationRequirementMatrixRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No accreditation requirements loaded yet.',
};

const emptyGaps: LiveResult<AccreditationGapDashboardRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No accreditation gaps loaded yet.',
};

function rows<T>(result: LiveResult<T[]>): T[] {
  return isLive(result) ? result.data : [];
}

function scoreTone(score: number | null): 'neutral' | 'good' | 'warning' | 'danger' {
  if (score === null) return 'neutral';
  if (score >= 85) return 'good';
  if (score >= 70) return 'warning';
  return 'danger';
}

function gapTone(severity: string): 'neutral' | 'good' | 'warning' | 'danger' {
  if (severity === 'critical' || severity === 'high') return 'danger';
  if (severity === 'medium') return 'warning';
  if (severity === 'low') return 'neutral';
  return 'neutral';
}

export function AccreditationCenter() {
  const [summary, setSummary] = useState<LiveResult<AccreditationReadinessSummary[]>>(emptySummary);
  const [matrix, setMatrix] = useState<LiveResult<AccreditationRequirementMatrixRow[]>>(emptyMatrix);
  const [gaps, setGaps] = useState<LiveResult<AccreditationGapDashboardRow[]>>(emptyGaps);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const [summaryResult, matrixResult, gapsResult] = await Promise.all([
        getAccreditationReadinessSummary(),
        getAccreditationRequirementMatrix(),
        getAccreditationGapDashboard(),
      ]);

      if (!mounted) return;
      setSummary(summaryResult);
      setMatrix(matrixResult);
      setGaps(gapsResult);
      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const summaryRows = rows(summary);
  const matrixRows = rows(matrix);
  const gapRows = rows(gaps);

  const kpis = useMemo(() => {
    const standardCount = summaryRows.length;
    const requirementCount = summaryRows.reduce((total, item) => total + (item.requirement_count ?? 0), 0);
    const evidenceRules = summaryRows.reduce((total, item) => total + (item.evidence_rule_count ?? 0), 0);
    const openGaps = gapRows.reduce((total, item) => total + (item.gap_count ?? 0), 0);
    const latestScores = summaryRows
      .map(item => item.latest_readiness_score)
      .filter((score): score is number => typeof score === 'number');
    const averageScore = latestScores.length
      ? Math.round(latestScores.reduce((total, score) => total + score, 0) / latestScores.length)
      : null;

    return { standardCount, requirementCount, evidenceRules, openGaps, averageScore };
  }, [gapRows, summaryRows]);

  const nonLiveMessages = ([summary, matrix, gaps] as LiveResult<unknown[]>[])
    .filter(result => !isLive(result))
    .map(result => getLiveResultMessage(result))
    .filter((message, index, all) => all.indexOf(message) === index);

  return (
    <div className="page-stack accreditation-center">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Accreditation engine</p>
          <h1>CBAHI / international readiness command center</h1>
          <p className="section-subtitle">
            Clause-to-measurable-element-to-evidence backbone for healthcare accreditation readiness. Load only licensed/current standards content owned by the organization.
          </p>
        </div>
      </section>

      <DataState
        loading={loading}
        empty={!loading && summaryRows.length === 0 && matrixRows.length === 0 && gapRows.length === 0}
        emptyTitle="Accreditation engine is installed, but no live content is loaded yet"
        emptyMessage={nonLiveMessages[0] ?? 'Load licensed/current standards content and assign organization context to start readiness tracking.'}
      >
        <div className="kpi-grid">
          <KpiTile label="Standards" value={kpis.standardCount} hint="Loaded standard versions" />
          <KpiTile label="Requirements" value={kpis.requirementCount} hint="Clause-level operating items" />
          <KpiTile label="Evidence rules" value={kpis.evidenceRules} hint="Required evidence links" />
          <KpiTile label="Open gaps" value={kpis.openGaps} hint="Active accreditation findings" tone={kpis.openGaps > 0 ? 'warning' : 'good'} />
          <KpiTile label="Readiness" value={kpis.averageScore === null ? 'Not scored' : `${kpis.averageScore}%`} hint="Latest approved/draft snapshot" tone={scoreTone(kpis.averageScore)} />
        </div>

        <ModernCard
          title="Standards readiness"
          subtitle="Approved/live standards appear here after licensed content is loaded. Empty contract rows are expected immediately after Patch 2."
        >
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Standard</th>
                  <th>Version</th>
                  <th>Content</th>
                  <th>Approval</th>
                  <th>Requirements</th>
                  <th>Elements</th>
                  <th>Evidence rules</th>
                  <th>Open gaps</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map(row => (
                  <tr key={`${row.standard_code}-${row.standard_version_id}`}>
                    <td><strong>{row.standard_code}</strong><br /><small>{row.standard_name_en}</small></td>
                    <td>{row.version_label}</td>
                    <td><StatusPill tone={row.content_status === 'approved' || row.content_status === 'loaded' ? 'good' : 'warning'}>{row.content_status}</StatusPill></td>
                    <td><StatusPill tone={row.approval_status === 'approved' ? 'good' : 'warning'}>{row.approval_status}</StatusPill></td>
                    <td>{row.requirement_count}</td>
                    <td>{row.measurable_element_count}</td>
                    <td>{row.evidence_rule_count}</td>
                    <td>{row.open_gap_count}</td>
                    <td>{row.latest_readiness_score === null ? '-' : `${row.latest_readiness_score}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard
          title="Requirement matrix"
          subtitle="Requirements, measurable elements, evidence rules, and crosswalk coverage."
        >
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Standard</th>
                  <th>Chapter</th>
                  <th>Requirement</th>
                  <th>Type</th>
                  <th>Priority</th>
                  <th>Elements</th>
                  <th>Evidence</th>
                  <th>Crosswalk</th>
                </tr>
              </thead>
              <tbody>
                {matrixRows.slice(0, 80).map(row => (
                  <tr key={row.requirement_id}>
                    <td>{row.standard_code}</td>
                    <td><strong>{row.chapter_code}</strong><br /><small>{row.chapter_title_en}</small></td>
                    <td><strong>{row.requirement_code}</strong><br /><small>{row.requirement_title_en}</small></td>
                    <td>{row.requirement_type}</td>
                    <td><StatusPill tone={row.priority === 'critical' || row.priority === 'high' ? 'danger' : 'neutral'}>{row.priority}</StatusPill></td>
                    <td>{row.measurable_element_count}</td>
                    <td>{row.evidence_rule_count}</td>
                    <td>{row.crosswalk_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard
          title="Gap dashboard"
          subtitle="Open accreditation gaps grouped by standard, requirement, status, and severity."
        >
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Standard</th>
                  <th>Requirement</th>
                  <th>Status</th>
                  <th>Severity</th>
                  <th>Count</th>
                  <th>Nearest due date</th>
                </tr>
              </thead>
              <tbody>
                {gapRows.map(row => (
                  <tr key={`${row.standard_code}-${row.requirement_code}-${row.gap_status}-${row.severity}`}>
                    <td>{row.standard_code}</td>
                    <td><strong>{row.requirement_code}</strong><br /><small>{row.requirement_title_en}</small></td>
                    <td>{row.gap_status}</td>
                    <td><StatusPill tone={gapTone(row.severity)}>{row.severity}</StatusPill></td>
                    <td>{row.gap_count}</td>
                    <td>{row.nearest_due_date ?? '-'}</td>
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
