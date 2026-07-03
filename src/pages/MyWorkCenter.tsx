import { useEffect, useMemo, useState } from 'react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import {
  getDepartmentWorkQueue,
  getEscalatedWorkQueue,
  getGovernanceOperatingSummary,
  getMyWorkQueue,
  getOverdueWorkQueue,
  getWaitingForReviewQueue,
  type GovernanceOperatingSummaryRow,
  type UnifiedWorkQueueRow,
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

function WorkTable({ data, label }: { data: UnifiedWorkQueueRow[]; label: string }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead><tr><th>Work</th><th>Module</th><th>Status</th><th>Priority</th><th>Department</th><th>Due</th><th>Flags</th></tr></thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={7}><strong>No {label} records returned.</strong></td></tr>
          ) : data.slice(0, 100).map(row => (
            <tr key={`${row.source_module}-${row.work_type}-${row.work_id}`}>
              <td><strong>{value(row.work_title)}</strong><br /><small>{value(row.work_description)}</small></td>
              <td><StatusPill tone="neutral">{value(row.source_module)}</StatusPill><br /><small>{value(row.work_type)}</small></td>
              <td><StatusPill tone={row.is_overdue ? 'danger' : statusTone(row.work_status)}>{row.is_overdue ? 'Overdue' : value(row.work_status)}</StatusPill></td>
              <td><StatusPill tone={priorityTone(row.priority)}>{value(row.priority)}</StatusPill></td>
              <td>{value(row.department_name)}</td>
              <td>{value(row.due_date)}</td>
              <td>{row.waiting_for_review ? 'Review' : '-'}{row.is_escalated ? ' / Escalated' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MyWorkCenter() {
  const [myWork, setMyWork] = useState<LiveResult<UnifiedWorkQueueRow[]>>(emptyRows('No assigned work loaded yet.'));
  const [departmentWork, setDepartmentWork] = useState<LiveResult<UnifiedWorkQueueRow[]>>(emptyRows('No department work loaded yet.'));
  const [overdue, setOverdue] = useState<LiveResult<UnifiedWorkQueueRow[]>>(emptyRows('No overdue work loaded yet.'));
  const [review, setReview] = useState<LiveResult<UnifiedWorkQueueRow[]>>(emptyRows('No review queue loaded yet.'));
  const [escalated, setEscalated] = useState<LiveResult<UnifiedWorkQueueRow[]>>(emptyRows('No escalated work loaded yet.'));
  const [summary, setSummary] = useState<LiveResult<GovernanceOperatingSummaryRow[]>>(emptyRows('No operating summary loaded yet.'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const [myResult, deptResult, overdueResult, reviewResult, escalatedResult, summaryResult] = await Promise.all([
        getMyWorkQueue(),
        getDepartmentWorkQueue(),
        getOverdueWorkQueue(),
        getWaitingForReviewQueue(),
        getEscalatedWorkQueue(),
        getGovernanceOperatingSummary(),
      ]);
      if (!mounted) return;
      setMyWork(myResult);
      setDepartmentWork(deptResult);
      setOverdue(overdueResult);
      setReview(reviewResult);
      setEscalated(escalatedResult);
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
  const summaryRow = first(summary);
  const hasAnyData = myRows.length + deptRows.length + overdueRows.length + reviewRows.length + escalatedRows.length > 0 || Boolean(summaryRow);

  const messages = useMemo(() => ([myWork, departmentWork, overdue, review, escalated, summary] as LiveResult<unknown>[])
    .filter(result => !isLive(result))
    .map(result => getLiveResultMessage(result))
    .filter((message, index, all) => all.indexOf(message) === index), [myWork, departmentWork, overdue, review, escalated, summary]);

  return (
    <div className="page-stack my-work-center">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Unified Work Queue</p>
          <h1>One daily queue for hospital governance work</h1>
          <p className="section-subtitle">Assigned, overdue, department, escalated, and review work across accreditation, evidence, audit, OVR/RCA, CAPA, training, documents, and approvals.</p>
        </div>
      </section>
      <DataState loading={loading} empty={!loading && !hasAnyData} emptyTitle="No unified work is visible yet" emptyMessage={messages[0] ?? 'Work appears here when live module queues assign tasks, reviews, escalations, approvals, or evidence requests.'}>
        <div className="kpi-grid">
          <KpiTile label="Signal" value={value(summaryRow?.executive_signal)} hint="Operating posture" tone={signalTone(summaryRow?.executive_signal)} />
          <KpiTile label="My work" value={summaryRow?.my_work_count ?? myRows.length} hint="Assigned to me" />
          <KpiTile label="Overdue" value={summaryRow?.overdue_work_count ?? overdueRows.length} hint="Past due" tone={(summaryRow?.overdue_work_count ?? overdueRows.length) > 0 ? 'danger' : 'good'} />
          <KpiTile label="Waiting review" value={summaryRow?.waiting_for_review_count ?? reviewRows.length} hint="Submitted or pending" tone={(summaryRow?.waiting_for_review_count ?? reviewRows.length) > 0 ? 'warning' : 'good'} />
          <KpiTile label="Escalated" value={summaryRow?.escalated_work_count ?? escalatedRows.length} hint="Blocked or escalated" tone={(summaryRow?.escalated_work_count ?? escalatedRows.length) > 0 ? 'danger' : 'good'} />
          <KpiTile label="Master data exceptions" value={summaryRow?.master_data_exception_count ?? 0} hint="Owner/status gaps" tone={(summaryRow?.master_data_exception_count ?? 0) > 0 ? 'warning' : 'good'} />
        </div>
        <ModernCard title="My assigned work"><WorkTable data={myRows} label="my work" /></ModernCard>
        <ModernCard title="Overdue work"><WorkTable data={overdueRows} label="overdue work" /></ModernCard>
        <ModernCard title="Waiting for review"><WorkTable data={reviewRows} label="review work" /></ModernCard>
        <ModernCard title="Escalated or blocked work"><WorkTable data={escalatedRows} label="escalated work" /></ModernCard>
        <ModernCard title="Department work"><WorkTable data={deptRows} label="department work" /></ModernCard>
      </DataState>
    </div>
  );
}
