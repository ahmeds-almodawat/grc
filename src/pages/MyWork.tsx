import { useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Clock3,
  Filter,
  ListChecks,
  Search,
  ShieldCheck,
  UserRoundCheck,
} from 'lucide-react';
import type { PageKey } from '../routes/pageLocation';
import { useAuth } from '../auth/AuthProvider';
import { DataState } from '../components/DataState';
import { Modal } from '../components/Modal';
import { AssignmentResponseForm } from '../components/WorkItemControls';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import { formatDate, humanize } from '../lib/format';
import { getUi7ApprovalWorkspace, getUi7MyWorkQueue } from '../lib/ui7ApprovalsReportsApi';
import {
  approvalAuthorityForActor,
  ui7WorkBucket,
  type Ui7WorkBucket,
  type Ui7WorkItem,
} from '../lib/ui7ApprovalsReportsModel';

interface MyWorkProps {
  setPage?: (page: PageKey) => void;
}

type WorkView = 'overview' | Ui7WorkBucket;

const OPEN_APPROVALS = new Set(['pending', 'partially_approved', 'escalated']);

function toneForWork(item: Ui7WorkItem) {
  if (item.actionability === 'completed') return 'good';
  if (item.actionability === 'blocked' || ui7WorkBucket(item) === 'overdue') return 'danger';
  if (ui7WorkBucket(item) === 'due_soon') return 'warning';
  if (item.actionability === 'read_only') return 'neutral';
  return 'primary';
}

function Metric({ icon, label, value, note, tone = 'neutral' }: { icon: ReactNode; label: string; value: number; note: string; tone?: string }) {
  return <article className={`ui7-metric ui7-tone--${tone}`}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></article>;
}

