import { useEffect, useMemo, useState } from 'react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import {
  getLiveGrcCapaQueue,
  getLiveGrcObligationDashboard,
  getLiveGrcOperatingSummary,
  getLiveGrcRiskControlMap,
  type LiveGrcCapaQueueRow,
  type LiveGrcObligationDashboardRow,
  type LiveGrcOperatingSummary,
  type LiveGrcRiskControlMapRow,
} from '../lib/liveGrcOperatingApi';
import { getLiveResultMessage, isLive, type LiveResult } from '../lib/liveResult';

const emptySummary: LiveResult<LiveGrcOperatingSummary> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No live GRC operating summary loaded yet.',
};

const emptyRiskMap: LiveResult<LiveGrcRiskControlMapRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No live risk/control map loaded yet.',
};

const emptyCapa: LiveResult<LiveGrcCapaQueueRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No live CAPA queue loaded yet.',
};

const emptyObligations: LiveResult<LiveGrcObligationDashboardRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No live compliance obligation dashboard loaded yet.',
};

function rows<T>(result: LiveResult<T[]>): T[] {
  return isLive(result) ? result.data : [];
}

function effectivenessTone(value?: string | null): 'neutral' | 'good' | 'warning' | 'danger' {
  if (value === 'effective') return 'good';
  if (value === 'partially_effective' || value === 'not_tested' || value === 'not_assessed') return 'warning';
  if (value === 'ineffective') return 'danger';
  return 'neutral';
}

function queueTone(value: string): 'neutral' | 'good' | 'warning' | 'danger' {
  if (value === 'overdue') return 'danger';
  if (value === 'due_soon' || value === 'ready_for_retest') return 'warning';
  return 'neutral';
}

