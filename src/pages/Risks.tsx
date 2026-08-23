import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Edit3,
  Eye,
  FileClock,
  Gauge,
  LayoutDashboard,
  List,
  Plus,
  Search,
  ShieldCheck,
  Target,
  TrendingDown,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { GovernedDecisionDialog } from '../components/GovernedDecisionDialog';
import { GovernanceCriteriaLinkage } from '../components/governance/GovernanceCriteriaLinkage';
import { RiskForm } from '../components/GrcForms';
import { Modal } from '../components/Modal';
import { ModuleHeader } from '../components/ModuleHeader';
import { StatusBadge } from '../components/StatusBadge';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import { departmentName, formatDate, humanize, ownerName } from '../lib/format';
import {
  getDepartments,
  getOrganizations,
  getProfiles,
  getRiskReassessmentHistory,
  getRisks,
  getRiskWorkflowEvents,
  updateRiskAssessment,
  updateRiskTreatment,
  linkRiskSource,
  markDuplicateRisk,
  reopenRiskWithReason,
  requestRiskAcceptance,
  requestRiskClosure,
} from '../lib/grcApi';
import type { GovernanceLinkageReview } from '../lib/governanceCriteriaLinkageApi';
import {
  decideUi3RiskReassessment,
  getUi3RiskControls,
  getUi3RiskKris,
  getUi3RiskTreatments,
  updateUi3RiskRecord,
  type Ui3RiskControl,
  type Ui3RiskKri,
  type Ui3RiskTreatmentAction,
} from '../lib/ui3RiskComplianceApi';
import { buildRiskMatrix, evaluateRiskGovernanceGate } from '../lib/ui3RiskComplianceModel';
import type { RiskReassessmentHistoryRow, RiskRow, RiskWorkflowEventRow } from '../types/domain';

type RiskView = 'dashboard' | 'register';
type RiskTab = 'overview' | 'assessment' | 'controls' | 'treatment' | 'kris' | 'history' | 'governance';
type RiskDialog = 'create' | 'edit' | 'reassess' | 'treatment' | null;
type RiskWorkflowAction = 'reassess' | 'request_acceptance' | 'update_treatment' | 'link_source' | 'mark_duplicate' | 'request_closure' | 'reopen';

interface RiskWorkflowDecision {
  action: RiskWorkflowAction;
  risk: RiskRow;
}

const riskTabs: Array<{ id: RiskTab; en: string; ar: string }> = [
  { id: 'overview', en: 'Overview', ar: 'نظرة عامة' },
  { id: 'assessment', en: 'Assessment', ar: 'التقييم' },
  { id: 'controls', en: 'Controls', ar: 'الضوابط' },
  { id: 'treatment', en: 'Treatment', ar: 'المعالجة' },
  { id: 'kris', en: 'KRIs', ar: 'مؤشرات المخاطر' },
  { id: 'history', en: 'History', ar: 'السجل' },
  { id: 'governance', en: 'Governance Context', ar: 'سياق الحوكمة' },
];

function riskTone(level: string) {
  return ['critical', 'high', 'medium', 'low'].includes(level) ? level : 'neutral';
}

function scoreBand(score: number) {
  if (score >= 20) return 'critical';
  if (score >= 12) return 'high';
  if (score >= 5) return 'medium';
  return 'low';
}

function RiskScore({ label, score, level }: { label: string; score: number; level: string }) {
  return (
    <div className={`ui3-risk-score ui3-tone--${riskTone(level)}`}>
      <span>{label}</span>
      <strong>{score}</strong>
      <small>{humanize(level)}</small>
    </div>
  );
}

function EmptyRows({ label }: { label: string }) {
  return <div className="ui3-empty-state"><ShieldCheck size={24} /><strong>{label}</strong></div>;
}

