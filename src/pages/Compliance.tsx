import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FileSearch,
  Gavel,
  LayoutDashboard,
  List,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { GovernanceCriteriaLinkage } from '../components/governance/GovernanceCriteriaLinkage';
import { Modal } from '../components/Modal';
import { ModuleHeader } from '../components/ModuleHeader';
import { StatusBadge } from '../components/StatusBadge';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import { formatDate, humanize } from '../lib/format';
import { getDepartments, getOrganizations, getProfiles } from '../lib/grcApi';
import type { GovernanceLinkageReview } from '../lib/governanceCriteriaLinkageApi';
import {
  createUi3ComplianceAssessment,
  createUi3ComplianceObligation,
  createUi3ComplianceRemediation,
  decideUi3ComplianceAssessment,
  getUi3ComplianceAssessments,
  getUi3ComplianceEvents,
  getUi3ComplianceFindings,
  getUi3ComplianceObligations,
  getUi3ComplianceRemediations,
  recordUi3ComplianceFinding,
  submitUi3ComplianceAssessment,
  updateUi3ComplianceRemediation,
  type Ui3ComplianceAssessment,
  type Ui3ComplianceEvent,
  type Ui3ComplianceFinding,
  type Ui3ComplianceObligation,
  type Ui3ComplianceRemediation,
} from '../lib/ui3RiskComplianceApi';
import { isCompletedGovernanceReview, isFindingAllowed, resultTone } from '../lib/ui3RiskComplianceModel';

type ComplianceView = 'register' | 'dashboard';
type ComplianceTab = 'overview' | 'assessments' | 'findings' | 'remediation' | 'governance' | 'activity';
type ComplianceDialog = 'obligation' | 'assessment' | 'finding' | 'remediation' | null;

const tabs: Array<{ id: ComplianceTab; en: string; ar: string }> = [
  { id: 'overview', en: 'Overview', ar: 'نظرة عامة' },
  { id: 'assessments', en: 'Assessments', ar: 'التقييمات' },
  { id: 'findings', en: 'Findings', ar: 'النتائج' },
  { id: 'remediation', en: 'Remediation', ar: 'المعالجة' },
  { id: 'governance', en: 'Obligation and Internal Governance Basis', ar: 'الالتزام وأساس الحوكمة الداخلية' },
  { id: 'activity', en: 'Activity', ar: 'النشاط' },
];

function EmptyState({ label }: { label: string }) {
  return <div className="ui3-empty-state"><ShieldCheck size={24} /><strong>{label}</strong></div>;
}

function complianceTone(value: string) {
  if (['critical', 'noncompliant', 'overdue'].includes(value)) return 'danger';
  if (['high', 'partial_compliance', 'insufficient_evidence', 'in_review'].includes(value)) return 'warning';
  if (['compliant', 'approved', 'completed', 'verified'].includes(value)) return 'success';
  return 'neutral';
}

function finiteCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) ? count : 0;
}

