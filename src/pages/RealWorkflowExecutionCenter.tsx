import { useEffect, useMemo, useState } from 'react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import {
  getRealActionQueue,
  getRealEvidenceReviewQueue,
  getRealGapCapaQueue,
  getRealManagementResponseQueue,
  getRealWorkflowExecutionSummary,
  type RealActionQueueRow,
  type RealEvidenceReviewQueueRow,
  type RealGapCapaQueueRow,
  type RealManagementResponseQueueRow,
  type RealWorkflowExecutionSummary,
} from '../lib/realWorkflowExecutionApi';
import { getLiveResultMessage, isLive, type LiveResult } from '../lib/liveResult';

const emptySummary: LiveResult<RealWorkflowExecutionSummary> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No real workflow execution summary loaded yet.',
};

const emptyActions: LiveResult<RealActionQueueRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No real action queue loaded yet.',
};

const emptyEvidence: LiveResult<RealEvidenceReviewQueueRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No real evidence review queue loaded yet.',
};

const emptyGapCapa: LiveResult<RealGapCapaQueueRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No real gap/CAPA queue loaded yet.',
};

const emptyResponses: LiveResult<RealManagementResponseQueueRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No real management response queue loaded yet.',
};

function rows<T>(result: LiveResult<T[]>): T[] {
  return isLive(result) ? result.data : [];
}

function signalTone(signal?: string | null): 'neutral' | 'good' | 'warning' | 'danger' {
  if (!signal || signal === 'normal') return 'neutral';
  if (signal.includes('overdue') || signal.includes('failed') || signal.includes('rejected')) return 'danger';
  if (signal.includes('high') || signal.includes('open') || signal.includes('changes') || signal.includes('sensitive')) return 'warning';
  return 'neutral';
}

function statusTone(status?: string | null): 'neutral' | 'good' | 'warning' | 'danger' {
  if (!status) return 'neutral';
  if (['closed', 'approved', 'accepted', 'passed', 'implemented'].includes(status)) return 'good';
  if (['overdue', 'rejected', 'failed'].includes(status)) return 'danger';
  if (['open', 'submitted', 'under_review', 'changes_requested', 'issued', 'in_progress', 'draft'].includes(status)) return 'warning';
  return 'neutral';
}

