import { useEffect, useMemo, useState } from 'react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import {
  getAccreditationLiveReadinessSummary,
  getClauseControlEvidenceBridge,
  getClauseEvidenceReadiness,
  getDepartmentEvidenceReadiness,
  getEvidenceCollectionQueue,
  getEvidenceDependencies,
  getEvidenceExceptionRegister,
  getEvidenceReviewQueue,
  getExecutiveEvidenceBridgeSummary,
  getLiveEvidenceGapRegister,
  getOverdueEvidenceRequests,
  getStaleExpiredEvidenceRegister,
  type EvidenceBridgeRow,
  type EvidenceCollectionQueueRow,
  type EvidenceReadinessRow,
  type ExecutiveEvidenceBridgeSummaryRow,
} from '../lib/evidenceBridgeApi';
import { getLiveResultMessage, isLive, type LiveResult } from '../lib/liveResult';

type Tone = 'neutral' | 'good' | 'warning' | 'danger';
type RowValue = string | number | boolean | null | undefined;

const emptyBridgeRows: LiveResult<EvidenceBridgeRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No evidence bridge records loaded yet.',
};

const emptyQueueRows: LiveResult<EvidenceCollectionQueueRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No evidence collection requests loaded yet.',
};

const emptyReadinessRows: LiveResult<EvidenceReadinessRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No evidence readiness rows loaded yet.',
};

const emptyExecutiveSummary: LiveResult<ExecutiveEvidenceBridgeSummaryRow[]> = {
  status: 'empty',
  data: null,
  source: 'system',
  isLive: false,
  generatedAt: new Date(0).toISOString(),
  message: 'No executive evidence bridge summary loaded yet.',
};

function rows<T>(result: LiveResult<T[]>): T[] {
  return isLive(result) ? result.data : [];
}

function first<T>(result: LiveResult<T[]>): T | null {
  return isLive(result) ? result.data[0] ?? null : null;
}

function formatValue(value: RowValue): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(1);
  return value.replaceAll('_', ' ');
}

function percent(value: number | null | undefined): string {
  if (typeof value !== 'number') return 'Not scored';
  return `${Math.round(value)}%`;
}

function evidenceTone(status?: string | null): Tone {
  if (status === 'accepted' || status === 'current' || status === 'ready') return 'good';
  if (status === 'pending_collection' || status === 'pending_review' || status === 'due_soon' || status === 'partial_gap' || status === 'pending_evidence' || status === 'pending_owner_review') return 'warning';
  if (status === 'missing' || status === 'rejected' || status === 'stale' || status === 'expired' || status === 'major_gap' || status === 'evidence_gaps_open') return 'danger';
  return 'neutral';
}

function priorityTone(priority?: string | null): Tone {
  if (priority === 'critical' || priority === 'high') return 'danger';
  if (priority === 'medium') return 'warning';
  if (priority === 'low') return 'good';
  return 'neutral';
}

function statusBadge(status?: string | null) {
  return <StatusPill tone={evidenceTone(status)}>{formatValue(status)}</StatusPill>;
}

function priorityBadge(priority?: string | null) {
  return <StatusPill tone={priorityTone(priority)}>{formatValue(priority)}</StatusPill>;
}

function readinessBadge(status?: string | null, score?: number | null) {
  if (status) return <StatusPill tone={evidenceTone(status)}>{formatValue(status)}</StatusPill>;
  if (typeof score === 'number') {
    const tone: Tone = score >= 85 ? 'good' : score >= 60 ? 'warning' : 'danger';
    return <StatusPill tone={tone}>{percent(score)}</StatusPill>;
  }
  return <StatusPill>Not scored</StatusPill>;
}

function EmptyTableMessage({ label }: { label: string }) {
  return (
    <tr>
      <td colSpan={8}>
        <strong>No {label} records returned.</strong>
      </td>
    </tr>
  );
}

