import { useEffect, useMemo, useState } from 'react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import {
  getLaunchReadinessDashboard,
  getProductionHardeningQueue,
  getProductionHardeningSummary,
  type LaunchReadinessDashboardRow,
  type ProductionHardeningQueueRow,
  type ProductionHardeningSummary,
} from '../lib/productionHardeningLaunchApi';
import { getLiveResultMessage, isLive, type LiveResult } from '../lib/liveResult';

const emptySummary: LiveResult<ProductionHardeningSummary> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No production hardening summary loaded yet.',
};

const emptyQueue: LiveResult<ProductionHardeningQueueRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No production hardening queue loaded yet.',
};

const emptyLaunchReadiness: LiveResult<LaunchReadinessDashboardRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No launch readiness dashboard loaded yet.',
};

function rows<T>(result: LiveResult<T[]>): T[] {
  return isLive(result) ? result.data : [];
}

function signalTone(signal?: string | null): 'neutral' | 'good' | 'warning' | 'danger' {
  if (!signal || signal === 'normal') return 'neutral';
  if (['ready', 'green'].includes(signal)) return 'good';
  if (['danger', 'red', 'no_go'].includes(signal)) return 'danger';
  if (['warning', 'amber', 'conditional_go'].includes(signal)) return 'warning';
  return 'neutral';
}

function statusTone(status?: string | null): 'neutral' | 'good' | 'warning' | 'danger' {
  if (!status) return 'neutral';
  if (['closed', 'accepted', 'passed', 'approved', 'signed', 'green', 'approved_go', 'approved_conditional_go'].includes(status)) return 'good';
  if (['failed', 'rejected', 'red', 'rejected_no_go', 'rolled_back'].includes(status)) return 'danger';
  if (['open', 'investigating', 'pending', 'amber', 'deferred', 'review_required', 'fixed_pending_verification'].includes(status)) return 'warning';
  return 'neutral';
}

export function ProductionHardeningLaunchCenter() {
  const [summary, setSummary] = useState<LiveResult<ProductionHardeningSummary>>(emptySummary);
  const [queue, setQueue] = useState<LiveResult<ProductionHardeningQueueRow[]>>(emptyQueue);
  const [launchReadiness, setLaunchReadiness] = useState<LiveResult<LaunchReadinessDashboardRow[]>>(emptyLaunchReadiness);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const [summaryResult, queueResult, launchResult] = await Promise.all([
        getProductionHardeningSummary(),
        getProductionHardeningQueue(),
        getLaunchReadinessDashboard(),
      ]);

      if (!mounted) return;
      setSummary(summaryResult);
      setQueue(queueResult);
      setLaunchReadiness(launchResult);
      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const summaryData = isLive(summary) ? summary.data : null;
  const queueRows = rows(queue);
  const launchRows = rows(launchReadiness);

  const nonLiveMessages = useMemo(() => ([summary, queue, launchReadiness] as LiveResult<unknown>[])
    .filter(result => !isLive(result))
    .map(result => getLiveResultMessage(result))
    .filter((message, index, all) => all.indexOf(message) === index), [launchReadiness, queue, summary]);

  const hasAnyData = Boolean(summaryData) || queueRows.length > 0 || launchRows.length > 0;
  const openWarningCount = (summaryData?.open_client_warning_count ?? 0) + (summaryData?.open_v65_warning_count ?? 0);
  const passedProofCount = (summaryData?.passed_persona_sql_count ?? 0) + (summaryData?.passed_restore_proof_count ?? 0);

  return (
    <div className="page-stack production-hardening-launch-center">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Production hardening and launch pack</p>
          <h1>Final launch controls before signed go-live</h1>
          <p className="section-subtitle">
            Tracks warning cleanup, staging persona SQL, restore proof, change freeze, board go/no-go packs, launch signoffs, production decisions, and post-launch monitoring.
          </p>
        </div>
      </section>

      <DataState
        loading={loading}
        empty={!loading && !hasAnyData}
        emptyTitle="Patch 14 launch pack is installed, but no production hardening records are loaded yet"
        emptyMessage={nonLiveMessages[0] ?? 'Create warning, proof, signoff, go/no-go, and monitoring records before any production launch decision.'}
      >
        <div className="kpi-grid">
          <KpiTile label="Open warnings" value={openWarningCount} hint="Client + v65 cleanup" tone={openWarningCount > 0 ? 'warning' : 'good'} />
          <KpiTile label="Passed proof runs" value={passedProofCount} hint="Persona SQL + restore" tone={passedProofCount > 0 ? 'good' : 'warning'} />
          <KpiTile label="Active freezes" value={summaryData?.active_freeze_count ?? 0} hint="Change control" />
          <KpiTile label="Approved packs" value={summaryData?.approved_go_no_go_pack_count ?? launchRows.filter(row => row.pack_status === 'approved').length} hint="Board / committee" tone={(summaryData?.approved_go_no_go_pack_count ?? 0) > 0 ? 'good' : 'warning'} />
          <KpiTile label="Pending signoffs" value={summaryData?.pending_launch_signoff_count ?? 0} hint="Human approval" tone={(summaryData?.pending_launch_signoff_count ?? 0) > 0 ? 'warning' : 'good'} />
          <KpiTile label="Red monitoring" value={summaryData?.red_monitoring_check_count ?? queueRows.filter(row => row.queue_signal === 'danger').length} hint="Launch blockers" tone={(summaryData?.red_monitoring_check_count ?? 0) > 0 ? 'danger' : 'good'} />
        </div>

        <ModernCard title="Hardening queue" subtitle="Warnings, v65 cleanup, launch signoffs, and post-launch monitoring checks needing action.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Item</th>
                  <th>Status</th>
                  <th>Severity</th>
                  <th>Owner</th>
                  <th>Due</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {queueRows.map(row => (
                  <tr key={`${row.queue_type}-${row.item_code}`}>
                    <td>{row.queue_type}</td>
                    <td><strong>{row.item_title}</strong><br /><span>{row.item_code}</span></td>
                    <td><StatusPill tone={statusTone(row.item_status)}>{row.item_status}</StatusPill></td>
                    <td>{row.severity}</td>
                    <td>{row.owner_name ?? 'Unassigned'}</td>
                    <td>{row.due_date ?? '—'}</td>
                    <td><StatusPill tone={signalTone(row.queue_signal)}>{row.queue_signal}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard title="Launch readiness dashboard" subtitle="Board go/no-go packs, signoff completeness, launch recommendation, and latest decision status.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Pack</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Recommendation</th>
                  <th>Meeting</th>
                  <th>Signed</th>
                  <th>Pending</th>
                  <th>Rejected</th>
                  <th>Decision</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {launchRows.map(row => (
                  <tr key={row.pack_code}>
                    <td><strong>{row.pack_title}</strong><br /><span>{row.pack_code}</span></td>
                    <td><StatusPill tone={statusTone(row.pack_status)}>{row.pack_status}</StatusPill></td>
                    <td>{row.summary_score}</td>
                    <td>{row.launch_recommendation}</td>
                    <td>{row.board_meeting_date ?? '—'}</td>
                    <td>{row.signed_count}</td>
                    <td>{row.pending_count}</td>
                    <td>{row.rejected_count}</td>
                    <td>{row.latest_decision_status ?? '—'}</td>
                    <td><StatusPill tone={signalTone(row.readiness_signal)}>{row.readiness_signal}</StatusPill></td>
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
