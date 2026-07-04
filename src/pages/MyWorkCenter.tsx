import { useEffect, useMemo, useState } from 'react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import {
  unifiedWorkQueueApi,
  type EvidenceGateOverlayRow,
  type GovernanceOperatingSummaryRow,
  type UnifiedQueueItem,
} from '../lib/unifiedWorkQueueApi';
import { getLiveResultMessage, isLive, type LiveResult } from '../lib/liveResult';

type Tone = 'neutral' | 'good' | 'warning' | 'danger';

function emptyRows<T>(message: string): LiveResult<T[]> {
  return { status: 'empty', data: null, source: 'system', isLive: false, generatedAt: new Date(0).toISOString(), message };
}

function rows<T>(result: LiveResult<T[]>): T[] {
  return isLive(result) ? result.data : [];
}

function first<T>(result: LiveResult<T[]>): T | null {
  return isLive(result) ? result.data[0] ?? null : null;
}

function value(v: unknown): string {
  if (v === null || v === undefined || v === '') return '-';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(1);
  return String(v).replaceAll('_', ' ');
}

function statusTone(status?: string | null): Tone {
  if (['approved', 'accepted', 'completed', 'closed', 'resolved'].includes(status ?? '')) return 'good';
  if (['open', 'assigned', 'in_progress', 'submitted', 'under_review', 'pending', 'partially_approved'].includes(status ?? '')) return 'warning';
  if (['overdue', 'blocked', 'escalated', 'rejected', 'failed', 'action_required'].includes(status ?? '')) return 'danger';
  return 'neutral';
}

function priorityTone(priority?: string | null): Tone {
  if (['critical', 'sentinel', 'high'].includes(priority ?? '')) return 'danger';
  if (priority === 'medium') return 'warning';
  if (priority === 'low') return 'good';
  return 'neutral';
}

function signalTone(signal?: string | null): Tone {
  if (signal === 'on_track') return 'good';
  if (signal === 'watch') return 'warning';
  if (signal === 'attention_required') return 'danger';
  return 'neutral';
}

function gateTone(status?: string | null): Tone {
  if (['pass', 'waived', 'not_required'].includes(status ?? '')) return 'good';
  if (['requires_review'].includes(status ?? '')) return 'warning';
  if ((status ?? '').startsWith('fail')) return 'danger';
  return 'neutral';
}