export function RealWorkflowExecutionCenter() {
  const [summary, setSummary] = useState<LiveResult<RealWorkflowExecutionSummary>>(emptySummary);
  const [actions, setActions] = useState<LiveResult<RealActionQueueRow[]>>(emptyActions);
  const [evidence, setEvidence] = useState<LiveResult<RealEvidenceReviewQueueRow[]>>(emptyEvidence);
  const [gapCapa, setGapCapa] = useState<LiveResult<RealGapCapaQueueRow[]>>(emptyGapCapa);
  const [responses, setResponses] = useState<LiveResult<RealManagementResponseQueueRow[]>>(emptyResponses);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const [summaryResult, actionResult, evidenceResult, gapCapaResult, responseResult] = await Promise.all([
        getRealWorkflowExecutionSummary(),
        getRealActionQueue(),
        getRealEvidenceReviewQueue(),
        getRealGapCapaQueue(),
        getRealManagementResponseQueue(),
      ]);

      if (!mounted) return;
      setSummary(summaryResult);
      setActions(actionResult);
      setEvidence(evidenceResult);
      setGapCapa(gapCapaResult);
      setResponses(responseResult);
      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const summaryData = isLive(summary) ? summary.data : null;
  const actionRows = rows(actions);
  const evidenceRows = rows(evidence);
  const gapCapaRows = rows(gapCapa);
  const responseRows = rows(responses);

  const nonLiveMessages = useMemo(() => ([summary, actions, evidence, gapCapa, responses] as LiveResult<unknown>[])
    .filter(result => !isLive(result))
    .map(result => getLiveResultMessage(result))
    .filter((message, index, all) => all.indexOf(message) === index), [actions, evidence, gapCapa, responses, summary]);

  const hasAnyData = Boolean(summaryData) || actionRows.length > 0 || evidenceRows.length > 0 || gapCapaRows.length > 0 || responseRows.length > 0;
  const overdueCount = summaryData?.overdue_item_count ?? actionRows.filter(row => row.queue_signal === 'overdue').length;
  const evidenceAttention = summaryData?.evidence_attention_count ?? evidenceRows.length;

  return (
    <div className="page-stack real-workflow-execution-center">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Real workflow execution</p>
          <h1>Submit, review, approve, close, escalate, and evidence daily GRC work</h1>
          <p className="section-subtitle">
            Turns standards, gaps, evidence, findings, exceptions, management responses, and CAPA into executable operating work with decisions and activity history.
          </p>
        </div>
      </section>

      <DataState
        loading={loading}
        empty={!loading && !hasAnyData}
        emptyTitle="Patch 12 execution layer is installed, but no real workflow records are loaded yet"
        emptyMessage={nonLiveMessages[0] ?? 'Create execution items, evidence submissions, gap closures, CAPA records, findings, exceptions, and management responses.'}
      >
        <div className="kpi-grid">
          <KpiTile label="Execution items" value={summaryData?.execution_item_count ?? actionRows.length} hint="Real daily work" />
          <KpiTile label="Active items" value={summaryData?.active_item_count ?? actionRows.length} hint="Open operating work" />
          <KpiTile label="Overdue" value={overdueCount} hint="Needs escalation" tone={overdueCount > 0 ? 'danger' : 'good'} />
          <KpiTile label="Evidence review" value={evidenceAttention} hint="Pending evidence decisions" tone={evidenceAttention > 0 ? 'warning' : 'good'} />
          <KpiTile label="Open CAPA" value={summaryData?.open_capa_count ?? gapCapaRows.reduce((sum, row) => sum + row.capa_count, 0)} hint="Corrective actions" />
          <KpiTile label="Management responses" value={summaryData?.management_response_count ?? responseRows.length} hint="Finding responses" />
        </div>

        <ModernCard title="Action queue" subtitle="Real executable items across standards, audit, risk, compliance, quality, evidence, gaps, and CAPA.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Module</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Owner</th>
                  <th>Reviewer</th>
                  <th>Due</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {actionRows.map(row => (
                  <tr key={row.execution_item_id}>
                    <td>{row.item_title}</td>
                    <td>{row.module_key}</td>
                    <td><StatusPill tone={statusTone(row.execution_status)}>{row.execution_status}</StatusPill></td>
                    <td>{row.priority}</td>
                    <td>{row.owner_name ?? 'Unassigned'}</td>
                    <td>{row.reviewer_name ?? 'Unassigned'}</td>
                    <td>{row.due_date ?? '—'}</td>
                    <td><StatusPill tone={signalTone(row.queue_signal)}>{row.queue_signal}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard title="Evidence review queue" subtitle="Submitted evidence awaiting acceptance, rejection, or change request decisions.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Evidence</th>
                  <th>Requirement</th>
                  <th>Taxonomy</th>
                  <th>Status</th>
                  <th>Confidentiality</th>
                  <th>Review due</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {evidenceRows.map(row => (
                  <tr key={row.evidence_submission_id}>
                    <td>{row.evidence_title}</td>
                    <td>{row.requirement_code ?? '—'}</td>
                    <td>{row.evidence_taxonomy_code ?? '—'}</td>
                    <td><StatusPill tone={statusTone(row.evidence_status)}>{row.evidence_status}</StatusPill></td>
                    <td>{row.confidentiality_level}</td>
                    <td>{row.review_due_date ?? '—'}</td>
                    <td><StatusPill tone={signalTone(row.queue_signal)}>{row.queue_signal}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard title="Gap, CAPA, and retest queue" subtitle="Gap closure actions, issued CAPA, failed retests, and overdue correction work.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Gap</th>
                  <th>Requirement</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>CAPA</th>
                  <th>Failed retests</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {gapCapaRows.map(row => (
                  <tr key={row.gap_code}>
                    <td>{row.gap_code} — {row.gap_title}</td>
                    <td>{row.requirement_code ?? '—'}</td>
                    <td>{row.department_code ?? '—'}</td>
                    <td><StatusPill tone={statusTone(row.closure_status)}>{row.closure_status}</StatusPill></td>
                    <td>{row.owner_name ?? 'Unassigned'}</td>
                    <td>{row.capa_count}</td>
                    <td>{row.failed_retest_count}</td>
                    <td><StatusPill tone={signalTone(row.queue_signal)}>{row.queue_signal}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModernCard>

        <ModernCard title="Management response queue" subtitle="Audit and review findings requiring response, acceptance, retest, or closure.">
          <div className="table-scroll">
            <table className="entity-table">
              <thead>
                <tr>
                  <th>Response</th>
                  <th>Finding</th>
                  <th>Severity</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Target</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {responseRows.map(row => (
                  <tr key={row.response_code}>
                    <td>{row.response_code}</td>
                    <td>{row.finding_title}</td>
                    <td>{row.severity ?? '—'}</td>
                    <td>{row.response_owner_name ?? 'Unassigned'}</td>
                    <td><StatusPill tone={statusTone(row.response_status)}>{row.response_status}</StatusPill></td>
                    <td>{row.target_date ?? '—'}</td>
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
