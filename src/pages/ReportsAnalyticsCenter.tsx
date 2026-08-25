import { useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileSearch,
  Filter,
  GraduationCap,
  Landmark,
  Library,
  ListChecks,
  Search,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import type { PageKey } from '../routes/pageLocation';
import { DataState } from '../components/DataState';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import { formatDate, humanize } from '../lib/format';
import { getUi7ReportDataset, type Ui7ReportDataset, type Ui7ReportRow } from '../lib/ui7ApprovalsReportsApi';
import {
  buildGovernanceAnalytics,
  metricValue,
  permissionScopedOptions,
  type Ui7GovernanceTruthRow,
  type Ui7SourceResult,
} from '../lib/ui7ApprovalsReportsModel';

interface ReportsAnalyticsCenterProps {
  setPage: (page: PageKey) => void;
}

type ReportView = 'overview' | 'library' | 'governance' | 'adequacy' | 'risk' | 'compliance' | 'audit' | 'capa' | 'training' | 'ovr' | 'portfolio' | 'approvals' | 'drilldown';

interface DrilldownState {
  title: string;
  note: string;
  rows: Array<Record<string, unknown>>;
  sourcePage: PageKey | null;
  returnView: ReportView;
}

function value(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) if (row[key] !== null && row[key] !== undefined && row[key] !== '') return row[key];
  return null;
}

function textValue(row: Record<string, unknown>, ...keys: string[]) {
  const found = value(row, ...keys);
  return found === null ? null : String(found);
}

function boolValue(row: Record<string, unknown>, ...keys: string[]) {
  const found = value(row, ...keys);
  return found === true || found === 'true';
}

function rowDate(row: Record<string, unknown>) {
  return textValue(row, 'created_at', 'updated_at', 'requested_at', 'occurrence_date', 'finding_date', 'assessment_date', 'assigned_at', 'due_date', 'next_review_date');
}

function rowDepartment(row: Record<string, unknown>) {
  return textValue(row, 'department_name', 'department_name_en', 'department_id');
}

function rowTitle(row: Record<string, unknown>) {
  return textValue(row, 'title', 'capa_title', 'finding_title', 'brief_description', 'program_title', 'evidence_title', 'request_reason', 'action_description', 'target_display_label') || 'Governed record';
}

function rowStatus(row: Record<string, unknown>) {
  return textValue(row, 'status', 'request_status', 'capa_status', 'finding_status', 'latest_assessment_result', 'review_status', 'action_status', 'review_result') || 'recorded';
}

function reportTone(valueName: string) {
  const normalized = valueName.toLowerCase();
  if (['approved', 'accepted', 'active', 'closed', 'completed', 'compliant', 'effective', 'passed', 'verified'].some((item) => normalized.includes(item))) return 'good';
  if (['critical', 'high', 'overdue', 'rejected', 'failed', 'noncompliant', 'delayed'].some((item) => normalized.includes(item))) return 'danger';
  if (['partial', 'pending', 'review', 'at_risk', 'warning'].some((item) => normalized.includes(item))) return 'warning';
  return 'neutral';
}

