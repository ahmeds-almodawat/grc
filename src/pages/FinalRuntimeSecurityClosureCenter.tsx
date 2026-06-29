import { useEffect, useMemo, useState } from 'react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import {
  getFinalRuntimeSecurityClosureSummary,
  getFinalWarningClosureQueue,
  getRpcReviewQueue,
  type FinalRuntimeSecurityClosureSummary,
  type FinalWarningClosureQueueRow,
  type RpcReviewQueueRow,
} from '../lib/finalRuntimeSecurityClosureApi';
import { getLiveResultMessage, isLive, type LiveResult } from '../lib/liveResult';

const emptySummary: LiveResult<FinalRuntimeSecurityClosureSummary> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No Patch 15 final hardening summary loaded yet.',
};

const emptyWarnings: LiveResult<FinalWarningClosureQueueRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No Patch 15 warning closure queue loaded yet.',
};

const emptyRpcReviews: LiveResult<RpcReviewQueueRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No Patch 15 RPC review queue loaded yet.',
};

function rows<T>(result: LiveResult<T[]>): T[] {
  return isLive(result) ? result.data : [];
}

function toneForSignal(signal?: string | null): 'neutral' | 'good' | 'warning' | 'danger' {
  if (!signal || signal === 'normal') return 'neutral';
  if (signal.includes('closed') || signal === 'ready') return 'good';
  if (signal.includes('high') || signal.includes('overdue') || signal.includes('failed')) return 'danger';
  if (signal.includes('open') || signal.includes('pending') || signal.includes('bridge')) return 'warning';
  return 'neutral';
}

function toneForSeverity(severity?: string | null): 'neutral' | 'good' | 'warning' | 'danger' {
  if (!severity || severity === 'info') return 'neutral';
  if (severity === 'low') return 'good';
  if (severity === 'medium') return 'warning';
  return 'danger';
}

