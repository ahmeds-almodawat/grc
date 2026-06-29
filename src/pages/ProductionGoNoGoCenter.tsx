import { useEffect, useMemo, useState } from 'react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import { getLiveResultMessage, isLive, type LiveResult } from '../lib/liveResult';
import {
  getProductionGoNoGoDecisionQueue,
  getProductionGoNoGoEvidenceQueue,
  getProductionGoNoGoMonitoringDashboard,
  getProductionGoNoGoSummary,
  type ProductionGoNoGoDecisionQueueRow,
  type ProductionGoNoGoEvidenceQueueRow,
  type ProductionGoNoGoMonitoringRow,
  type ProductionGoNoGoSummary,
} from '../lib/productionGoNoGoApi';

const emptySummary: LiveResult<ProductionGoNoGoSummary> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No production go/no-go summary loaded yet.',
};

const emptyEvidenceQueue: LiveResult<ProductionGoNoGoEvidenceQueueRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No production go/no-go evidence queue loaded yet.',
};

const emptyDecisions: LiveResult<ProductionGoNoGoDecisionQueueRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No production go/no-go decisions loaded yet.',
};

const emptyMonitoring: LiveResult<ProductionGoNoGoMonitoringRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No production launch monitoring checks loaded yet.',
};

function rows<T>(result: LiveResult<T[]>): T[] {
  return isLive(result) ? result.data : [];
}

function tone(signal?: string | null): 'neutral' | 'good' | 'warning' | 'danger' {
  if (!signal || signal === 'normal') return 'neutral';
  if (['ready', 'go', 'green', 'passed', 'signed', 'accepted'].includes(signal)) return 'good';
  if (['danger', 'failed', 'red', 'no_go', 'blocked', 'rejected'].includes(signal)) return 'danger';
  if (['warning', 'amber', 'pending', 'conditional_go', 'deferred'].includes(signal)) return 'warning';
  return 'neutral';
}

function statusTone(status?: string | null): 'neutral' | 'good' | 'warning' | 'danger' {
  if (!status) return 'neutral';
  if (['go', 'green', 'passed', 'accepted', 'signed', 'closed', 'ready', 'resolved'].includes(status)) return 'good';
  if (['failed', 'blocked', 'rejected', 'red', 'no_go'].includes(status)) return 'danger';
  if (['pending', 'in_review', 'preparing', 'conditional_go', 'deferred', 'amber', 'active'].includes(status)) return 'warning';
  return 'neutral';
}