function StatusChip({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={`ui7-chip ui7-tone--${tone}`}>{children}</span>;
}

function assignmentNeedsResponse(row: Ui7WorkItem) {
  return row.assignment_status === 'pending' || row.assignment_status === 'legacy_unverified';
}

export function MyWork({ setPage }: MyWorkProps) {
  const auth = useAuth();
  const { language } = useI18n();
  const text = (en: string, ar: string) => language === 'ar' ? ar : en;
  const [view, setView] = useState<WorkView>('overview');
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assignmentResponse, setAssignmentResponse] = useState<Ui7WorkItem | null>(null);

  const data = useAsyncData(async () => {
    const [queue, approvals] = await Promise.all([getUi7MyWorkQueue(), getUi7ApprovalWorkspace()]);
    return { queue, approvals };
  }, []);

  const actorId = auth.profile?.id ?? '';
  const actorRoles = useMemo(() => auth.roles.map((role) => role.role), [auth.roles]);
  const approvalItems = useMemo<Ui7WorkItem[]>(() => {
    if (!data.data || !actorId) return [];
    const { requests, rules, stages, delegations, decisions } = data.data.approvals;
    return requests.flatMap((request) => {
      const authority = approvalAuthorityForActor({ request, rules, stages, delegations, actorId, actorRoles });
      const participated = request.requested_by === actorId
        || request.final_decision_by === actorId
        || decisions.some((row) => row.approval_request_id === request.id && row.approver_id === actorId);
      if (!authority.actionable && !participated && !authority.delegated) return [];
      const completed = !OPEN_APPROVALS.has(request.request_status);
      return [{
        id: `approval:${request.id}`,
        sourceModule: 'approval',
        sourceType: request.linked_item_type,
        sourceId: request.linked_item_id,
        title: request.request_reason || `${humanize(request.action_type)} · ${request.request_code || 'Approval request'}`,
        description: authority.reason,
        owner: authority.stage?.stage_name || null,
        requester: request.requester_name || null,
        dueDate: request.due_date,
        status: request.request_status,
        priority: request.escalation_required ? 'high' : null,
        severity: null,
        requiredAction: authority.actionable ? text('Review approval', 'مراجعة الاعتماد') : text('View approval', 'عرض الاعتماد'),
        route: 'approvals',
        createdAt: request.requested_at,
        updatedAt: request.updated_at,
        actionability: completed ? 'completed' : authority.actionable ? 'actionable' : 'read_only',
        blockedReason: authority.actionable || completed ? null : authority.reason,
        delegated: authority.delegated,
      }];
    });
  }, [actorId, actorRoles, data.data, language]);

  const items = useMemo(() => {
    const byId = new Map<string, Ui7WorkItem>();
    for (const row of [...(data.data?.queue ?? []), ...approvalItems]) byId.set(row.id, row);
    return [...byId.values()];
  }, [approvalItems, data.data?.queue]);
  const modules = [...new Set(items.map((item) => item.sourceModule))].sort();
  const filtered = useMemo(() => items.filter((item) => {
    const query = search.trim().toLowerCase();
    const matchesView = view === 'overview' || ui7WorkBucket(item) === view;
    const matchesModule = moduleFilter === 'all' || item.sourceModule === moduleFilter;
    const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter || item.severity === priorityFilter;
    const matchesSearch = !query || [item.title, item.description, item.requester, item.owner, item.requiredAction, item.sourceModule]
      .some((value) => value?.toLowerCase().includes(query));
    return matchesView && matchesModule && matchesPriority && matchesSearch;
  }), [items, moduleFilter, priorityFilter, search, view]);

  const dueSoon = items.filter((item) => ui7WorkBucket(item) === 'due_soon');
  const overdue = items.filter((item) => ui7WorkBucket(item) === 'overdue');
  const completed = items.filter((item) => ui7WorkBucket(item) === 'completed');
  const delegated = items.filter((item) => ui7WorkBucket(item) === 'delegated');
  const actionable = items.filter((item) => item.actionability === 'actionable');

  function openSource(item: Ui7WorkItem) {
    if (!item.route) return;
    if (setPage) setPage(item.route as PageKey);
  }

  function closeAssignmentResponse() {
    setAssignmentResponse(null);
    void data.refresh();
  }

  const displayedItems = view === 'overview'
    ? filtered.filter((item) => ['overdue', 'due_soon'].includes(ui7WorkBucket(item))).slice(0, 12)
    : filtered;
  const workList = displayedItems.length ? <div className="ui7-work-list" role="table" aria-label={text('My governed work queue', 'قائمة أعمالي المحكومة')}>
    <div className="ui7-work-row ui7-work-row--head" role="row"><span>{text('Work item', 'بند العمل')}</span><span>{text('Module', 'الوحدة')}</span><span>{text('Requester / owner', 'مقدم الطلب / المالك')}</span><span>{text('Due / age', 'الاستحقاق / العمر')}</span><span>{text('Status', 'الحالة')}</span><span>{text('Required action', 'الإجراء المطلوب')}</span></div>
    {displayedItems.map((item) => <article className="ui7-work-row" role="row" key={item.id} data-actionability={item.actionability}>
      <span><strong>{item.title}</strong><small>{item.description || text('No additional source context recorded.', 'لم يسجل سياق إضافي للمصدر.')}</small>{item.blockedReason ? <em><AlertTriangle size={13} />{item.blockedReason}</em> : null}</span>
      <span><StatusChip>{humanize(item.sourceModule)}</StatusChip><small>{humanize(item.sourceType)}</small></span>
      <span><strong>{item.requester || item.owner || text('Assigned to me', 'مسند إلي')}</strong><small>{item.delegated ? text('Delegated authority', 'صلاحية مفوضة') : text('Direct responsibility', 'مسؤولية مباشرة')}</small></span>
      <span><strong>{formatDate(item.dueDate)}</strong><small>{item.createdAt ? `${text('Received', 'تم الاستلام')} ${formatDate(item.createdAt)}` : text('Age unavailable', 'العمر غير متاح')}</small></span>
      <span><StatusChip tone={toneForWork(item)}>{item.actionability === 'read_only' ? text('Read-only', 'للقراءة فقط') : item.actionability === 'blocked' ? text('Blocked', 'متعطل') : humanize(item.status)}</StatusChip></span>
      <span>{assignmentNeedsResponse(item) ? <button type="button" className="ui7-row-action" onClick={() => setAssignmentResponse(item)}>{text('Respond to assignment', 'الرد على الإسناد')}<ArrowRight size={15} /></button> : item.route ? <button type="button" className="ui7-row-action" onClick={() => openSource(item)}>{item.actionability === 'actionable' ? item.requiredAction : item.actionability === 'blocked' ? text('Open blocked source', 'فتح المصدر المتعطل') : text('View source', 'عرض المصدر')}<ArrowRight size={15} /></button> : <StatusChip>{text('Information only', 'للمعلومات فقط')}</StatusChip>}</span>
    </article>)}
  </div> : <div className="ui7-empty"><CheckCircle2 size={24} /><strong>{text('No priority work', 'لا توجد أعمال ذات أولوية')}</strong><p>{text('No overdue or due-soon work matches the active filters.', 'لا توجد أعمال متأخرة أو مستحقة قريباً تطابق المرشحات النشطة.')}</p></div>;

  return <section className="ui7-workspace ui7-my-work" data-testid="ui7-my-work">
    <header className="ui7-module-header"><div><span>{text('Approvals / My Work', 'الاعتمادات / أعمالي')}</span><h1>{text('My governed work', 'أعمالي المحكومة')}</h1><p>{text('A role-scoped execution queue for assignments, reviews, evidence, acknowledgments, and approval decisions.', 'قائمة تنفيذ حسب الصلاحيات للإسنادات والمراجعات والأدلة والإقرارات وقرارات الاعتماد.')}</p></div><div className="ui7-header-state"><ShieldCheck size={18} /><span><strong>{actionable.length}</strong>{text('actionable now', 'قابلة للتنفيذ الآن')}</span></div></header>

    <nav className="ui7-view-tabs" aria-label={text('My Work views', 'عروض أعمالي')}>{([
      ['overview', text('Overview', 'نظرة عامة'), <ListChecks size={16} />],
      ['pending', text('My Pending', 'المعلقة لدي'), <CircleDot size={16} />],
      ['due_soon', text('Due Soon', 'مستحقة قريباً'), <CalendarClock size={16} />],
      ['overdue', text('Overdue', 'متأخرة'), <AlertTriangle size={16} />],
      ['completed', text('Recently Actioned', 'منفذة مؤخراً'), <CheckCircle2 size={16} />],
      ['delegated', text('Delegated', 'مفوضة'), <UserRoundCheck size={16} />],
    ] as Array<[WorkView, string, ReactNode]>).map(([id, label, icon]) => <button type="button" key={id} className={view === id ? 'active' : ''} aria-pressed={view === id} onClick={() => setView(id)}>{icon}<span>{label}</span></button>)}</nav>

    <div className="ui7-filterbar" aria-label={text('My Work filters', 'مرشحات أعمالي')}>
      <label className="ui7-search"><Search size={16} /><span className="sr-only">{text('Search work', 'البحث في الأعمال')}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text('Search work, requester, action...', 'ابحث عن عمل أو مقدم طلب أو إجراء...')} /></label>
      <label><span className="sr-only">{text('Module', 'الوحدة')}</span><select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}><option value="all">{text('All modules', 'كل الوحدات')}</option>{modules.map((module) => <option value={module} key={module}>{humanize(module)}</option>)}</select></label>
      <label><span className="sr-only">{text('Priority', 'الأولوية')}</span><select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="all">{text('All priorities', 'كل الأولويات')}</option><option value="critical">{text('Critical', 'حرجة')}</option><option value="high">{text('High', 'عالية')}</option><option value="medium">{text('Medium', 'متوسطة')}</option><option value="low">{text('Low', 'منخفضة')}</option></select></label>
      <button type="button" className="ui7-icon-button" title={text('Clear filters', 'مسح المرشحات')} onClick={() => { setSearch(''); setModuleFilter('all'); setPriorityFilter('all'); }}><Filter size={17} /></button>
    </div>

    <DataState loading={data.loading} error={data.error} empty={!data.loading && !data.error && !items.length} emptyTitle={text('No governed work assigned', 'لا توجد أعمال محكومة مسندة')} emptyMessage={text('No legitimate assigned, delegated, or recently actioned work is visible in your current scope.', 'لا توجد أعمال مسندة أو مفوضة أو منفذة مؤخراً ظاهرة ضمن نطاقك الحالي.')}>
      {view === 'overview' ? <div data-testid="ui7-my-work-overview"><div className="ui7-metric-grid"><Metric icon={<ClipboardCheck size={20} />} label={text('Total assigned', 'إجمالي المسند')} value={items.length} note={text('Visible authorized scope', 'النطاق المصرح الظاهر')} tone="primary" /><Metric icon={<Clock3 size={20} />} label={text('Due soon', 'مستحقة قريباً')} value={dueSoon.length} note={text('Within seven days', 'خلال سبعة أيام')} tone="warning" /><Metric icon={<AlertTriangle size={20} />} label={text('Overdue', 'متأخرة')} value={overdue.length} note={text('Needs attention', 'تحتاج اهتماماً')} tone="danger" /><Metric icon={<CheckCircle2 size={20} />} label={text('Completed / recent', 'مكتملة / حديثة')} value={completed.length} note={text('Immutable source outcomes', 'نتائج مصدر غير قابلة للتغيير')} tone="good" /></div><div className="ui7-dashboard-grid"><section className="ui7-surface ui7-span-7"><div className="ui7-section-heading"><div><span>{text('Workload', 'عبء العمل')}</span><h2>{text('Current responsibility mix', 'مزيج المسؤوليات الحالي')}</h2></div><ListChecks size={20} /></div><div className="ui7-workload-bars">{modules.map((module) => { const count = items.filter((item) => item.sourceModule === module).length; return <button type="button" key={module} onClick={() => { setModuleFilter(module); setView('pending'); }}><span><strong>{humanize(module)}</strong><small>{count} {text('items', 'بنود')}</small></span><i><b style={{ width: `${items.length ? Math.max(8, count / items.length * 100) : 0}%` }} /></i></button>; })}</div></section><section className="ui7-surface ui7-span-5"><div className="ui7-section-heading"><div><span>{text('Actionability', 'قابلية التنفيذ')}</span><h2>{text('What you can do now', 'ما يمكنك فعله الآن')}</h2></div><ShieldCheck size={20} /></div><div className="ui7-stat-list"><button type="button" onClick={() => setView('pending')}><span>{text('Actionable now', 'قابلة للتنفيذ الآن')}</span><strong>{actionable.length}</strong></button><button type="button" onClick={() => setView('overdue')}><span>{text('Overdue', 'متأخرة')}</span><strong>{overdue.length}</strong></button><button type="button" onClick={() => setView('delegated')}><span>{text('Delegated / reassigned', 'مفوضة / معاد إسنادها')}</span><strong>{delegated.length}</strong></button><div><span>{text('Read-only / blocked', 'للقراءة فقط / متعطلة')}</span><strong>{items.filter((item) => ['read_only', 'blocked'].includes(item.actionability)).length}</strong></div></div></section><section className="ui7-surface ui7-span-12"><div className="ui7-section-heading"><div><span>{text('Priority queue', 'قائمة الأولويات')}</span><h2>{text('Overdue and due-soon responsibilities', 'المسؤوليات المتأخرة والمستحقة قريباً')}</h2></div><CalendarClock size={20} /></div>{workList}</section></div></div> : <section className="ui7-surface" data-testid={`ui7-my-work-${view}`}><div className="ui7-section-heading"><div><span>{text('Personal queue', 'القائمة الشخصية')}</span><h2>{text(humanize(view), view === 'pending' ? 'المعلقة لدي' : view === 'due_soon' ? 'مستحقة قريباً' : view === 'overdue' ? 'متأخرة' : view === 'completed' ? 'منفذة مؤخراً' : 'مفوضة')}</h2></div><StatusChip tone={view === 'overdue' ? 'danger' : view === 'completed' ? 'good' : 'primary'}>{filtered.length}</StatusChip></div>{filtered.length ? workList : <div className="ui7-empty"><CheckCircle2 size={24} /><strong>{text('No matching work', 'لا توجد أعمال مطابقة')}</strong><p>{text('Adjust the active filters or choose another queue.', 'عدّل المرشحات النشطة أو اختر قائمة أخرى.')}</p></div>}</section>}
    </DataState>

    <Modal open={Boolean(assignmentResponse)} title={assignmentResponse?.title || text('Assignment response', 'الرد على الإسناد')} onClose={() => setAssignmentResponse(null)}>
      {assignmentResponse?.assignment_id ? <AssignmentResponseForm assignmentId={assignmentResponse.assignment_id} onCancel={() => setAssignmentResponse(null)} onResponded={closeAssignmentResponse} /> : null}
    </Modal>
  </section>;
}