function WorkTable({ data, label, onSelect }: { data: UnifiedQueueItem[]; label: string; onSelect: (item: UnifiedQueueItem) => void }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead><tr><th>Work</th><th>Module</th><th>Status</th><th>Priority</th><th>Due</th><th>Flags</th><th>Action</th></tr></thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={7}><strong>No {label} records returned.</strong></td></tr>
          ) : data.slice(0, 100).map(row => (
            <tr key={`${row.source_module}-${row.source_entity_type}-${row.queue_item_id}`}>
              <td><strong>{value(row.title)}</strong><br /><small>{value(row.description)}</small></td>
              <td><StatusPill tone="neutral">{value(row.source_module)}</StatusPill><br /><small>{value(row.source_entity_type)}</small></td>
              <td><StatusPill tone={row.is_overdue ? 'danger' : statusTone(row.status)}>{row.is_overdue ? 'Overdue' : value(row.status)}</StatusPill></td>
              <td><StatusPill tone={priorityTone(row.priority)}>{value(row.priority)}</StatusPill></td>
              <td>{value(row.due_date)}</td>
              <td>{row.waiting_for_review ? 'Review' : '-'}{row.is_escalated ? ' / Escalated' : ''}{row.evidence_required ? ' / Evidence' : ''}</td>
              <td><button className="secondary-button" onClick={() => onSelect(row)}>View</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EvidenceGateOverlayTable({ data }: { data: EvidenceGateOverlayRow[] }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead><tr><th>Work</th><th>Module</th><th>Gate</th><th>Evidence</th><th>Next action</th></tr></thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={5}><strong>No evidence gate overlay records returned.</strong></td></tr>
          ) : data.slice(0, 80).map(row => (
            <tr key={row.queue_item_id}>
              <td><strong>{value(row.title)}</strong><br /><small>{value(row.due_date)}</small></td>
              <td><StatusPill tone="neutral">{value(row.source_module)}</StatusPill><br /><small>{value(row.source_entity_type)}</small></td>
              <td><StatusPill tone={gateTone(row.gate_status)}>{value(row.gate_status)}</StatusPill><br /><small>{value(row.evaluated_at)}</small></td>
              <td>{value(row.accepted_evidence_count)} accepted<br /><small>{value(row.missing_evidence_count)} missing</small></td>
              <td>{value(row.evidence_gate_next_action)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MyWorkCenter() {
  const [myWork, setMyWork] = useState<LiveResult<UnifiedQueueItem[]>>(emptyRows('No assigned work loaded yet.'));
  const [departmentWork, setDepartmentWork] = useState<LiveResult<UnifiedQueueItem[]>>(emptyRows('No department work loaded yet.'));
  const [overdue, setOverdue] = useState<LiveResult<UnifiedQueueItem[]>>(emptyRows('No overdue work loaded yet.'));
  const [review, setReview] = useState<LiveResult<UnifiedQueueItem[]>>(emptyRows('No review queue loaded yet.'));
  const [escalated, setEscalated] = useState<LiveResult<UnifiedQueueItem[]>>(emptyRows('No escalated work loaded yet.'));
  const [blocked, setBlocked] = useState<LiveResult<UnifiedQueueItem[]>>(emptyRows('No blocked work loaded yet.'));
  const [evidenceRequired, setEvidenceRequired] = useState<LiveResult<UnifiedQueueItem[]>>(emptyRows('No evidence required loaded yet.'));
  const [evidenceGateOverlay, setEvidenceGateOverlay] = useState<LiveResult<EvidenceGateOverlayRow[]>>(emptyRows('No evidence gate overlay loaded yet.'));
  const [missingOwner, setMissingOwner] = useState<LiveResult<UnifiedQueueItem[]>>(emptyRows('No missing owner loaded yet.'));
  const [summary, setSummary] = useState<LiveResult<GovernanceOperatingSummaryRow[]>>(emptyRows('No operating summary loaded yet.'));
  const [loading, setLoading] = useState(true);
  
  const [selectedItem, setSelectedItem] = useState<UnifiedQueueItem | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const [
        myResult, deptResult, overdueResult, reviewResult, 
        escalatedResult, blockedResult, evidenceResult,
        gateOverlayResult, missingResult, summaryResult
      ] = await Promise.all([
        unifiedWorkQueueApi.fetchMyWorkQueue(),
        unifiedWorkQueueApi.fetchDepartmentWorkQueue(),
        unifiedWorkQueueApi.fetchOverdueWorkQueue(),
        unifiedWorkQueueApi.fetchWaitingForReviewQueue(),
        unifiedWorkQueueApi.fetchEscalatedWorkQueue(),
        unifiedWorkQueueApi.fetchBlockedWorkQueue(),
        unifiedWorkQueueApi.fetchEvidenceRequiredQueue(),
        unifiedWorkQueueApi.fetchEvidenceGateOverlay(),
        unifiedWorkQueueApi.fetchMissingOwnerQueue(),
        unifiedWorkQueueApi.fetchGovernanceOperatingSummary(),
      ]);
      if (!mounted) return;
      setMyWork(myResult);
      setDepartmentWork(deptResult);
      setOverdue(overdueResult);
      setReview(reviewResult);
      setEscalated(escalatedResult);
      setBlocked(blockedResult);
      setEvidenceRequired(evidenceResult);
      setEvidenceGateOverlay(gateOverlayResult);
      setMissingOwner(missingResult);
      setSummary(summaryResult);
      setLoading(false);
    }
    void load();
    return () => { mounted = false; };
  }, []);

  const myRows = rows(myWork);
  const deptRows = rows(departmentWork);
  const overdueRows = rows(overdue);
  const reviewRows = rows(review);
  const escalatedRows = rows(escalated);
  const blockedRows = rows(blocked);
  const evidenceRows = rows(evidenceRequired);
  const evidenceGateRows = rows(evidenceGateOverlay);
  const missingRows = rows(missingOwner);
  const summaryRow = first(summary);
  const hasAnyData = myRows.length + deptRows.length + overdueRows.length + reviewRows.length + escalatedRows.length + blockedRows.length + evidenceRows.length + evidenceGateRows.length + missingRows.length > 0 || Boolean(summaryRow);

  const messages = useMemo(() => ([myWork, departmentWork, overdue, review, escalated, blocked, evidenceRequired, evidenceGateOverlay, missingOwner, summary] as LiveResult<unknown>[])
    .filter(result => !isLive(result))
    .map(result => getLiveResultMessage(result))
    .filter((message, index, all) => all.indexOf(message) === index), [myWork, departmentWork, overdue, review, escalated, blocked, evidenceRequired, evidenceGateOverlay, missingOwner, summary]);

  return (
    <section className="page-section my-work-center">
      <div className="section-heading command-hero">
        <div>
          <p className="eyebrow">Unified Work Queue</p>
          <h3>One daily queue for hospital governance work</h3>
          <p className="section-subtitle">Assigned, overdue, department, escalated, and review work across accreditation, evidence, audit, OVR/RCA, CAPA, training, documents, and approvals.</p>
        </div>
      </div>
      
      {selectedItem && (
        <div className="drawer-overlay" onClick={() => setSelectedItem(null)}>
          <div className="drawer-panel" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>Queue Item Detail</h3>
              <button className="secondary-button" onClick={() => setSelectedItem(null)}>Close</button>
            </div>
            <div className="drawer-content">
              <p><strong>Title:</strong> {selectedItem.title}</p>
              <p><strong>Module:</strong> {selectedItem.source_module}</p>
              <p><strong>Status:</strong> {selectedItem.status}</p>
              <p><strong>Priority:</strong> {selectedItem.priority}</p>
              <p><strong>Due Date:</strong> {selectedItem.due_date || 'None'}</p>
              <p><strong>Description:</strong> {selectedItem.description}</p>
              <pre>{JSON.stringify(selectedItem.source_context, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}

      <DataState loading={loading} empty={!loading && !hasAnyData} emptyTitle="No unified work is visible yet" emptyMessage={messages[0] ?? 'Work appears here when live module queues assign tasks, reviews, escalations, approvals, or evidence requests.'}>
        <h2>Executive Summary</h2>
        <div className="kpi-grid">
          <KpiTile label="Signal" value={value(summaryRow?.executive_signal)} hint="Operating posture" tone={signalTone(summaryRow?.executive_signal)} />
          <KpiTile label="My work" value={summaryRow?.my_work_count ?? myRows.length} hint="Assigned to me" />
          <KpiTile label="Overdue" value={summaryRow?.overdue_work_count ?? overdueRows.length} hint="Past due" tone={(summaryRow?.overdue_work_count ?? overdueRows.length) > 0 ? 'danger' : 'good'} />
          <KpiTile label="Waiting review" value={summaryRow?.waiting_for_review_count ?? reviewRows.length} hint="Submitted or pending" tone={(summaryRow?.waiting_for_review_count ?? reviewRows.length) > 0 ? 'warning' : 'good'} />
          <KpiTile label="Escalated" value={summaryRow?.escalated_work_count ?? escalatedRows.length} hint="Blocked or escalated" tone={(summaryRow?.escalated_work_count ?? escalatedRows.length) > 0 ? 'danger' : 'good'} />
          <KpiTile label="Master data exceptions" value={summaryRow?.master_data_exception_count ?? missingRows.length} hint="Owner/status gaps" tone={(summaryRow?.master_data_exception_count ?? missingRows.length) > 0 ? 'warning' : 'good'} />
        </div>
        <ModernCard title="My Work"><WorkTable data={myRows} label="my work" onSelect={setSelectedItem} /></ModernCard>
        <ModernCard title="Department Work"><WorkTable data={deptRows} label="department work" onSelect={setSelectedItem} /></ModernCard>
        <ModernCard title="Overdue"><WorkTable data={overdueRows} label="overdue work" onSelect={setSelectedItem} /></ModernCard>
        <ModernCard title="Waiting for Review"><WorkTable data={reviewRows} label="review work" onSelect={setSelectedItem} /></ModernCard>
        <ModernCard title="Escalated"><WorkTable data={escalatedRows} label="escalated work" onSelect={setSelectedItem} /></ModernCard>
        <ModernCard title="Blocked"><WorkTable data={blockedRows} label="blocked work" onSelect={setSelectedItem} /></ModernCard>
        <ModernCard title="Evidence Required"><WorkTable data={evidenceRows} label="evidence required" onSelect={setSelectedItem} /></ModernCard>
        <ModernCard title="Evidence Gate Overlay"><EvidenceGateOverlayTable data={evidenceGateRows} /></ModernCard>
        <ModernCard title="Missing Owner / Routing Exceptions"><WorkTable data={missingRows} label="missing owner" onSelect={setSelectedItem} /></ModernCard>
      </DataState>
    </section>
  );
}