function BridgeTable({ rows: bridgeRows, label }: { rows: EvidenceBridgeRow[]; label: string }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead>
          <tr>
            <th>Clause</th>
            <th>Standard</th>
            <th>Linked item</th>
            <th>Role</th>
            <th>Evidence</th>
            <th>Freshness</th>
            <th>Owner</th>
            <th>Valid until</th>
          </tr>
        </thead>
        <tbody>
          {bridgeRows.length === 0 ? <EmptyTableMessage label={label} /> : bridgeRows.slice(0, 80).map(row => (
            <tr key={row.bridge_link_id ?? row.id ?? `${row.clause_id}-${row.linked_entity_id}`}>
              <td><strong>{formatValue(row.clause_code)}</strong><br /><small>{formatValue(row.clause_title)}</small></td>
              <td>{formatValue(row.framework)}<br /><small>{formatValue(row.standard_code)}</small></td>
              <td>{formatValue(row.linked_entity_type)}<br /><small>{formatValue(row.linked_entity_id)}</small></td>
              <td>{formatValue(row.bridge_role)}</td>
              <td>{statusBadge(row.evidence_status)}</td>
              <td>{statusBadge(row.freshness_status)}</td>
              <td>{formatValue(row.owner_name ?? row.department_name)}</td>
              <td>{formatValue(row.valid_until)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QueueTable({ rows: queueRows, label }: { rows: EvidenceCollectionQueueRow[]; label: string }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead>
          <tr>
            <th>Request</th>
            <th>Clause</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Due</th>
            <th>Assigned</th>
            <th>Evidence</th>
            <th>Overdue</th>
          </tr>
        </thead>
        <tbody>
          {queueRows.length === 0 ? <EmptyTableMessage label={label} /> : queueRows.slice(0, 80).map(row => (
            <tr key={row.id ?? `${row.clause_id}-${row.request_title}`}>
              <td><strong>{formatValue(row.request_title)}</strong><br /><small>{formatValue(row.request_description)}</small></td>
              <td><strong>{formatValue(row.clause_code)}</strong><br /><small>{formatValue(row.clause_title)}</small></td>
              <td>{statusBadge(row.status)}</td>
              <td>{priorityBadge(row.priority)}</td>
              <td>{formatValue(row.due_date)}</td>
              <td>{formatValue(row.assigned_user_name ?? row.assigned_department_name)}</td>
              <td>{statusBadge(row.evidence_status)}</td>
              <td>{row.is_overdue ? <StatusPill tone="danger">Overdue</StatusPill> : <StatusPill tone="good">On track</StatusPill>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReadinessTable({ rows: readinessRows, by }: { rows: EvidenceReadinessRow[]; by: 'department' | 'clause' | 'standard' }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead>
          <tr>
            <th>{by === 'department' ? 'Department' : by === 'standard' ? 'Standard' : 'Clause'}</th>
            <th>Bridge links</th>
            <th>Ready</th>
            <th>Gaps</th>
            <th>Readiness</th>
          </tr>
        </thead>
        <tbody>
          {readinessRows.length === 0 ? <EmptyTableMessage label={`${by} readiness`} /> : readinessRows.slice(0, 80).map(row => {
            const score = row.evidence_readiness_score ?? row.live_evidence_readiness_score ?? null;
            return (
              <tr key={row.department_id ?? row.clause_id ?? `${row.framework}-${row.standard_code}`}>
                <td>
                  <strong>{formatValue(row.department_name ?? row.clause_code ?? row.standard_code)}</strong>
                  <br />
                  <small>{formatValue(row.clause_title ?? row.framework)}</small>
                </td>
                <td>{formatValue(row.bridge_link_count)}</td>
                <td>{formatValue(row.ready_evidence_count ?? row.accepted_current_count)}</td>
                <td>{formatValue(row.gap_count ?? row.evidence_gap_count)}</td>
                <td>{readinessBadge(row.readiness_status, score)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function EvidenceBridgeCenter() {
  const [bridge, setBridge] = useState<LiveResult<EvidenceBridgeRow[]>>(emptyBridgeRows);
  const [gaps, setGaps] = useState<LiveResult<EvidenceBridgeRow[]>>(emptyBridgeRows);
  const [queue, setQueue] = useState<LiveResult<EvidenceCollectionQueueRow[]>>(emptyQueueRows);
  const [overdue, setOverdue] = useState<LiveResult<EvidenceCollectionQueueRow[]>>(emptyQueueRows);
  const [staleExpired, setStaleExpired] = useState<LiveResult<EvidenceBridgeRow[]>>(emptyBridgeRows);
  const [reviewQueue, setReviewQueue] = useState<LiveResult<EvidenceCollectionQueueRow[]>>(emptyQueueRows);
  const [departmentReadiness, setDepartmentReadiness] = useState<LiveResult<EvidenceReadinessRow[]>>(emptyReadinessRows);
  const [clauseReadiness, setClauseReadiness] = useState<LiveResult<EvidenceReadinessRow[]>>(emptyReadinessRows);
  const [dependencies, setDependencies] = useState<LiveResult<EvidenceBridgeRow[]>>(emptyBridgeRows);
  const [liveReadiness, setLiveReadiness] = useState<LiveResult<EvidenceReadinessRow[]>>(emptyReadinessRows);
  const [exceptions, setExceptions] = useState<LiveResult<EvidenceBridgeRow[]>>(emptyBridgeRows);
  const [executiveSummary, setExecutiveSummary] = useState<LiveResult<ExecutiveEvidenceBridgeSummaryRow[]>>(emptyExecutiveSummary);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const [
        bridgeResult,
        gapResult,
        queueResult,
        overdueResult,
        staleExpiredResult,
        reviewResult,
        departmentResult,
        clauseResult,
        dependencyResult,
        liveReadinessResult,
        exceptionResult,
        executiveResult,
      ] = await Promise.all([
        getClauseControlEvidenceBridge(),
        getLiveEvidenceGapRegister(),
        getEvidenceCollectionQueue(),
        getOverdueEvidenceRequests(),
        getStaleExpiredEvidenceRegister(),
        getEvidenceReviewQueue(),
        getDepartmentEvidenceReadiness(),
        getClauseEvidenceReadiness(),
        getEvidenceDependencies(),
        getAccreditationLiveReadinessSummary(),
        getEvidenceExceptionRegister(),
        getExecutiveEvidenceBridgeSummary(),
      ]);

      if (!mounted) return;
      setBridge(bridgeResult);
      setGaps(gapResult);
      setQueue(queueResult);
      setOverdue(overdueResult);
      setStaleExpired(staleExpiredResult);
      setReviewQueue(reviewResult);
      setDepartmentReadiness(departmentResult);
      setClauseReadiness(clauseResult);
      setDependencies(dependencyResult);
      setLiveReadiness(liveReadinessResult);
      setExceptions(exceptionResult);
      setExecutiveSummary(executiveResult);
      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const bridgeRows = rows(bridge);
  const gapRows = rows(gaps);
  const queueRows = rows(queue);
  const overdueRows = rows(overdue);
  const staleExpiredRows = rows(staleExpired);
  const reviewRows = rows(reviewQueue);
  const departmentRows = rows(departmentReadiness);
  const clauseRows = rows(clauseReadiness);
  const dependencyRows = rows(dependencies);
  const liveReadinessRows = rows(liveReadiness);
  const exceptionRows = rows(exceptions);
  const summary = first(executiveSummary);

  const nonLiveMessages = useMemo(() => ([
    bridge,
    gaps,
    queue,
    overdue,
    staleExpired,
    reviewQueue,
    departmentReadiness,
    clauseReadiness,
    dependencies,
    liveReadiness,
    exceptions,
    executiveSummary,
  ] as LiveResult<unknown>[])
    .filter(result => !isLive(result))
    .map(result => getLiveResultMessage(result))
    .filter((message, index, all) => all.indexOf(message) === index), [
      bridge,
      clauseReadiness,
      departmentReadiness,
      dependencies,
      exceptions,
      executiveSummary,
      gaps,
      liveReadiness,
      overdue,
      queue,
      reviewQueue,
      staleExpired,
    ]);

  const hasAnyData = bridgeRows.length > 0
    || gapRows.length > 0
    || queueRows.length > 0
    || overdueRows.length > 0
    || staleExpiredRows.length > 0
    || reviewRows.length > 0
    || departmentRows.length > 0
    || clauseRows.length > 0
    || dependencyRows.length > 0
    || liveReadinessRows.length > 0
    || exceptionRows.length > 0
    || Boolean(summary);

  return (
    <div className="page-stack evidence-bridge-center">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Evidence Bridge</p>
          <h1>Live accreditation evidence operations center</h1>
          <p className="section-subtitle">
            Clause-to-control-to-evidence coverage, collection queues, review work, stale proof, dependencies, and executive readiness signals from the Patch 33 bridge.
          </p>
        </div>
      </section>

      <DataState
        loading={loading}
        empty={!loading && !hasAnyData}
        emptyTitle="Evidence bridge is installed, but no live bridge records are visible yet"
        emptyMessage={nonLiveMessages[0] ?? 'Create bridge links and collection requests through authorized evidence operations to activate this center.'}
      >
        <div className="kpi-grid">
          <KpiTile label="Bridge links" value={summary?.total_bridge_links ?? bridgeRows.length} hint="Clause/control/evidence links" />
          <KpiTile label="Ready links" value={summary?.ready_links ?? bridgeRows.filter(row => row.evidence_status === 'accepted' && row.freshness_status === 'current').length} hint="Accepted and current" tone="good" />
          <KpiTile label="Evidence gaps" value={summary?.gap_links ?? gapRows.length} hint="Missing, pending, rejected, stale, or expired" tone={gapRows.length > 0 || (summary?.gap_links ?? 0) > 0 ? 'warning' : 'good'} />
          <KpiTile label="Overdue requests" value={overdueRows.length} hint="Collection work past due" tone={overdueRows.length > 0 ? 'danger' : 'good'} />
          <KpiTile label="Review queue" value={reviewRows.length} hint="Pending reviewer attention" tone={reviewRows.length > 0 ? 'warning' : 'good'} />
          <KpiTile label="Readiness" value={percent(summary?.overall_evidence_readiness_score)} hint="Overall accepted/current score" tone={evidenceTone((summary?.overall_evidence_readiness_score ?? 0) >= 85 ? 'ready' : 'partial_gap')} />
        </div>

        <ModernCard title="Clause-control-evidence bridge" subtitle="Live bridge links across clauses, controls, evidence, documents, SOPs, and operating dependencies.">
          <BridgeTable rows={bridgeRows} label="bridge" />
        </ModernCard>

        <ModernCard title="Live evidence gap register" subtitle="Evidence gaps that can block accreditation readiness or closure confidence.">
          <BridgeTable rows={gapRows} label="gap" />
        </ModernCard>

        <ModernCard title="Evidence collection queue" subtitle="Open collection requests with owner, department, due date, priority, and bridge status.">
          <QueueTable rows={queueRows} label="collection queue" />
        </ModernCard>

        <ModernCard title="Overdue evidence requests" subtitle="Requests past due that require owner follow-up or governance escalation.">
          <QueueTable rows={overdueRows} label="overdue request" />
        </ModernCard>

        <ModernCard title="Stale and expired evidence register" subtitle="Evidence no longer fresh enough to support survey, audit, or closure confidence.">
          <BridgeTable rows={staleExpiredRows} label="stale or expired evidence" />
        </ModernCard>

        <ModernCard title="Evidence review queue" subtitle="Submitted evidence waiting for review or rework decision.">
          <QueueTable rows={reviewRows} label="review queue" />
        </ModernCard>

        <div className="two-column-grid">
          <ModernCard title="Department evidence readiness" subtitle="Readiness and gap profile by responsible department.">
            <ReadinessTable rows={departmentRows} by="department" />
          </ModernCard>

          <ModernCard title="Clause evidence readiness" subtitle="Clause-level status based on accepted current evidence coverage.">
            <ReadinessTable rows={clauseRows} by="clause" />
          </ModernCard>
        </div>

        <ModernCard title="Accreditation live readiness summary" subtitle="Framework and standard readiness based on the evidence bridge.">
          <ReadinessTable rows={liveReadinessRows} by="standard" />
        </ModernCard>

        <ModernCard title="CAPA, training, SOP, risk, and audit dependencies" subtitle="Operational dependencies that may affect closure, survey readiness, or executive confidence.">
          <BridgeTable rows={dependencyRows} label="dependency" />
        </ModernCard>

        <ModernCard title="Evidence exception register" subtitle="Open exceptions for missing, pending, rejected, stale, expired, or otherwise unresolved evidence bridge links.">
          <BridgeTable rows={exceptionRows} label="exception" />
        </ModernCard>
      </DataState>
    </div>
  );
}