export function LiveGrcOperatingCore() {
  const [summary, setSummary] = useState<LiveResult<LiveGrcOperatingSummary>>(emptySummary);
  const [riskMap, setRiskMap] = useState<LiveResult<LiveGrcRiskControlMapRow[]>>(emptyRiskMap);
  const [capaQueue, setCapaQueue] = useState<LiveResult<LiveGrcCapaQueueRow[]>>(emptyCapa);
  const [obligations, setObligations] = useState<LiveResult<LiveGrcObligationDashboardRow[]>>(emptyObligations);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const [summaryResult, riskMapResult, capaResult, obligationResult] = await Promise.all([
        getLiveGrcOperatingSummary(),
        getLiveGrcRiskControlMap(),
        getLiveGrcCapaQueue(),
        getLiveGrcObligationDashboard(),
      ]);

      if (!mounted) return;
      setSummary(summaryResult);
      setRiskMap(riskMapResult);
      setCapaQueue(capaResult);
      setObligations(obligationResult);
      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const riskRows = rows(riskMap);
  const capaRows = rows(capaQueue);
  const obligationRows = rows(obligations);
  const summaryData = isLive(summary) ? summary.data : null;

  const nonLiveMessages = useMemo(() => ([summary, riskMap, capaQueue, obligations] as LiveResult<unknown>[])
    .filter(result => !isLive(result))
    .map(result => getLiveResultMessage(result))
    .filter((message, index, all) => all.indexOf(message) === index), [capaQueue, obligations, riskMap, summary]);

  const hasAnyData = Boolean(summaryData)
    || riskRows.length > 0
    || capaRows.length > 0
    || obligationRows.length > 0;

  return (
    <div className="page-stack live-grc-operating-core">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Live GRC operating core</p>
          <h1>Risk - control - test - evidence - CAPA closure</h1>
          <p className="section-subtitle">
            Controlled workflow backbone for risk appetite, KRIs, controls, tests, obligations, evidence, CAPA, vendors, and evidence-based closure packets.
          </p>
        </div>
      </section>

      <DataState
        loading={loading}
        empty={!loading && !hasAnyData}
        emptyTitle="Live GRC operating core is installed, but no operating records are loaded yet"
        emptyMessage={nonLiveMessages[0] ?? 'Create live risk, control, compliance, evidence, and CAPA records to activate this workspace.'}
      >
        <div className="kpi-grid">
          <KpiTile label="Risks" value={summaryData?.risk_count ?? 0} hint="Registered risks" />
          <KpiTile label="Active risks" value={summaryData?.active_risk_count ?? 0} hint="Open or under treatment" tone={(summaryData?.active_risk_count ?? 0) > 0 ? 'warning' : 'good'} />
          <KpiTile label="Controls" value={summaryData?.control_count ?? 0} hint="Registered controls" />
          <KpiTile label="Weak controls" value={summaryData?.weak_control_count ?? 0} hint="Partially effective / ineffective" tone={(summaryData?.weak_control_count ?? 0) > 0 ? 'danger' : 'good'} />
          <KpiTile label="Open CAPA" value={summaryData?.open_capa_count ?? 0} hint="Not closed or cancelled" tone={(summaryData?.open_capa_count ?? 0) > 0 ? 'warning' : 'good'} />
          <KpiTile label="Evidence attention" value={summaryData?.evidence_attention_count ?? 0} hint="Requested / rejected / expired" tone={(summaryData?.evidence_attention_count ?? 0) > 0 ? 'warning' : 'good'} />
        </div>

        <ModernCard
          title="Risk and control map"
          subtitle="Residual risk mapped to control design, operating effectiveness, coverage strength, and next test due date."
        >
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Risk</th>
                  <th>Residual score</th>
                  <th>Status</th>
                  <th>Control</th>
                  <th>Design</th>
                  <th>Operating</th>
                  <th>Coverage</th>
                  <th>Next test</th>
                </tr>
              </thead>
              <tbody>
                {riskRows.slice(0, 100).map(row => (
                  <tr key={`${row.risk_id}-${row.control_id ?? 'no-control'}`}>
                    <td><strong>{row.risk_code}</strong><br /><small>{row.risk_title}</small></td>
                    <td>{row.residual_score ?? '-'}</td>
                    <td><StatusPill tone={row.risk_status === 'closed' ? 'good' : 'warning'}>{row.risk_status}</StatusPill></td>
                    <td>{row.control_code ? <><strong>{row.control_code}</strong><br /><small>{row.control_title}</small></> : 'No linked control'}</td>
                    <td><StatusPill tone={effectivenessTone(row.design_effectiveness)}>{row.design_effectiveness ?? 'not_mapped'}</StatusPill></td>
                    <td><StatusPill tone={effectivenessTone(row.operating_effectiveness)}>{row.operating_effectiveness ?? 'not_mapped'}</StatusPill></td>
                    <td>{row.coverage_type ?? '-'} / {row.coverage_strength ?? '-'}</td>
                    <td>{row.next_test_due_date ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard
          title="CAPA queue"
          subtitle="Corrective/preventive actions requiring evidence, retest, or closure approval."
        >
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>CAPA</th>
                  <th>Source</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Signal</th>
                  <th>Due date</th>
                </tr>
              </thead>
              <tbody>
                {capaRows.map(row => (
                  <tr key={row.capa_id}>
                    <td><strong>{row.capa_code}</strong><br /><small>{row.title}</small></td>
                    <td>{row.source_type}</td>
                    <td>{row.owner_name ?? 'Unassigned'}</td>
                    <td>{row.capa_status}</td>
                    <td><StatusPill tone={queueTone(row.queue_signal)}>{row.queue_signal}</StatusPill></td>
                    <td>{row.due_date ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard
          title="Compliance obligation dashboard"
          subtitle="Regulatory, contractual, policy, standards, and license obligations grouped by authority and status."
        >
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Authority</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Count</th>
                  <th>Nearest due date</th>
                </tr>
              </thead>
              <tbody>
                {obligationRows.map(row => (
                  <tr key={`${row.source_authority}-${row.obligation_type}-${row.obligation_status}`}>
                    <td>{row.source_authority}</td>
                    <td>{row.obligation_type}</td>
                    <td>{row.obligation_status}</td>
                    <td>{row.obligation_count}</td>
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
