import { useEffect, useMemo, useState } from 'react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import { getLiveResultMessage, isLive, type LiveResult } from '../lib/liveResult';
import {
  getRealUatEvidencePackReadiness,
  getRealUatExecutionSummary,
  getRealUatFindingRetestQueue,
  getRealUatRunQueue,
  getRealUatSignoffReadiness,
  type RealUatEvidencePackReadinessRow,
  type RealUatExecutionSummary,
  type RealUatFindingRetestRow,
  type RealUatRunQueueRow,
  type RealUatSignoffReadinessRow,
} from '../lib/realUatExecutionApi';

const emptySummary: LiveResult<RealUatExecutionSummary> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No real UAT execution summary loaded yet.',
};

const emptyRuns: LiveResult<RealUatRunQueueRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No real UAT run queue loaded yet.',
};

const emptyFindings: LiveResult<RealUatFindingRetestRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No UAT finding or retest queue loaded yet.',
};

const emptySignoffs: LiveResult<RealUatSignoffReadinessRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No real UAT signoff readiness loaded yet.',
};

const emptyPacks: LiveResult<RealUatEvidencePackReadinessRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No accreditation evidence pack readiness loaded yet.',
};

function rows<T>(result: LiveResult<T[]>): T[] {
  return isLive(result) ? result.data : [];
}

function tone(signal?: string | null): 'neutral' | 'good' | 'warning' | 'danger' {
  if (!signal || signal === 'normal') return 'neutral';
  if (['ready', 'passed', 'signed', 'accepted'].includes(signal)) return 'good';
  if (['danger', 'failed', 'blocked', 'overdue', 'rejected'].includes(signal)) return 'danger';
  if (['warning', 'pending', 'conditional', 'retest_ready', 'needs_more_evidence'].includes(signal)) return 'warning';
  return 'neutral';
}

function statusTone(status?: string | null): 'neutral' | 'good' | 'warning' | 'danger' {
  if (!status) return 'neutral';
  if (['passed', 'accepted', 'signed', 'closed', 'ready', 'review_ready'].includes(status)) return 'good';
  if (['failed', 'blocked', 'rejected', 'critical', 'high'].includes(status)) return 'danger';
  if (['pending', 'in_progress', 'conditional', 'retest_required', 'needs_more_evidence', 'open'].includes(status)) return 'warning';
  return 'neutral';
}