export function ProductionGoNoGoCenter() {
  const [summary, setSummary] = useState<LiveResult<ProductionGoNoGoSummary>>(emptySummary);
  const [evidenceQueue, setEvidenceQueue] = useState<LiveResult<ProductionGoNoGoEvidenceQueueRow[]>>(emptyEvidenceQueue);
  const [decisions, setDecisions] = useState<LiveResult<ProductionGoNoGoDecisionQueueRow[]>>(emptyDecisions);
  const [monitoring, setMonitoring] = useState<LiveResult<ProductionGoNoGoMonitoringRow[]>>(emptyMonitoring);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      const [summaryResult, evidenceResult, decisionResult, monitoringResult] = await Promise.all([
        getProductionGoNoGoSummary(),
        getProductionGoNoGoEvidenceQueue(),
        getProductionGoNoGoDecisionQueue(),
        getProductionGoNoGoMonitoringDashboard(),
      ]);

      if (!alive) return;
      setSummary(summaryResult);
      setEvidenceQueue(evidenceResult);
      setDecisions(decisionResult);
      setMonitoring(monitoringResult);
      setLoading(false);
    }

    void load();

    return () => {
      alive = false;
    };
  }, []);

  const evidenceRows = useMemo(() => rows(evidenceQueue), [evidenceQueue]);
  const decisionRows = useMemo(() => rows(decisions), [decisions]);
  const monitoringRows = useMemo(() => rows(monitoring), [monitoring]);
  const summaryData = isLive(summary) ? summary.data : null;

  return (
    <div className="space-y-6">
      <ModernCard
        title="Patch 18 - Production Go/No-Go Pack"
        subtitle="Final staging persona SQL, restore/rollback proof, change freeze, access/confidentiality review, board pack, launch decision, and post-launch monitoring control."
      >
        <DataState
          loading={loading}
          empty={!loading && !isLive(summary)}
          emptyTitle="No production go/no-go cycle loaded"
          emptyMessage={getLiveResultMessage(summary)}
        >
          <div className="grid gap-4 md:grid-cols-4">
            <KpiTile label="Cycles" value={summaryData?.cycle_count ?? 0} tone="neutral" />
            <KpiTile label="Go-ready cycles" value={summaryData?.go_ready_cycles ?? 0} tone="good" />
            <KpiTile label="Blocked / deferred" value={summaryData?.blocked_or_deferred_cycles ?? 0} tone={summaryData?.blocked_or_deferred_cycles ? 'danger' : 'neutral'} />
            <KpiTile label="Avg readiness" value={`${summaryData?.avg_readiness_score ?? 0}%`} tone={(summaryData?.avg_readiness_score ?? 0) >= 90 ? 'good' : 'warning'} />
          </div>
        </DataState>
      </ModernCard>

      <ModernCard
        title="Evidence readiness queue"
        subtitle="Tracks pending persona SQL, restore proof, access review, confidentiality checks, and final decisions before launch."
      >
        <DataState
          loading={loading}
          empty={!loading && evidenceRows.length === 0}
          emptyTitle="No go/no-go evidence queue"
          emptyMessage={getLiveResultMessage(evidenceQueue)}
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 pr-4">Cycle</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Persona SQL</th>
                  <th className="py-2 pr-4">Restore</th>
                  <th className="py-2 pr-4">Access</th>
                  <th className="py-2 pr-4">Confidentiality</th>
                  <th className="py-2 pr-4">Decisions</th>
                  <th className="py-2 pr-4">Signal</th>
                </tr>
              </thead>
              <tbody>
                {evidenceRows.map(row => (
                  <tr key={row.cycle_id} className="border-t">
                    <td className="py-2 pr-4 font-medium">{row.cycle_code} — {row.cycle_name}</td>
                    <td className="py-2 pr-4"><StatusPill tone={statusTone(row.decision_status)}>{row.decision_status}</StatusPill></td>
                    <td className="py-2 pr-4">{row.pending_persona_runs}</td>
                    <td className="py-2 pr-4">{row.pending_restore_proofs}</td>
                    <td className="py-2 pr-4">{row.pending_access_reviews}</td>
                    <td className="py-2 pr-4">{row.pending_confidentiality_checks}</td>
                    <td className="py-2 pr-4">{row.pending_decisions}</td>
                    <td className="py-2 pr-4"><StatusPill tone={tone(row.readiness_signal)}>{row.readiness_signal}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataState>
      </ModernCard>

      <ModernCard
        title="Executive decision queue"
        subtitle="Records go, conditional-go, no-go, deferred, and reopened launch decisions with evidence references."
      >
        <DataState
          loading={loading}
          empty={!loading && decisionRows.length === 0}
          emptyTitle="No production launch decisions"
          emptyMessage={getLiveResultMessage(decisions)}
        >
          <div className="grid gap-3">
            {decisionRows.map(row => (
              <div key={row.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{row.decision_code} · {row.decision_type}</p>
                    <p className="text-sm text-muted-foreground">{row.cycle_code} — {row.cycle_name}</p>
                    <p className="text-sm text-muted-foreground">Decision by: {row.decided_by_name ?? 'Pending'}</p>
                  </div>
                  <StatusPill tone={tone(row.decision_signal)}>{row.decision_status}</StatusPill>
                </div>
              </div>
            ))}
          </div>
        </DataState>
      </ModernCard>

      <ModernCard
        title="Post-launch monitoring"
        subtitle="Tracks availability, authentication, RLS, errors, performance, backups, evidence uploads, workflow execution, and support checks."
      >
        <DataState
          loading={loading}
          empty={!loading && monitoringRows.length === 0}
          emptyTitle="No launch monitoring checks"
          emptyMessage={getLiveResultMessage(monitoring)}
        >
          <div className="grid gap-3 md:grid-cols-2">
            {monitoringRows.map(row => (
              <div key={`${row.cycle_id}-${row.monitoring_area}`} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{row.monitoring_area}</p>
                    <p className="text-sm text-muted-foreground">{row.cycle_code} · {row.check_frequency}</p>
                    <p className="text-sm text-muted-foreground">Owner: {row.owner_name ?? 'Unassigned'}</p>
                  </div>
                  <StatusPill tone={tone(row.monitoring_signal)}>{row.check_status}</StatusPill>
                </div>
              </div>
            ))}
          </div>
        </DataState>
      </ModernCard>
    </div>
  );
}