export function Compliance() {
  const auth = useAuth();
  const { language, t } = useI18n();
  const text = useCallback((en: string, ar: string) => language === 'ar' ? ar : en, [language]);
  const [view, setView] = useState<ComplianceView>('register');
  const [tab, setTab] = useState<ComplianceTab>('overview');
  const [dialog, setDialog] = useState<ComplianceDialog>(null);
  const [selected, setSelected] = useState<Ui3ComplianceObligation | null>(null);
  const [selectedAssessment, setSelectedAssessment] = useState<Ui3ComplianceAssessment | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<Ui3ComplianceFinding | null>(null);
  const [assessments, setAssessments] = useState<Ui3ComplianceAssessment[]>([]);
  const [findings, setFindings] = useState<Ui3ComplianceFinding[]>([]);
  const [remediations, setRemediations] = useState<Ui3ComplianceRemediation[]>([]);
  const [events, setEvents] = useState<Ui3ComplianceEvent[]>([]);
  const [governanceReview, setGovernanceReview] = useState<GovernanceLinkageReview | null>(null);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [bodyFilter, setBodyFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const obligationData = useAsyncData(getUi3ComplianceObligations, []);
  const departments = useAsyncData(getDepartments, []);
  const profiles = useAsyncData(getProfiles, []);
  const organizations = useAsyncData(getOrganizations, []);
  const organizationId = organizations.data?.[0]?.id ?? '';
  const canManage = auth.roles.some((role) => [
    'super_admin', 'governance_admin', 'compliance_officer', 'department_manager', 'auditor',
  ].includes(role.role));
  const canApprove = auth.roles.some((role) => ['super_admin', 'governance_admin', 'compliance_officer'].includes(role.role));
  const rows = obligationData.data ?? [];
  const bodies = useMemo(() => [...new Set(rows.map((item) => item.regulatory_body).filter((value): value is string => Boolean(value)))].sort(), [rows]);
  const filteredRows = useMemo(() => rows.filter((item) => {
    const query = search.trim().toLowerCase();
    return (!query || `${item.obligation_code ?? ''} ${item.title} ${item.requirement_text} ${item.regulatory_body ?? ''}`.toLowerCase().includes(query))
      && (riskFilter === 'all' || item.risk_level === riskFilter)
      && (statusFilter === 'all' || item.status === statusFilter)
      && (bodyFilter === 'all' || item.regulatory_body === bodyFilter);
  }), [bodyFilter, riskFilter, rows, search, statusFilter]);

  const closeDialog = useCallback(() => {
    setFormDirty(false);
    setDialog(null);
  }, []);

  const loadDetail = useCallback(async (obligation: Ui3ComplianceObligation) => {
    try {
      const [assessmentRows, findingRows, remediationRows] = await Promise.all([
        getUi3ComplianceAssessments(obligation.id),
        getUi3ComplianceFindings(obligation.id),
        getUi3ComplianceRemediations(),
      ]);
      const findingIds = new Set(findingRows.map((item) => item.id));
      setAssessments(assessmentRows);
      setFindings(findingRows);
      setRemediations(remediationRows.filter((item) => findingIds.has(item.finding_id)));
      setSelectedAssessment((current) => current && assessmentRows.some((item) => item.id === current.id) ? current : assessmentRows[0] ?? null);
      setSelectedFinding((current) => current && findingRows.some((item) => item.id === current.id) ? current : findingRows[0] ?? null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : text('Compliance detail could not be loaded.', 'تعذر تحميل تفاصيل الامتثال.'));
    }
  }, [text]);

  useEffect(() => {
    if (selected) void loadDetail(selected);
  }, [loadDetail, selected]);

  useEffect(() => {
    if (!selectedAssessment) {
      setEvents([]);
      return;
    }
    getUi3ComplianceEvents(selectedAssessment.id).then(setEvents).catch((error) => setNotice(error instanceof Error ? error.message : String(error)));
  }, [selectedAssessment]);

  function openObligation(obligation: Ui3ComplianceObligation, nextTab: ComplianceTab = 'overview') {
    setSelected(obligation);
    setSelectedAssessment(null);
    setSelectedFinding(null);
    setGovernanceReview(null);
    setTab(nextTab);
    setNotice(null);
  }

  async function refreshDetail() {
    await obligationData.refresh();
    if (selected) await loadDetail(selected);
  }

  async function saveObligation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await createUi3ComplianceObligation({
        obligation_code: String(form.get('obligation_code') ?? ''),
        title: String(form.get('title') ?? '').trim(),
        requirement_text: String(form.get('requirement_text') ?? '').trim(),
        regulatory_body: String(form.get('regulatory_body') ?? '').trim(),
        framework: String(form.get('framework') ?? '').trim(),
        clause_reference: String(form.get('clause_reference') ?? '').trim(),
        risk_level: String(form.get('risk_level') ?? 'medium'),
        applicability: String(form.get('applicability') ?? 'applicable'),
        review_frequency: String(form.get('review_frequency') ?? 'annual').replace('semiannual', 'semi_annual'),
        next_review_date: String(form.get('next_review_date') ?? ''),
        department_id: String(form.get('department_id') ?? ''),
        owner_id: String(form.get('owner_id') ?? ''),
        evidence_required: form.get('evidence_required') === 'on',
      });
      closeDialog();
      setNotice(text('Compliance obligation created.', 'تم إنشاء التزام الامتثال.'));
      await obligationData.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : text('Obligation creation failed.', 'فشل إنشاء الالتزام.'));
    } finally { setBusy(false); }
  }

  async function saveAssessment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await createUi3ComplianceAssessment({
        obligation_id: selected.id,
        assessment_code: String(form.get('assessment_code') ?? ''),
        assessment_title: String(form.get('assessment_title') ?? '').trim(),
        assessment_date: String(form.get('assessment_date') ?? ''),
        assessment_period_start: String(form.get('assessment_period_start') ?? ''),
        assessment_period_end: String(form.get('assessment_period_end') ?? ''),
        assessment_method: String(form.get('assessment_method') ?? ''),
        scope_description: String(form.get('scope_description') ?? '').trim(),
        result: String(form.get('result') ?? 'not_assessed'),
        conclusion_summary: String(form.get('conclusion_summary') ?? '').trim(),
        evidence_reference: String(form.get('evidence_reference') ?? '').trim(),
        responsible_owner_id: String(form.get('responsible_owner_id') ?? ''),
        reviewer_id: String(form.get('reviewer_id') ?? ''),
        rationale: 'Assessment created through the governed Compliance workspace.',
      });
      closeDialog();
      setTab('assessments');
      setNotice(text('Compliance assessment created.', 'تم إنشاء تقييم الامتثال.'));
      await refreshDetail();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : text('Assessment creation failed.', 'فشل إنشاء التقييم.'));
    } finally { setBusy(false); }
  }

  async function saveFinding(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAssessment) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await recordUi3ComplianceFinding({
        assessment_id: selectedAssessment.id,
        finding_code: String(form.get('finding_code') ?? ''),
        finding_description: String(form.get('finding_description') ?? '').trim(),
        severity: String(form.get('severity') ?? 'medium'),
        materiality: String(form.get('materiality') ?? ''),
        due_date: String(form.get('due_date') ?? ''),
        responsible_owner_id: String(form.get('responsible_owner_id') ?? ''),
        department_id: String(form.get('department_id') ?? ''),
        root_cause_category: String(form.get('root_cause_category') ?? ''),
        root_cause_description: String(form.get('root_cause_description') ?? '').trim(),
        evidence_reference: String(form.get('evidence_reference') ?? '').trim(),
        rationale: 'Finding recorded from the selected non-passing compliance assessment.',
      });
      closeDialog();
      setTab('findings');
      setNotice(text('Compliance finding recorded.', 'تم تسجيل نتيجة الامتثال.'));
      await refreshDetail();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : text('Finding creation failed.', 'فشل إنشاء النتيجة.'));
    } finally { setBusy(false); }
  }

  async function saveRemediation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFinding) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await createUi3ComplianceRemediation({
        finding_id: selectedFinding.id,
        action_code: String(form.get('action_code') ?? ''),
        action_description: String(form.get('action_description') ?? '').trim(),
        owner_id: String(form.get('owner_id') ?? ''),
        due_date: String(form.get('due_date') ?? ''),
        evidence_reference: String(form.get('evidence_reference') ?? '').trim(),
        rationale: 'Remediation action created for the selected finding.',
      });
      closeDialog();
      setTab('remediation');
      setNotice(text('Remediation action created.', 'تم إنشاء إجراء المعالجة.'));
      await refreshDetail();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : text('Remediation creation failed.', 'فشل إنشاء المعالجة.'));
    } finally { setBusy(false); }
  }

  async function submitAssessment() {
    if (!selectedAssessment) return;
    setBusy(true);
    try {
      await submitUi3ComplianceAssessment({ assessment_id: selectedAssessment.id, rationale: 'Submitted for governed review.' });
      setNotice(text('Assessment submitted for review.', 'تم إرسال التقييم للمراجعة.'));
      await refreshDetail();
    } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }

  async function decideAssessment(approved: boolean) {
    if (!selectedAssessment) return;
    if (approved && !isCompletedGovernanceReview(governanceReview)) {
      setNotice(text('Complete the Obligation and Internal Governance Basis review before approval.', 'أكمل مراجعة الالتزام وأساس الحوكمة الداخلية قبل الاعتماد.'));
      setTab('governance');
      return;
    }
    setBusy(true);
    try {
      await decideUi3ComplianceAssessment(selectedAssessment.id, approved, approved ? 'Approved after governed criteria review.' : 'Returned for clarification and additional evidence.');
      setNotice(approved ? text('Assessment approved.', 'تم اعتماد التقييم.') : text('Assessment returned.', 'تمت إعادة التقييم.'));
      await refreshDetail();
    } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }

  async function advanceRemediation(item: Ui3ComplianceRemediation) {
    const next = item.action_status === 'planned' ? 'in_progress' : item.action_status === 'in_progress' ? 'completed' : 'verified';
    setBusy(true);
    try {
      await updateUi3ComplianceRemediation({ remediation_action_id: item.id, action_status: next, rationale: `Remediation moved to ${next}.` });
      setNotice(text('Remediation status updated.', 'تم تحديث حالة المعالجة.'));
      await refreshDetail();
    } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }

  if (selected) {
    const selectedFindingRemediations = selectedFinding ? remediations.filter((item) => item.finding_id === selectedFinding.id) : [];
    return (
      <section className="page-section ui3-module" data-testid="ui3-compliance-detail">
        <button type="button" className="ui3-back-button" onClick={() => setSelected(null)}><ArrowLeft size={16} />{text('Obligations register', 'سجل الالتزامات')}</button>
        <header className="ui3-record-header">
          <div><span className="ui3-eyebrow">{selected.obligation_code ?? text('Obligation', 'التزام')}</span><h1>{selected.title}</h1><p>{selected.requirement_text}</p><div className="ui3-record-tags"><span className={`ui3-pill ui3-tone--${complianceTone(selected.risk_level)}`}>{humanize(selected.risk_level)}</span><StatusBadge status={humanize(selected.status)} /><span>{selected.regulatory_body || text('Internal', 'داخلي')}</span></div></div>
          <div className="ui3-header-actions">{canManage ? <button type="button" className="ui3-primary-button" onClick={() => setDialog('assessment')}><ClipboardCheck size={16} />{text('New assessment', 'تقييم جديد')}</button> : null}</div>
        </header>
        {notice ? <div className="ui3-notice" role="status">{notice}</div> : null}
        <nav className="ui3-detail-tabs" aria-label={text('Compliance sections', 'أقسام الامتثال')}>{tabs.map((item) => <button key={item.id} type="button" className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{language === 'ar' ? item.ar : item.en}</button>)}</nav>

        {tab === 'overview' ? <div className="ui3-detail-layout"><main className="ui3-stack"><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('External requirement', 'المتطلب الخارجي')}</span><h2>{text('Obligation profile', 'ملف الالتزام')}</h2></div><Gavel size={20} /></div><div className="ui3-data-grid"><div><span>{text('Regulatory body', 'الجهة التنظيمية')}</span><strong>{selected.regulatory_body || '—'}</strong></div><div><span>{text('Framework', 'الإطار')}</span><strong>{selected.framework || '—'}</strong></div><div><span>{text('Clause', 'البند')}</span><strong>{selected.clause_reference || '—'}</strong></div><div><span>{text('Applicability', 'قابلية التطبيق')}</span><strong>{humanize(selected.applicability)}</strong></div><div><span>{text('Review cycle', 'دورة المراجعة')}</span><strong>{humanize(selected.review_frequency)}</strong></div><div><span>{text('Next review', 'المراجعة التالية')}</span><strong>{formatDate(selected.next_review_date)}</strong></div></div></section><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Latest assurance', 'أحدث تأكيد')}</span><h2>{text('Assessment position', 'وضع التقييم')}</h2></div><BookOpenCheck size={20} /></div>{selected.latest_assessment_id ? <div className="ui3-assessment-summary"><span className={`ui3-score-dot ui3-tone--${resultTone(selected.latest_assessment_result)}`}>{selected.latest_assessment_result === 'compliant' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}</span><div><strong>{humanize(selected.latest_assessment_result ?? 'not assessed')}</strong><p>{selected.latest_assessment_code} · {formatDate(selected.latest_assessment_date)}</p></div><StatusBadge status={humanize(selected.latest_assessment_status ?? '')} /></div> : <EmptyState label={text('No assessment has been recorded', 'لم يتم تسجيل تقييم')} />}</section></main><aside className="ui3-stack"><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Open work', 'العمل المفتوح')}</span><h2>{text('Assurance follow-up', 'متابعة التأكيد')}</h2></div><ShieldAlert size={20} /></div><div className="ui3-stat-list"><div><span>{text('Assessments', 'التقييمات')}</span><strong>{assessments.length}</strong></div><div><span>{text('Open findings', 'النتائج المفتوحة')}</span><strong>{findings.filter((item) => !['closed', 'verified'].includes(item.finding_status)).length}</strong></div><div><span>{text('Open remediation', 'المعالجة المفتوحة')}</span><strong>{remediations.filter((item) => !['completed', 'verified', 'closed'].includes(item.action_status)).length}</strong></div></div></section></aside></div> : null}

        {tab === 'assessments' ? <div className="ui3-detail-layout"><main className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Assurance records', 'سجلات التأكيد')}</span><h2>{text('Compliance assessments', 'تقييمات الامتثال')}</h2></div>{canManage ? <button type="button" className="ui3-secondary-button" onClick={() => setDialog('assessment')}><Plus size={15} />{text('Assessment', 'تقييم')}</button> : null}</div>{assessments.length ? <div className="ui3-record-list">{assessments.map((item) => <button type="button" key={item.id} className={selectedAssessment?.id === item.id ? 'active' : ''} onClick={() => { setSelectedAssessment(item); setGovernanceReview(null); }}><span><strong>{item.assessment_code} · {item.assessment_title}</strong><small>{humanize(item.assessment_method ?? 'document review')} · {formatDate(item.assessment_date)}</small></span><span><span className={`ui3-pill ui3-tone--${resultTone(item.result)}`}>{humanize(item.result)}</span><StatusBadge status={humanize(item.workflow_status)} /></span></button>)}</div> : <EmptyState label={text('No compliance assessments', 'لا توجد تقييمات امتثال')} />}</main><aside className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Workflow', 'سير العمل')}</span><h2>{text('Selected assessment', 'التقييم المحدد')}</h2></div><ClipboardCheck size={20} /></div>{selectedAssessment ? <><div className="ui3-data-grid ui3-data-grid--single"><div><span>{text('Result', 'النتيجة')}</span><strong>{humanize(selectedAssessment.result)}</strong></div><div><span>{text('Conclusion', 'الخلاصة')}</span><strong>{selectedAssessment.conclusion_summary || '—'}</strong></div><div><span>{text('Evidence', 'الدليل')}</span><strong>{selectedAssessment.evidence_reference || '—'}</strong></div></div><div className="ui3-form-actions">{selectedAssessment.workflow_status === 'draft' ? <button type="button" className="ui3-primary-button" disabled={busy} onClick={() => void submitAssessment()}>{text('Submit', 'إرسال')}</button> : null}{selectedAssessment.workflow_status === 'in_review' && canApprove ? <><button type="button" className="ui3-secondary-button" disabled={busy} onClick={() => void decideAssessment(false)}>{text('Return', 'إعادة')}</button><button type="button" className="ui3-primary-button" disabled={busy || !isCompletedGovernanceReview(governanceReview)} onClick={() => void decideAssessment(true)}>{text('Approve', 'اعتماد')}</button></> : null}</div></> : <p className="ui3-supporting-copy">{text('Select an assessment to review its governed outcome.', 'اختر تقييماً لمراجعة نتيجته المحكومة.')}</p>}</aside></div> : null}

        {tab === 'findings' ? <section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Observed gaps', 'الفجوات المرصودة')}</span><h2>{text('Assessment findings', 'نتائج التقييم')}</h2></div>{canManage && selectedAssessment && isFindingAllowed(selectedAssessment.result) ? <button type="button" className="ui3-primary-button" onClick={() => setDialog('finding')}><Plus size={15} />{text('Record finding', 'تسجيل نتيجة')}</button> : null}</div><p className="ui3-supporting-copy">{text('A finding is an observed gap from an assessment. It is not the obligation and not the remediation action.', 'النتيجة هي فجوة مرصودة من تقييم. وهي ليست الالتزام وليست إجراء المعالجة.')}</p>{findings.length ? <div className="ui3-data-table"><div className="ui3-table-head"><span>{text('Finding', 'النتيجة')}</span><span>{text('Assessment', 'التقييم')}</span><span>{text('Severity', 'الشدة')}</span><span>{text('Due', 'الاستحقاق')}</span><span>{text('Status', 'الحالة')}</span><span /></div>{findings.map((item) => <button type="button" className="ui3-table-row" key={item.id} onClick={() => setSelectedFinding(item)}><span><strong>{item.finding_code}</strong><small>{item.finding_description}</small></span><span>{assessments.find((assessment) => assessment.id === item.assessment_id)?.assessment_code ?? '—'}</span><span><span className={`ui3-pill ui3-tone--${complianceTone(item.severity)}`}>{humanize(item.severity)}</span></span><span>{formatDate(item.due_date)}</span><span><StatusBadge status={humanize(item.finding_status)} /></span><span><Eye size={16} /></span></button>)}</div> : <EmptyState label={text('No findings recorded', 'لم يتم تسجيل نتائج')} />}</section> : null}

        {tab === 'remediation' ? <div className="ui3-detail-layout"><main className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Corrective work', 'العمل التصحيحي')}</span><h2>{text('Remediation actions', 'إجراءات المعالجة')}</h2></div>{canManage && selectedFinding ? <button type="button" className="ui3-primary-button" onClick={() => setDialog('remediation')}><Plus size={15} />{text('Action', 'إجراء')}</button> : null}</div>{remediations.length ? <div className="ui3-record-list ui3-record-list--static">{remediations.map((item) => <div key={item.id}><span><strong>{item.action_code} · {item.action_description}</strong><small>{findings.find((finding) => finding.id === item.finding_id)?.finding_code ?? '—'} · {formatDate(item.due_date)}</small></span><span><StatusBadge status={humanize(item.action_status)} />{canManage && !['verified', 'closed'].includes(item.action_status) ? <button type="button" className="ui3-icon-button" title={text('Advance remediation', 'تقدم المعالجة')} disabled={busy} onClick={() => void advanceRemediation(item)}><Wrench size={15} /></button> : null}</span></div>)}</div> : <EmptyState label={text('No remediation actions', 'لا توجد إجراءات معالجة')} />}</main><aside className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Finding context', 'سياق النتيجة')}</span><h2>{text('Selected finding', 'النتيجة المحددة')}</h2></div><FileSearch size={20} /></div>{selectedFinding ? <div className="ui3-data-grid ui3-data-grid--single"><div><span>{text('Finding', 'النتيجة')}</span><strong>{selectedFinding.finding_code}</strong></div><div><span>{text('Root cause', 'السبب الجذري')}</span><strong>{selectedFinding.root_cause_description || selectedFinding.root_cause_category || '—'}</strong></div><div><span>{text('Actions', 'الإجراءات')}</span><strong>{selectedFindingRemediations.length}</strong></div></div> : <p className="ui3-supporting-copy">{text('Select a finding before creating remediation.', 'اختر نتيجة قبل إنشاء المعالجة.')}</p>}</aside></div> : null}

        {tab === 'governance' ? selectedFinding ? <GovernanceCriteriaLinkage source={{ type: 'compliance_finding', id: selectedFinding.id, organizationId: selectedFinding.organization_id || selected.organization_id || organizationId, sourceDate: assessments.find((assessment) => assessment.id === selectedFinding.assessment_id)?.assessment_date ?? null, departmentId: selectedFinding.department_id || assessments.find((assessment) => assessment.id === selectedFinding.assessment_id)?.department_id }} mode="compliance" title={text('Finding and Internal Governance Basis', 'النتيجة وأساس الحوكمة الداخلية')} canManage={canManage} requiredObligationId={selected.id} onReviewChange={setGovernanceReview} /> : selectedAssessment ? <GovernanceCriteriaLinkage source={{ type: 'compliance_assessment', id: selectedAssessment.id, organizationId: selectedAssessment.organization_id || selected.organization_id || organizationId, sourceDate: selectedAssessment.assessment_date, departmentId: selectedAssessment.department_id }} mode="compliance" title={text('Obligation and Internal Governance Basis', 'الالتزام وأساس الحوكمة الداخلية')} canManage={canManage} requiredObligationId={selected.id} onReviewChange={setGovernanceReview} /> : <section className="ui3-surface"><EmptyState label={text('Select a finding or assessment to establish its exact governance basis', 'اختر نتيجة أو تقييماً لتحديد أساس الحوكمة الدقيق')} /></section> : null}
        {tab === 'activity' ? <section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Immutable workflow', 'سير عمل غير قابل للتعديل')}</span><h2>{text('Assessment activity', 'نشاط التقييم')}</h2></div><BarChart3 size={20} /></div>{events.length ? <ol className="ui3-timeline">{events.map((item) => <li key={item.id}><span /><div><strong>{humanize(item.event_type)}</strong><p>{item.event_note || `${humanize(item.from_status ?? '')} → ${humanize(item.to_status ?? '')}`}</p><small>{formatDate(item.created_at)}</small></div></li>)}</ol> : <EmptyState label={text('No activity for the selected assessment', 'لا يوجد نشاط للتقييم المحدد')} />}</section> : null}

        <Modal open={dialog === 'assessment'} title={text('New compliance assessment', 'تقييم امتثال جديد')} onClose={closeDialog} isDirty={formDirty} isSubmitting={busy} size="large"><form className="ui3-form" onChangeCapture={() => setFormDirty(true)} onSubmit={saveAssessment}><div className="ui3-form-grid"><label><span>{text('Assessment code', 'رمز التقييم')}</span><input name="assessment_code" placeholder="ASM-AUTO" /></label><label><span>{text('Assessment date', 'تاريخ التقييم')}</span><input type="date" name="assessment_date" defaultValue={new Date().toISOString().slice(0,10)} required /></label><label className="ui3-span-2"><span>{text('Assessment title', 'عنوان التقييم')}</span><input name="assessment_title" defaultValue={`${selected.title} assessment`} required /></label><label><span>{text('Period start', 'بداية الفترة')}</span><input type="date" name="assessment_period_start" /></label><label><span>{text('Period end', 'نهاية الفترة')}</span><input type="date" name="assessment_period_end" /></label><label><span>{text('Method', 'المنهجية')}</span><select name="assessment_method"><option value="document_review">{text('Document review', 'مراجعة المستندات')}</option><option value="testing">{text('Control testing', 'اختبار الضوابط')}</option><option value="interview">{text('Interview', 'مقابلة')}</option><option value="combined">{text('Combined', 'مدمج')}</option></select></label><label><span>{text('Result', 'النتيجة')}</span><select name="result"><option value="not_assessed">{text('Not assessed', 'غير مقيم')}</option><option value="compliant">{text('Compliant', 'ممتثل')}</option><option value="partial_compliance">{text('Partial compliance', 'امتثال جزئي')}</option><option value="noncompliant">{text('Noncompliant', 'غير ممتثل')}</option><option value="insufficient_evidence">{text('Insufficient evidence', 'أدلة غير كافية')}</option><option value="not_applicable">{text('Not applicable', 'غير منطبق')}</option></select></label><label><span>{text('Responsible owner', 'المالك المسؤول')}</span><select name="responsible_owner_id"><option value="">—</option>{(profiles.data ?? []).map((item) => <option value={item.id} key={item.id}>{item.full_name_en}</option>)}</select></label><label><span>{text('Reviewer', 'المراجع')}</span><select name="reviewer_id"><option value="">—</option>{(profiles.data ?? []).map((item) => <option value={item.id} key={item.id}>{item.full_name_en}</option>)}</select></label><label className="ui3-span-2"><span>{text('Scope', 'النطاق')}</span><textarea name="scope_description" required /></label><label className="ui3-span-2"><span>{text('Conclusion', 'الخلاصة')}</span><textarea name="conclusion_summary" /></label><label className="ui3-span-2"><span>{text('Evidence reference', 'مرجع الدليل')}</span><input name="evidence_reference" /></label></div><div className="ui3-form-actions"><button type="button" className="ui3-secondary-button" onClick={closeDialog}>{text('Cancel', 'إلغاء')}</button><button className="ui3-primary-button" disabled={busy}>{text('Create assessment', 'إنشاء التقييم')}</button></div></form></Modal>
        <Modal open={dialog === 'finding'} title={text('Record compliance finding', 'تسجيل نتيجة امتثال')} onClose={closeDialog} isDirty={formDirty} isSubmitting={busy} size="large"><form className="ui3-form" onChangeCapture={() => setFormDirty(true)} onSubmit={saveFinding}><div className="ui3-form-grid"><label><span>{text('Finding code', 'رمز النتيجة')}</span><input name="finding_code" placeholder="FND-AUTO" /></label><label><span>{text('Severity', 'الشدة')}</span><select name="severity"><option value="low">{text('Low', 'منخفض')}</option><option value="medium">{text('Medium', 'متوسط')}</option><option value="high">{text('High', 'عال')}</option><option value="critical">{text('Critical', 'حرج')}</option></select></label><label className="ui3-span-2"><span>{text('Observed gap', 'الفجوة المرصودة')}</span><textarea name="finding_description" required minLength={3} /></label><label><span>{text('Materiality', 'الأهمية النسبية')}</span><input name="materiality" /></label><label><span>{text('Due date', 'تاريخ الاستحقاق')}</span><input type="date" name="due_date" /></label><label><span>{text('Department', 'الإدارة')}</span><select name="department_id"><option value="">—</option>{(departments.data ?? []).map((item) => <option value={item.id} key={item.id}>{item.name_en}</option>)}</select></label><label><span>{text('Responsible owner', 'المالك المسؤول')}</span><select name="responsible_owner_id"><option value="">—</option>{(profiles.data ?? []).map((item) => <option value={item.id} key={item.id}>{item.full_name_en}</option>)}</select></label><label><span>{text('Root-cause category', 'فئة السبب الجذري')}</span><input name="root_cause_category" /></label><label><span>{text('Evidence reference', 'مرجع الدليل')}</span><input name="evidence_reference" /></label><label className="ui3-span-2"><span>{text('Root-cause detail', 'تفاصيل السبب الجذري')}</span><textarea name="root_cause_description" /></label></div><div className="ui3-form-actions"><button type="button" className="ui3-secondary-button" onClick={closeDialog}>{text('Cancel', 'إلغاء')}</button><button className="ui3-primary-button" disabled={busy}>{text('Record finding', 'تسجيل النتيجة')}</button></div></form></Modal>
        <Modal open={dialog === 'remediation'} title={text('New remediation action', 'إجراء معالجة جديد')} onClose={closeDialog} isDirty={formDirty} isSubmitting={busy}><form className="ui3-form" onChangeCapture={() => setFormDirty(true)} onSubmit={saveRemediation}><div className="ui3-form-grid"><label><span>{text('Action code', 'رمز الإجراء')}</span><input name="action_code" placeholder="REM-AUTO" /></label><label><span>{text('Due date', 'تاريخ الاستحقاق')}</span><input type="date" name="due_date" /></label><label className="ui3-span-2"><span>{text('Action description', 'وصف الإجراء')}</span><textarea name="action_description" required minLength={3} /></label><label><span>{text('Owner', 'المالك')}</span><select name="owner_id"><option value="">—</option>{(profiles.data ?? []).map((item) => <option value={item.id} key={item.id}>{item.full_name_en}</option>)}</select></label><label><span>{text('Evidence reference', 'مرجع الدليل')}</span><input name="evidence_reference" /></label></div><div className="ui3-form-actions"><button type="button" className="ui3-secondary-button" onClick={closeDialog}>{text('Cancel', 'إلغاء')}</button><button className="ui3-primary-button" disabled={busy}>{text('Create action', 'إنشاء الإجراء')}</button></div></form></Modal>
      </section>
    );
  }

  const overdue = rows.filter((item) => item.next_review_date && new Date(item.next_review_date).getTime() < Date.now()).length;
  const nonpassing = rows.filter((item) => item.latest_assessment_result && !['compliant', 'not_applicable'].includes(item.latest_assessment_result)).length;
  const openFindings = rows.reduce((total, item) => total + finiteCount(item.open_finding_count), 0);
  const overdueRemediation = rows.filter((item) => item.has_overdue_remediation).length;
  const bodySummary = bodies.map((body) => ({ body, count: rows.filter((item) => item.regulatory_body === body).length }));
  return (
    <section className="page-section ui3-module" data-testid="ui3-compliance-register">
      <ModuleHeader eyebrow={text('Compliance Assurance', 'تأكيد الامتثال')} title={t('compliance.title')} subtitle={text('Manage external obligations, assess compliance, record findings, and govern remediation.', 'إدارة الالتزامات الخارجية وتقييم الامتثال وتسجيل النتائج وحوكمة المعالجة.')} action={canManage ? <button type="button" className="ui3-primary-button" onClick={() => setDialog('obligation')}><Plus size={16} />{text('New obligation', 'التزام جديد')}</button> : null} />
      <div className="ui3-view-switch" role="group" aria-label={text('Compliance views', 'عروض الامتثال')}><button type="button" aria-pressed={view === 'register'} className={view === 'register' ? 'active' : ''} onClick={() => setView('register')}><List size={16} />{text('Obligations', 'الالتزامات')}</button><button type="button" aria-pressed={view === 'dashboard'} className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}><LayoutDashboard size={16} />{text('Dashboard', 'لوحة المعلومات')}</button></div>
      {notice ? <div className="ui3-notice" role="status">{notice}</div> : null}
      <div className="ui3-kpi-grid"><article><span>{text('Obligations', 'الالتزامات')}</span><strong>{rows.length}</strong><small>{text('Governed register', 'سجل محكوم')}</small></article><article className="ui3-tone--warning"><span>{text('Review overdue', 'مراجعة متأخرة')}</span><strong>{overdue}</strong><small>{text('Requires assessment', 'يتطلب تقييماً')}</small></article><article className="ui3-tone--danger"><span>{text('Non-passing', 'غير ناجح')}</span><strong>{nonpassing}</strong><small>{text('Latest assessment', 'أحدث تقييم')}</small></article><article className="ui3-tone--warning"><span>{text('Open findings', 'النتائج المفتوحة')}</span><strong>{openFindings}</strong><small>{text('Observed gaps', 'فجوات مرصودة')}</small></article><article className="ui3-tone--danger"><span>{text('Overdue remediation', 'معالجة متأخرة')}</span><strong>{overdueRemediation}</strong><small>{text('Corrective work', 'عمل تصحيحي')}</small></article></div>
      {view === 'dashboard' ? <div className="ui3-dashboard-grid"><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Regulatory landscape', 'المشهد التنظيمي')}</span><h2>{text('Obligations by authority', 'الالتزامات حسب الجهة')}</h2></div><Gavel size={20} /></div><div className="ui3-bar-list">{bodySummary.map((item) => <div key={item.body}><span><strong>{item.body}</strong><small>{item.count} {text('obligations', 'التزامات')}</small></span><div><i style={{ width: `${Math.min(100, item.count / Math.max(1, bodySummary[0]?.count ?? 1) * 100)}%` }} /></div><b>{item.count}</b></div>)}</div></section><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Assessment outcomes', 'نتائج التقييم')}</span><h2>{text('Current compliance position', 'وضع الامتثال الحالي')}</h2></div><BarChart3 size={20} /></div><div className="ui3-status-breakdown">{['compliant','partial_compliance','noncompliant','insufficient_evidence','not_assessed'].map((result) => { const count = rows.filter((item) => (item.latest_assessment_result ?? 'not_assessed') === result).length; return <div key={result}><span className={`ui3-score-dot ui3-tone--${resultTone(result)}`}>{count}</span><strong>{humanize(result)}</strong></div>; })}</div></section><section className="ui3-surface ui3-span-all"><div className="ui3-section-heading"><div><span>{text('Priority queue', 'قائمة الأولويات')}</span><h2>{text('Obligations requiring attention', 'الالتزامات التي تتطلب اهتماماً')}</h2></div><ShieldAlert size={20} /></div><div className="ui3-priority-grid">{[...rows].sort((a,b) => Number(b.has_overdue_remediation) - Number(a.has_overdue_remediation) || finiteCount(b.open_finding_count) - finiteCount(a.open_finding_count)).slice(0,5).map((item) => <button type="button" key={item.id} onClick={() => openObligation(item)}><span className={`ui3-score-dot ui3-tone--${complianceTone(item.latest_assessment_result ?? item.risk_level)}`}>{finiteCount(item.open_finding_count)}</span><span><strong>{item.title}</strong><small>{item.obligation_code} · {item.regulatory_body || text('Internal', 'داخلي')}</small></span><Eye size={16} /></button>)}</div></section></div> : <><section className="ui3-filter-bar"><label className="ui3-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text('Search obligations', 'البحث في الالتزامات')} /></label><select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)} aria-label={text('Risk level', 'مستوى المخاطر')}><option value="all">{text('All levels', 'كل المستويات')}</option>{['critical','high','medium','low'].map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label={text('Obligation status', 'حالة الالتزام')}><option value="all">{text('All statuses', 'كل الحالات')}</option>{[...new Set(rows.map((item) => item.status))].map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select><select value={bodyFilter} onChange={(event) => setBodyFilter(event.target.value)} aria-label={text('Regulatory body', 'الجهة التنظيمية')}><option value="all">{text('All authorities', 'كل الجهات')}</option>{bodies.map((value) => <option key={value} value={value}>{value}</option>)}</select><span>{filteredRows.length} {text('records', 'سجلات')}</span></section><section className="ui3-surface ui3-register-surface"><div className="ui3-data-table ui3-compliance-table"><div className="ui3-table-head"><span>{text('Obligation', 'الالتزام')}</span><span>{text('Authority', 'الجهة')}</span><span>{text('Risk', 'المخاطر')}</span><span>{text('Latest result', 'أحدث نتيجة')}</span><span>{text('Findings', 'النتائج')}</span><span>{text('Next review', 'المراجعة التالية')}</span><span>{text('Status', 'الحالة')}</span><span /></div>{filteredRows.map((item) => <button type="button" className="ui3-table-row" key={item.id} onClick={() => openObligation(item)}><span><strong>{item.obligation_code ?? 'OBL'}</strong><small>{item.title}</small></span><span>{item.regulatory_body || '—'}</span><span><span className={`ui3-pill ui3-tone--${complianceTone(item.risk_level)}`}>{humanize(item.risk_level)}</span></span><span><span className={`ui3-pill ui3-tone--${resultTone(item.latest_assessment_result)}`}>{humanize(item.latest_assessment_result ?? 'not assessed')}</span></span><span>{finiteCount(item.open_finding_count)}</span><span>{formatDate(item.next_review_date)}</span><span><StatusBadge status={humanize(item.status)} /></span><span><Eye size={16} /></span></button>)}</div>{obligationData.loading ? <p className="ui3-supporting-copy">{text('Loading obligations…', 'جارٍ تحميل الالتزامات…')}</p> : null}{!obligationData.loading && !filteredRows.length ? <EmptyState label={text('No obligations match the current filters', 'لا توجد التزامات تطابق عوامل التصفية الحالية')} /> : null}</section></>}
      <Modal open={dialog === 'obligation'} title={text('New compliance obligation', 'التزام امتثال جديد')} onClose={closeDialog} isDirty={formDirty} isSubmitting={busy} size="large"><form className="ui3-form" onChangeCapture={() => setFormDirty(true)} onSubmit={saveObligation}><div className="ui3-form-grid"><label><span>{text('Obligation code', 'رمز الالتزام')}</span><input name="obligation_code" placeholder="OBL-AUTO" /></label><label><span>{text('Regulatory body', 'الجهة التنظيمية')}</span><input name="regulatory_body" required /></label><label className="ui3-span-2"><span>{text('Requirement title', 'عنوان المتطلب')}</span><input name="title" required minLength={3} /></label><label className="ui3-span-2"><span>{text('Requirement text', 'نص المتطلب')}</span><textarea name="requirement_text" required minLength={3} /></label><label><span>{text('Framework', 'الإطار')}</span><input name="framework" /></label><label><span>{text('Clause reference', 'مرجع البند')}</span><input name="clause_reference" /></label><label><span>{text('Risk level', 'مستوى المخاطر')}</span><select name="risk_level"><option value="low">{text('Low', 'منخفض')}</option><option value="medium">{text('Medium', 'متوسط')}</option><option value="high">{text('High', 'عال')}</option><option value="critical">{text('Critical', 'حرج')}</option></select></label><label><span>{text('Applicability', 'قابلية التطبيق')}</span><select name="applicability"><option value="applicable">{text('Applicable', 'منطبق')}</option><option value="partially_applicable">{text('Partially applicable', 'منطبق جزئياً')}</option><option value="not_applicable">{text('Not applicable', 'غير منطبق')}</option></select></label><label><span>{text('Review frequency', 'تكرار المراجعة')}</span><select name="review_frequency"><option value="annual">{text('Annual', 'سنوي')}</option><option value="semiannual">{text('Semiannual', 'نصف سنوي')}</option><option value="quarterly">{text('Quarterly', 'ربع سنوي')}</option><option value="monthly">{text('Monthly', 'شهري')}</option></select></label><label><span>{text('Next review', 'المراجعة التالية')}</span><input type="date" name="next_review_date" /></label><label><span>{text('Department', 'الإدارة')}</span><select name="department_id"><option value="">—</option>{(departments.data ?? []).map((item) => <option value={item.id} key={item.id}>{item.name_en}</option>)}</select></label><label><span>{text('Owner', 'المالك')}</span><select name="owner_id"><option value="">—</option>{(profiles.data ?? []).map((item) => <option value={item.id} key={item.id}>{item.full_name_en}</option>)}</select></label><label className="ui3-checkbox"><input type="checkbox" name="evidence_required" defaultChecked /><span>{text('Evidence required', 'الدليل مطلوب')}</span></label></div><div className="ui3-form-actions"><button type="button" className="ui3-secondary-button" onClick={closeDialog}>{text('Cancel', 'إلغاء')}</button><button className="ui3-primary-button" disabled={busy}>{text('Create obligation', 'إنشاء الالتزام')}</button></div></form></Modal>
    </section>
  );
}