function StatusChip({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={`ui7-chip ui7-tone--${tone}`}>{children}</span>;
}

function Metric({ icon, label, value: metric, note, tone = 'neutral', onClick }: { icon: ReactNode; label: string; value: number | string | null; note: string; tone?: string; onClick?: () => void }) {
  const body = <><span>{icon}</span><div><small>{label}</small><strong>{metric === null ? 'Not available' : metric}</strong><p>{metric === null ? 'Insufficient governed data' : note}</p></div></>;
  return onClick && metric !== null && metric !== 0 ? <button type="button" className={`ui7-metric ui7-tone--${tone}`} onClick={onClick}>{body}<ArrowRight size={15} /></button> : <article className={`ui7-metric ui7-tone--${tone}`}>{body}</article>;
}

function sourceRows<T>(source: Ui7SourceResult<T>, periodDays: number | null, department: string) {
  if (!source.available) return [];
  const cutoff = periodDays ? Date.now() - periodDays * 86_400_000 : null;
  return source.rows.filter((row) => {
    const record = row as Record<string, unknown>;
    const date = rowDate(record);
    const matchesPeriod = !cutoff || !date || new Date(date).getTime() >= cutoff;
    const matchesDepartment = department === 'all' || rowDepartment(record) === department;
    return matchesPeriod && matchesDepartment;
  });
}

function SourceBoundary({ source, children, empty, text }: { source: Ui7SourceResult<unknown>; children: ReactNode; empty: boolean; text: (en: string, ar: string) => string }) {
  if (!source.available) return <div className="ui7-unavailable"><AlertTriangle size={22} /><strong>{text('Metric unavailable', 'المؤشر غير متاح')}</strong><p>{text('The governed source could not be read in the current permission scope.', 'تعذرت قراءة المصدر المحكوم ضمن نطاق الصلاحية الحالي.')}</p></div>;
  if (empty) return <div className="ui7-empty"><FileSearch size={23} /><strong>{text('No data for selected period', 'لا توجد بيانات للفترة المحددة')}</strong><p>{text('No governed records match the active filters.', 'لا توجد سجلات محكومة تطابق المرشحات النشطة.')}</p></div>;
  return <>{children}</>;
}

function RecordList({ rows, text, onOpen }: { rows: Array<Record<string, unknown>>; text: (en: string, ar: string) => string; onOpen?: (row: Record<string, unknown>) => void }) {
  return <div className="ui7-report-list">{rows.slice(0, 12).map((row, index) => {
    const content = <><span><strong>{rowTitle(row)}</strong><small>{textValue(row, 'request_code', 'risk_code', 'finding_code', 'capa_code', 'ovr_number', 'document_code', 'evidence_code') || text('Governed source record', 'سجل مصدر محكوم')}</small></span><span><StatusChip tone={reportTone(rowStatus(row))}>{humanize(rowStatus(row))}</StatusChip><small>{formatDate(rowDate(row))}</small></span></>;
    return onOpen ? <button type="button" onClick={() => onOpen(row)} key={String(value(row, 'id', 'link_id', 'decision_id') || index)}>{content}<ArrowRight size={15} /></button> : <article key={String(value(row, 'id', 'link_id', 'decision_id') || index)}>{content}</article>;
  })}</div>;
}

function Distribution({ rows, field, onSelect }: { rows: Array<Record<string, unknown>>; field: string; onSelect?: (label: string, rows: Array<Record<string, unknown>>) => void }) {
  const grouped = new Map<string, Array<Record<string, unknown>>>();
  rows.forEach((row) => { const label = textValue(row, field) || 'Not recorded'; grouped.set(label, [...(grouped.get(label) ?? []), row]); });
  const maximum = Math.max(1, ...[...grouped.values()].map((group) => group.length));
  return <div className="ui7-report-bars">{[...grouped.entries()].sort((left, right) => right[1].length - left[1].length).slice(0, 8).map(([label, group]) => <button type="button" key={label} onClick={() => onSelect?.(label, group)}><span><strong>{humanize(label)}</strong><small>{group.length}</small></span><i><b className={`ui7-tone--${reportTone(label)}`} style={{ width: `${Math.max(8, group.length / maximum * 100)}%` }} /></i></button>)}</div>;
}

export function ReportsAnalyticsCenter({ setPage }: ReportsAnalyticsCenterProps) {
  const { language } = useI18n();
  const text = (en: string, ar: string) => language === 'ar' ? ar : en;
  const [view, setView] = useState<ReportView>('overview');
  const [period, setPeriod] = useState('all');
  const [department, setDepartment] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [criterionFilter, setCriterionFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [drilldown, setDrilldown] = useState<DrilldownState | null>(null);
  const data = useAsyncData(getUi7ReportDataset, []);
  const dataset = data.data;
  const periodDays = period === 'all' ? null : Number(period);

  const filtered = useMemo(() => {
    if (!dataset) return null;
    const pick = <T,>(source: Ui7SourceResult<T>) => sourceRows(source, periodDays, department);
    const governanceRows = pick(dataset.governance).filter((row) => criterionFilter === 'all' || row.target_criterion_type === criterionFilter);
    return {
      governance: governanceRows,
      risks: pick(dataset.risks),
      compliance: pick(dataset.compliance),
      complianceRemediation: pick(dataset.complianceRemediation),
      audit: pick(dataset.audit),
      capa: pick(dataset.capa),
      capaEffectiveness: pick(dataset.capaEffectiveness),
      training: pick(dataset.training),
      competency: pick(dataset.competency),
      ovr: pick(dataset.ovr),
      projects: pick(dataset.projects),
      milestones: pick(dataset.milestones),
      tasks: pick(dataset.tasks),
      evidence: pick(dataset.evidence),
      approvals: pick(dataset.approvals),
      approvalHistory: pick(dataset.approvalHistory),
    };
  }, [criterionFilter, dataset, department, periodDays]);
  const governance = buildGovernanceAnalytics(filtered?.governance ?? []);

  const departmentOptions = dataset ? permissionScopedOptions([
    ...dataset.risks.rows, ...dataset.compliance.rows, ...dataset.audit.rows, ...dataset.capa.rows,
    ...dataset.training.rows, ...dataset.ovr.rows, ...dataset.projects.rows, ...dataset.evidence.rows,
  ], (row) => rowDepartment(row as Record<string, unknown>)) : [];
  const criteriaOptions = dataset ? permissionScopedOptions(dataset.governance.rows, (row) => row.target_criterion_type) : [];

  function openDrilldown(title: string, note: string, rows: Array<Record<string, unknown>>, sourcePage: PageKey | null, returnView: ReportView) {
    setDrilldown({ title, note, rows, sourcePage, returnView });
    setView('drilldown');
  }

  function filteredSearch(rows: Array<Record<string, unknown>>) {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => Object.values(row).some((entry) => typeof entry === 'string' && entry.toLowerCase().includes(query)));
  }

  const openRisks = filtered?.risks.filter((row) => !['closed', 'cancelled'].includes(String(row.status))) ?? [];
  const highRisks = openRisks.filter((row) => ['high', 'critical'].includes(String(value(row, 'risk_level'))));
  const overdueTreatment = openRisks.filter((row) => boolValue(row, 'treatment_required') && textValue(row, 'treatment_due_date') && new Date(String(row.treatment_due_date)).getTime() < Date.now() && !['completed', 'closed'].includes(String(row.treatment_status)));
  const complianceRows = filtered?.compliance ?? [];
  const complianceRemediation = filtered?.complianceRemediation ?? [];
  const overdueCompliance = complianceRemediation.filter((row) => row.due_date && new Date(String(row.due_date)).getTime() < Date.now() && !['completed', 'closed'].includes(String(value(row, 'action_status', 'status'))));
  const auditRows = filtered?.audit ?? [];
  const openAudit = auditRows.filter((row) => !['closed', 'cancelled', 'waived'].includes(rowStatus(row)));
  const overdueAudit = openAudit.filter((row) => row.due_date && new Date(String(row.due_date)).getTime() < Date.now());
  const capaRows = filtered?.capa ?? [];
  const openCapa = capaRows.filter((row) => !['closed', 'cancelled'].includes(String(value(row, 'capa_status', 'status'))));
  const overdueCapa = openCapa.filter((row) => boolValue(row, 'overdue_flag') || Number(value(row, 'overdue_days') || 0) > 0);
  const effectiveness = filtered?.capaEffectiveness ?? [];
  const trainingRows = filtered?.training ?? [];
  const overdueTraining = trainingRows.filter((row) => ['overdue'].includes(String(row.status)) || (row.due_date && new Date(String(row.due_date)).getTime() < Date.now() && !['completed', 'waived', 'cancelled'].includes(String(row.status))));
  const competency = filtered?.competency ?? [];
  const ovrRows = filtered?.ovr ?? [];
  const projectRows = filtered?.projects ?? [];
  const delayedProjects = projectRows.filter((row) => ['delayed', 'at_risk'].includes(String(row.status)));
  const overdueDelivery = [...(filtered?.milestones ?? []), ...(filtered?.tasks ?? [])].filter((row) => row.due_date && new Date(String(row.due_date)).getTime() < Date.now() && !['closed', 'approved', 'cancelled', 'completed'].includes(String(row.status)));
  const evidenceRows = filtered?.evidence ?? [];
  const approvals = filtered?.approvals ?? [];
  const openApprovals = approvals.filter((row) => ['pending', 'partially_approved', 'escalated'].includes(row.request_status));
  const overdueApprovals = openApprovals.filter((row) => row.due_date && new Date(`${row.due_date}T23:59:59`).getTime() < Date.now());

  const tabs: Array<{ id: ReportView; label: string; icon: ReactNode }> = [
    { id: 'overview', label: text('Overview', 'نظرة عامة'), icon: <BarChart3 size={16} /> },
    { id: 'library', label: text('Report Library', 'مكتبة التقارير'), icon: <Library size={16} /> },
    { id: 'governance', label: text('Policy / SOP', 'السياسات / الإجراءات'), icon: <BookOpenCheck size={16} /> },
    { id: 'adequacy', label: text('Governance Review', 'مراجعة الحوكمة'), icon: <FileSearch size={16} /> },
    { id: 'risk', label: text('Risk', 'المخاطر'), icon: <ShieldAlert size={16} /> },
    { id: 'compliance', label: text('Compliance', 'الالتزام'), icon: <Landmark size={16} /> },
    { id: 'audit', label: text('Audit', 'التدقيق'), icon: <ClipboardCheck size={16} /> },
    { id: 'capa', label: 'CAPA', icon: <CheckCircle2 size={16} /> },
    { id: 'training', label: text('Training', 'التدريب'), icon: <GraduationCap size={16} /> },
    { id: 'ovr', label: 'OVR', icon: <Stethoscope size={16} /> },
    { id: 'portfolio', label: text('Projects / Evidence', 'المشاريع / الأدلة'), icon: <BriefcaseBusiness size={16} /> },
    { id: 'approvals', label: text('Approvals', 'الاعتمادات'), icon: <ShieldCheck size={16} /> },
  ];

  const availableSourceCount = dataset ? [dataset.governance, dataset.risks, dataset.compliance, dataset.audit, dataset.capa, dataset.training, dataset.ovr, dataset.projects, dataset.evidence, dataset.approvals].filter((source) => source.available).length : 0;

  function reportPanel() {
    if (!dataset || !filtered) return null;
    if (view === 'overview') return <div data-testid="ui7-reports-overview"><div className="ui7-metric-grid"><Metric icon={<ShieldAlert size={20} />} label={text('High / critical risks', 'مخاطر عالية / حرجة')} value={metricValue(dataset.risks.available, highRisks.length)} note={text('Open governed risks', 'مخاطر محكومة مفتوحة')} tone="danger" onClick={() => openDrilldown(text('High / critical risks', 'مخاطر عالية / حرجة'), text('Canonical risk records in the selected scope.', 'سجلات مخاطر قانونية ضمن النطاق المحدد.'), highRisks, 'risks', 'overview')} /><Metric icon={<ClipboardCheck size={20} />} label={text('Open audit findings', 'ملاحظات تدقيق مفتوحة')} value={metricValue(dataset.audit.available, openAudit.length)} note={text('Auditor truth preserved', 'حقيقة المدقق محفوظة')} tone="warning" onClick={() => openDrilldown(text('Open audit findings', 'ملاحظات تدقيق مفتوحة'), text('Open canonical audit findings.', 'ملاحظات تدقيق قانونية مفتوحة.'), openAudit, 'audit', 'overview')} /><Metric icon={<CheckCircle2 size={20} />} label={text('Overdue CAPAs', 'إجراءات CAPA متأخرة')} value={metricValue(dataset.capa.available, overdueCapa.length)} note={text('Completion is not effectiveness', 'الإكمال ليس فعالية')} tone="danger" onClick={() => openDrilldown(text('Overdue CAPAs', 'إجراءات CAPA متأخرة'), text('Past due canonical CAPA records.', 'سجلات CAPA قانونية متجاوزة للاستحقاق.'), overdueCapa, 'capa', 'overview')} /><Metric icon={<ShieldCheck size={20} />} label={text('Pending approvals', 'اعتمادات معلقة')} value={metricValue(dataset.approvals.available, openApprovals.length)} note={text('Authority-governed requests', 'طلبات محكومة بالصلاحيات')} tone="primary" onClick={() => openDrilldown(text('Pending approvals', 'اعتمادات معلقة'), text('Open governed approval requests.', 'طلبات اعتماد محكومة مفتوحة.'), openApprovals as unknown as Array<Record<string, unknown>>, 'approvals', 'overview')} /></div><div className="ui7-dashboard-grid"><section className="ui7-surface ui7-span-7"><div className="ui7-section-heading"><div><span>{text('Executive GRC report', 'تقرير الحوكمة التنفيذي')}</span><h2>{text('Current governed pressure by module', 'الضغط المحكوم الحالي حسب الوحدة')}</h2></div><BarChart3 size={20} /></div><div className="ui7-module-pressure">{[
      ['Risk', highRisks.length, dataset.risks.available, 'risk'], ['Compliance', overdueCompliance.length, dataset.complianceRemediation.available, 'compliance'], ['Audit', openAudit.length, dataset.audit.available, 'audit'], ['CAPA', overdueCapa.length, dataset.capa.available, 'capa'], ['Training', overdueTraining.length, dataset.training.available, 'training'], ['Approvals', openApprovals.length, dataset.approvals.available, 'approvals'],
    ].map(([label, count, available, target]) => <button type="button" key={String(label)} disabled={!available} onClick={() => setView(target as ReportView)}><span><strong>{label}</strong><small>{available ? `${count} ${text('attention items', 'بنود اهتمام')}` : text('Metric unavailable', 'المؤشر غير متاح')}</small></span><i><b style={{ width: available ? `${Math.min(100, Math.max(8, Number(count) * 8))}%` : '0%' }} /></i><ArrowRight size={15} /></button>)}</div></section><section className="ui7-surface ui7-span-5"><div className="ui7-section-heading"><div><span>{text('Governance truth', 'حقيقة الحوكمة')}</span><h2>{text('Confirmed root events', 'الأحداث الجذرية المؤكدة')}</h2></div><BookOpenCheck size={20} /></div><div className="ui7-stat-list"><button type="button" onClick={() => setView('governance')}><span>{text('Policy nonconformities', 'حالات عدم مطابقة السياسة')}</span><strong>{dataset.governance.available ? governance.policyNonconformities.reduce((sum, row) => sum + row.count, 0) : text('N/A', 'غير متاح')}</strong></button><button type="button" onClick={() => setView('governance')}><span>{text('SOP procedure failures', 'إخفاقات إجراءات التشغيل')}</span><strong>{dataset.governance.available ? governance.sopProcedureFailures.reduce((sum, row) => sum + row.count, 0) : text('N/A', 'غير متاح')}</strong></button><button type="button" onClick={() => setView('governance')}><span>{text('Global root incidents', 'الحوادث الجذرية الإجمالية')}</span><strong>{dataset.governance.available ? governance.globalRootIncidentCount : text('N/A', 'غير متاح')}</strong></button><button type="button" onClick={() => setView('adequacy')}><span>{text('Governance review candidates', 'مرشحات مراجعة الحوكمة')}</span><strong>{dataset.governance.available ? governance.documentReviewCandidates.length : text('N/A', 'غير متاح')}</strong></button></div></section><section className="ui7-surface ui7-span-12"><div className="ui7-section-heading"><div><span>{text('Reporting integrity', 'نزاهة التقارير')}</span><h2>{text('Live, role-scoped governed sources', 'مصادر محكومة حية حسب الصلاحية')}</h2></div><ShieldCheck size={20} /></div><div className="ui7-integrity-strip"><div><strong>{availableSourceCount}/10</strong><span>{text('primary sources available', 'مصادر أساسية متاحة')}</span></div><div><strong>{formatDate(dataset.loadedAt)}</strong><span>{text('data as of', 'البيانات حتى')}</span></div><div><strong>{period === 'all' ? text('All visible history', 'كل السجل الظاهر') : `${period} ${text('days', 'يوماً')}`}</strong><span>{text('selected period', 'الفترة المحددة')}</span></div><div><strong>{department === 'all' ? text('All permitted departments', 'كل الإدارات المسموحة') : department}</strong><span>{text('permission-scoped filter', 'مرشح حسب الصلاحيات')}</span></div></div></section></div></div>;

    if (view === 'library') {
      const definitions = tabs.filter((tab) => !['overview', 'library'].includes(tab.id));
      const searched = definitions.filter((report) => !search || report.label.toLowerCase().includes(search.toLowerCase()));
      return <section className="ui7-surface" data-testid="ui7-report-library"><div className="ui7-section-heading"><div><span>{text('Report Library', 'مكتبة التقارير')}</span><h2>{text('Governed live reports', 'تقارير حية محكومة')}</h2></div><Library size={20} /></div><div className="ui7-library-table"><div className="ui7-library-row ui7-library-row--head"><span>{text('Report', 'التقرير')}</span><span>{text('Category', 'الفئة')}</span><span>{text('Type', 'النوع')}</span><span>{text('Data as of', 'البيانات حتى')}</span><span>{text('Action', 'الإجراء')}</span></div>{searched.map((report) => <button type="button" className="ui7-library-row" key={report.id} onClick={() => setView(report.id)}><span>{report.icon}<strong>{report.label}</strong></span><span>{humanize(report.id)}</span><span><StatusChip tone="good">{text('Live report', 'تقرير حي')}</StatusChip></span><span>{formatDate(dataset.loadedAt)}</span><span>{text('View report', 'عرض التقرير')}<ArrowRight size={15} /></span></button>)}</div><p className="ui7-context-note">{text('No export or immutable snapshot action is shown because UI-7 does not create a new persisted report-pack contract.', 'لا يظهر إجراء تصدير أو لقطة غير قابلة للتغيير لأن UI-7 لا ينشئ عقد حزمة تقارير محفوظة جديداً.')}</p></section>;
    }

    if (view === 'governance') return <div data-testid="ui7-governance-report"><div className="ui7-metric-grid"><Metric icon={<BookOpenCheck size={20} />} label={text('Confirmed Policy nonconformities', 'حالات عدم مطابقة السياسة المؤكدة')} value={metricValue(dataset.governance.available, governance.policyNonconformities.reduce((sum, row) => sum + row.count, 0))} note={text('Distinct root events by document', 'أحداث جذرية مميزة حسب الوثيقة')} tone="danger" /><Metric icon={<ListChecks size={20} />} label={text('Confirmed SOP procedure failures', 'إخفاقات الإجراءات المؤكدة')} value={metricValue(dataset.governance.available, governance.sopProcedureFailures.reduce((sum, row) => sum + row.count, 0))} note={text('Distinct root events by procedure', 'أحداث جذرية مميزة حسب الإجراء')} tone="warning" /><Metric icon={<ShieldCheck size={20} />} label={text('Global root incidents', 'الحوادث الجذرية الإجمالية')} value={metricValue(dataset.governance.available, governance.globalRootIncidentCount)} note={text('Policy + SOP same root counted once', 'يحتسب جذر السياسة والإجراء مرة واحدة')} tone="primary" /><Metric icon={<CheckCircle2 size={20} />} label={text('Events despite correct compliance', 'أحداث رغم الالتزام الصحيح')} value={metricValue(dataset.governance.available, governance.correctComplianceEvents.length)} note={text('Control weakness, not violation', 'ضعف رقابي وليس مخالفة')} tone="good" onClick={() => openDrilldown(text('Events Despite Correct Compliance', 'أحداث رغم الالتزام الصحيح'), text('Confirmed control failures where adherence was complied.', 'إخفاقات رقابية مؤكدة رغم حالة الالتزام.'), governance.correctComplianceEvents as unknown as Array<Record<string, unknown>>, 'ovr', 'governance')} /></div><div className="ui7-dashboard-grid"><section className="ui7-surface ui7-span-6"><div className="ui7-section-heading"><div><span>{text('Policy attribution', 'إسناد السياسة')}</span><h2>{text('Most frequent confirmed Policy nonconformities', 'أكثر حالات عدم مطابقة السياسة المؤكدة')}</h2></div><BookOpenCheck size={20} /></div><SourceBoundary source={dataset.governance} empty={!governance.policyNonconformities.length} text={text}><div className="ui7-attribution-list">{governance.policyNonconformities.map((row) => <button type="button" key={row.documentId} onClick={() => openDrilldown(row.label, text('Confirmed direct Policy attribution by distinct root event.', 'إسناد سياسة مباشر مؤكد حسب حدث جذري مميز.'), filtered.governance.filter((item) => item.target_document_id === row.documentId && row.rootEvents.includes(item.root_event_key)) as unknown as Array<Record<string, unknown>>, 'documents', 'governance')}><span><strong>{row.label}</strong><small>{row.versionId ? `${text('Historical version', 'الإصدار التاريخي')} · ${row.versionId.slice(0, 8)}` : text('Version not exposed', 'الإصدار غير ظاهر')}</small></span><em>{row.count}</em></button>)}</div></SourceBoundary></section><section className="ui7-surface ui7-span-6"><div className="ui7-section-heading"><div><span>{text('SOP attribution', 'إسناد الإجراء')}</span><h2>{text('Most frequent confirmed SOP procedure failures', 'أكثر إخفاقات الإجراءات المؤكدة')}</h2></div><ListChecks size={20} /></div><SourceBoundary source={dataset.governance} empty={!governance.sopProcedureFailures.length} text={text}><div className="ui7-attribution-list">{governance.sopProcedureFailures.map((row) => <button type="button" key={row.documentId} onClick={() => openDrilldown(row.label, text('Confirmed direct SOP attribution by distinct root event.', 'إسناد إجراء مباشر مؤكد حسب حدث جذري مميز.'), filtered.governance.filter((item) => item.target_document_id === row.documentId && row.rootEvents.includes(item.root_event_key)) as unknown as Array<Record<string, unknown>>, 'sops', 'governance')}><span><strong>{row.label}</strong><small>{row.versionId ? `${text('Historical version', 'الإصدار التاريخي')} · ${row.versionId.slice(0, 8)}` : text('Version not exposed', 'الإصدار غير ظاهر')}</small></span><em>{row.count}</em></button>)}</div></SourceBoundary></section><section className="ui7-surface ui7-span-12"><div className="ui7-boundary"><ShieldCheck size={22} /><div><strong>{text('Root-event-safe reporting', 'تقارير آمنة على مستوى الحدث الجذري')}</strong><p>{text('Only latest confirmed, non-context, direct relationships qualify. Suggested, rejected, under-review, superseded, inherited-only, unknown-adherence, and related-not-violated records are excluded. A Policy and SOP may each receive attribution while the global incident total counts their shared root once.', 'تتأهل فقط العلاقات المباشرة المؤكدة الأحدث وغير السياقية. تستبعد العلاقات المقترحة والمرفوضة وقيد المراجعة والملغاة والموروثة فقط ومجهولة الالتزام والمرتبطة دون مخالفة. يمكن إسناد الحدث للسياسة والإجراء مع احتساب الجذر المشترك مرة واحدة إجمالاً.')}</p></div></div></section></div></div>;

    if (view === 'adequacy') return <div data-testid="ui7-adequacy-report"><div className="ui7-metric-grid"><Metric icon={<FileSearch size={20} />} label={text('Documents requiring governance review', 'وثائق تتطلب مراجعة حوكمة')} value={metricValue(dataset.governance.available, governance.documentReviewCandidates.length)} note={text('Confirmed adequacy findings', 'نتائج كفاية مؤكدة')} tone="warning" /><Metric icon={<GraduationCap size={20} />} label={text('Training / competency gap documents', 'وثائق فجوات التدريب / الكفاءة')} value={metricValue(dataset.governance.available, governance.trainingGapDocuments.length)} note={text('Distinct root-event attribution', 'إسناد حسب حدث جذري مميز')} tone="danger" /><Metric icon={<CheckCircle2 size={20} />} label={text('Correct-compliance control failures', 'إخفاقات الرقابة مع الالتزام الصحيح')} value={metricValue(dataset.governance.available, governance.correctComplianceEvents.length)} note={text('Reported separately from violations', 'تبلغ منفصلة عن المخالفات')} tone="good" /></div><section className="ui7-surface"><div className="ui7-section-heading"><div><span>{text('Document adequacy / governance review', 'كفاية الوثيقة / مراجعة الحوكمة')}</span><h2>{text('Confirmed review candidates by governed document', 'مرشحات مراجعة مؤكدة حسب الوثيقة المحكومة')}</h2></div><FileSearch size={20} /></div><SourceBoundary source={dataset.governance} empty={!governance.documentReviewCandidates.length} text={text}><div className="ui7-attribution-list">{governance.documentReviewCandidates.map((row) => <button type="button" key={row.documentId} onClick={() => openDrilldown(row.label, text('Confirmed adequacy, implementation, training, or control weakness.', 'ضعف مؤكد في الكفاية أو التطبيق أو التدريب أو الرقابة.'), filtered.governance.filter((item) => item.target_document_id === row.documentId && row.rootEvents.includes(item.root_event_key)) as unknown as Array<Record<string, unknown>>, 'documents', 'adequacy')}><span><strong>{row.label}</strong><small>{row.versionId ? `${text('Exact version', 'الإصدار الدقيق')} · ${row.versionId.slice(0, 8)}` : text('Version unavailable', 'الإصدار غير متاح')}</small></span><em>{row.count}</em></button>)}</div></SourceBoundary></section></div>;

    const reportConfig: Partial<Record<ReportView, { testId: string; eyebrow: string; title: string; source: Ui7SourceResult<unknown>; rows: Ui7ReportRow[]; field: string; metrics: Array<{ label: string; value: number | null; note: string; tone: string; rows: Ui7ReportRow[] }>; page: PageKey }>> = {
      risk: { testId: 'ui7-risk-report', eyebrow: text('Risk analytics', 'تحليلات المخاطر'), title: text('Risk exposure and treatment', 'التعرض للمخاطر والمعالجة'), source: dataset.risks, rows: openRisks, field: 'risk_level', page: 'risks', metrics: [{ label: text('Open risks', 'مخاطر مفتوحة'), value: metricValue(dataset.risks.available, openRisks.length), note: text('Canonical current records', 'سجلات حالية قانونية'), tone: 'primary', rows: openRisks }, { label: text('High / critical', 'عالية / حرجة'), value: metricValue(dataset.risks.available, highRisks.length), note: text('Needs attention', 'تحتاج اهتماماً'), tone: 'danger', rows: highRisks }, { label: text('Overdue treatment', 'معالجة متأخرة'), value: metricValue(dataset.risks.available, overdueTreatment.length), note: text('Past due, incomplete', 'متجاوزة للاستحقاق وغير مكتملة'), tone: 'warning', rows: overdueTreatment }, { label: text('Reassessment required', 'تتطلب إعادة تقييم'), value: metricValue(dataset.risks.available, openRisks.filter((row) => boolValue(row, 'review_overdue')).length), note: text('Recorded review status', 'حالة مراجعة مسجلة'), tone: 'warning', rows: openRisks.filter((row) => boolValue(row, 'review_overdue')) }] },
      compliance: { testId: 'ui7-compliance-report', eyebrow: text('Compliance analytics', 'تحليلات الالتزام'), title: text('Obligation status and remediation', 'حالة الالتزامات والمعالجة'), source: dataset.compliance, rows: complianceRows, field: 'latest_assessment_result', page: 'compliance', metrics: [{ label: text('Compliant', 'ملتزمة'), value: metricValue(dataset.compliance.available, complianceRows.filter((row) => row.latest_assessment_result === 'compliant').length), note: text('Latest assessment result', 'نتيجة أحدث تقييم'), tone: 'good', rows: complianceRows.filter((row) => row.latest_assessment_result === 'compliant') }, { label: text('Partially compliant', 'ملتزمة جزئياً'), value: metricValue(dataset.compliance.available, complianceRows.filter((row) => row.latest_assessment_result === 'partially_compliant').length), note: text('Obligations, not findings', 'التزامات وليست نتائج'), tone: 'warning', rows: complianceRows.filter((row) => row.latest_assessment_result === 'partially_compliant') }, { label: text('Noncompliant', 'غير ملتزمة'), value: metricValue(dataset.compliance.available, complianceRows.filter((row) => row.latest_assessment_result === 'noncompliant').length), note: text('Latest approved truth', 'أحدث حقيقة معتمدة'), tone: 'danger', rows: complianceRows.filter((row) => row.latest_assessment_result === 'noncompliant') }, { label: text('Overdue remediation', 'معالجة متأخرة'), value: metricValue(dataset.complianceRemediation.available, overdueCompliance.length), note: text('Canonical action records', 'سجلات إجراءات قانونية'), tone: 'danger', rows: overdueCompliance }] },
      audit: { testId: 'ui7-audit-report', eyebrow: text('Audit analytics', 'تحليلات التدقيق'), title: text('Findings, severity, and closure ageing', 'النتائج والشدة وعمر الإغلاق'), source: dataset.audit, rows: openAudit, field: 'severity_level', page: 'audit', metrics: [{ label: text('Open findings', 'نتائج مفتوحة'), value: metricValue(dataset.audit.available, openAudit.length), note: text('Auditor truth preserved', 'حقيقة المدقق محفوظة'), tone: 'primary', rows: openAudit }, { label: text('Overdue', 'متأخرة'), value: metricValue(dataset.audit.available, overdueAudit.length), note: text('Past due open findings', 'نتائج مفتوحة متجاوزة'), tone: 'danger', rows: overdueAudit }, { label: text('Repeat findings', 'نتائج متكررة'), value: metricValue(dataset.audit.available, auditRows.filter((row) => boolValue(row, 'repeat_finding_flag')).length), note: text('Recorded repeat signal', 'إشارة تكرار مسجلة'), tone: 'warning', rows: auditRows.filter((row) => boolValue(row, 'repeat_finding_flag')) }, { label: text('Governance review', 'مراجعة حوكمة'), value: metricValue(dataset.governance.available, governance.documentReviewCandidates.filter((row) => filtered.governance.some((item) => item.source_entity_type === 'audit_finding' && item.target_document_id === row.documentId)).length), note: text('Confirmed adequacy truth', 'حقيقة كفاية مؤكدة'), tone: 'warning', rows: [] }] },
      capa: { testId: 'ui7-capa-report', eyebrow: text('CAPA effectiveness analytics', 'تحليلات فعالية CAPA'), title: text('Action completion and effectiveness', 'إكمال الإجراءات والفعالية'), source: dataset.capa, rows: openCapa, field: 'capa_status', page: 'capa', metrics: [{ label: text('Open CAPAs', 'CAPA مفتوحة'), value: metricValue(dataset.capa.available, openCapa.length), note: text('Current canonical status', 'الحالة القانونية الحالية'), tone: 'primary', rows: openCapa }, { label: text('Overdue', 'متأخرة'), value: metricValue(dataset.capa.available, overdueCapa.length), note: text('Past governed due date', 'بعد الاستحقاق المحكوم'), tone: 'danger', rows: overdueCapa }, { label: text('Effectiveness passed', 'الفعالية ناجحة'), value: metricValue(dataset.capaEffectiveness.available, effectiveness.filter((row) => ['passed', 'effective'].includes(String(value(row, 'review_result')))).length), note: text('Completed review result', 'نتيجة مراجعة مكتملة'), tone: 'good', rows: effectiveness.filter((row) => ['passed', 'effective'].includes(String(value(row, 'review_result')))) }, { label: text('Effectiveness failed', 'الفعالية فاشلة'), value: metricValue(dataset.capaEffectiveness.available, effectiveness.filter((row) => ['failed', 'ineffective'].includes(String(value(row, 'review_result')))).length), note: text('Recurrence / control concern', 'مخاوف تكرار / رقابة'), tone: 'danger', rows: effectiveness.filter((row) => ['failed', 'ineffective'].includes(String(value(row, 'review_result')))) }] },
      training: { testId: 'ui7-training-report', eyebrow: text('Training analytics', 'تحليلات التدريب'), title: text('Governed training and competency gaps', 'فجوات التدريب والكفاءة المحكومة'), source: dataset.training, rows: trainingRows, field: 'status', page: 'trainingGovernance', metrics: [{ label: text('Assigned', 'مسندة'), value: metricValue(dataset.training.available, trainingRows.filter((row) => ['assigned', 'in_progress'].includes(String(row.status))).length), note: text('Visible aggregate scope', 'نطاق إجمالي ظاهر'), tone: 'primary', rows: trainingRows.filter((row) => ['assigned', 'in_progress'].includes(String(row.status))) }, { label: text('Overdue training', 'تدريب متأخر'), value: metricValue(dataset.training.available, overdueTraining.length), note: text('Individual detail remains governed', 'تبقى تفاصيل الفرد محكومة'), tone: 'danger', rows: overdueTraining }, { label: text('Competency failures', 'إخفاقات الكفاءة'), value: metricValue(dataset.competency.available, competency.length), note: text('Permission-scoped aggregate', 'إجمالي حسب الصلاحيات'), tone: 'warning', rows: competency }, { label: text('Governance training gaps', 'فجوات تدريب الحوكمة'), value: metricValue(dataset.governance.available, governance.trainingGapDocuments.length), note: text('Confirmed document attribution', 'إسناد وثيقة مؤكد'), tone: 'warning', rows: [] }] },
      ovr: { testId: 'ui7-ovr-report', eyebrow: text('OVR analytics', 'تحليلات OVR'), title: text('Incident severity and governed findings', 'شدة الحوادث والنتائج المحكومة'), source: dataset.ovr, rows: ovrRows, field: 'severity_level', page: 'ovr', metrics: [{ label: text('Visible incidents', 'الحوادث الظاهرة'), value: metricValue(dataset.ovr.available, ovrRows.length), note: text('Role-scoped OVR records', 'سجلات OVR حسب الصلاحيات'), tone: 'primary', rows: ovrRows }, { label: text('Major / sentinel', 'جسيمة / حرجة'), value: metricValue(dataset.ovr.available, ovrRows.filter((row) => ['level_4', 'sentinel'].includes(String(row.severity_level))).length), note: text('Recorded severity only', 'الشدة المسجلة فقط'), tone: 'danger', rows: ovrRows.filter((row) => ['level_4', 'sentinel'].includes(String(row.severity_level))) }, { label: text('Confirmed Policy / SOP roots', 'جذور سياسة / إجراء مؤكدة'), value: metricValue(dataset.governance.available, governance.globalRootIncidentCount), note: text('No inherited duplicate inflation', 'دون تضخيم النسخ الموروثة'), tone: 'warning', rows: [] }, { label: text('Correct-compliance events', 'أحداث الالتزام الصحيح'), value: metricValue(dataset.governance.available, governance.correctComplianceEvents.length), note: text('Control weakness, not violation', 'ضعف رقابي وليس مخالفة'), tone: 'good', rows: governance.correctComplianceEvents as unknown as Ui7ReportRow[] }] },
    };
    const config = reportConfig[view];
    if (config) return <div data-testid={config.testId}><div className="ui7-metric-grid">{config.metrics.map((metric, index) => <Metric key={metric.label} icon={[<BarChart3 size={20} />, <AlertTriangle size={20} />, <CalendarDays size={20} />, <CheckCircle2 size={20} />][index]} label={metric.label} value={metric.value} note={metric.note} tone={metric.tone} onClick={metric.rows.length ? () => openDrilldown(metric.label, metric.note, metric.rows as Array<Record<string, unknown>>, config.page, view) : undefined} />)}</div><div className="ui7-dashboard-grid"><section className="ui7-surface ui7-span-7"><div className="ui7-section-heading"><div><span>{config.eyebrow}</span><h2>{config.title}</h2></div><BarChart3 size={20} /></div><SourceBoundary source={config.source} empty={!config.rows.length} text={text}><Distribution rows={config.rows as Array<Record<string, unknown>>} field={config.field} onSelect={(label, rows) => openDrilldown(`${config.title} · ${humanize(label)}`, text('Filtered governed source records.', 'سجلات مصدر محكومة مفلترة.'), rows, config.page, view)} /></SourceBoundary></section><section className="ui7-surface ui7-span-5"><div className="ui7-section-heading"><div><span>{text('Current records', 'السجلات الحالية')}</span><h2>{text('Governed drill-down preview', 'معاينة تفصيلية محكومة')}</h2></div><ListChecks size={20} /></div><SourceBoundary source={config.source} empty={!config.rows.length} text={text}><RecordList rows={config.rows as Array<Record<string, unknown>>} text={text} onOpen={(row) => openDrilldown(rowTitle(row), text('Single governed source record.', 'سجل مصدر محكوم واحد.'), [row], config.page, view)} /></SourceBoundary></section></div>{view === 'capa' ? <div className="ui7-boundary"><ShieldCheck size={22} /><div><strong>{text('Completed action is not an effective CAPA', 'الإجراء المكتمل ليس CAPA فعالاً')}</strong><p>{text('Effectiveness outcomes come only from governed effectiveness reviews. Action completion alone is never reported as effectiveness.', 'تأتي نتائج الفعالية فقط من مراجعات الفعالية المحكومة. لا يبلغ عن اكتمال الإجراء وحده كفعالية.')}</p></div></div> : null}</div>;

    if (view === 'portfolio') return <div data-testid="ui7-portfolio-evidence-report"><div className="ui7-metric-grid"><Metric icon={<BriefcaseBusiness size={20} />} label={text('Active projects', 'مشاريع نشطة')} value={metricValue(dataset.projects.available, projectRows.filter((row) => !['completed', 'closed', 'cancelled'].includes(String(row.status))).length)} note={text('Canonical project records', 'سجلات مشاريع قانونية')} tone="primary" /><Metric icon={<AlertTriangle size={20} />} label={text('Delayed / at risk', 'متأخرة / معرضة للخطر')} value={metricValue(dataset.projects.available, delayedProjects.length)} note={text('Stored health state', 'حالة صحية مسجلة')} tone="danger" /><Metric icon={<CalendarDays size={20} />} label={text('Overdue milestones / tasks', 'مراحل / مهام متأخرة')} value={metricValue(dataset.tasks.available && dataset.milestones.available, overdueDelivery.length)} note={text('Known due-date denominator', 'مقام معروف لتاريخ الاستحقاق')} tone="warning" /><Metric icon={<FileCheck2 size={20} />} label={text('Evidence awaiting verification', 'أدلة تنتظر التحقق')} value={metricValue(dataset.evidence.available, evidenceRows.length)} note={text('Visible review queue', 'قائمة المراجعة الظاهرة')} tone="warning" /></div><div className="ui7-dashboard-grid"><section className="ui7-surface ui7-span-6"><div className="ui7-section-heading"><div><span>{text('Project status', 'حالة المشروع')}</span><h2>{text('Strategic delivery portfolio', 'محفظة التنفيذ الاستراتيجي')}</h2></div><BriefcaseBusiness size={20} /></div><SourceBoundary source={dataset.projects} empty={!projectRows.length} text={text}><Distribution rows={projectRows} field="status" onSelect={(label, rows) => openDrilldown(`${text('Projects', 'المشاريع')} · ${humanize(label)}`, text('Canonical project status records.', 'سجلات حالة مشروع قانونية.'), rows, 'projects', 'portfolio')} /></SourceBoundary></section><section className="ui7-surface ui7-span-6"><div className="ui7-section-heading"><div><span>{text('Evidence state', 'حالة الأدلة')}</span><h2>{text('Evidence awaiting governed review', 'أدلة تنتظر مراجعة محكومة')}</h2></div><FileCheck2 size={20} /></div><SourceBoundary source={dataset.evidence} empty={!evidenceRows.length} text={text}><RecordList rows={evidenceRows} text={text} onOpen={(row) => openDrilldown(rowTitle(row), text('Evidence access remains independently governed.', 'يبقى الوصول إلى الأدلة محكوماً بشكل مستقل.'), [row], 'evidence', 'portfolio')} /></SourceBoundary><p className="ui7-context-note">{text('No evidence completeness percentage is shown because a reliable universal denominator is unavailable.', 'لا تظهر نسبة اكتمال الأدلة لعدم توفر مقام شامل موثوق.')}</p></section></div></div>;

    if (view === 'approvals') return <div data-testid="ui7-approval-report"><div className="ui7-metric-grid"><Metric icon={<ClipboardCheck size={20} />} label={text('Pending approvals', 'اعتمادات معلقة')} value={metricValue(dataset.approvals.available, openApprovals.length)} note={text('Current request state', 'حالة الطلب الحالية')} tone="primary" onClick={() => openDrilldown(text('Pending approvals', 'اعتمادات معلقة'), text('Open governed approval requests.', 'طلبات اعتماد محكومة مفتوحة.'), openApprovals as unknown as Array<Record<string, unknown>>, 'approvals', 'approvals')} /><Metric icon={<AlertTriangle size={20} />} label={text('Overdue approvals', 'اعتمادات متأخرة')} value={metricValue(dataset.approvals.available, overdueApprovals.length)} note={text('Past recorded due date', 'بعد تاريخ الاستحقاق المسجل')} tone="danger" onClick={() => openDrilldown(text('Overdue approvals', 'اعتمادات متأخرة'), text('Open requests past due.', 'طلبات مفتوحة متجاوزة للاستحقاق.'), overdueApprovals as unknown as Array<Record<string, unknown>>, 'approvals', 'approvals')} /><Metric icon={<CheckCircle2 size={20} />} label={text('Approved decisions', 'قرارات معتمدة')} value={metricValue(dataset.approvalHistory.available, filtered.approvalHistory.filter((row) => row.decision === 'approved').length)} note={text('Immutable history rows', 'صفوف سجل غير قابلة للتغيير')} tone="good" /><Metric icon={<CalendarDays size={20} />} label={text('Average decision time', 'متوسط وقت القرار')} value={null} note={text('Reliable denominator unavailable', 'المقام الموثوق غير متاح')} tone="warning" /></div><div className="ui7-dashboard-grid"><section className="ui7-surface ui7-span-7"><div className="ui7-section-heading"><div><span>{text('Approval workload', 'عبء الاعتمادات')}</span><h2>{text('Pending requests by module', 'الطلبات المعلقة حسب الوحدة')}</h2></div><ClipboardCheck size={20} /></div><SourceBoundary source={dataset.approvals} empty={!openApprovals.length} text={text}><Distribution rows={openApprovals as unknown as Array<Record<string, unknown>>} field="workflow_type" onSelect={(label, rows) => openDrilldown(`${text('Approvals', 'الاعتمادات')} · ${humanize(label)}`, text('Permission-scoped request rows.', 'صفوف طلبات حسب الصلاحية.'), rows, 'approvals', 'approvals')} /></SourceBoundary></section><section className="ui7-surface ui7-span-5"><div className="ui7-section-heading"><div><span>{text('Decision outcomes', 'نتائج القرارات')}</span><h2>{text('Immutable approval history', 'سجل اعتماد غير قابل للتغيير')}</h2></div><ShieldCheck size={20} /></div><SourceBoundary source={dataset.approvalHistory} empty={!filtered.approvalHistory.length} text={text}><Distribution rows={filtered.approvalHistory as unknown as Array<Record<string, unknown>>} field="decision" /></SourceBoundary></section></div></div>;

    if (view === 'drilldown' && drilldown) return <div className="ui7-report-drilldown" data-testid="ui7-report-drilldown"><button type="button" className="ui7-back" onClick={() => setView(drilldown.returnView)}><ArrowLeft size={16} />{text('Back to report', 'العودة للتقرير')}</button><header className="ui7-record-header"><div><span>{text('Governed drill-down', 'تفصيل محكوم')}</span><h1>{drilldown.title}</h1><p>{drilldown.note}</p><StatusChip tone="primary">{drilldown.rows.length} {text('visible records', 'سجلات ظاهرة')}</StatusChip></div>{drilldown.sourcePage ? <button type="button" className="ui7-secondary-button" onClick={() => setPage(drilldown.sourcePage!)}>{text('Open source module', 'فتح وحدة المصدر')}<ArrowRight size={16} /></button> : null}</header><section className="ui7-surface"><div className="ui7-section-heading"><div><span>{text('Filtered source data', 'بيانات المصدر المفلترة')}</span><h2>{text('Permission-scoped records', 'سجلات حسب الصلاحيات')}</h2></div><ListChecks size={20} /></div><RecordList rows={filteredSearch(drilldown.rows)} text={text} /></section></div>;
    return null;
  }

  return <section className="ui7-workspace ui7-reports" data-testid="ui7-reports">
    {view !== 'drilldown' ? <><header className="ui7-module-header"><div><span>{text('Reports & Analytics', 'التقارير والتحليلات')}</span><h1>{text('Governed reporting center', 'مركز التقارير المحكومة')}</h1><p>{text('Role-scoped live reporting across GRC modules, confirmed governance truth, exact document versions, and root-event-safe attribution.', 'تقارير حية حسب الصلاحيات عبر وحدات الحوكمة مع حقيقة حوكمة مؤكدة وإصدارات وثائق دقيقة وإسناد آمن للأحداث الجذرية.')}</p></div><div className="ui7-header-state"><ShieldCheck size={18} /><span><strong>{availableSourceCount}</strong>{text('governed sources available', 'مصادر محكومة متاحة')}</span></div></header><nav className="ui7-view-tabs ui7-report-tabs" aria-label={text('Report views', 'عروض التقارير')}>{tabs.map((tab) => <button type="button" key={tab.id} title={tab.label} className={view === tab.id ? 'active' : ''} aria-pressed={view === tab.id} onClick={() => setView(tab.id)}>{tab.icon}<span>{tab.label}</span></button>)}</nav><div className="ui7-filterbar" aria-label={text('Report filters', 'مرشحات التقارير')}><label className="ui7-search"><Search size={16} /><span className="sr-only">{text('Search report data', 'البحث في بيانات التقرير')}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text('Search current report...', 'ابحث في التقرير الحالي...')} /></label><label><span className="sr-only">{text('Period', 'الفترة')}</span><select aria-label={text('Reporting period', 'فترة التقرير')} value={period} onChange={(event) => setPeriod(event.target.value)}><option value="all">{text('All visible history', 'كل السجل الظاهر')}</option><option value="30">{text('Last 30 days', 'آخر 30 يوماً')}</option><option value="90">{text('Last 90 days', 'آخر 90 يوماً')}</option><option value="365">{text('Last 12 months', 'آخر 12 شهراً')}</option></select></label><label><span className="sr-only">{text('Department', 'الإدارة')}</span><select aria-label={text('Department scope', 'نطاق الإدارة')} value={department} onChange={(event) => setDepartment(event.target.value)}><option value="all">{text('All permitted departments', 'كل الإدارات المسموحة')}</option>{departmentOptions.map((option) => <option value={option} key={option}>{option}</option>)}</select></label><label><span className="sr-only">{text('Module', 'الوحدة')}</span><select aria-label={text('Module filter', 'مرشح الوحدة')} value={moduleFilter} onChange={(event) => { const next = event.target.value; setModuleFilter(next); if (next !== 'all') setView(next as ReportView); }}><option value="all">{text('All modules', 'كل الوحدات')}</option>{tabs.filter((tab) => !['overview', 'library', 'governance', 'adequacy'].includes(tab.id)).map((tab) => <option value={tab.id} key={tab.id}>{tab.label}</option>)}</select></label>{['governance', 'adequacy'].includes(view) ? <label><span className="sr-only">{text('Criterion', 'المعيار')}</span><select aria-label={text('Criterion filter', 'مرشح المعيار')} value={criterionFilter} onChange={(event) => setCriterionFilter(event.target.value)}><option value="all">{text('All permitted criteria', 'كل المعايير المسموحة')}</option>{criteriaOptions.map((criterion) => <option value={criterion} key={criterion}>{humanize(criterion)}</option>)}</select></label> : null}<button type="button" className="ui7-icon-button" title={text('Reset report filters', 'إعادة تعيين مرشحات التقرير')} onClick={() => { setSearch(''); setPeriod('all'); setDepartment('all'); setModuleFilter('all'); setCriterionFilter('all'); }}><Filter size={17} /></button></div></> : null}
    <DataState loading={data.loading} error={data.error} empty={!data.loading && !data.error && !dataset} emptyTitle={text('Reports unavailable', 'التقارير غير متاحة')} emptyMessage={text('No governed report dataset could be initialized.', 'تعذر تهيئة مجموعة بيانات تقارير محكومة.')}>
      {reportPanel()}
    </DataState>
  </section>;
}
