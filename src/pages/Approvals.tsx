import { useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileClock,
  Filter,
  History,
  Search,
  ShieldCheck,
  UserRoundCheck,
  XCircle,
} from 'lucide-react';
import type { PageKey } from '../routes/pageLocation';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';
import { GovernedDecisionDialog } from '../components/GovernedDecisionDialog';
import { GovernedEvidenceAccess } from '../components/GovernedEvidenceAccess';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import { formatDate, humanize } from '../lib/format';
import { decideApproval, getApprovals, getEvidenceForItem } from '../lib/grcApi';
import { decideUi7Approval, getUi7ApprovalWorkspace } from '../lib/ui7ApprovalsReportsApi';
import {
  approvalAuthorityForActor,
  type Ui7ApprovalAuthority,
  type Ui7ApprovalRequest,
} from '../lib/ui7ApprovalsReportsModel';
import type { ApprovalRow } from '../types/domain';

interface ApprovalsProps {
  setPage?: (page: PageKey) => void;
}

type ApprovalView = 'inbox' | 'due' | 'delegations' | 'completed' | 'performance' | 'detail';
type Decision = 'approved' | 'rejected' | 'returned';

const OPEN_STATUSES = new Set(['pending', 'partially_approved', 'escalated']);
const ELEVATED_ROLES = new Set(['super_admin', 'executive', 'governance_admin', 'division_head', 'department_manager', 'compliance_officer', 'auditor']);

function approvalRoute(request: Ui7ApprovalRequest): PageKey | null {
  if (request.workflow_type === 'document_control') return request.linked_item_type.includes('sop') ? 'sops' : 'documents';
  if (request.workflow_type === 'risk') return 'risks';
  if (request.workflow_type === 'evidence') return 'evidence';
  if (request.workflow_type === 'audit_finding') return 'audit';
  if (request.workflow_type === 'compliance_obligation') return 'compliance';
  if (request.workflow_type === 'capa') return 'capa';
  if (request.workflow_type === 'project') return 'projects';
  if (request.workflow_type === 'ovr') return 'ovr';
  if (request.linked_item_type === 'training') return 'trainingGovernance';
  return null;
}

function approvalTone(status: string) {
  if (status === 'approved') return 'good';
  if (['rejected', 'expired'].includes(status)) return 'danger';
  if (status === 'returned') return 'warning';
  if (status === 'escalated') return 'danger';
  return 'primary';
}

