import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  AlertTriangle, ArrowLeft, BarChart3, CalendarDays, CheckCircle2, ClipboardCheck,
  Clock3, Eye, FileCheck2, FileSearch, FileText, Flag, LayoutDashboard, Link2,
  ListChecks, MessageSquareWarning, Plus, Search, Send, ShieldCheck, Target,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { GovernedDecisionDialog, type DecisionFieldConfig } from '../components/GovernedDecisionDialog';
import { GovernanceCriteriaLinkage } from '../components/governance/GovernanceCriteriaLinkage';
import { AuditFindingForm } from '../components/GrcForms';
import { Modal } from '../components/Modal';
import { ModuleHeader } from '../components/ModuleHeader';
import { StatusBadge } from '../components/StatusBadge';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import { departmentName, formatDate, humanize, ownerName } from '../lib/format';
import {
  acceptCorrectiveActionPlan, acceptManagementResponse, generateAuditClosurePackIndex,
  getAuditClosureGateStatus, getAuditFindingValidationEvents, getAuditFindingWorkflowQueue,
  getAuditFindings, getDepartments, getOrganizations, getOverdueAuditFindings, getProfiles,
  issueAuditFinding, rejectAuditFindingClosure, rejectCorrectiveActionPlan,
  rejectManagementResponse, requestAuditFindingClosure, submitCorrectiveActionPlan,
  submitManagementResponse, validateAuditFindingClosure,
} from '../lib/grcApi';
import {
  createUi4Capa, getUi4AuditCriteriaContracts, getUi4AuditCriteriaDisputes,
  recordUi4AuditCriteriaDispute, type Ui4AuditCriteriaContract, type Ui4AuditCriteriaDispute,
} from '../lib/ui4AuditCapaApi';
import { evaluateUi4AuditClosureGate } from '../lib/ui4AuditCapaModel';
import type { AuditFindingRow } from '../types/domain';

type AuditScreen = 'dashboard' | 'register' | 'engagement' | 'planning' | 'program' | 'findings' | 'finding' | 'report' | 'followup' | 'review';
type AuditAction = 'issue' | 'submit_response' | 'accept_response' | 'reject_response' | 'submit_action' | 'accept_action' | 'reject_action' | 'request_closure' | 'validate_closure' | 'reject_closure' | 'generate_pack' | 'dispute' | 'create_capa';

interface AuditEngagement {
  key: string;
  title: string;
  findings: AuditFindingRow[];
  status: string;
  startDate: string | null;
  endDate: string | null;
}

interface AuditDecision { action: AuditAction; finding: AuditFindingRow }

const auditScreens: Array<{ id: AuditScreen; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'register', label: 'Audit register', icon: FileSearch },
  { id: 'engagement', label: 'Engagement', icon: ClipboardCheck },
  { id: 'planning', label: 'Planning', icon: Target },
  { id: 'program', label: 'Program', icon: ListChecks },
  { id: 'findings', label: 'Findings', icon: Flag },
  { id: 'finding', label: 'Finding details', icon: FileCheck2 },
  { id: 'report', label: 'Report', icon: FileText },
  { id: 'followup', label: 'Follow-up', icon: Clock3 },
  { id: 'review', label: 'Review', icon: ShieldCheck },
];

function findingTone(value: string | null | undefined) {
  if (value === 'critical' || value === 'high') return 'danger';
  if (value === 'medium') return 'warning';
  if (value === 'low' || value === 'closed') return 'success';
  return 'neutral';
}

function workflowLabel(finding: AuditFindingRow) { return finding.finding_status || finding.status || 'draft'; }
function engagementStatus(findings: AuditFindingRow[]) {
  if (findings.length && findings.every((finding) => workflowLabel(finding) === 'closed')) return 'completed';
  if (findings.some((finding) => workflowLabel(finding) !== 'draft')) return 'in_progress';
  return 'planned';
}

function EmptyAudit({ title, detail }: { title: string; detail?: string }) {
  return <div className="ui3-empty-state"><FileSearch size={23} /><strong>{title}</strong>{detail ? <p>{detail}</p> : null}</div>;
}

function MiniBar({ label, value, max, tone = 'primary' }: { label: string; value: number; max: number; tone?: string }) {
  return <div className="ui4-mini-bar"><span>{label}</span><div><i className={`ui4-fill--${tone}`} style={{ width: `${max ? Math.max(4, (value / max) * 100) : 0}%` }} /></div><strong>{value}</strong></div>;
}