export function Risks() {
  const auth = useAuth();
  const { language, t } = useI18n();
  const text = useCallback((en: string, ar: string) => language === 'ar' ? ar : en, [language]);
  const [view, setView] = useState<RiskView>('register');
  const [tab, setTab] = useState<RiskTab>('overview');
  const [dialog, setDialog] = useState<RiskDialog>(null);
  const [selectedRisk, setSelectedRisk] = useState<RiskRow | null>(null);
  const [selectedRevision, setSelectedRevision] = useState<RiskReassessmentHistoryRow | null>(null);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [controls, setControls] = useState<Ui3RiskControl[]>([]);
  const [treatments, setTreatments] = useState<Ui3RiskTreatmentAction[]>([]);
  const [kris, setKris] = useState<Ui3RiskKri[]>([]);
  const [history, setHistory] = useState<RiskReassessmentHistoryRow[]>([]);
  const [events, setEvents] = useState<RiskWorkflowEventRow[]>([]);
  const [governanceReview, setGovernanceReview] = useState<GovernanceLinkageReview | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [riskFormDirty, setRiskFormDirty] = useState(false);
  const [riskFormSubmitting, setRiskFormSubmitting] = useState(false);
  const [workflowDecision, setWorkflowDecision] = useState<RiskWorkflowDecision | null>(null);

  const risks = useAsyncData(getRisks, []);
  const departments = useAsyncData(getDepartments, []);
  const profiles = useAsyncData(getProfiles, []);
  const organizations = useAsyncData(getOrganizations, []);
  const organizationId = organizations.data?.[0]?.id || '';
  const canManage = auth.roles.some((role) => ['super_admin', 'governance_admin', 'division_head', 'department_manager', 'compliance_officer'].includes(role.role));
  const canApprove = auth.roles.some((role) => ['super_admin', 'governance_admin', 'division_head'].includes(role.role));
  const rows = risks.data ?? [];
  const categories = useMemo(() => [...new Set(rows.map((risk) => risk.category).filter(Boolean))].sort(), [rows]);
  const filteredRows = useMemo(() => rows.filter((risk) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${risk.risk_code ?? ''} ${risk.title} ${risk.description ?? ''}`.toLowerCase().includes(query);
    return matchesSearch
      && (levelFilter === 'all' || risk.risk_level === levelFilter)
      && (statusFilter === 'all' || risk.status === statusFilter)
      && (categoryFilter === 'all' || risk.category === categoryFilter);
  }), [categoryFilter, levelFilter, rows, search, statusFilter]);
  const matrix = useMemo(() => buildRiskMatrix(rows), [rows]);
  const categorySummary = useMemo(() => categories.map((category) => ({
    category,
    count: rows.filter((risk) => risk.category === category).length,
    exposure: rows.filter((risk) => risk.category === category).reduce((total, risk) => total + risk.residual_score, 0),
  })).sort((a, b) => b.exposure - a.exposure), [categories, rows]);

  const loadDetail = useCallback(async (risk: RiskRow) => {
    try {
      const [controlRows, treatmentRows, kriRows, historyRows, eventRows] = await Promise.all([
        getUi3RiskControls(risk.id),
        getUi3RiskTreatments(risk.id),
        getUi3RiskKris(risk.id),
        getRiskReassessmentHistory(risk.id),
        getRiskWorkflowEvents(risk.id),
      ]);
      setControls(controlRows);
      setTreatments(treatmentRows);
      setKris(kriRows);
      setHistory(historyRows);
      setEvents(eventRows);
      setSelectedRevision((current) => current && historyRows.some((item) => item.id === current.id) ? current : historyRows[0] ?? null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : text('Risk detail could not be loaded.', 'تعذر تحميل تفاصيل المخاطر.'));
    }
  }, [text]);

  useEffect(() => {
    if (selectedRisk) void loadDetail(selectedRisk);
  }, [loadDetail, selectedRisk]);

  async function refreshSelected() {
    await risks.refresh();
    if (selectedRisk) await loadDetail(selectedRisk);
  }

  function openRisk(risk: RiskRow, nextTab: RiskTab = 'overview') {
    setSelectedRisk(risk);
    setSelectedRevision(null);
    setGovernanceReview(null);
    setTab(nextTab);
    setNotice(null);
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRisk) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await updateUi3RiskRecord(selectedRisk.id, {
        title: String(form.get('title') ?? '').trim(),
        description: String(form.get('description') ?? '').trim() || null,
        category: String(form.get('category') ?? 'operational'),
        department_id: String(form.get('department_id') ?? '') || null,
        owner_id: String(form.get('owner_id') ?? '') || null,
        response_type: String(form.get('response_type') ?? 'mitigate'),
        next_review_date: String(form.get('next_review_date') ?? '') || null,
      });
      setDialog(null);
      setNotice(text('Risk record updated.', 'تم تحديث سجل المخاطر.'));
      await risks.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : text('Risk update failed.', 'فشل تحديث المخاطر.'));
    } finally {
      setBusy(false);
    }
  }

  async function saveReassessment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRisk) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await updateRiskAssessment({
        risk_id: selectedRisk.id,
        likelihood: selectedRisk.likelihood,
        impact: selectedRisk.impact,
        residual_likelihood: Number(form.get('residual_likelihood')),
        residual_impact: Number(form.get('residual_impact')),
        appetite_threshold: selectedRisk.appetite_threshold ?? 12,
        change_reason: String(form.get('change_reason') ?? '').trim(),
      });
      setDialog(null);
      setTab('assessment');
      setNotice(text('Reassessment recorded. Complete its Governance Context before approval when required.', 'تم تسجيل إعادة التقييم. أكمل سياق الحوكمة قبل الاعتماد عند الحاجة.'));
      await refreshSelected();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : text('Reassessment failed.', 'فشلت إعادة التقييم.'));
    } finally {
      setBusy(false);
    }
  }

  async function saveTreatment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRisk) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await updateRiskTreatment({
        risk_id: selectedRisk.id,
        treatment_status: String(form.get('status') ?? 'planned'),
        treatment_plan_summary: String(form.get('summary') ?? '').trim(),
        treatment_due_date: String(form.get('due_date') ?? '') || undefined,
        treatment_owner_id: selectedRisk.treatment_owner_id || selectedRisk.owner_id || undefined,
        note: String(form.get('summary') ?? '').trim(),
      });
      setDialog(null);
      setNotice(text('Treatment plan updated.', 'تم تحديث خطة المعالجة.'));
      await refreshSelected();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : text('Treatment update failed.', 'فشل تحديث المعالجة.'));
    } finally {
      setBusy(false);
    }
  }

  function defaultWorkflowExpiryDate() {
    const date = new Date();
    date.setDate(date.getDate() + 90);
    return date.toISOString().slice(0, 10);
  }

  async function executeWorkflowDecision(values: Record<string, any>) {
    if (!workflowDecision) return;
    const { action, risk } = workflowDecision;
    setBusy(true);
    setNotice(null);
    try {
      if (action === 'reassess') {
        await updateRiskAssessment({
          risk_id: risk.id,
          likelihood: risk.likelihood,
          impact: risk.impact,
          residual_likelihood: Number(values.residual_likelihood),
          residual_impact: Number(values.residual_impact),
          appetite_threshold: risk.appetite_threshold ?? 12,
          change_reason: values.change_reason?.trim(),
        });
      } else if (action === 'request_acceptance') {
        await requestRiskAcceptance({
          risk_id: risk.id,
          reason: values.reason,
          acceptance_expiry_date: values.acceptance_expiry_date,
        });
      } else if (action === 'update_treatment') {
        await updateRiskTreatment({
          risk_id: risk.id,
          treatment_status: 'planned',
          treatment_plan_summary: values.treatment_plan_summary,
          treatment_due_date: values.treatment_due_date || undefined,
          treatment_owner_id: risk.treatment_owner_id || risk.owner_id || undefined,
          note: values.treatment_plan_summary,
        });
      } else if (action === 'link_source') {
        await linkRiskSource({
          risk_id: risk.id,
          source_ovr_id: values.source_ovr_id || undefined,
          source_audit_finding_id: values.source_audit_finding_id || undefined,
          source_compliance_id: values.source_compliance_id || undefined,
          source_project_id: values.source_project_id || undefined,
          note: 'Source linkage updated',
        });
      } else if (action === 'mark_duplicate') {
        await markDuplicateRisk({
          risk_id: risk.id,
          duplicate_of_risk_id: values.duplicate_of_risk_id,
          reason: values.reason || undefined,
        });
      } else if (action === 'request_closure') {
        await requestRiskClosure({ risk_id: risk.id, reason: values.reason || undefined });
      } else {
        await reopenRiskWithReason({ risk_id: risk.id, reason: values.reason || undefined });
      }
      setNotice(text('Governed risk workflow updated.', 'تم تحديث سير عمل المخاطر المحكوم.'));
      await refreshSelected();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : text('Risk workflow update failed.', 'فشل تحديث سير عمل المخاطر.'));
      throw error;
    } finally {
      setBusy(false);
    }
  }

  async function decideRevision(approved: boolean) {
    if (!selectedRevision || !selectedRisk) return;
    const gate = evaluateRiskGovernanceGate(selectedRisk, governanceReview);
    if (approved && !gate.canApprove) {
      setNotice(text(gate.reason ?? 'Governance Context is incomplete.', 'سياق الحوكمة غير مكتمل.'));
      return;
    }
    setBusy(true);
    try {
      await decideUi3RiskReassessment({
        reassessmentId: selectedRevision.id,
        approved,
        governanceReviewId: governanceReview?.id,
        rationale: approved ? 'Approved after governed review.' : 'Returned for reassessment and additional evidence.',
      });
      setNotice(approved ? text('Reassessment approved.', 'تم اعتماد إعادة التقييم.') : text('Reassessment returned.', 'تمت إعادة التقييم.'));
      await loadDetail(selectedRisk);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : text('Decision failed.', 'فشل القرار.'));
    } finally {
      setBusy(false);
    }
  }

  if (selectedRisk) {
    const residualLikelihood = selectedRisk.residual_likelihood ?? selectedRisk.likelihood;
    const residualImpact = selectedRisk.residual_impact ?? selectedRisk.impact;
    const gate = evaluateRiskGovernanceGate(selectedRisk, governanceReview);
    return (
      <section className="page-section ui3-module" data-testid="ui3-risk-detail">
        <button type="button" className="ui3-back-button" onClick={() => setSelectedRisk(null)}><ArrowLeft size={16} />{text('Risk register', 'سجل المخاطر')}</button>
        <header className="ui3-record-header">
          <div>
            <span className="ui3-eyebrow">{selectedRisk.risk_code ?? text('Risk', 'مخاطر')}</span>
            <h1>{selectedRisk.title}</h1>
            <p>{selectedRisk.description || text('No description recorded.', 'لم يتم تسجيل وصف.')}</p>
            <div className="ui3-record-tags"><span className={`ui3-pill ui3-tone--${riskTone(selectedRisk.risk_level)}`}>{humanize(selectedRisk.risk_level)}</span><StatusBadge status={humanize(selectedRisk.status)} /><span>{humanize(selectedRisk.category)}</span></div>
          </div>
          <div className="ui3-header-actions">
            {canManage ? <button type="button" className="ui3-secondary-button" onClick={() => setDialog('edit')}><Edit3 size={16} />{text('Edit', 'تعديل')}</button> : null}
            {canManage ? <button type="button" className="ui3-primary-button" onClick={() => setDialog('reassess')}><ClipboardCheck size={16} />{text('Reassess', 'إعادة تقييم')}</button> : null}
          </div>
        </header>

        {notice ? <div className="ui3-notice" role="status">{notice}</div> : null}
        {canManage ? (
          <section className="ui3-workflow-actions" aria-label={text('Governed risk workflow', 'سير عمل المخاطر المحكوم')}>
            <strong>{text('Workflow actions', 'إجراءات سير العمل')}</strong>
            <div>
              <button type="button" onClick={() => setWorkflowDecision({ action: 'reassess', risk: selectedRisk })}>{text('Reassess risk', 'إعادة تقييم المخاطر')}</button>
              <button type="button" onClick={() => setWorkflowDecision({ action: 'request_acceptance', risk: selectedRisk })}>{text('Request acceptance', 'طلب القبول')}</button>
              <button type="button" onClick={() => setWorkflowDecision({ action: 'update_treatment', risk: selectedRisk })}>{text('Update treatment', 'تحديث المعالجة')}</button>
              <button type="button" onClick={() => setWorkflowDecision({ action: 'request_closure', risk: selectedRisk })}>{text('Request closure', 'طلب الإغلاق')}</button>
              <button type="button" onClick={() => setWorkflowDecision({ action: 'reopen', risk: selectedRisk })}>{text('Reopen with reason', 'إعادة الفتح مع السبب')}</button>
              <button type="button" onClick={() => setWorkflowDecision({ action: 'link_source', risk: selectedRisk })}>{text('Link source', 'ربط المصدر')}</button>
              <button type="button" onClick={() => setWorkflowDecision({ action: 'mark_duplicate', risk: selectedRisk })}>{text('Mark duplicate', 'وضع علامة مكرر')}</button>
            </div>
          </section>
        ) : null}
        <nav className="ui3-detail-tabs" aria-label={text('Risk sections', 'أقسام المخاطر')}>
          {riskTabs.map((item) => <button key={item.id} type="button" className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{language === 'ar' ? item.ar : item.en}</button>)}
        </nav>

        {tab === 'overview' ? <div className="ui3-detail-layout">
          <main className="ui3-stack">
            <section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Risk profile', 'ملف المخاطر')}</span><h2>{text('Current exposure', 'التعرض الحالي')}</h2></div><Gauge size={20} /></div><div className="ui3-score-comparison"><RiskScore label={text('Inherent risk', 'المخاطر الكامنة')} score={selectedRisk.inherent_score} level={scoreBand(selectedRisk.inherent_score)} /><TrendingDown size={20} /><RiskScore label={text('Residual risk', 'المخاطر المتبقية')} score={selectedRisk.residual_score} level={selectedRisk.risk_level} /></div><div className="ui3-mini-matrix"><span style={{ gridColumn: residualImpact, gridRow: 6 - residualLikelihood }} className={`ui3-matrix-marker ui3-tone--${scoreBand(residualImpact * residualLikelihood)}`}>{selectedRisk.residual_score}</span></div></section>
            <section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Accountability', 'المساءلة')}</span><h2>{text('Ownership and response', 'الملكية والاستجابة')}</h2></div><Target size={20} /></div><div className="ui3-data-grid"><div><span>{text('Risk owner', 'مالك المخاطر')}</span><strong>{ownerName(selectedRisk.risk_owner ?? selectedRisk.owner)}</strong></div><div><span>{text('Department', 'الإدارة')}</span><strong>{departmentName(selectedRisk.departments)}</strong></div><div><span>{text('Response', 'الاستجابة')}</span><strong>{humanize(selectedRisk.response_type)}</strong></div><div><span>{text('Next review', 'المراجعة التالية')}</span><strong>{formatDate(selectedRisk.next_review_date)}</strong></div></div></section>
          </main>
          <aside className="ui3-stack"><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Status', 'الحالة')}</span><h2>{text('Control posture', 'وضع الضوابط')}</h2></div><ShieldCheck size={20} /></div><div className="ui3-stat-list"><div><span>{text('Active controls', 'الضوابط النشطة')}</span><strong>{controls.filter((item) => item.is_active).length}</strong></div><div><span>{text('Open treatments', 'المعالجات المفتوحة')}</span><strong>{treatments.filter((item) => !['completed', 'closed'].includes(item.status)).length}</strong></div><div><span>{text('KRI alerts', 'تنبيهات مؤشرات المخاطر')}</span><strong>{kris.filter((item) => ['warning', 'critical'].includes(item.status)).length}</strong></div></div></section><section className={`ui3-surface ui3-gate-summary ${gate.required && !gate.complete ? 'ui3-gate-summary--blocked' : ''}`}><AlertTriangle size={20} /><div><strong>{gate.required ? text('Governance review required', 'مراجعة الحوكمة مطلوبة') : text('Standard governance review', 'مراجعة حوكمة قياسية')}</strong><p>{gate.complete ? text('Review complete and traceable.', 'المراجعة مكتملة وقابلة للتتبع.') : text('Open Governance Context to record the conclusion.', 'افتح سياق الحوكمة لتسجيل الخلاصة.')}</p></div></section></aside>
        </div> : null}

        {tab === 'assessment' ? <div className="ui3-detail-layout"><main className="ui3-stack"><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Reassessment history', 'سجل إعادة التقييم')}</span><h2>{text('Select an immutable scoring snapshot', 'اختر لقطة تقييم غير قابلة للتعديل')}</h2></div><FileClock size={20} /></div>{history.length ? <div className="ui3-record-list">{history.map((item) => <button type="button" key={item.id} className={selectedRevision?.id === item.id ? 'active' : ''} onClick={() => { setSelectedRevision(item); setGovernanceReview(null); }}><span><strong>{item.previous_residual_score ?? '—'} → {item.new_residual_score ?? '—'}</strong><small>{item.change_reason || text('No rationale recorded', 'لم يتم تسجيل مبرر')}</small></span><span><StatusBadge status={humanize(item.assessment_status ?? 'recorded')} /><small>{formatDate(item.changed_at)}</small></span></button>)}</div> : <EmptyRows label={text('No reassessment snapshots', 'لا توجد لقطات إعادة تقييم')} />}</section>{selectedRevision ? <GovernanceCriteriaLinkage source={{ type: 'risk', id: selectedRisk.id, revisionId: selectedRevision.id, organizationId: selectedRisk.organization_id ?? organizationId, sourceDate: selectedRevision.changed_at, departmentId: selectedRisk.department_id }} mode="risk" title={text('Reassessment Governance Context', 'سياق حوكمة إعادة التقييم')} canManage={canManage} onReviewChange={setGovernanceReview} /> : null}</main><aside className="ui3-stack"><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Decision gate', 'بوابة القرار')}</span><h2>{text('Reassessment approval', 'اعتماد إعادة التقييم')}</h2></div><CheckCircle2 size={20} /></div><p className="ui3-supporting-copy">{gate.reason || text('Governance requirements are satisfied.', 'تم استيفاء متطلبات الحوكمة.')}</p>{canApprove && selectedRevision ? <div className="ui3-form-actions"><button type="button" className="ui3-secondary-button" disabled={busy} onClick={() => void decideRevision(false)}>{text('Return', 'إعادة')}</button><button type="button" className="ui3-primary-button" disabled={busy || !gate.canApprove} onClick={() => void decideRevision(true)}>{text('Approve', 'اعتماد')}</button></div> : null}</section></aside></div> : null}

        {tab === 'controls' ? <section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Control environment', 'بيئة الضوابط')}</span><h2>{text('Mapped controls', 'الضوابط المرتبطة')}</h2></div><ShieldCheck size={20} /></div>{controls.length ? <div className="ui3-data-table"><div className="ui3-table-head"><span>{text('Control', 'الضابط')}</span><span>{text('Type', 'النوع')}</span><span>{text('Effectiveness', 'الفعالية')}</span><span>{text('Next test', 'الاختبار التالي')}</span></div>{controls.map((item) => <div className="ui3-table-row" key={item.id}><span><strong>{item.control_code || 'CTRL'}</strong><small>{item.title}</small></span><span>{humanize(item.control_type)}</span><span><StatusBadge status={humanize(item.effectiveness)} /></span><span>{formatDate(item.next_test_date)}</span></div>)}</div> : <EmptyRows label={text('No controls mapped', 'لا توجد ضوابط مرتبطة')} />}</section> : null}
        {tab === 'treatment' ? <section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Risk response', 'الاستجابة للمخاطر')}</span><h2>{text('Treatment plan', 'خطة المعالجة')}</h2></div>{canManage ? <button type="button" className="ui3-secondary-button" onClick={() => setDialog('treatment')}><Edit3 size={15} />{text('Update plan', 'تحديث الخطة')}</button> : null}</div>{treatments.length ? <div className="ui3-record-list ui3-record-list--static">{treatments.map((item) => <div key={item.id}><span><strong>{item.title}</strong><small>{item.description || text('No description', 'لا يوجد وصف')}</small></span><span><StatusBadge status={humanize(item.status)} /><small>{item.progress_percent}% · {formatDate(item.due_date)}</small></span></div>)}</div> : <EmptyRows label={text('No treatment actions', 'لا توجد إجراءات معالجة')} />}</section> : null}
        {tab === 'kris' ? <section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Early warning', 'الإنذار المبكر')}</span><h2>{text('Key risk indicators', 'مؤشرات المخاطر الرئيسية')}</h2></div><BarChart3 size={20} /></div>{kris.length ? <div className="ui3-kri-grid">{kris.map((item) => <article key={item.id}><div><span>{item.kri_code || 'KRI'}</span><StatusBadge status={humanize(item.status)} /></div><strong>{language === 'ar' ? item.name_ar || item.name_en : item.name_en}</strong><b>{item.current_value ?? '—'}</b><small>{text('Warning', 'تحذير')} {item.threshold_warning ?? '—'} · {text('Critical', 'حرج')} {item.threshold_critical ?? '—'}</small></article>)}</div> : <EmptyRows label={text('No KRI measurements', 'لا توجد قياسات للمؤشرات')} />}</section> : null}
        {tab === 'history' ? <section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Audit trail', 'مسار التدقيق')}</span><h2>{text('Risk activity', 'نشاط المخاطر')}</h2></div><FileClock size={20} /></div>{events.length ? <ol className="ui3-timeline">{events.map((item) => <li key={item.id}><span /><div><strong>{humanize(item.action)}</strong><p>{item.note || `${humanize(item.from_status ?? '')} → ${humanize(item.to_status ?? '')}`}</p><small>{formatDate(item.created_at)}</small></div></li>)}</ol> : <EmptyRows label={text('No workflow events', 'لا توجد أحداث سير عمل')} />}</section> : null}
        {tab === 'governance' ? <GovernanceCriteriaLinkage source={{ type: 'risk', id: selectedRisk.id, organizationId: selectedRisk.organization_id ?? organizationId, sourceDate: selectedRisk.last_reviewed_at ?? selectedRisk.next_review_date, departmentId: selectedRisk.department_id }} mode="risk" title={text('Governance Context', 'سياق الحوكمة')} canManage={canManage} onReviewChange={setGovernanceReview} /> : null}

        <Modal open={dialog === 'edit'} title={text('Edit risk', 'تعديل المخاطر')} onClose={() => setDialog(null)} size="large"><form className="ui3-form" onSubmit={saveEdit}><div className="ui3-form-grid"><label className="ui3-span-2"><span>{text('Risk title', 'عنوان المخاطر')}</span><input name="title" defaultValue={selectedRisk.title} required /></label><label className="ui3-span-2"><span>{text('Description', 'الوصف')}</span><textarea name="description" defaultValue={selectedRisk.description ?? ''} /></label><label><span>{text('Category', 'الفئة')}</span><input name="category" defaultValue={selectedRisk.category} required /></label><label><span>{text('Response', 'الاستجابة')}</span><select name="response_type" defaultValue={selectedRisk.response_type}><option value="mitigate">{text('Mitigate', 'تخفيف')}</option><option value="accept">{text('Accept', 'قبول')}</option><option value="transfer">{text('Transfer', 'نقل')}</option><option value="avoid">{text('Avoid', 'تجنب')}</option></select></label><label><span>{text('Department', 'الإدارة')}</span><select name="department_id" defaultValue={selectedRisk.department_id ?? ''}><option value="">—</option>{(departments.data ?? []).map((item) => <option value={item.id} key={item.id}>{language === 'ar' ? item.name_ar || item.name_en : item.name_en}</option>)}</select></label><label><span>{text('Owner', 'المالك')}</span><select name="owner_id" defaultValue={selectedRisk.owner_id ?? ''}><option value="">—</option>{(profiles.data ?? []).map((item) => <option value={item.id} key={item.id}>{language === 'ar' ? item.full_name_ar || item.full_name_en : item.full_name_en}</option>)}</select></label><label><span>{text('Next review', 'المراجعة التالية')}</span><input type="date" name="next_review_date" defaultValue={selectedRisk.next_review_date ?? ''} /></label></div><div className="ui3-form-actions"><button type="button" className="ui3-secondary-button" onClick={() => setDialog(null)}>{text('Cancel', 'إلغاء')}</button><button className="ui3-primary-button" disabled={busy}>{text('Save changes', 'حفظ التغييرات')}</button></div></form></Modal>
        <Modal open={dialog === 'reassess'} title={text('Record risk reassessment', 'تسجيل إعادة تقييم المخاطر')} onClose={() => setDialog(null)}><form className="ui3-form" onSubmit={saveReassessment}><div className="ui3-form-grid"><label><span>{text('Residual likelihood', 'الاحتمالية المتبقية')}</span><select name="residual_likelihood" defaultValue={residualLikelihood}>{[1,2,3,4,5].map((value) => <option key={value}>{value}</option>)}</select></label><label><span>{text('Residual impact', 'الأثر المتبقي')}</span><select name="residual_impact" defaultValue={residualImpact}>{[1,2,3,4,5].map((value) => <option key={value}>{value}</option>)}</select></label><label className="ui3-span-2"><span>{text('Change rationale', 'مبرر التغيير')}</span><textarea name="change_reason" required minLength={3} /></label></div><div className="ui3-form-actions"><button type="button" className="ui3-secondary-button" onClick={() => setDialog(null)}>{text('Cancel', 'إلغاء')}</button><button className="ui3-primary-button" disabled={busy}>{text('Record snapshot', 'تسجيل اللقطة')}</button></div></form></Modal>
        <Modal open={dialog === 'treatment'} title={text('Update treatment plan', 'تحديث خطة المعالجة')} onClose={() => setDialog(null)}><form className="ui3-form" onSubmit={saveTreatment}><label><span>{text('Plan summary', 'ملخص الخطة')}</span><textarea name="summary" defaultValue={selectedRisk.treatment_plan_summary ?? ''} required /></label><div className="ui3-form-grid"><label><span>{text('Status', 'الحالة')}</span><select name="status" defaultValue={selectedRisk.treatment_status ?? 'planned'}><option value="planned">{text('Planned', 'مخطط')}</option><option value="in_progress">{text('In progress', 'قيد التنفيذ')}</option><option value="completed">{text('Completed', 'مكتمل')}</option><option value="delayed">{text('Delayed', 'متأخر')}</option></select></label><label><span>{text('Due date', 'تاريخ الاستحقاق')}</span><input type="date" name="due_date" defaultValue={selectedRisk.treatment_due_date ?? ''} /></label></div><div className="ui3-form-actions"><button type="button" className="ui3-secondary-button" onClick={() => setDialog(null)}>{text('Cancel', 'إلغاء')}</button><button className="ui3-primary-button" disabled={busy}>{text('Update plan', 'تحديث الخطة')}</button></div></form></Modal>
        <GovernedDecisionDialog
          open={Boolean(workflowDecision)}
          title={
            workflowDecision?.action === 'reassess' ? t('risks.decision.reassessTitle')
            : workflowDecision?.action === 'request_acceptance' ? t('risks.decision.requestAcceptanceTitle')
            : workflowDecision?.action === 'update_treatment' ? t('risks.decision.updateTreatmentTitle')
            : workflowDecision?.action === 'link_source' ? t('risks.decision.linkSourceTitle')
            : workflowDecision?.action === 'mark_duplicate' ? t('risks.decision.markDuplicateTitle')
            : workflowDecision?.action === 'request_closure' ? t('risks.decision.closureRequestTitle')
            : workflowDecision?.action === 'reopen' ? t('risks.decision.reopenTitle') : ''
          }
          subtitle={workflowDecision?.action === 'reassess' ? t('risks.decision.reassessSubtitle') : undefined}
          decisionVariant={workflowDecision?.action === 'reopen' ? 'warning' : workflowDecision?.action === 'request_closure' ? 'approve' : 'action'}
          contextItems={workflowDecision ? [
            { label: text('Risk', 'المخاطر'), value: workflowDecision.risk.risk_code || workflowDecision.risk.title },
            { label: t('risks.decision.inherentScore'), value: workflowDecision.risk.inherent_score },
            { label: t('risks.decision.residualScore'), value: workflowDecision.risk.residual_score },
          ] : []}
          fields={
            !workflowDecision ? []
            : workflowDecision.action === 'reassess' ? [
              { id: 'residual_likelihood', label: t('risks.decision.residualLikelihood'), type: 'select', defaultValue: String(workflowDecision.risk.residual_likelihood ?? 3), options: [1,2,3,4,5].map((value) => ({ value: String(value), label: String(value) })), required: true },
              { id: 'residual_impact', label: t('risks.decision.residualImpact'), type: 'select', defaultValue: String(workflowDecision.risk.residual_impact ?? 3), options: [1,2,3,4,5].map((value) => ({ value: String(value), label: String(value) })), required: true },
              { id: 'change_reason', label: t('risks.decision.reassessReason'), type: 'textarea', defaultValue: '', required: true, autoFocus: true },
            ]
            : workflowDecision.action === 'request_acceptance' ? [
              { id: 'reason', label: t('risks.decision.acceptanceReason'), type: 'textarea', defaultValue: '', required: true, autoFocus: true },
              { id: 'acceptance_expiry_date', label: t('risks.decision.acceptanceExpiry'), type: 'date', defaultValue: workflowDecision.risk.acceptance_expiry_date || defaultWorkflowExpiryDate(), required: true },
            ]
            : workflowDecision.action === 'update_treatment' ? [
              { id: 'treatment_plan_summary', label: t('risks.decision.treatmentSummary'), type: 'textarea', defaultValue: workflowDecision.risk.treatment_plan_summary || '', required: true, autoFocus: true },
              { id: 'treatment_due_date', label: t('risks.decision.treatmentDueDate'), type: 'date', defaultValue: workflowDecision.risk.treatment_due_date || defaultWorkflowExpiryDate() },
            ]
            : workflowDecision.action === 'link_source' ? [
              { id: 'source_ovr_id', label: t('risks.decision.sourceOvr'), type: 'text', defaultValue: workflowDecision.risk.source_ovr_id || '' },
              { id: 'source_audit_finding_id', label: t('risks.decision.sourceAudit'), type: 'text', defaultValue: workflowDecision.risk.source_audit_finding_id || '' },
              { id: 'source_compliance_id', label: t('risks.decision.sourceCompliance'), type: 'text', defaultValue: workflowDecision.risk.source_compliance_id || '' },
              { id: 'source_project_id', label: t('risks.decision.sourceProject'), type: 'text', defaultValue: workflowDecision.risk.source_project_id || '' },
            ]
            : workflowDecision.action === 'mark_duplicate' ? [
              { id: 'duplicate_of_risk_id', label: t('risks.decision.duplicateTargetId'), type: 'text', defaultValue: workflowDecision.risk.duplicate_of_risk_id || '', required: true, autoFocus: true },
              { id: 'reason', label: t('risks.decision.duplicateReason'), type: 'textarea', defaultValue: 'Duplicate or related risk signal' },
            ]
            : workflowDecision.action === 'request_closure' ? [
              { id: 'reason', label: t('risks.decision.closureReason'), type: 'textarea', defaultValue: '', autoFocus: true },
            ] : [
              { id: 'reason', label: t('risks.decision.reopenReason'), type: 'textarea', defaultValue: '', autoFocus: true },
            ]
          }
          onClose={() => setWorkflowDecision(null)}
          onSubmit={executeWorkflowDecision}
        />
      </section>
    );
  }

  const criticalHigh = rows.filter((risk) => ['critical', 'high'].includes(risk.risk_level)).length;
  const appetiteBreached = rows.filter((risk) => risk.appetite_breached).length;
  const overdue = rows.filter((risk) => risk.next_review_date && new Date(risk.next_review_date).getTime() < Date.now()).length;
  return (
    <section className="page-section ui3-module" data-testid="ui3-risk-register">
      <ModuleHeader eyebrow={text('Enterprise Risk', 'مخاطر المؤسسة')} title={t('risks.title')} subtitle={text('Identify, assess, treat, and monitor enterprise risk through governed evidence and review.', 'تحديد وتقييم ومعالجة ومراقبة مخاطر المؤسسة من خلال الأدلة والمراجعة المحكومة.')} action={canManage ? <button type="button" className="ui3-primary-button" onClick={() => setDialog('create')}><Plus size={16} />{text('New risk', 'مخاطر جديدة')}</button> : null} />
      <div className="ui3-view-switch" role="group" aria-label={text('Risk views', 'عروض المخاطر')}><button type="button" aria-pressed={view === 'register'} className={view === 'register' ? 'active' : ''} onClick={() => setView('register')}><List size={16} />{text('Risk register', 'سجل المخاطر')}</button><button type="button" aria-pressed={view === 'dashboard'} className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}><LayoutDashboard size={16} />{text('Dashboard', 'لوحة المعلومات')}</button></div>
      {notice ? <div className="ui3-notice" role="status">{notice}</div> : null}
      <div className="ui3-kpi-grid"><article><span>{text('Total risks', 'إجمالي المخاطر')}</span><strong>{rows.length}</strong><small>{text('Visible in your scope', 'ظاهرة في نطاقك')}</small></article><article className="ui3-tone--danger"><span>{text('Critical and high', 'حرجة وعالية')}</span><strong>{criticalHigh}</strong><small>{text('Priority exposure', 'التعرض ذو الأولوية')}</small></article><article className="ui3-tone--warning"><span>{text('Above appetite', 'فوق الشهية')}</span><strong>{appetiteBreached}</strong><small>{text('Executive attention', 'اهتمام تنفيذي')}</small></article><article><span>{text('Treatment active', 'معالجة نشطة')}</span><strong>{rows.filter((risk) => ['planned', 'in_progress'].includes(risk.treatment_status ?? '')).length}</strong><small>{text('Open response plans', 'خطط استجابة مفتوحة')}</small></article><article className="ui3-tone--warning"><span>{text('Review overdue', 'مراجعة متأخرة')}</span><strong>{overdue}</strong><small>{text('Action required', 'إجراء مطلوب')}</small></article></div>

      {view === 'dashboard' ? <div className="ui3-dashboard-grid"><section className="ui3-surface ui3-heatmap-panel"><div className="ui3-section-heading"><div><span>{text('Exposure map', 'خريطة التعرض')}</span><h2>{text('Residual risk heatmap', 'خريطة المخاطر المتبقية')}</h2></div><Gauge size={20} /></div><div className="ui3-heatmap"><div className="ui3-axis-label ui3-axis-label--y">{text('Likelihood', 'الاحتمالية')}</div>{matrix.flat().map((cell) => <button key={`${cell.likelihood}-${cell.impact}`} type="button" className={`ui3-heat-cell ui3-tone--${cell.level}`} title={`${cell.likelihood} × ${cell.impact}`}><span>{cell.score}</span>{cell.count ? <strong>{cell.count}</strong> : null}</button>)}<div className="ui3-axis-label ui3-axis-label--x">{text('Impact', 'الأثر')}</div></div></section><section className="ui3-surface"><div className="ui3-section-heading"><div><span>{text('Portfolio', 'المحفظة')}</span><h2>{text('Exposure by category', 'التعرض حسب الفئة')}</h2></div><BarChart3 size={20} /></div><div className="ui3-bar-list">{categorySummary.map((item) => <div key={item.category}><span><strong>{humanize(item.category)}</strong><small>{item.count} {text('risks', 'مخاطر')}</small></span><div><i style={{ width: `${Math.min(100, (item.exposure / Math.max(1, categorySummary[0]?.exposure ?? 1)) * 100)}%` }} /></div><b>{item.exposure}</b></div>)}</div></section><section className="ui3-surface ui3-span-all"><div className="ui3-section-heading"><div><span>{text('Priority queue', 'قائمة الأولويات')}</span><h2>{text('Highest residual exposure', 'أعلى تعرض متبقٍ')}</h2></div><AlertTriangle size={20} /></div><div className="ui3-priority-grid">{[...rows].sort((a,b) => b.residual_score - a.residual_score).slice(0,5).map((risk) => <button key={risk.id} type="button" onClick={() => openRisk(risk)}><span className={`ui3-score-dot ui3-tone--${riskTone(risk.risk_level)}`}>{risk.residual_score}</span><span><strong>{risk.title}</strong><small>{risk.risk_code} · {humanize(risk.category)}</small></span><Eye size={16} /></button>)}</div></section></div> : <>
        <section className="ui3-filter-bar"><label className="ui3-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text('Search risks', 'البحث في المخاطر')} /></label><select aria-label={text('Risk level', 'مستوى المخاطر')} value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}><option value="all">{text('All levels', 'كل المستويات')}</option>{['critical','high','medium','low'].map((value) => <option value={value} key={value}>{humanize(value)}</option>)}</select><select aria-label={text('Risk status', 'حالة المخاطر')} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">{text('All statuses', 'كل الحالات')}</option>{[...new Set(rows.map((risk) => risk.status))].map((value) => <option value={value} key={value}>{humanize(value)}</option>)}</select><select aria-label={text('Risk category', 'فئة المخاطر')} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">{text('All categories', 'كل الفئات')}</option>{categories.map((value) => <option value={value} key={value}>{humanize(value)}</option>)}</select><span>{filteredRows.length} {text('records', 'سجلات')}</span></section>
        <section className="ui3-surface ui3-register-surface"><div className="ui3-data-table ui3-risk-table"><div className="ui3-table-head"><span>{text('Risk', 'المخاطر')}</span><span>{text('Category', 'الفئة')}</span><span>{text('Owner', 'المالك')}</span><span>{text('Score', 'الدرجة')}</span><span>{text('Treatment', 'المعالجة')}</span><span>{text('Review', 'المراجعة')}</span><span>{text('Status', 'الحالة')}</span><span /></div>{filteredRows.map((risk) => <button className="ui3-table-row" type="button" key={risk.id} aria-label={`${risk.risk_code ?? risk.title} Workflow`} onClick={() => openRisk(risk)}><span><strong>{risk.risk_code ?? 'RISK'}</strong><small>{risk.title}</small></span><span>{humanize(risk.category)}</span><span>{ownerName(risk.risk_owner ?? risk.owner)}</span><span><b>{risk.inherent_score}</b><TrendingDown size={13} /><b className={`ui3-text--${riskTone(risk.risk_level)}`}>{risk.residual_score}</b></span><span><StatusBadge status={humanize(risk.treatment_status ?? 'not required')} /></span><span>{formatDate(risk.next_review_date)}</span><span><span className={`ui3-pill ui3-tone--${riskTone(risk.risk_level)}`}>{humanize(risk.risk_level)}</span></span><span><Eye size={16} /></span></button>)}</div>{risks.loading ? <p className="ui3-supporting-copy">{text('Loading risks…', 'جارٍ تحميل المخاطر…')}</p> : null}{!risks.loading && !filteredRows.length ? <EmptyRows label={text('No risks match the current filters', 'لا توجد مخاطر تطابق عوامل التصفية الحالية')} /> : null}</section>
      </>}
      <Modal open={dialog === 'create'} title={t('risks.create', 'Create risk')} onClose={() => setDialog(null)} isDirty={riskFormDirty} isSubmitting={riskFormSubmitting} size="large"><RiskForm organizationId={organizationId} departments={departments.data ?? []} profiles={profiles.data ?? []} onDirtyChange={setRiskFormDirty} onSubmittingChange={setRiskFormSubmitting} onCancel={() => setDialog(null)} onCreated={() => { setDialog(null); void risks.refresh(); }} /></Modal>
    </section>
  );
}