export function RealUatExecutionCenter() {
  const [summary, setSummary] = useState<LiveResult<RealUatExecutionSummary>>(emptySummary);
  const [runQueue, setRunQueue] = useState<LiveResult<RealUatRunQueueRow[]>>(emptyRuns);
  const [findingQueue, setFindingQueue] = useState<LiveResult<RealUatFindingRetestRow[]>>(emptyFindings);
  const [signoffQueue, setSignoffQueue] = useState<LiveResult<RealUatSignoffReadinessRow[]>>(emptySignoffs);
  const [packQueue, setPackQueue] = useState<LiveResult<RealUatEvidencePackReadinessRow[]>>(emptyPacks);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const [summaryResult, runsResult, findingsResult, signoffsResult, packsResult] = await Promise.all([
        getRealUatExecutionSummary(),
        getRealUatRunQueue(),
        getRealUatFindingRetestQueue(),
        getRealUatSignoffReadiness(),
        getRealUatEvidencePackReadiness(),
      ]);

      if (!mounted) return;
      setSummary(summaryResult);
      setRunQueue(runsResult);
      setFindingQueue(findingsResult);
      setSignoffQueue(signoffsResult);
      setPackQueue(packsResult);
      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const summaryData = isLive(summary) ? summary.data : null;
  const runs = rows(runQueue);
  const findings = rows(findingQueue);
  const signoffs = rows(signoffQueue);
  const packs = rows(packQueue);

  const nonLiveMessages = useMemo(() => ([summary, runQueue, findingQueue, signoffQueue, packQueue] as LiveResult<unknown>[])
    .filter(result => !isLive(result))
    .map(result => getLiveResultMessage(result))
    .filter((message, index, all) => all.indexOf(message) === index), [findingQueue, packQueue, runQueue, signoffQueue, summary]);

  const hasAnyData = Boolean(summaryData) || runs.length > 0 || findings.length > 0 || signoffs.length > 0 || packs.length > 0;
  const failedRunCount = summaryData?.failed_or_blocked_run_count ?? runs.filter(row => ['danger', 'overdue'].includes(row.queue_signal)).length;
  const highOpenFindingCount = summaryData?.high_open_finding_count ?? findings.filter(row => row.queue_signal === 'danger').length;
  const signedAreaCount = summaryData?.signed_area_count ?? signoffs.filter(row => row.signoff_status === 'signed').length;

  return (
    <div className="page-stack real-uat-execution-center">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Patch 17 · Real UAT execution evidence</p>
          <h1>Run, evidence, retest, and sign off real hospital UAT</h1>
          <p className="section-subtitle">
            Turns the UAT framework into execution evidence: role scripts, persona runs, screenshots, SQL proof,
            findings, retests, signoffs, and accreditation evidence pack readiness. No fake evidence is seeded.
          </p>
        </div>
      </section>

      <DataState
        loading={loading}
        empty={!loading && !hasAnyData}
        emptyTitle="Real UAT execution is installed, but no live UAT records are loaded yet"
        emptyMessage={nonLiveMessages[0] ?? 'Create real UAT cycles, scripts, runs, evidence artifacts, SQL proof outputs, findings, retests, and signoffs to activate this center.'}
      >
        <div className="kpi-grid">
          <KpiTile label="UAT cycles" value={summaryData?.cycle_count ?? 0} hint="Controlled execution waves" />
          <KpiTile label="Role scripts" value={summaryData?.script_count ?? runs.length} hint="Persona-based scenarios" />
          <KpiTile label="Passed runs" value={summaryData?.passed_run_count ?? runs.filter(row => row.run_status === 'passed').length} hint="Accepted scenarios" tone="good" />
          <KpiTile label="Failed / blocked" value={failedRunCount} hint="Requires correction" tone={failedRunCount > 0 ? 'danger' : 'good'} />
          <KpiTile label="High findings" value={highOpenFindingCount} hint="Critical/high open UAT defects" tone={highOpenFindingCount > 0 ? 'danger' : 'good'} />
          <KpiTile label="Signed areas" value={signedAreaCount} hint="Role/department approvals" tone={signedAreaCount > 0 ? 'good' : 'neutral'} />
        </div>

        <ModernCard title="Real UAT run queue" subtitle="Persona scenarios for Executive, Quality, Risk, Compliance, Audit, IT, Department Manager, Employee, External Auditor, and Board views.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Cycle</th>
                  <th>Script</th>
                  <th>Module</th>
                  <th>Persona</th>
                  <th>Run</th>
                  <th>Evidence review</th>
                  <th>Executor</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((row, index) => (
                  <tr key={`${row.script_code}-${row.run_code ?? index}`}>
                    <td>{row.cycle_name ?? row.cycle_code ?? 'Unassigned'}</td>
                    <td>{row.script_title}</td>
                    <td>{row.module_key}</td>
                    <td>{row.persona_name ?? row.persona_group ?? 'Unassigned'}</td>
                    <td><StatusPill tone={statusTone(row.run_status)}>{row.run_status ?? 'not_started'}</StatusPill></td>
                    <td><StatusPill tone={statusTone(row.evidence_review_status)}>{row.evidence_review_status ?? 'pending'}</StatusPill></td>
                    <td>{row.executed_by_name ?? 'Not executed'}</td>
                    <td><StatusPill tone={tone(row.queue_signal)}>{row.queue_signal}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard title="Findings and retests" subtitle="Failed scenarios, blocked workflows, corrective actions, and retest results before final acceptance.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Finding</th>
                  <th>Cycle</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Due</th>
                  <th>Retests</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {findings.map(row => (
                  <tr key={row.finding_code}>
                    <td>{row.finding_title}</td>
                    <td>{row.cycle_name ?? row.cycle_code ?? 'Unassigned'}</td>
                    <td><StatusPill tone={statusTone(row.severity)}>{row.severity}</StatusPill></td>
                    <td><StatusPill tone={statusTone(row.finding_status)}>{row.finding_status}</StatusPill></td>
                    <td>{row.owner_name ?? 'Unassigned'}</td>
                    <td>{row.due_date ?? 'Not set'}</td>
                    <td>{row.passed_retest_count}/{row.retest_count}</td>
                    <td><StatusPill tone={tone(row.queue_signal)}>{row.queue_signal}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard title="Signoff readiness" subtitle="Real acceptance status for Executive, Quality, Risk, Compliance, Audit, IT, departments, external auditor, and board.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Cycle</th>
                  <th>Area</th>
                  <th>Signer</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Signed at</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {signoffs.map(row => (
                  <tr key={`${row.cycle_code}-${row.signoff_area}`}>
                    <td>{row.cycle_name}</td>
                    <td>{row.signoff_area}</td>
                    <td>{row.signer_name ?? 'Unassigned'}</td>
                    <td>{row.signer_title ?? '—'}</td>
                    <td><StatusPill tone={statusTone(row.signoff_status)}>{row.signoff_status}</StatusPill></td>
                    <td>{row.signed_at ?? 'Pending'}</td>
                    <td><StatusPill tone={tone(row.queue_signal)}>{row.queue_signal}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard title="Accreditation evidence pack readiness" subtitle="Evidence packs prepared for survey/accreditation review with required artifact counts and open gaps.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Pack</th>
                  <th>Scope</th>
                  <th>Status</th>
                  <th>Artifacts</th>
                  <th>Open gaps</th>
                  <th>Owner</th>
                  <th>Target review</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {packs.map(row => (
                  <tr key={row.pack_code}>
                    <td>{row.pack_title}</td>
                    <td>{row.accreditation_scope}</td>
                    <td><StatusPill tone={statusTone(row.pack_status)}>{row.pack_status}</StatusPill></td>
                    <td>{row.accepted_artifact_count}/{row.required_artifact_count}</td>
                    <td>{row.open_gap_count}</td>
                    <td>{row.owner_name ?? 'Unassigned'}</td>
                    <td>{row.target_review_date ?? 'Not set'}</td>
                    <td><StatusPill tone={tone(row.queue_signal)}>{row.queue_signal}</StatusPill></td>
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