export function FinalRuntimeSecurityClosureCenter() {
  const [summary, setSummary] = useState<LiveResult<FinalRuntimeSecurityClosureSummary>>(emptySummary);
  const [warnings, setWarnings] = useState<LiveResult<FinalWarningClosureQueueRow[]>>(emptyWarnings);
  const [rpcReviews, setRpcReviews] = useState<LiveResult<RpcReviewQueueRow[]>>(emptyRpcReviews);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const [summaryResult, warningResult, rpcResult] = await Promise.all([
        getFinalRuntimeSecurityClosureSummary(),
        getFinalWarningClosureQueue(),
        getRpcReviewQueue(),
      ]);

      if (!mounted) return;
      setSummary(summaryResult);
      setWarnings(warningResult);
      setRpcReviews(rpcResult);
      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const summaryData = isLive(summary) ? summary.data : null;
  const warningRows = rows(warnings);
  const rpcRows = rows(rpcReviews);

  const nonLiveMessages = useMemo(() => ([summary, warnings, rpcReviews] as LiveResult<unknown>[])
    .filter(result => !isLive(result))
    .map(result => getLiveResultMessage(result))
    .filter((message, index, all) => all.indexOf(message) === index), [rpcReviews, summary, warnings]);

  const hasAnyData = Boolean(summaryData) || warningRows.length > 0 || rpcRows.length > 0;
  const openWarnings = summaryData?.open_warning_count ?? warningRows.filter(row => !['closed', 'accepted_exception'].includes(row.item_status)).length;
  const highWarnings = summaryData?.high_warning_count ?? warningRows.filter(row => ['critical', 'high'].includes(row.severity)).length;
  const rpcReviewCount = summaryData?.rpc_review_queue_count ?? rpcRows.filter(row => ['pending', 'needs_bridge'].includes(row.review_status)).length;

  return (
    <div className="page-stack final-runtime-security-closure-center">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Patch 15 final warning and runtime security closure</p>
          <h1>Close technical warnings before real production evidence</h1>
          <p className="section-subtitle">
            Tracks Supabase client warnings, v65/v700 audit cleanup, RPC classification reviews, runtime-security exceptions, and final proof runs before real data activation.
          </p>
        </div>
      </section>

      <DataState
        loading={loading}
        empty={!loading && !hasAnyData}
        emptyTitle="Patch 15 closure engine is installed, but no live records are loaded yet"
        emptyMessage={nonLiveMessages[0] ?? 'Record Supabase warning checks, v65 closure evidence, RPC reviews, and final proof runs to activate this hardening center.'}
      >
        <div className="kpi-grid">
          <KpiTile label="Open warnings" value={openWarnings} hint="Runtime / proof cleanup" tone={openWarnings > 0 ? 'warning' : 'good'} />
          <KpiTile label="High warnings" value={highWarnings} hint="Critical/high only" tone={highWarnings > 0 ? 'danger' : 'good'} />
          <KpiTile label="v65 warnings" value={summaryData?.open_v65_warning_count ?? warningRows.filter(row => row.item_source === 'v65_audit').length} hint="Generated SQL sync" tone={(summaryData?.open_v65_warning_count ?? 0) > 0 ? 'warning' : 'good'} />
          <KpiTile label="RPC reviews" value={rpcReviewCount} hint="Unknown classifications" tone={rpcReviewCount > 0 ? 'warning' : 'good'} />
          <KpiTile label="Client checks" value={summaryData?.open_client_check_count ?? 0} hint="Supabase client warning" tone={(summaryData?.open_client_check_count ?? 0) > 0 ? 'warning' : 'good'} />
          <KpiTile label="Proof attention" value={summaryData?.proof_attention_count ?? 0} hint="Final proof runs" tone={(summaryData?.proof_attention_count ?? 0) > 0 ? 'warning' : 'good'} />
        </div>

        <ModernCard title="Final warning closure queue" subtitle="Supabase client warnings, v65/v700 cleanup items, E2E warnings, and runtime-security observations.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Title</th>
                  <th>Source</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Due</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {warningRows.map(row => (
                  <tr key={`${row.item_source}-${row.item_code}-${row.item_title}`}>
                    <td>{row.item_code}</td>
                    <td>{row.item_title}</td>
                    <td>{row.item_source}</td>
                    <td><StatusPill tone={toneForSeverity(row.severity)}>{row.severity}</StatusPill></td>
                    <td><StatusPill tone={toneForSignal(row.queue_signal)}>{row.item_status}</StatusPill></td>
                    <td>{row.owner_name ?? 'Unassigned'}</td>
                    <td>{row.due_date ?? '-'}</td>
                    <td><StatusPill tone={toneForSignal(row.queue_signal)}>{row.queue_signal}</StatusPill></td>
                  </tr>
                ))}
                {warningRows.length === 0 && (
                  <tr>
                    <td colSpan={8}>No warning records returned.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard title="RPC classification review queue" subtitle="Reduce unknown runtime-security classifications and document bridge decisions before production reliance.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>RPC</th>
                  <th>Location</th>
                  <th>Transport</th>
                  <th>Current</th>
                  <th>Approved</th>
                  <th>Status</th>
                  <th>Risk</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {rpcRows.map(row => (
                  <tr key={`${row.rpc_name}-${row.source_file ?? 'unknown'}-${row.source_line ?? 0}`}>
                    <td>{row.rpc_name}</td>
                    <td>{row.source_file ? `${row.source_file}:${row.source_line ?? '?'}` : '-'}</td>
                    <td>{row.transport}</td>
                    <td>{row.current_classification}</td>
                    <td>{row.approved_classification ?? 'Pending'}</td>
                    <td><StatusPill tone={toneForSignal(row.queue_signal)}>{row.review_status}</StatusPill></td>
                    <td><StatusPill tone={toneForSeverity(row.risk_rating)}>{row.risk_rating}</StatusPill></td>
                    <td><StatusPill tone={toneForSignal(row.queue_signal)}>{row.queue_signal}</StatusPill></td>
                  </tr>
                ))}
                {rpcRows.length === 0 && (
                  <tr>
                    <td colSpan={8}>No RPC review records returned.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ModernCard>
      </DataState>
    </div>
  );
}