function StatusChip({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={`ui7-chip ui7-tone--${tone}`}>{children}</span>;
}

function Metric({ icon, label, value, note, tone = 'neutral' }: { icon: ReactNode; label: string; value: number | string; note: string; tone?: string }) {
  return <article className={`ui7-metric ui7-tone--${tone}`}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></article>;
}

function requestTitle(request: Ui7ApprovalRequest) {
  return request.request_reason || `${humanize(request.action_type)} · ${request.request_code || 'Approval request'}`;
}

export function Approvals({ setPage }: ApprovalsProps) {
  const auth = useAuth();
  const { language, t } = useI18n();
  const text = (en: string, ar: string) => language === 'ar' ? ar : en;
  const [view, setView] = useState<ApprovalView>('inbox');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decision, setDecision] = useState<{ request: Ui7ApprovalRequest; decision: Decision } | null>(null);
  const [legacyDecision, setLegacyDecision] = useState<{ row: ApprovalRow; status: 'approved' | 'rejected' } | null>(null);
  const [selectedLegacyApproval, setSelectedLegacyApproval] = useState<ApprovalRow | null>(null);

  const data = useAsyncData(getUi7ApprovalWorkspace, []);
  const legacyApprovals = useAsyncData(getApprovals, []);
  const legacyEvidence = useAsyncData(
    () => selectedLegacyApproval && ['project', 'milestone', 'task'].includes(selectedLegacyApproval.item_type)
      ? getEvidenceForItem(selectedLegacyApproval.item_type as 'project' | 'milestone' | 'task', selectedLegacyApproval.item_id)
      : Promise.resolve([]),
    [selectedLegacyApproval?.id],
  );
  const actorId = auth.profile?.id ?? '';
  const actorRoles = useMemo(() => auth.roles.map((role) => role.role), [auth.roles]);
  const elevated = actorRoles.some((role) => ELEVATED_ROLES.has(role));
  const authorities = useMemo(() => new Map((data.data?.requests ?? []).map((request) => [request.id, approvalAuthorityForActor({
    request,
    rules: data.data?.rules ?? [],
    stages: data.data?.stages ?? [],
    delegations: data.data?.delegations ?? [],
    actorId,
    actorRoles,
  })])), [actorId, actorRoles, data.data]);

  const visibleRequests = useMemo(() => (data.data?.requests ?? []).filter((request) => {
    const authority = authorities.get(request.id);
    const participated = request.requested_by === actorId
      || request.final_decision_by === actorId
      || (data.data?.decisions ?? []).some((row) => row.approval_request_id === request.id && row.approver_id === actorId);
    return elevated || authority?.actionable || authority?.delegated || participated;
  }), [actorId, authorities, data.data, elevated]);
  const selected = visibleRequests.find((request) => request.id === selectedId) ?? null;
  const selectedAuthority = selected ? authorities.get(selected.id) ?? null : null;
  const selectedHistory = selected ? (data.data?.decisions ?? []).filter((row) => row.approval_request_id === selected.id) : [];

  const filtered = useMemo(() => visibleRequests.filter((request) => {
    const query = search.trim().toLowerCase();
    const due = request.due_date ? new Date(`${request.due_date}T23:59:59`).getTime() : null;
    const matchesView = view === 'detail' || view === 'performance'
      ? true
      : view === 'inbox' ? OPEN_STATUSES.has(request.request_status)
      : view === 'due' ? OPEN_STATUSES.has(request.request_status) && Boolean(due && due < Date.now() + 7 * 86_400_000)
      : view === 'delegations' ? Boolean(authorities.get(request.id)?.delegated)
      : !OPEN_STATUSES.has(request.request_status);
    const matchesType = typeFilter === 'all' || request.workflow_type === typeFilter;
    const matchesStatus = statusFilter === 'all' || request.request_status === statusFilter;
    const matchesSearch = !query || [request.request_code, request.request_reason, request.requester_name, request.workflow_type, request.linked_item_type, request.action_type]
      .some((value) => value?.toLowerCase().includes(query));
    return matchesView && matchesType && matchesStatus && matchesSearch;
  }), [authorities, search, statusFilter, typeFilter, view, visibleRequests]);

  const open = visibleRequests.filter((row) => OPEN_STATUSES.has(row.request_status));
  const overdue = open.filter((row) => row.due_date && new Date(`${row.due_date}T23:59:59`).getTime() < Date.now());
  const completed = visibleRequests.filter((row) => !OPEN_STATUSES.has(row.request_status));
  const approvalOutcomes = (data.data?.decisions ?? []).filter((row) => visibleRequests.some((request) => request.id === row.approval_request_id));
  const decidedTimes = completed.flatMap((row) => row.final_decision_at ? [new Date(row.final_decision_at).getTime() - new Date(row.requested_at).getTime()] : []);
  const averageDecisionDays = decidedTimes.length ? (decidedTimes.reduce((sum, value) => sum + value, 0) / decidedTimes.length / 86_400_000).toFixed(1) : null;

  function openDetail(request: Ui7ApprovalRequest) {
    setSelectedId(request.id);
    setView('detail');
  }

  async function submitDecision(values: Record<string, unknown>) {
    if (!decision) return;
    await decideUi7Approval({
      approvalRequestId: decision.request.id,
      decision: decision.decision,
      note: String(values.note ?? '').trim(),
    });
    setDecision(null);
    await data.refresh();
  }

  async function submitLegacyDecision(values: Record<string, unknown>) {
    if (!legacyDecision) return;
    const defaultNote = legacyDecision.status === 'approved'
      ? t('approvals.defaultApprovalNote')
      : t('approvals.defaultRejectionNote');
    await decideApproval(legacyDecision.row.id, legacyDecision.status, String(values.note ?? '').trim() || defaultNote);
    setLegacyDecision(null);
    await legacyApprovals.refresh();
  }

  const approvalList = <div className="ui7-approval-list" role="table" aria-label={text('Approval inbox', 'صندوق الاعتمادات')}>
    <div className="ui7-approval-row ui7-approval-row--head" role="row"><span>{text('Request', 'الطلب')}</span><span>{text('Workflow', 'سير العمل')}</span><span>{text('Requester', 'مقدم الطلب')}</span><span>{text('Received / due', 'الاستلام / الاستحقاق')}</span><span>{text('Authority', 'الصلاحية')}</span><span>{text('Status', 'الحالة')}</span></div>
    {filtered.map((request) => { const authority = authorities.get(request.id); return <button type="button" className="ui7-approval-row" role="row" onClick={() => openDetail(request)} key={request.id}>
      <span><strong>{requestTitle(request)}</strong><small>{request.request_code || request.id.slice(0, 8)}</small></span>
      <span><strong>{humanize(request.workflow_type)}</strong><small>{humanize(request.action_type)}</small></span>
      <span><strong>{request.requester_name || text('Requester unavailable', 'مقدم الطلب غير متاح')}</strong><small>{request.requested_by === actorId ? text('Requested by you', 'طلبته أنت') : text('Governed requester', 'مقدم طلب محكوم')}</small></span>
      <span><strong>{formatDate(request.requested_at)}</strong><small>{formatDate(request.due_date)}</small></span>
      <span><StatusChip tone={authority?.actionable ? 'good' : authority?.reason.includes('Separation') ? 'danger' : 'neutral'}>{authority?.actionable ? authority.delegated ? text('Delegated', 'مفوضة') : text('Actionable', 'قابلة للتنفيذ') : text('Read-only', 'للقراءة فقط')}</StatusChip></span>
      <span><StatusChip tone={approvalTone(request.request_status)}>{humanize(request.request_status)}</StatusChip><ArrowRight size={15} /></span>
    </button>; })}
  </div>;

  function detailView(request: Ui7ApprovalRequest, authority: Ui7ApprovalAuthority | null) {
    const source = approvalRoute(request);
    return <div className="ui7-approval-detail" data-testid="ui7-approval-detail">
      <button type="button" className="ui7-back" onClick={() => setView(OPEN_STATUSES.has(request.request_status) ? 'inbox' : 'completed')}><ArrowLeft size={16} />{text('Approval inbox', 'صندوق الاعتمادات')}</button>
      <header className="ui7-record-header"><div><span>{request.request_code || text('Governed approval', 'اعتماد محكوم')}</span><h1>{requestTitle(request)}</h1><p>{request.request_reason || text('No additional request rationale was recorded.', 'لم يسجل مبرر إضافي للطلب.')}</p><div><StatusChip tone={approvalTone(request.request_status)}>{humanize(request.request_status)}</StatusChip><StatusChip>{humanize(request.workflow_type)}</StatusChip>{authority?.delegated ? <StatusChip tone="primary">{text('Delegated authority', 'صلاحية مفوضة')}</StatusChip> : null}</div></div><div className="ui7-record-actions">{source ? <button type="button" className="ui7-secondary-button" onClick={() => setPage?.(source)}>{text('Open source', 'فتح المصدر')}<ArrowRight size={16} /></button> : null}</div></header>
      <div className="ui7-detail-grid"><main className="ui7-stack"><section className="ui7-surface"><div className="ui7-section-heading"><div><span>{text('Approval details', 'تفاصيل الاعتماد')}</span><h2>{text('Decision context', 'سياق القرار')}</h2></div><ClipboardCheck size={20} /></div><div className="ui7-definition-grid"><div><span>{text('Requested action', 'الإجراء المطلوب')}</span><strong>{humanize(request.action_type)}</strong></div><div><span>{text('Entity', 'الكيان')}</span><strong>{humanize(request.linked_item_type)}</strong></div><div><span>{text('Requester', 'مقدم الطلب')}</span><strong>{request.requester_name || text('Unavailable', 'غير متاح')}</strong></div><div><span>{text('Requested', 'تم الطلب')}</span><strong>{formatDate(request.requested_at)}</strong></div><div><span>{text('Due date', 'تاريخ الاستحقاق')}</span><strong>{formatDate(request.due_date)}</strong></div><div><span>{text('Approval progress', 'تقدم الاعتماد')}</span><strong>{request.received_approval_count} / {request.required_approval_count}</strong></div></div></section>
        <section className="ui7-surface" data-testid="ui7-approval-history"><div className="ui7-section-heading"><div><span>{text('Decision history', 'سجل القرارات')}</span><h2>{text('Immutable approval trail', 'مسار اعتماد غير قابل للتغيير')}</h2></div><History size={20} /></div><div className="ui7-timeline">{selectedHistory.length ? selectedHistory.map((row) => <div key={row.decision_id}><span className={`ui7-timeline-dot ui7-tone--${approvalTone(row.decision)}`} /><div><strong>{humanize(row.decision)}</strong><p>{row.decision_note || text('No decision note recorded.', 'لم تسجل ملاحظة قرار.')}</p><small>{row.approver_name || humanize(row.approver_role || 'authorized approver')} · {formatDate(row.decided_at)}</small></div></div>) : <div><span className="ui7-timeline-dot" /><div><strong>{text('Submitted for approval', 'أرسل للاعتماد')}</strong><p>{request.request_reason || text('Approval request created.', 'تم إنشاء طلب الاعتماد.')}</p><small>{formatDate(request.requested_at)}</small></div></div>}{request.final_decision ? <div><span className={`ui7-timeline-dot ui7-tone--${approvalTone(request.final_decision)}`} /><div><strong>{text('Final decision', 'القرار النهائي')}: {humanize(request.final_decision)}</strong><p>{request.final_decision_note || text('Final outcome recorded.', 'تم تسجيل النتيجة النهائية.')}</p><small>{formatDate(request.final_decision_at)}</small></div></div> : null}</div></section></main>
        <aside className="ui7-stack"><section className="ui7-surface ui7-decision-card"><div className="ui7-section-heading"><div><span>{text('Authority', 'الصلاحية')}</span><h2>{text('Decision gate', 'بوابة القرار')}</h2></div><ShieldCheck size={20} /></div><StatusChip tone={authority?.actionable ? 'good' : 'danger'}>{authority?.actionable ? text('Authorized now', 'مصرح الآن') : text('Fail closed', 'مغلقة عند الفشل')}</StatusChip><p>{authority?.reason || text('Approval authority is unavailable.', 'صلاحية الاعتماد غير متاحة.')}</p>{authority?.stage ? <div className="ui7-stage"><span>{text('Current stage', 'المرحلة الحالية')}</span><strong>{authority.stage.stage_name}</strong><small>{authority.stage.received_decision_count} / {authority.stage.required_decision_count} {text('decisions', 'قرارات')}</small></div> : null}{authority?.actionable ? <div className="ui7-decision-actions" data-testid="ui7-decision-workspace"><button type="button" className="ui7-primary-button" onClick={() => setDecision({ request, decision: 'approved' })}><CheckCircle2 size={16} />{text('Approve', 'اعتماد')}</button><button type="button" className="ui7-secondary-button" onClick={() => setDecision({ request, decision: 'returned' })}><FileClock size={16} />{text('Request changes', 'طلب تعديلات')}</button><button type="button" className="ui7-danger-button" onClick={() => setDecision({ request, decision: 'rejected' })}><XCircle size={16} />{text('Reject', 'رفض')}</button></div> : <div className="ui7-boundary"><AlertTriangle size={20} /><p>{OPEN_STATUSES.has(request.request_status) ? text('No decision controls are exposed because the signed-in actor is not the current authority.', 'لا تظهر ضوابط قرار لأن المستخدم الحالي ليس صاحب الصلاحية الحالية.') : text('Completed decisions remain immutable.', 'تبقى القرارات المكتملة غير قابلة للتغيير.')}</p></div>}</section></aside></div>
    </div>;
  }

  return <section className="ui7-workspace ui7-approvals" data-testid="ui7-approvals">
    {view !== 'detail' ? <><header className="ui7-module-header"><div><span>{text('Governed decisions', 'القرارات المحكومة')}</span><h1>{text('Approval inbox', 'صندوق الاعتمادات')}</h1><p>{text('Authority-matched approvals, immutable outcomes, active delegations, and auditable rationale in one decision workspace.', 'اعتمادات مطابقة للصلاحيات ونتائج غير قابلة للتغيير وتفويضات نشطة ومبررات قابلة للتدقيق في مساحة قرار واحدة.')}</p></div><div className="ui7-header-state"><ShieldCheck size={18} /><span><strong>{open.filter((row) => authorities.get(row.id)?.actionable).length}</strong>{text('ready for decision', 'جاهزة للقرار')}</span></div></header>
    <nav className="ui7-view-tabs" aria-label={text('Approval views', 'عروض الاعتماد')}>{([
      ['inbox', text('My Approvals', 'اعتماداتي'), <ClipboardCheck size={16} />],
      ['due', text('Due Soon / Overdue', 'قريبة / متأخرة'), <CalendarClock size={16} />],
      ['delegations', text('Delegations', 'التفويضات'), <UserRoundCheck size={16} />],
      ['completed', text('Completed', 'مكتملة'), <CheckCircle2 size={16} />],
      ['performance', text('Performance', 'الأداء'), <Clock3 size={16} />],
    ] as Array<[ApprovalView, string, ReactNode]>).map(([id, label, icon]) => <button type="button" key={id} className={view === id ? 'active' : ''} aria-pressed={view === id} onClick={() => setView(id)}>{icon}<span>{label}</span></button>)}</nav>
    <div className="ui7-filterbar"><label className="ui7-search"><Search size={16} /><span className="sr-only">{text('Search approvals', 'البحث في الاعتمادات')}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text('Search request, workflow, requester...', 'ابحث عن طلب أو سير عمل أو مقدم...')} /></label><label><span className="sr-only">{text('Workflow', 'سير العمل')}</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">{text('All workflows', 'كل مسارات العمل')}</option>{[...new Set(visibleRequests.map((row) => row.workflow_type))].sort().map((type) => <option value={type} key={type}>{humanize(type)}</option>)}</select></label><label><span className="sr-only">{text('Status', 'الحالة')}</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">{text('All statuses', 'كل الحالات')}</option>{[...new Set(visibleRequests.map((row) => row.request_status))].sort().map((status) => <option value={status} key={status}>{humanize(status)}</option>)}</select></label><button type="button" className="ui7-icon-button" title={text('Clear filters', 'مسح المرشحات')} onClick={() => { setSearch(''); setTypeFilter('all'); setStatusFilter('all'); }}><Filter size={17} /></button></div></> : null}

    <DataState loading={data.loading} error={data.error} empty={!data.loading && !data.error && !visibleRequests.length} emptyTitle={text('No approvals in scope', 'لا توجد اعتمادات ضمن النطاق')} emptyMessage={text('No approval requests are visible through your current organization, role, or assignment.', 'لا توجد طلبات اعتماد ظاهرة حسب منشأتك أو دورك أو إسنادك الحالي.')}>
      {view === 'detail' && selected ? detailView(selected, selectedAuthority) : null}
      {view !== 'detail' && view !== 'performance' ? <section className="ui7-surface" data-testid={`ui7-approval-${view}`}><div className="ui7-section-heading"><div><span>{text('Approval queue', 'قائمة الاعتمادات')}</span><h2>{view === 'inbox' ? text('Authority-matched inbox', 'صندوق مطابق للصلاحيات') : view === 'due' ? text('Time-sensitive decisions', 'قرارات حساسة للوقت') : view === 'delegations' ? text('Active delegated work', 'أعمال مفوضة نشطة') : text('Immutable completed decisions', 'قرارات مكتملة غير قابلة للتغيير')}</h2></div><StatusChip tone={view === 'due' && overdue.length ? 'danger' : 'primary'}>{filtered.length}</StatusChip></div>{filtered.length ? approvalList : <div className="ui7-empty"><CheckCircle2 size={24} /><strong>{text('No matching approvals', 'لا توجد اعتمادات مطابقة')}</strong><p>{text('Adjust the active filters or choose another approval view.', 'عدّل المرشحات النشطة أو اختر عرض اعتماد آخر.')}</p></div>}</section> : null}
      {view === 'performance' ? <div data-testid="ui7-approval-performance"><div className="ui7-metric-grid"><Metric icon={<ClipboardCheck size={20} />} label={text('Pending approvals', 'اعتمادات معلقة')} value={open.length} note={text('Visible governed scope', 'النطاق المحكوم الظاهر')} tone="primary" /><Metric icon={<AlertTriangle size={20} />} label={text('Overdue', 'متأخرة')} value={overdue.length} note={text('Past recorded due date', 'بعد تاريخ الاستحقاق المسجل')} tone="danger" /><Metric icon={<CheckCircle2 size={20} />} label={text('Approved', 'معتمدة')} value={approvalOutcomes.filter((row) => row.decision === 'approved').length} note={text('Immutable decision rows', 'صفوف قرار غير قابلة للتغيير')} tone="good" /><Metric icon={<Clock3 size={20} />} label={text('Average decision time', 'متوسط وقت القرار')} value={averageDecisionDays ? `${averageDecisionDays}d` : text('N/A', 'غير متاح')} note={averageDecisionDays ? text('Trustworthy final timestamps', 'طوابع نهائية موثوقة') : text('Insufficient governed data', 'بيانات محكومة غير كافية')} tone="warning" /></div><div className="ui7-dashboard-grid"><section className="ui7-surface ui7-span-7"><div className="ui7-section-heading"><div><span>{text('Approvals by workflow', 'الاعتمادات حسب سير العمل')}</span><h2>{text('Visible decision workload', 'عبء القرارات الظاهر')}</h2></div><ClipboardCheck size={20} /></div><div className="ui7-workload-bars">{[...new Set(visibleRequests.map((row) => row.workflow_type))].map((type) => { const count = visibleRequests.filter((row) => row.workflow_type === type).length; return <button type="button" key={type} onClick={() => { setTypeFilter(type); setView('inbox'); }}><span><strong>{humanize(type)}</strong><small>{count} {text('requests', 'طلبات')}</small></span><i><b style={{ width: `${visibleRequests.length ? Math.max(8, count / visibleRequests.length * 100) : 0}%` }} /></i></button>; })}</div></section><section className="ui7-surface ui7-span-5"><div className="ui7-section-heading"><div><span>{text('Decision outcomes', 'نتائج القرارات')}</span><h2>{text('Recorded authority history', 'سجل الصلاحيات المسجل')}</h2></div><History size={20} /></div><div className="ui7-stat-list">{['approved', 'rejected', 'returned'].map((outcome) => <div key={outcome}><span>{humanize(outcome)}</span><strong>{approvalOutcomes.filter((row) => row.decision === outcome).length}</strong></div>)}</div><p className="ui7-context-note">{text('Counts use immutable decision history. They do not infer outcomes from source-item status.', 'تستخدم الأعداد سجل القرارات غير القابل للتغيير ولا تستنتج نتائج من حالة بند المصدر.')}</p></section></div></div> : null}
    </DataState>

    {legacyApprovals.data?.length ? <section className="ui7-surface ui7-legacy-approvals" data-testid="ui7-f1r2-approvals"><div className="ui7-section-heading"><div><span>{text('Project delivery decisions', 'قرارات تسليم المشاريع')}</span><h2>{text('Item-scoped approval queue', 'قائمة اعتماد حسب البند')}</h2></div><ShieldCheck size={20} /></div><div className="ui7-legacy-approval-list">{legacyApprovals.data.map((row) => <article key={row.id}><button type="button" className="ui7-legacy-approval-title" onClick={() => setSelectedLegacyApproval(row)}><strong>{row.item_title}</strong><small>{row.requested_by_name || text('Requester unavailable', 'مقدم الطلب غير متاح')} · {formatDate(row.requested_at)}</small></button><StatusChip tone={approvalTone(row.status)}>{humanize(row.status)}</StatusChip>{row.status === 'pending' ? <div className="ui7-decision-actions"><button type="button" className="ui7-primary-button" onClick={() => setLegacyDecision({ row, status: 'approved' })}>{text('Approve', 'اعتماد')}</button><button type="button" className="ui7-danger-button" onClick={() => setLegacyDecision({ row, status: 'rejected' })}>{text('Reject', 'رفض')}</button></div> : <span className="ui7-context-note">{text('Decision recorded', 'تم تسجيل القرار')}</span>}</article>)}</div>{selectedLegacyApproval ? <div className="ui7-legacy-evidence"><div className="ui7-section-heading"><div><span>{text('Governed evidence', 'الأدلة المحكومة')}</span><h2>{selectedLegacyApproval.item_title}</h2></div><button type="button" className="ui7-secondary-button" onClick={() => setSelectedLegacyApproval(null)}>{text('Close', 'إغلاق')}</button></div><DataState loading={legacyEvidence.loading} error={legacyEvidence.error} empty={!legacyEvidence.data?.length} emptyMessage={text('No governed evidence is linked to this approval item.', 'لا توجد أدلة محكومة مرتبطة ببند الاعتماد هذا.')}><div className="governed-evidence-list">{(legacyEvidence.data || []).map((file) => <GovernedEvidenceAccess key={file.id} evidenceId={file.id} fileName={file.file_name} fileType={file.file_type} fileSize={file.file_size} description={file.description} />)}</div></DataState></div> : null}</section> : null}

    <GovernedDecisionDialog open={Boolean(decision)} title={decision?.decision === 'approved' ? text('Approve request', 'اعتماد الطلب') : decision?.decision === 'rejected' ? text('Reject request', 'رفض الطلب') : text('Request changes', 'طلب تعديلات')} subtitle={decision ? requestTitle(decision.request) : undefined} decisionVariant={decision?.decision === 'approved' ? 'approve' : decision?.decision === 'rejected' ? 'reject' : 'warning'} confirmLabel={decision?.decision === 'approved' ? text('Approve', 'اعتماد') : decision?.decision === 'rejected' ? text('Reject', 'رفض') : text('Return for changes', 'إعادة للتعديل')} warningNotice={text('The server will re-check active identity, organization, current stage, authority, delegation, separation of duties, and open state before recording the decision.', 'سيعيد الخادم التحقق من الهوية النشطة والمنشأة والمرحلة والصلاحية والتفويض وفصل المهام والحالة المفتوحة قبل تسجيل القرار.')} contextItems={decision ? [{ label: text('Request', 'الطلب'), value: decision.request.request_code || decision.request.id.slice(0, 8) }, { label: text('Workflow', 'سير العمل'), value: humanize(decision.request.workflow_type) }, { label: text('Requester', 'مقدم الطلب'), value: decision.request.requester_name || text('Unavailable', 'غير متاح') }, { label: text('Status', 'الحالة'), value: humanize(decision.request.request_status) }] : []} fields={[{ id: 'note', label: text('Decision rationale', 'مبرر القرار'), type: 'textarea', required: decision?.decision !== 'approved', placeholder: text('Record the decision rationale...', 'سجل مبرر القرار...'), autoFocus: true }]} onClose={() => setDecision(null)} onSubmit={submitDecision} />
    <GovernedDecisionDialog open={Boolean(legacyDecision)} title={legacyDecision?.status === 'approved' ? t('approvals.approveDecisionTitle') : t('approvals.rejectDecisionTitle')} decisionVariant={legacyDecision?.status === 'approved' ? 'approve' : 'reject'} confirmLabel={legacyDecision?.status === 'approved' ? t('approvals.approve') : t('approvals.reject')} contextItems={legacyDecision ? [{ label: t('common.item'), value: legacyDecision.row.item_title }, { label: t('approvals.requestedBy'), value: legacyDecision.row.requested_by_name || '—' }] : []} fields={legacyDecision?.status === 'approved' ? [{ id: 'note', label: t('approvals.noteLabel'), type: 'textarea', defaultValue: t('approvals.defaultApprovalNote'), required: false, autoFocus: true }] : [{ id: 'note', label: t('approvals.rejectionReason'), type: 'textarea', defaultValue: '', required: true, hint: t('approvals.rejectionReasonRequired'), autoFocus: true }]} onClose={() => setLegacyDecision(null)} onSubmit={submitLegacyDecision} />
  </section>;
}
