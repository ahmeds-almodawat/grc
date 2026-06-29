import { useEffect, useMemo, useState } from 'react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import {
  getAccreditationEvidencePackReadiness,
  getUatEvidenceSummary,
  getUatFailedRetestQueue,
  getUatRoleScenarioQueue,
  type AccreditationEvidencePackReadinessRow,
  type UatEvidenceSummary,
  type UatFailedRetestQueueRow,
  type UatRoleScenarioQueueRow,
} from '../lib/uatAccreditationEvidenceApi';
import { getLiveResultMessage, isLive, type LiveResult } from '../lib/liveResult';

const emptySummary: LiveResult<UatEvidenceSummary> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No UAT evidence summary loaded yet.',
};

const emptyScenarioQueue: LiveResult<UatRoleScenarioQueueRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No role scenario queue loaded yet.',
};

const emptyEvidencePack: LiveResult<AccreditationEvidencePackReadinessRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No accreditation evidence pack readiness loaded yet.',
};

const emptyRetestQueue: LiveResult<UatFailedRetestQueueRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No failed scenario retest queue loaded yet.',
};

function rows<T>(result: LiveResult<T[]>): T[] {
  return isLive(result) ? result.data : [];
}

function signalTone(signal?: string | null): 'neutral' | 'good' | 'warning' | 'danger' {
  if (!signal || signal === 'normal') return 'neutral';
  if (['ready', 'passed'].includes(signal)) return 'good';
  if (['danger', 'overdue', 'failed', 'blocked', 'gap_open'].includes(signal)) return 'danger';
  if (['warning', 'retest_ready', 'in_progress'].includes(signal)) return 'warning';
  return 'neutral';
}

function statusTone(status?: string | null): 'neutral' | 'good' | 'warning' | 'danger' {
  if (!status) return 'neutral';
  if (['passed', 'ready', 'approved', 'accepted', 'closed', 'retested_passed'].includes(status)) return 'good';
  if (['failed', 'blocked', 'rejected', 'expired', 'gap_open'].includes(status)) return 'danger';
  if (['pending', 'submitted', 'in_progress', 'fixed_pending_retest', 'review_required'].includes(status)) return 'warning';
  return 'neutral';
}