export function Audit() {
  const auth = useAuth();
  const { language, t } = useI18n();
  const text = useCallback((en: string, ar: string) => language === 'ar' ? ar : en, [language]);
  const [screen, setScreen] = useState<AuditScreen>('dashboard');
  const [selectedEngagementKey, setSelectedEngagementKey] = useState<string | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [decision, setDecision] = useState<AuditDecision | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [criteriaContracts, setCriteriaContracts] = useState<Ui4AuditCriteriaContract[]>([]);
  const [disputes, setDisputes] = useState<Ui4AuditCriteriaDispute[]>([]);

  const findings = useAsyncData(getAuditFindings, []);
  const workflowQueue = useAsyncData(getAuditFindingWorkflowQueue, []);
  const overdue = useAsyncData(getOverdueAuditFindings, []);
  const closureGates = useAsyncData(getAuditClosureGateStatus, []);
  const departments = useAsyncData(getDepartments, []);
  const profiles = useAsyncData(getProfiles, []);
  const organizations = useAsyncData(getOrganizations, []);
  const events = useAsyncData(() => selectedFindingId ? getAuditFindingValidationEvents(selectedFindingId) : Promise.resolve([]), [selectedFindingId]);

  const rows = findings.data ?? [];
  const organizationId = organizations.data?.[0]?.id || auth.profile?.organizationId || '';
  const isIndependentReviewer = auth.roles.some((role) => ['super_admin', 'governance_admin', 'auditor'].includes(role.role));
  const canManageWorkflow = auth.roles.some((role) => ['super_admin', 'governance_admin', 'auditor', 'compliance_officer', 'department_manager'].includes(role.role));
  const canManagementRespond = auth.roles.some((role) => ['super_admin', 'governance_admin', 'department_manager', 'division_head'].includes(role.role));

  const engagements = useMemo<AuditEngagement[]>(() => {
    const groups = new Map<string, AuditFindingRow[]>();
    for (const finding of rows) {
      const key = finding.audit_title?.trim() || text('Unassigned audit engagement', 'مهمة مراجعة غير مسندة');
      groups.set(key, [...(groups.get(key) ?? []), finding]);
    }
    return [...groups.entries()].map(([title, grouped]) => {
      const endDates = grouped.map((finding) => finding.audit_period_end_date || finding.due_date || null).filter(Boolean).sort();
      return {
        key: title, title, findings: grouped, status: engagementStatus(grouped),
        startDate: grouped.map((finding) => finding.finding_date || finding.created_at || null).filter(Boolean).sort()[0] ?? null,
        endDate: endDates[endDates.length - 1] ?? null,
      };
    });
  }, [rows, text]);

  const selectedFinding = useMemo(() => rows.find((finding) => finding.id === selectedFindingId) ?? null, [rows, selectedFindingId]);
  const selectedEngagement = useMemo(() => engagements.find((engagement) => engagement.key === selectedEngagementKey)
    ?? engagements.find((engagement) => engagement.findings.some((finding) => finding.id === selectedFindingId))
    ?? engagements[0] ?? null, [engagements, selectedEngagementKey, selectedFindingId]);
  const selectedContract = criteriaContracts.find((contract) => contract.audit_finding_id === selectedFindingId) ?? null;
  const selectedPatch24Gate = (closureGates.data ?? []).find((gate) => gate.audit_finding_id === selectedFindingId) ?? null;
  const closureEvaluation = selectedFinding ? evaluateUi4AuditClosureGate(selectedFinding, selectedContract, selectedPatch24Gate) : null;

  const filteredFindings = useMemo(() => rows.filter((finding) => {
    const query = search.trim().toLowerCase();
    return (!query || `${finding.finding_code ?? ''} ${finding.title} ${finding.audit_title ?? ''}`.toLowerCase().includes(query))
      && (statusFilter === 'all' || workflowLabel(finding) === statusFilter)
      && (severityFilter === 'all' || (finding.severity_level || finding.risk_level) === severityFilter);
  }), [rows, search, severityFilter, statusFilter]);

  const loadCriteria = useCallback(async () => {
    try { setCriteriaContracts(await getUi4AuditCriteriaContracts()); }
    catch (error) { setNotice(error instanceof Error ? error.message : text('Audit criteria contract is unavailable.', 'عقد معايير المراجعة غير متاح.')); }
  }, [text]);

  useEffect(() => { void loadCriteria(); }, [loadCriteria]);
  useEffect(() => {
    if (!selectedFindingId) { setDisputes([]); return; }
    void getUi4AuditCriteriaDisputes(selectedFindingId).then(setDisputes).catch((error) => setNotice(error instanceof Error ? error.message : text('Criteria disputes could not be loaded.', 'تعذر تحميل اعتراضات المعايير.')));
  }, [selectedFindingId, text]);

  async function refreshAudit() {
    await Promise.all([findings.refresh(), workflowQueue.refresh(), overdue.refresh(), closureGates.refresh(), events.refresh(), loadCriteria()]);
    if (selectedFindingId) setDisputes(await getUi4AuditCriteriaDisputes(selectedFindingId));
  }

  function openEngagement(engagement: AuditEngagement, target: AuditScreen = 'engagement') {
    setSelectedEngagementKey(engagement.key);
    if (!selectedFindingId || !engagement.findings.some((finding) => finding.id === selectedFindingId)) setSelectedFindingId(engagement.findings[0]?.id ?? null);
    setScreen(target);
  }

  function openFinding(finding: AuditFindingRow, target: AuditScreen = 'finding') {
    setSelectedFindingId(finding.id);
    setSelectedEngagementKey(finding.audit_title?.trim() || text('Unassigned audit engagement', 'مهمة مراجعة غير مسندة'));
    setScreen(target);
  }

  async function executeDecision(values: Record<string, unknown>) {
    if (!decision) return;
    setBusy(true);
    const findingId = decision.finding.id;
    try {
      if (decision.action === 'issue') await issueAuditFinding({ audit_finding_id: findingId, note: String(values.note || '') });
      if (decision.action === 'submit_response') await submitManagementResponse({ audit_finding_id: findingId, management_response: String(values.management_response || ''), note: String(values.note || '') });
      if (decision.action === 'accept_response') await acceptManagementResponse({ audit_finding_id: findingId, note: String(values.note || '') });
      if (decision.action === 'reject_response') await rejectManagementResponse({ audit_finding_id: findingId, rejection_reason: String(values.reason || ''), note: String(values.note || '') });
      if (decision.action === 'submit_action') await submitCorrectiveActionPlan({ audit_finding_id: findingId, corrective_action_plan: String(values.corrective_action_plan || ''), corrective_action_due_date: String(values.due_date || '') || undefined, note: String(values.note || '') });
      if (decision.action === 'accept_action') await acceptCorrectiveActionPlan({ audit_finding_id: findingId, note: String(values.note || '') });
      if (decision.action === 'reject_action') await rejectCorrectiveActionPlan({ audit_finding_id: findingId, rejection_reason: String(values.reason || ''), note: String(values.note || '') });
      if (decision.action === 'request_closure') await requestAuditFindingClosure({ audit_finding_id: findingId, note: String(values.note || '') });
      if (decision.action === 'validate_closure') await validateAuditFindingClosure({ audit_finding_id: findingId, note: String(values.note || '') });
      if (decision.action === 'reject_closure') await rejectAuditFindingClosure({ audit_finding_id: findingId, rejection_reason: String(values.reason || ''), note: String(values.note || '') });
      if (decision.action === 'generate_pack') await generateAuditClosurePackIndex({ audit_finding_id: findingId, closure_pack_reference: String(values.reference || '') || undefined, note: String(values.note || '') });
      if (decision.action === 'dispute') await recordUi4AuditCriteriaDispute({
        auditFindingId: findingId,
        disputeType: String(values.dispute_type || 'criterion_dispute') as Ui4AuditCriteriaDispute['dispute_type'],
        disputeStatement: String(values.dispute_statement || ''),
        proposedCorrection: String(values.proposed_correction || '') || null,
        evidenceReference: String(values.evidence_reference || '') || null,
      });
      if (decision.action === 'create_capa') await createUi4Capa({
        capa_title: String(values.capa_title || decision.finding.title),
        capa_description: String(values.capa_description || decision.finding.description),
        capa_type: 'corrective_action', source_type: 'audit_finding', source_id: findingId,
        source_reference: decision.finding.finding_code,
        severity_level: decision.finding.severity_level || decision.finding.risk_level,
        due_date: String(values.due_date || '') || null, evidence_required: true,
        validation_required: true, effectiveness_review_required: true,
      });
      setNotice(text('Governed Audit action recorded.', 'تم تسجيل إجراء المراجعة المحكوم.'));
      await refreshAudit();
    } finally { setBusy(false); }
  }

  const decisionFields = useMemo<DecisionFieldConfig[]>(() => {
    if (!decision) return [];
    if (decision.action === 'submit_response') return [
      { id: 'management_response', label: text('Management response', 'رد الإدارة'), type: 'textarea', required: true, autoFocus: true },
      { id: 'note', label: text('Supporting note', 'ملاحظة داعمة'), type: 'textarea' },
    ];
    if (decision.action === 'submit_action') return [
      { id: 'corrective_action_plan', label: text('Corrective action plan', 'خطة الإجراء التصحيحي'), type: 'textarea', required: true, autoFocus: true },
      { id: 'due_date', label: text('Target date', 'التاريخ المستهدف'), type: 'date' },
      { id: 'note', label: text('Supporting note', 'ملاحظة داعمة'), type: 'textarea' },
    ];
    if (['reject_response', 'reject_action', 'reject_closure'].includes(decision.action)) return [
      { id: 'reason', label: text('Required reason', 'السبب المطلوب'), type: 'textarea', required: true, autoFocus: true },
      { id: 'note', label: text('Reviewer note', 'ملاحظة المراجع'), type: 'textarea' },
    ];
    if (decision.action === 'generate_pack') return [
      { id: 'reference', label: text('Closure pack reference', 'مرجع حزمة الإغلاق'), type: 'text' },
      { id: 'note', label: text('Pack note', 'ملاحظة الحزمة'), type: 'textarea' },
    ];
    if (decision.action === 'dispute') return [
      { id: 'dispute_type', label: text('Dispute type', 'نوع الاعتراض'), type: 'select', defaultValue: 'criterion_dispute', options: ['criterion_dispute','scope_correction','version_correction','applicability_correction','evidence_response'].map((value) => ({ value, label: humanize(value, language) })) },
      { id: 'dispute_statement', label: text('Management statement', 'بيان الإدارة'), type: 'textarea', required: true, autoFocus: true },
      { id: 'proposed_correction', label: text('Proposed correction', 'التصحيح المقترح'), type: 'textarea' },
      { id: 'evidence_reference', label: text('Evidence reference', 'مرجع الدليل'), type: 'text' },
    ];
    if (decision.action === 'create_capa') return [
      { id: 'capa_title', label: text('CAPA title', 'عنوان الإجراء التصحيحي'), type: 'text', defaultValue: decision.finding.title, required: true },
      { id: 'capa_description', label: text('Problem statement', 'بيان المشكلة'), type: 'textarea', defaultValue: decision.finding.description, required: true },
      { id: 'due_date', label: text('Target date', 'التاريخ المستهدف'), type: 'date' },
    ];
    return [{ id: 'note', label: text('Decision rationale', 'مبرر القرار'), type: 'textarea', required: true, autoFocus: true }];
  }, [decision, language, text]);

  const severityCounts = ['critical', 'high', 'medium', 'low'].map((severity) => ({ severity, count: rows.filter((finding) => (finding.severity_level || finding.risk_level) === severity).length }));
  const maxSeverity = Math.max(1, ...severityCounts.map((item) => item.count));

  function AuditTable({ tableRows = filteredFindings }: { tableRows?: AuditFindingRow[] }) {
    return <div className="ui3-data-table ui4-audit-table"><div className="ui3-table-head"><span>{text('Finding', 'الملاحظة')}</span><span>{text('Engagement', 'المهمة')}</span><span>{text('Severity', 'الخطورة')}</span><span>{text('Owner', 'المالك')}</span><span>{text('Due date', 'الاستحقاق')}</span><span>{text('Status', 'الحالة')}</span><span /></div>{tableRows.map((finding) => <button type="button" className="ui3-table-row" key={finding.id} onClick={() => openFinding(finding)}><span><strong>{finding.finding_code || 'FINDING'}</strong><small>{finding.title}</small></span><span>{finding.audit_title || text('Unassigned', 'غير مسند')}</span><span><span className={`ui3-pill ui3-tone--${findingTone(finding.severity_level || finding.risk_level)}`}>{humanize(finding.severity_level || finding.risk_level)}</span></span><span>{ownerName(finding.owner)}</span><span>{formatDate(finding.due_date)}</span><span><StatusBadge status={humanize(workflowLabel(finding))} /></span><span><Eye size={15} /></span></button>)}</div>;
  }

  return (
    <section className="page-section ui3-module ui4-module" data-testid="ui4-audit">
      <ModuleHeader eyebrow={text('Audit management', 'إدارة المراجعة')} title={text('Audit', 'المراجعة')} subtitle={text('Plan engagements, determine exact governed criteria, issue findings, and validate evidence-backed closure.', 'تخطيط المهام وتحديد المعايير المحكومة الدقيقة وإصدار الملاحظات والتحقق من الإغلاق المدعوم بالأدلة.')} action={canManageWorkflow ? <button type="button" className="ui3-primary-button" onClick={() => setFormOpen(true)}><Plus size={16} />{text('New finding', 'ملاحظة جديدة')}</button> : null} />
      <nav className="ui4-workspace-tabs" aria-label={text('Audit workspace views', 'عروض مساحة عمل المراجعة')}>{auditScreens.map((item) => { const Icon = item.icon; const unavailable = ['engagement','planning','program','report'].includes(item.id) && !selectedEngagement; return <button type="button" key={item.id} className={screen === item.id ? 'active' : ''} disabled={unavailable || (item.id === 'finding' && !selectedFinding)} onClick={() => setScreen(item.id)}><Icon size={15} /><span>{item.label}</span></button>; })}</nav>
      {notice ? <div className="ui3-notice" role="status">{notice}</div> : null}

      {screen === 'dashboard' ? <div className="ui4-screen" data-testid="ui4-audit-dashboard">
        <div className="ui3-kpi-grid"><article><span>{text('Engagements', 'المهام')}</span><strong>{engagements.length}</strong><small>{text('Visible in scope', 'ظاهرة في النطاق')}</small></article><article className="ui3-tone--success"><span>{text('Completed', 'مكتملة')}</span><strong>{engagements.filter((item) => item.status === 'completed').length}</strong><small>{text('Audit engagements', 'مهام مراجعة')}</small></article><article className="ui3-tone--warning"><span>{text('Open findings', 'ملاحظات مفتوحة')}</span><strong>{rows.filter((finding) => workflowLabel(finding) !== 'closed').length}</strong><small>{text('Require follow-up', 'تتطلب متابعة')}</small></article><article className="ui3-tone--danger"><span>{text('Overdue', 'متأخرة')}</span><strong>{overdue.data?.length || 0}</strong><small>{text('Outside target date', 'تجاوزت التاريخ المستهدف')}</small></article><article><span>{text('Closure blocked', 'الإغلاق محظور')}</span><strong>{(closureGates.data ?? []).filter((gate) => !gate.can_close).length}</strong><small>{text('Governed gates', 'بوابات محكومة')}</small></article></div>
        <div className="ui3-dashboard-grid"><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Audit status', 'حالة المراجعة')}</span><h2>{text('Engagement portfolio', 'محفظة المهام')}</h2></div><BarChart3 size={20} /></div><div className="ui4-donut-layout"><div className="ui4-donut" style={{ '--ui4-progress': `${engagements.length ? (engagements.filter((item) => item.status === 'completed').length / engagements.length) * 360 : 0}deg` } as CSSProperties}><strong>{engagements.length}</strong><span>{text('Audits', 'مراجعات')}</span></div><div className="ui4-legend"><span><i className="is-success" />{text('Completed', 'مكتملة')} <b>{engagements.filter((item) => item.status === 'completed').length}</b></span><span><i className="is-warning" />{text('In progress', 'قيد التنفيذ')} <b>{engagements.filter((item) => item.status === 'in_progress').length}</b></span><span><i />{text('Planned', 'مخططة')} <b>{engagements.filter((item) => item.status === 'planned').length}</b></span></div></div></section><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Finding summary', 'ملخص الملاحظات')}</span><h2>{text('Severity distribution', 'توزيع الخطورة')}</h2></div><Flag size={20} /></div><div className="ui4-mini-bars">{severityCounts.map((item) => <MiniBar key={item.severity} label={humanize(item.severity, language)} value={item.count} max={maxSeverity} tone={findingTone(item.severity)} />)}</div></section><section className="ui3-surface ui3-span-all"><div className="ui3-section-heading"><div><span>{text('Upcoming engagements', 'المهام القادمة')}</span><h2>{text('Audit portfolio', 'محفظة المراجعة')}</h2></div><CalendarDays size={20} /></div><div className="ui3-priority-grid">{engagements.slice(0, 6).map((engagement) => <button type="button" key={engagement.key} onClick={() => openEngagement(engagement)}><span className={`ui3-score-dot ui3-tone--${engagement.status === 'completed' ? 'success' : engagement.status === 'in_progress' ? 'warning' : 'neutral'}`}>{engagement.findings.length}</span><span><strong>{engagement.title}</strong><small>{formatDate(engagement.startDate)} · {formatDate(engagement.endDate)}</small></span><Eye size={16} /></button>)}</div></section></div>
      </div> : null}

      {screen === 'register' ? <div className="ui4-screen" data-testid="ui4-audit-register"><section className="ui3-filter-bar"><label className="ui3-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text('Search engagements', 'بحث المهام')} /></label><span>{engagements.length} {text('engagements', 'مهام')}</span></section><section className="ui3-surface ui3-register-surface"><div className="ui3-data-table ui4-engagement-table"><div className="ui3-table-head"><span>{text('Engagement', 'المهمة')}</span><span>{text('Type', 'النوع')}</span><span>{text('Findings', 'الملاحظات')}</span><span>{text('Start', 'البداية')}</span><span>{text('End', 'النهاية')}</span><span>{text('Status', 'الحالة')}</span><span /></div>{engagements.filter((engagement) => !search.trim() || engagement.title.toLowerCase().includes(search.trim().toLowerCase())).map((engagement) => <button type="button" className="ui3-table-row" key={engagement.key} onClick={() => openEngagement(engagement)}><span><strong>{engagement.title}</strong><small>{engagement.findings[0]?.finding_code || text('Audit engagement', 'مهمة مراجعة')}</small></span><span>{text('Internal audit', 'مراجعة داخلية')}</span><span>{engagement.findings.length}</span><span>{formatDate(engagement.startDate)}</span><span>{formatDate(engagement.endDate)}</span><span><StatusBadge status={humanize(engagement.status)} /></span><span><Eye size={15} /></span></button>)}</div>{!engagements.length && !findings.loading ? <EmptyAudit title={text('No audit engagements', 'لا توجد مهام مراجعة')} /> : null}</section></div> : null}

      {screen === 'engagement' && selectedEngagement ? <div className="ui4-screen" data-testid="ui4-audit-engagement"><button type="button" className="ui3-back-button" onClick={() => setScreen('register')}><ArrowLeft size={16} />{text('Audit register', 'سجل المراجعة')}</button><header className="ui3-record-header"><div><span className="ui3-eyebrow">{selectedEngagement.findings[0]?.finding_code || text('Engagement', 'مهمة')}</span><h1>{selectedEngagement.title}</h1><p>{text('Internal audit engagement governed by exact-version criteria and independent finding review.', 'مهمة مراجعة داخلية محكومة بمعايير إصدار دقيقة ومراجعة مستقلة للملاحظات.')}</p><div className="ui3-record-tags"><StatusBadge status={humanize(selectedEngagement.status)} /><span>{selectedEngagement.findings.length} {text('findings', 'ملاحظات')}</span></div></div></header><div className="ui3-detail-layout"><main className="ui3-stack"><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Engagement information', 'معلومات المهمة')}</span><h2>{text('Scope and accountability', 'النطاق والمساءلة')}</h2></div><ClipboardCheck size={20} /></div><div className="ui3-data-grid"><div><span>{text('Start date', 'تاريخ البداية')}</span><strong>{formatDate(selectedEngagement.startDate)}</strong></div><div><span>{text('End date', 'تاريخ النهاية')}</span><strong>{formatDate(selectedEngagement.endDate)}</strong></div><div><span>{text('Audit manager', 'مدير المراجعة')}</span><strong>{ownerName(selectedEngagement.findings[0]?.owner)}</strong></div><div><span>{text('Progress', 'التقدم')}</span><strong>{Math.round((selectedEngagement.findings.filter((finding) => workflowLabel(finding) === 'closed').length / Math.max(1, selectedEngagement.findings.length)) * 100)}%</strong></div></div></section><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Description', 'الوصف')}</span><h2>{text('Audit objective', 'هدف المراجعة')}</h2></div><Target size={20} /></div><p className="ui3-supporting-copy">{text('Assess control design and operating effectiveness, determine applicable governed criteria at the audit period end, and retain traceable findings.', 'تقييم تصميم الضوابط وفعاليتها التشغيلية وتحديد المعايير المحكومة المنطبقة في نهاية فترة المراجعة والاحتفاظ بملاحظات قابلة للتتبع.')}</p></section></main><aside className="ui3-stack"><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Finding profile', 'ملف الملاحظات')}</span><h2>{text('Engagement summary', 'ملخص المهمة')}</h2></div><Flag size={20} /></div><div className="ui3-stat-list"><div><span>{text('Formal findings', 'ملاحظات رسمية')}</span><strong>{selectedEngagement.findings.filter((finding) => finding.finding_classification !== 'advisory_observation').length}</strong></div><div><span>{text('Advisory observations', 'ملاحظات استشارية')}</span><strong>{selectedEngagement.findings.filter((finding) => finding.finding_classification === 'advisory_observation').length}</strong></div><div><span>{text('Open', 'مفتوحة')}</span><strong>{selectedEngagement.findings.filter((finding) => workflowLabel(finding) !== 'closed').length}</strong></div></div></section></aside></div></div> : null}

      {screen === 'planning' && selectedEngagement ? <div className="ui4-screen" data-testid="ui4-audit-planning"><header className="ui3-record-header ui4-compact-record"><div><span className="ui3-eyebrow">{text('Plan', 'الخطة')}</span><h1>{selectedEngagement.title}</h1><p>{text('Scope, objectives, and governing criteria for the engagement.', 'نطاق المهمة وأهدافها ومعاييرها الحاكمة.')}</p></div></header><div className="ui4-stepper"><span className="active">1<small>{text('Plan', 'الخطة')}</small></span><span className="active">2<small>{text('Scope', 'النطاق')}</small></span><span>3<small>{text('Resources', 'الموارد')}</small></span><span>4<small>{text('Timeline', 'الجدول')}</small></span><span>5<small>{text('Review', 'المراجعة')}</small></span></div><div className="ui3-stack"><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('In scope', 'ضمن النطاق')}</span><h2>{text('Scope', 'النطاق')}</h2></div><Target size={20} /></div><div className="ui4-two-column-list"><ul>{[...new Set(selectedEngagement.findings.map((finding) => departmentName(finding.departments)).filter((value) => value !== '-'))].map((value) => <li key={value}>{value}</li>)}</ul><ul><li>{text('Control design', 'تصميم الضوابط')}</li><li>{text('Operating effectiveness', 'الفعالية التشغيلية')}</li><li>{text('Governed evidence', 'الأدلة المحكومة')}</li></ul></div></section><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Objectives', 'الأهداف')}</span><h2>{text('Assurance objectives', 'أهداف التأكيد')}</h2></div><CheckCircle2 size={20} /></div><ul className="ui4-check-list"><li>{text('Evaluate design and operating effectiveness of controls.', 'تقييم تصميم الضوابط وفعاليتها التشغيلية.')}</li><li>{text('Determine exact applicable Policy and SOP versions.', 'تحديد إصدارات السياسة والإجراء المنطبقة بدقة.')}</li><li>{text('Identify control gaps and improvement opportunities.', 'تحديد فجوات الضوابط وفرص التحسين.')}</li></ul></section><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Criteria', 'المعايير')}</span><h2>{text('Governance resolution', 'حل الحوكمة')}</h2></div><Link2 size={20} /></div><p className="ui3-supporting-copy">{text('Each formal finding resolves Policy/SOP versions at audit-period end, then finding date. The auditor owns the determination.', 'تحل كل ملاحظة رسمية إصدارات السياسة والإجراء عند نهاية فترة المراجعة ثم تاريخ الملاحظة. يملك المراجع التحديد.')}</p></section></div></div> : null}

      {screen === 'program' && selectedEngagement ? <div className="ui4-screen" data-testid="ui4-audit-program"><header className="ui3-record-header ui4-compact-record"><div><span className="ui3-eyebrow">{text('Audit program', 'برنامج المراجعة')}</span><h1>{selectedEngagement.title}</h1><p>{text('Procedures derived from the live engagement findings and governed criteria.', 'إجراءات مشتقة من ملاحظات المهمة الفعلية والمعايير المحكومة.')}</p></div></header><section className="ui3-filter-bar"><label className="ui3-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text('Search procedures', 'بحث الإجراءات')} /></label><span>{selectedEngagement.findings.length} {text('procedures', 'إجراءات')}</span></section><section className="ui3-surface ui3-register-surface"><div className="ui3-data-table ui4-program-table"><div className="ui3-table-head"><span>#</span><span>{text('Procedure', 'الإجراء')}</span><span>{text('Type', 'النوع')}</span><span>{text('Assignee', 'المسند إليه')}</span><span>{text('Status', 'الحالة')}</span></div>{selectedEngagement.findings.filter((finding) => !search.trim() || finding.title.toLowerCase().includes(search.trim().toLowerCase())).map((finding, index) => <button type="button" className="ui3-table-row" key={finding.id} onClick={() => openFinding(finding)}><span>{index + 1}</span><span><strong>{finding.title}</strong><small>{finding.criteria || text('Control and evidence verification', 'التحقق من الضوابط والأدلة')}</small></span><span>{text('Test', 'اختبار')}</span><span>{ownerName(finding.owner)}</span><span><StatusBadge status={humanize(workflowLabel(finding))} /></span></button>)}</div></section></div> : null}

      {screen === 'findings' ? <div className="ui4-screen" data-testid="ui4-audit-findings"><div className="ui3-kpi-grid"><article><span>{text('Total findings', 'إجمالي الملاحظات')}</span><strong>{rows.length}</strong></article>{severityCounts.map((item) => <article className={`ui3-tone--${findingTone(item.severity)}`} key={item.severity}><span>{humanize(item.severity, language)}</span><strong>{item.count}</strong></article>)}</div><section className="ui3-filter-bar"><label className="ui3-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text('Search findings', 'بحث الملاحظات')} /></label><select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}><option value="all">{text('All severities', 'كل درجات الخطورة')}</option>{['critical','high','medium','low'].map((value) => <option value={value} key={value}>{humanize(value, language)}</option>)}</select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">{text('All statuses', 'كل الحالات')}</option>{[...new Set(rows.map(workflowLabel))].map((value) => <option value={value} key={value}>{humanize(value, language)}</option>)}</select><span>{filteredFindings.length} {text('records', 'سجلات')}</span></section><section className="ui3-surface ui3-register-surface"><AuditTable />{!filteredFindings.length && !findings.loading ? <EmptyAudit title={text('No findings match the filters', 'لا توجد ملاحظات تطابق عوامل التصفية')} /> : null}</section></div> : null}

      {screen === 'finding' && selectedFinding ? <div className="ui4-screen" data-testid="ui4-audit-finding-detail"><button type="button" className="ui3-back-button" onClick={() => setScreen('findings')}><ArrowLeft size={16} />{text('Findings', 'الملاحظات')}</button><header className="ui3-record-header"><div><span className="ui3-eyebrow">{selectedFinding.finding_code || text('Finding', 'ملاحظة')}</span><h1>{selectedFinding.title}</h1><p>{selectedFinding.description}</p><div className="ui3-record-tags"><span className={`ui3-pill ui3-tone--${findingTone(selectedFinding.severity_level || selectedFinding.risk_level)}`}>{humanize(selectedFinding.severity_level || selectedFinding.risk_level, language)}</span><StatusBadge status={humanize(workflowLabel(selectedFinding))} /><span>{humanize(selectedFinding.finding_classification || 'formal_finding', language)}</span></div></div><div className="ui3-header-actions">{canManagementRespond ? <button type="button" className="ui3-secondary-button" onClick={() => setDecision({ action: 'dispute', finding: selectedFinding })}><MessageSquareWarning size={15} />{text('Record dispute', 'تسجيل اعتراض')}</button> : null}{canManageWorkflow ? <button type="button" className="ui3-primary-button" onClick={() => setDecision({ action: 'create_capa', finding: selectedFinding })}><Plus size={15} />{text('Create CAPA', 'إنشاء إجراء تصحيحي')}</button> : null}</div></header><section className="ui4-action-strip" aria-label={text('Audit workflow actions', 'إجراءات سير عمل المراجعة')}>{workflowLabel(selectedFinding) === 'draft' && isIndependentReviewer ? <button type="button" onClick={() => setDecision({ action: 'issue', finding: selectedFinding })}><Send size={14} />{text('Issue finding', 'إصدار الملاحظة')}</button> : null}{canManagementRespond ? <button type="button" onClick={() => setDecision({ action: 'submit_response', finding: selectedFinding })}>{text('Submit response', 'إرسال الرد')}</button> : null}{isIndependentReviewer ? <><button type="button" onClick={() => setDecision({ action: 'accept_response', finding: selectedFinding })}>{text('Accept response', 'قبول الرد')}</button><button type="button" onClick={() => setDecision({ action: 'reject_response', finding: selectedFinding })}>{text('Return response', 'إعادة الرد')}</button></> : null}{canManagementRespond ? <button type="button" onClick={() => setDecision({ action: 'submit_action', finding: selectedFinding })}>{text('Submit action plan', 'إرسال خطة الإجراء')}</button> : null}{isIndependentReviewer ? <><button type="button" onClick={() => setDecision({ action: 'accept_action', finding: selectedFinding })}>{text('Accept action plan', 'قبول خطة الإجراء')}</button><button type="button" disabled={!closureEvaluation?.passed} title={closureEvaluation?.blockers.join(' ')} onClick={() => setDecision({ action: 'validate_closure', finding: selectedFinding })}>{text('Validate closure', 'التحقق من الإغلاق')}</button></> : null}<button type="button" onClick={() => setDecision({ action: 'generate_pack', finding: selectedFinding })}>{text('Closure pack', 'حزمة الإغلاق')}</button></section><div className="ui3-detail-layout"><main className="ui3-stack"><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Finding details', 'تفاصيل الملاحظة')}</span><h2>{text('Condition, cause, effect', 'الحالة والسبب والأثر')}</h2></div><FileCheck2 size={20} /></div><div className="ui4-finding-narrative"><div><span>{text('Observed condition', 'الحالة الملحوظة')}</span><p>{selectedFinding.observed_condition || selectedFinding.description}</p></div><div><span>{text('Criteria', 'المعايير')}</span><p>{selectedFinding.criteria || text('Governance criteria are determined independently in the linkage workspace below.', 'يتم تحديد معايير الحوكمة بشكل مستقل في مساحة الربط أدناه.')}</p></div><div><span>{text('Root cause', 'السبب الجذري')}</span><p>{selectedFinding.root_cause_summary || selectedFinding.root_cause || text('Not yet recorded.', 'لم يسجل بعد.')}</p></div><div><span>{text('Effect / impact', 'الأثر')}</span><p>{selectedFinding.effect_impact || text('Not yet recorded.', 'لم يسجل بعد.')}</p></div><div><span>{text('Recommendation', 'التوصية')}</span><p>{selectedFinding.recommendation || text('Management action is tracked through the governed response lifecycle.', 'يتم تتبع إجراء الإدارة من خلال دورة حياة الاستجابة المحكومة.')}</p></div></div></section><GovernanceCriteriaLinkage source={{ type: 'audit_finding', id: selectedFinding.id, organizationId: selectedFinding.organization_id || organizationId, sourceDate: selectedContract?.criteria_resolution_date || selectedFinding.audit_period_end_date || selectedFinding.finding_date || null, departmentId: selectedFinding.responsible_department_id || selectedFinding.department_id }} mode="audit" title={text('Exact governed criteria', 'المعايير المحكومة الدقيقة')} canSuggest={isIndependentReviewer} canReview={isIndependentReviewer} onLinksChange={() => void loadCriteria()} /><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Management disputes', 'اعتراضات الإدارة')}</span><h2>{text('Append-only response trail', 'مسار استجابة غير قابل للتعديل')}</h2></div><MessageSquareWarning size={20} /></div>{disputes.length ? <ol className="ui3-timeline">{disputes.map((dispute) => <li key={dispute.id}><span /><div><strong>{humanize(dispute.dispute_type, language)}</strong><p>{dispute.dispute_statement}</p><small>{formatDate(dispute.created_at)}{dispute.proposed_correction ? ` · ${dispute.proposed_correction}` : ''}</small></div></li>)}</ol> : <EmptyAudit title={text('No management disputes recorded', 'لا توجد اعتراضات إدارية مسجلة')} detail={text('Disputes do not overwrite the auditor determination.', 'لا تستبدل الاعتراضات تحديد المراجع.')} />}</section></main><aside className="ui3-stack"><section className={`ui3-surface ui3-gate-summary ${closureEvaluation?.passed ? '' : 'ui3-gate-summary--blocked'}`}>{closureEvaluation?.passed ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}<div><strong>{closureEvaluation?.passed ? text('Closure criteria satisfied', 'تم استيفاء معايير الإغلاق') : text('Closure blocked', 'الإغلاق محظور')}</strong><p>{closureEvaluation?.criterionException ? text('Advisory observation criterion exception applies.', 'ينطبق استثناء معيار الملاحظة الاستشارية.') : closureEvaluation?.blockers.join(' ') || text('Gate evidence is loading.', 'جار تحميل أدلة البوابة.')}</p></div></section><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Accountability', 'المساءلة')}</span><h2>{text('Response ownership', 'ملكية الاستجابة')}</h2></div><Target size={20} /></div><div className="ui3-stat-list"><div><span>{text('Department', 'الإدارة')}</span><strong>{departmentName(selectedFinding.departments)}</strong></div><div><span>{text('Owner', 'المالك')}</span><strong>{ownerName(selectedFinding.owner)}</strong></div><div><span>{text('Due date', 'الاستحقاق')}</span><strong>{formatDate(selectedFinding.due_date)}</strong></div><div><span>{text('Criteria date', 'تاريخ المعايير')}</span><strong>{formatDate(selectedContract?.criteria_resolution_date)}</strong></div></div></section></aside></div></div> : null}

      {screen === 'report' && selectedEngagement ? <div className="ui4-screen" data-testid="ui4-audit-report"><header className="ui3-record-header ui4-compact-record"><div><span className="ui3-eyebrow">{text('Internal audit report', 'تقرير المراجعة الداخلية')}</span><h1>{selectedEngagement.title}</h1><p>{text('Evidence-backed conclusions drawn from the live engagement register.', 'استنتاجات مدعومة بالأدلة مستمدة من سجل المهمة الفعلي.')}</p></div></header><div className="ui3-detail-layout"><main className="ui3-stack"><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Overall conclusion', 'الاستنتاج العام')}</span><h2>{text('Control environment', 'بيئة الضوابط')}</h2></div><ClipboardCheck size={20} /></div><p className="ui3-supporting-copy">{selectedEngagement.findings.some((finding) => ['critical','high'].includes(finding.severity_level || finding.risk_level)) ? text('Material control weaknesses require prioritized management action and independent follow-up.', 'تتطلب نقاط الضعف الجوهرية في الضوابط إجراء إدارياً ذا أولوية ومتابعة مستقلة.') : text('No high-severity control weakness is visible in the current engagement scope.', 'لا تظهر نقاط ضعف عالية الخطورة في نطاق المهمة الحالي.')}</p></section><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Findings', 'الملاحظات')}</span><h2>{text('Report index', 'فهرس التقرير')}</h2></div><FileText size={20} /></div><AuditTable tableRows={selectedEngagement.findings} /></section></main><aside className="ui3-stack"><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Key metrics', 'المؤشرات الرئيسية')}</span><h2>{text('Report summary', 'ملخص التقرير')}</h2></div><BarChart3 size={20} /></div><div className="ui3-stat-list">{severityCounts.map((item) => <div key={item.severity}><span>{humanize(item.severity, language)}</span><strong>{selectedEngagement.findings.filter((finding) => (finding.severity_level || finding.risk_level) === item.severity).length}</strong></div>)}</div></section></aside></div></div> : null}

      {screen === 'followup' ? <div className="ui4-screen" data-testid="ui4-audit-followup"><div className="ui3-kpi-grid"><article><span>{text('Total actions', 'إجمالي الإجراءات')}</span><strong>{workflowQueue.data?.length || rows.length}</strong></article><article className="ui3-tone--danger"><span>{text('Overdue', 'متأخرة')}</span><strong>{overdue.data?.length || 0}</strong></article><article className="ui3-tone--warning"><span>{text('In progress', 'قيد التنفيذ')}</span><strong>{rows.filter((finding) => ['action_plan_in_progress','evidence_required','closure_requested'].includes(workflowLabel(finding))).length}</strong></article><article className="ui3-tone--success"><span>{text('Closed', 'مغلقة')}</span><strong>{rows.filter((finding) => workflowLabel(finding) === 'closed').length}</strong></article></div><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Follow-up queue', 'قائمة المتابعة')}</span><h2>{text('Management response and action tracking', 'تتبع استجابة الإدارة والإجراءات')}</h2></div><Clock3 size={20} /></div><div className="ui3-data-table ui4-followup-table"><div className="ui3-table-head"><span>{text('Finding', 'الملاحظة')}</span><span>{text('Response', 'الاستجابة')}</span><span>{text('Action plan', 'خطة الإجراء')}</span><span>{text('Due date', 'الاستحقاق')}</span><span>{text('Closure', 'الإغلاق')}</span><span /></div>{rows.map((finding) => <button type="button" className="ui3-table-row" key={finding.id} onClick={() => openFinding(finding)}><span><strong>{finding.finding_code || 'FINDING'}</strong><small>{finding.title}</small></span><span><StatusBadge status={humanize(finding.management_response_status || 'required')} /></span><span><StatusBadge status={humanize(finding.corrective_action_status || 'required')} /></span><span>{formatDate(finding.corrective_action_due_date || finding.due_date)}</span><span><StatusBadge status={humanize(finding.closure_validation_status || 'not requested')} /></span><span><Eye size={15} /></span></button>)}</div></section></div> : null}

      {screen === 'review' ? <div className="ui4-screen" data-testid="ui4-audit-review"><header className="ui3-record-header ui4-compact-record"><div><span className="ui3-eyebrow">{text('Submit for review', 'إرسال للمراجعة')}</span><h1>{selectedEngagement?.title || text('Audit review queue', 'قائمة مراجعة التدقيق')}</h1><p>{text('Independent review confirms criteria, response, action evidence, and closure gates.', 'تؤكد المراجعة المستقلة المعايير والاستجابة وأدلة الإجراءات وبوابات الإغلاق.')}</p></div></header><div className="ui4-stepper"><span className="active">1<small>{text('Prepare', 'إعداد')}</small></span><span className="active">2<small>{text('Submit', 'إرسال')}</small></span><span>3<small>{text('Review', 'مراجعة')}</small></span><span>4<small>{text('Approve', 'اعتماد')}</small></span></div><div className="ui3-detail-layout"><main className="ui3-stack"><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Review readiness', 'جاهزية المراجعة')}</span><h2>{text('Governed approval checks', 'فحوصات الاعتماد المحكومة')}</h2></div><ShieldCheck size={20} /></div><ul className="ui4-check-list"><li>{criteriaContracts.filter((contract) => contract.criterion_gate_satisfied).length} / {rows.length} {text('findings satisfy the criterion gate', 'ملاحظات تستوفي بوابة المعايير')}</li><li>{(closureGates.data ?? []).filter((gate) => gate.can_close).length} / {rows.length} {text('findings satisfy Patch 24 closure', 'ملاحظات تستوفي إغلاق Patch 24')}</li><li>{disputes.length} {text('append-only management disputes on the selected finding', 'اعتراضات إدارية غير قابلة للتعديل على الملاحظة المحددة')}</li></ul></section><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Reviewers', 'المراجعون')}</span><h2>{text('Independent approval path', 'مسار اعتماد مستقل')}</h2></div><ClipboardCheck size={20} /></div><div className="ui3-record-list ui3-record-list--static"><div><span><strong>{text('Audit manager', 'مدير المراجعة')}</strong><small>{text('Primary reviewer', 'المراجع الرئيسي')}</small></span><StatusBadge status={text('Pending', 'قيد الانتظار')} /></div><div><span><strong>{text('Governance reviewer', 'مراجع الحوكمة')}</strong><small>{text('Criteria and closure', 'المعايير والإغلاق')}</small></span><StatusBadge status={text('Pending', 'قيد الانتظار')} /></div></div></section></main><aside className="ui3-stack"><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Selected finding', 'الملاحظة المحددة')}</span><h2>{selectedFinding?.finding_code || text('None', 'لا يوجد')}</h2></div><Flag size={20} /></div>{selectedFinding ? <div className="ui3-form-actions"><button type="button" className="ui3-secondary-button" onClick={() => setDecision({ action: 'request_closure', finding: selectedFinding })}>{text('Request closure', 'طلب الإغلاق')}</button>{isIndependentReviewer ? <button type="button" className="ui3-primary-button" disabled={!closureEvaluation?.passed} onClick={() => setDecision({ action: 'validate_closure', finding: selectedFinding })}>{text('Approve closure', 'اعتماد الإغلاق')}</button> : null}</div> : <EmptyAudit title={text('Select a finding first', 'اختر ملاحظة أولاً')} />}</section></aside></div></div> : null}

      <Modal open={formOpen} title={t('audit.create', 'Create audit finding')} onClose={() => setFormOpen(false)} isDirty={formDirty} isSubmitting={formSubmitting} size="large"><AuditFindingForm organizationId={organizationId} departments={departments.data ?? []} profiles={profiles.data ?? []} onDirtyChange={setFormDirty} onSubmittingChange={setFormSubmitting} onCancel={() => setFormOpen(false)} onCreated={() => { setFormOpen(false); void refreshAudit(); }} /></Modal>
      <GovernedDecisionDialog open={Boolean(decision)} title={decision ? humanize(decision.action, language) : ''} subtitle={decision ? `${decision.finding.finding_code || 'FINDING'} · ${decision.finding.title}` : undefined} decisionVariant={decision?.action.startsWith('reject') ? 'reject' : decision?.action.includes('accept') || decision?.action === 'validate_closure' ? 'approve' : decision?.action === 'dispute' ? 'warning' : 'action'} fields={decisionFields} isSubmitting={busy} warningNotice={decision?.action === 'validate_closure' && closureEvaluation && !closureEvaluation.passed ? closureEvaluation.blockers.join(' ') : null} submitDisabled={decision?.action === 'validate_closure' && !closureEvaluation?.passed} onClose={() => setDecision(null)} onSubmit={executeDecision} />
    </section>
  );
}