export function UatAccreditationEvidenceCenter() {
  const [summary, setSummary] = useState<LiveResult<UatEvidenceSummary>>(emptySummary);
  const [scenarioQueue, setScenarioQueue] = useState<LiveResult<UatRoleScenarioQueueRow[]>>(emptyScenarioQueue);
  const [evidencePack, setEvidencePack] = useState<LiveResult<AccreditationEvidencePackReadinessRow[]>>(emptyEvidencePack);
  const [retestQueue, setRetestQueue] = useState<LiveResult<UatFailedRetestQueueRow[]>>(emptyRetestQueue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const [summaryResult, scenarioResult, evidenceResult, retestResult] = await Promise.all([
        getUatEvidenceSummary(),
        getUatRoleScenarioQueue(),
        getAccreditationEvidencePackReadiness(),
        getUatFailedRetestQueue(),
      ]);

      if (!mounted) return;
      setSummary(summaryResult);
      setScenarioQueue(scenarioResult);
      setEvidencePack(evidenceResult);
      setRetestQueue(retestResult);
      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const summaryData = isLive(summary) ? summary.data : null;
  const scenarioRows = rows(scenarioQueue);
  const evidenceRows = rows(evidencePack);
  const retestRows = rows(retestQueue);

  const nonLiveMessages = useMemo(() => ([summary, scenarioQueue, evidencePack, retestQueue] as LiveResult<unknown>[])
    .filter(result => !isLive(result))
    .map(result => getLiveResultMessage(result))
    .filter((message, index, all) => all.indexOf(message) === index), [evidencePack, retestQueue, scenarioQueue, summary]);

  const hasAnyData = Boolean(summaryData) || scenarioRows.length > 0 || evidenceRows.length > 0 || retestRows.length > 0;
  const evidenceAcceptanceRate = summaryData && summaryData.evidence_capture_count > 0
    ? Math.round((summaryData.accepted_evidence_count / summaryData.evidence_capture_count) * 100)
    : 0;

  return (
    <div className="page-stack uat-accreditation-evidence-center">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">UAT and accreditation evidence pack</p>
          <h1>Role-based scenario proof before production and survey readiness</h1>
          <p className="section-subtitle">
            Captures real role scenarios, screenshots, SQL proof, signoffs, failed scenarios, retests, and accreditation evidence pack readiness without loading copyrighted standards text.
          </p>
        </div>
      </section>

      <DataState
        loading={loading}
        empty={!loading && !hasAnyData}
        emptyTitle="Patch 13 evidence pack is installed, but no live UAT evidence is loaded yet"
        emptyMessage={nonLiveMessages[0] ?? 'Load real UAT scenario scripts, evidence captures, signoffs, and accreditation evidence pack records to activate this center.'}
      >
        <div className="kpi-grid">
          <KpiTile label="Scenarios" value={summaryData?.scenario_count ?? scenarioRows.length} hint="Role-based scripts" />
          <KpiTile label="Passed scenarios" value={summaryData?.passed_scenario_count ?? scenarioRows.filter(row => row.scenario_status === 'passed').length} hint="Accepted UAT proof" tone="good" />
          <KpiTile label="Failures / blocked" value={summaryData?.failed_or_blocked_scenario_count ?? retestRows.length} hint="Needs retest" tone={(summaryData?.failed_or_blocked_scenario_count ?? retestRows.length) > 0 ? 'danger' : 'good'} />
          <KpiTile label="Evidence acceptance" value={`${evidenceAcceptanceRate}%`} hint="Accepted captures" tone={evidenceAcceptanceRate >= 90 ? 'good' : 'warning'} />
          <KpiTile label="Pending signoffs" value={summaryData?.pending_signoff_count ?? 0} hint="Human approval" tone={(summaryData?.pending_signoff_count ?? 0) > 0 ? 'warning' : 'good'} />
          <KpiTile label="Readiness score" value={summaryData?.average_readiness_score ?? 0} hint="Average approved score" />
        </div>

        <ModernCard title="Role scenario queue" subtitle="Quality, Risk, Compliance, Audit, IT, Executive, Department Manager, Employee, and External Auditor scenarios.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Scenario</th>
                  <th>Role</th>
                  <th>Module</th>
                  <th>Domain</th>
                  <th>Status</th>
                  <th>Risk</th>
                  <th>Owner</th>
                  <th>Steps</th>
                  <th>Evidence</th>
                  <th>Open failures</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {scenarioRows.map(row => (
                  <tr key={row.scenario_code}>
                    <td><strong>{row.scenario_title}</strong><br /><span>{row.scenario_code}</span></td>
                    <td>{row.role_key}</td>
                    <td>{row.module_key}</td>
                    <td>{row.accreditation_domain ?? '—'}</td>
                    <td><StatusPill tone={statusTone(row.scenario_status)}>{row.scenario_status}</StatusPill></td>
                    <td>{row.risk_level}</td>
                    <td>{row.owner_name ?? 'Unassigned'}</td>
                    <td>{row.step_count}</td>
                    <td>{row.evidence_count}</td>
                    <td>{row.open_failure_count}</td>
                    <td><StatusPill tone={signalTone(row.queue_signal)}>{row.queue_signal}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard title="Accreditation evidence pack readiness" subtitle="Evidence pack gaps by framework and department for survey-readiness review.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Framework</th>
                  <th>Department</th>
                  <th>Items</th>
                  <th>Accepted</th>
                  <th>Gaps</th>
                  <th>Nearest due</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {evidenceRows.map(row => (
                  <tr key={`${row.framework_code}-${row.department_name ?? 'all'}`}>
                    <td>{row.framework_code}</td>
                    <td>{row.department_name ?? 'All departments'}</td>
                    <td>{row.evidence_item_count}</td>
                    <td>{row.accepted_count}</td>
                    <td>{row.gap_count}</td>
                    <td>{row.nearest_gap_due_date ?? '—'}</td>
                    <td><StatusPill tone={signalTone(row.readiness_signal)}>{row.readiness_signal}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard title="Failed scenario retest queue" subtitle="Failed scenarios, owner, due date, latest retest round, and closure signal.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Failure</th>
                  <th>Scenario</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Due</th>
                  <th>Latest retest</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {retestRows.map(row => (
                  <tr key={row.failure_code}>
                    <td><strong>{row.failure_title}</strong><br /><span>{row.failure_code}</span></td>
                    <td>{row.scenario_title}</td>
                    <td>{row.severity}</td>
                    <td><StatusPill tone={statusTone(row.failure_status)}>{row.failure_status}</StatusPill></td>
                    <td>{row.owner_name ?? 'Unassigned'}</td>
                    <td>{row.due_date ?? '—'}</td>
                    <td>{row.latest_retest_round ? `Round ${row.latest_retest_round}` : '—'}</td>
                    <td><StatusPill tone={signalTone(row.queue_signal)}>{row.queue_signal}</StatusPill></td>
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
