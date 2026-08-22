import { useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Download,
  FileCheck2,
  FileSearch,
  FolderKanban,
  HardDrive,
  LayoutDashboard,
  Link2,
  ListFilter,
  Lock,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  Upload,
  XCircle,
} from 'lucide-react';
import type { PageKey } from '../components/Layout';
import { DataState } from '../components/DataState';
import { GovernedEvidenceAccess } from '../components/GovernedEvidenceAccess';
import { Modal } from '../components/Modal';
import { EvidenceUploadForm, type EvidenceUploadItemType } from '../components/WorkItemControls';
import { useAuth } from '../auth/AuthProvider';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import {
  getEvidenceClosureGateStatus,
  getEvidenceGapDashboard,
  getEvidencePackIndex,
  getEvidenceQueue,
  getEvidenceReviewQueue,
  getSensitiveEvidenceRegister,
} from '../lib/grcApi';
import { formatDate, humanize } from '../lib/format';
import type { EvidencePackIndexRow } from '../types/domain';
import { Evidence as EvidenceGovernanceConsole } from './Evidence';

type EvidenceView = 'overview' | 'repository' | 'status' | 'categories' | 'retention' | 'requests' | 'collections' | 'storage' | 'actions' | 'search' | 'detail' | 'review';

interface EvidenceCenterProps {
  setPage: (page: PageKey) => void;
}

interface EvidenceFileView {
  id: string;
  code: string | null;
  title: string;
  fileName: string | null;
  evidenceType: string;
  sensitivity: string;
  reviewStatus: string;
  uploadedBy: string | null;
  reviewer: string | null;
  createdAt: string | null;
  expiryDate: string | null;
  renewalRequired: boolean;
  revisionRequired: boolean;
  lockedAt: string | null;
  links: EvidencePackIndexRow[];
  restricted: boolean;
}

function Metric({ icon, label, value, note, tone = 'neutral' }: { icon: ReactNode; label: string; value: string | number; note: string; tone?: string }) {
  return <article className={`ui6-metric ui6-tone--${tone}`}><span className="ui6-metric__icon">{icon}</span><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></article>;
}

function StatusChip({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={`ui6-chip ui6-tone--${tone}`}>{children}</span>;
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return <div className="ui6-empty"><FileCheck2 size={24} /><strong>{title}</strong><p>{body}</p></div>;
}

function statusTone(status: string) {
  if (['accepted', 'approved', 'verified', 'renewed'].includes(status)) return 'good';
  if (['rejected', 'expired'].includes(status)) return 'danger';
  if (['pending_review', 'submitted', 'needs_revision', 'waived'].includes(status)) return 'warning';
  return 'neutral';
}

function relationshipRoute(itemType: string): PageKey | null {
  if (['project', 'milestone', 'task'].includes(itemType)) return 'projects';
  if (itemType === 'risk') return 'risks';
  if (itemType === 'compliance') return 'compliance';
  if (itemType === 'audit_finding') return 'audit';
  if (itemType === 'capa') return 'capa';
  if (itemType === 'ovr') return 'ovr';
  if (itemType === 'policy') return 'documents';
  if (['training', 'training_assignment', 'training_program'].includes(itemType)) return 'trainingGovernance';
  if (itemType === 'control') return 'governance';
  return null;
}

function isExpired(date: string | null) {
  if (!date) return false;
  const value = new Date(`${date.slice(0, 10)}T23:59:59`).getTime();
  return !Number.isNaN(value) && value < Date.now();
}

function isExpiring(date: string | null) {
  if (!date || isExpired(date)) return false;
  const value = new Date(`${date.slice(0, 10)}T23:59:59`).getTime();
  return value <= Date.now() + 90 * 86_400_000;
}

export function EvidenceCenter({ setPage }: EvidenceCenterProps) {
  const auth = useAuth();
  const { language } = useI18n();
  const text = (en: string, ar: string) => language === 'ar' ? ar : en;
  const [view, setView] = useState<EvidenceView>('overview');
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sensitivityFilter, setSensitivityFilter] = useState('all');
  const [uploadTarget, setUploadTarget] = useState<EvidencePackIndexRow | null>(null);

  const data = useAsyncData(async () => {
    const [reviewQueue, packIndex, sensitive, gaps, gates, legacy] = await Promise.all([
      getEvidenceReviewQueue(),
      getEvidencePackIndex(),
      getSensitiveEvidenceRegister(),
      getEvidenceGapDashboard(),
      getEvidenceClosureGateStatus(),
      getEvidenceQueue(),
    ]);
    return { reviewQueue, packIndex, sensitive, gaps, gates, legacy };
  }, []);

  const canGovernEvidence = auth.roles.some(role => ['super_admin', 'governance_admin', 'compliance_officer', 'department_manager', 'auditor'].includes(role.role));
  const reviewQueue = data.data?.reviewQueue ?? [];
  const packIndex = data.data?.packIndex ?? [];
  const sensitive = data.data?.sensitive ?? [];
  const gaps = data.data?.gaps ?? [];
  const gates = data.data?.gates ?? [];
  const legacy = data.data?.legacy ?? [];

  const evidenceFiles = useMemo<EvidenceFileView[]>(() => {
    const rows = new Map<string, EvidenceFileView>();
    const sensitiveById = new Map(sensitive.map(row => [row.evidence_file_id, row]));
    const queueById = new Map(reviewQueue.map(row => [row.evidence_file_id, row]));
    const legacyById = new Map(legacy.map(row => [row.id, row]));
    const linksById = new Map<string, EvidencePackIndexRow[]>();
    for (const link of packIndex) linksById.set(link.evidence_file_id, [...(linksById.get(link.evidence_file_id) ?? []), link]);
    const ids = new Set([...queueById.keys(), ...linksById.keys(), ...sensitiveById.keys(), ...legacyById.keys()]);
    for (const id of ids) {
      const queue = queueById.get(id);
      const sensitiveRow = sensitiveById.get(id);
      const old = legacyById.get(id);
      const links = linksById.get(id) ?? [];
      const first = links[0];
      const sensitivity = queue?.sensitivity_level || sensitiveRow?.sensitivity_level || first?.sensitivity_level || old?.sensitivity_level || 'internal';
      const restricted = sensitivity === 'restricted' || sensitivity === 'highly_sensitive';
      rows.set(id, {
        id,
        code: queue?.evidence_code || sensitiveRow?.evidence_code || first?.evidence_code || old?.evidence_code || null,
        title: queue?.evidence_title || sensitiveRow?.evidence_title || first?.evidence_title || old?.evidence_title || old?.item_title || text('Untitled evidence', 'دليل بلا عنوان'),
        fileName: queue?.file_name || sensitiveRow?.file_name || first?.file_name || old?.file_name || null,
        evidenceType: queue?.evidence_type || first?.evidence_type || old?.evidence_type || old?.file_type || 'other',
        sensitivity,
        reviewStatus: queue?.review_status || sensitiveRow?.review_status || first?.review_status || old?.review_status || old?.status || 'submitted',
        uploadedBy: queue?.uploaded_by_name || old?.uploaded_by_name || null,
        reviewer: queue?.reviewer_name || sensitiveRow?.reviewer_name || first?.reviewer_name || old?.reviewed_by_name || null,
        createdAt: queue?.created_at || sensitiveRow?.created_at || old?.created_at || first?.linked_at || null,
        expiryDate: queue?.expiry_date || sensitiveRow?.expiry_date || old?.expiry_date || null,
        renewalRequired: Boolean(queue?.renewal_required || sensitiveRow?.renewal_required || old?.renewal_required),
        revisionRequired: Boolean(queue?.revision_required || old?.revision_required),
        lockedAt: queue?.locked_at || sensitiveRow?.locked_at || old?.locked_at || null,
        links,
        restricted,
      });
    }
    return [...rows.values()].sort((left, right) => (right.createdAt || '').localeCompare(left.createdAt || ''));
  }, [legacy, packIndex, reviewQueue, sensitive, language]);

  const selectedEvidence = evidenceFiles.find(row => row.id === selectedEvidenceId) ?? null;
  const filteredEvidence = evidenceFiles.filter(row => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [row.code, row.title, row.fileName, row.evidenceType, row.uploadedBy, ...row.links.map(link => link.linked_item_title)].some(value => value?.toLowerCase().includes(query));
    return matchesSearch
      && (statusFilter === 'all' || row.reviewStatus === statusFilter)
      && (typeFilter === 'all' || row.evidenceType === typeFilter)
      && (sensitivityFilter === 'all' || row.sensitivity === sensitivityFilter);
  });
  const accepted = evidenceFiles.filter(row => row.reviewStatus === 'accepted');
  const pending = evidenceFiles.filter(row => ['submitted', 'pending_review', 'needs_revision'].includes(row.reviewStatus));
  const rejected = evidenceFiles.filter(row => row.reviewStatus === 'rejected');
  const expiring = evidenceFiles.filter(row => isExpiring(row.expiryDate));
  const expired = evidenceFiles.filter(row => isExpired(row.expiryDate));
  const restricted = evidenceFiles.filter(row => row.restricted);
  const reused = evidenceFiles.filter(row => row.links.length > 1);
  const uploadTargets = useMemo(() => {
    const targets = new Map<string, EvidencePackIndexRow>();
    for (const row of packIndex) {
      if (!['project', 'milestone', 'task'].includes(row.linked_item_type)) continue;
      const key = `${row.linked_item_type}:${row.linked_item_id}`;
      if (!targets.has(key)) targets.set(key, row);
    }
    return [...targets.values()];
  }, [packIndex]);

  const categories = useMemo(() => {
    const grouped = new Map<string, EvidenceFileView[]>();
    for (const row of filteredEvidence) grouped.set(row.evidenceType, [...(grouped.get(row.evidenceType) ?? []), row]);
    return [...grouped.entries()].map(([type, rows]) => ({ type, rows })).sort((left, right) => right.rows.length - left.rows.length);
  }, [filteredEvidence]);
  const collections = useMemo(() => {
    const grouped = new Map<string, EvidencePackIndexRow[]>();
    for (const row of packIndex) {
      const key = `${row.linked_item_type}:${row.linked_item_id}`;
      grouped.set(key, [...(grouped.get(key) ?? []), row]);
    }
    return [...grouped.entries()].map(([key, rows]) => ({ key, rows, first: rows[0] }));
  }, [packIndex]);
  const sourceCounts = useMemo(() => {
    const grouped = new Map<string, Set<string>>();
    for (const row of packIndex) {
      const set = grouped.get(row.linked_item_type) ?? new Set<string>();
      set.add(row.evidence_file_id);
      grouped.set(row.linked_item_type, set);
    }
    return [...grouped.entries()].map(([type, ids]) => ({ type, count: ids.size })).sort((left, right) => right.count - left.count);
  }, [packIndex]);

  const tabs: Array<{ id: Exclude<EvidenceView, 'detail' | 'review'>; label: string; icon: ReactNode }> = [
    { id: 'overview', label: text('Overview', 'نظرة عامة'), icon: <LayoutDashboard size={16} /> },
    { id: 'repository', label: text('Evidence Repository', 'مستودع الأدلة'), icon: <FolderKanban size={16} /> },
    { id: 'status', label: text('Evidence Status', 'حالة الأدلة'), icon: <CheckCircle2 size={16} /> },
    { id: 'categories', label: text('Categories', 'الفئات'), icon: <BarChart3 size={16} /> },
    { id: 'retention', label: text('Retention & Validity', 'الاحتفاظ والصلاحية'), icon: <CalendarClock size={16} /> },
    { id: 'requests', label: text('Requests', 'الطلبات'), icon: <Clock3 size={16} /> },
    { id: 'collections', label: text('Collections', 'المجموعات'), icon: <PackageCheck size={16} /> },
    { id: 'storage', label: text('Storage & Access', 'التخزين والوصول'), icon: <HardDrive size={16} /> },
    { id: 'actions', label: text('Quick Actions', 'إجراءات سريعة'), icon: <Plus size={16} /> },
    { id: 'search', label: text('Search', 'البحث'), icon: <FileSearch size={16} /> },
  ];

  function openEvidence(row: EvidenceFileView) {
    setSelectedEvidenceId(row.id);
    setView('detail');
  }

  function navigateToRelationship(type: string) {
    const page = relationshipRoute(type);
    if (!page) return;
    const query = new URLSearchParams(window.location.search);
    query.set('page', page);
    window.history.pushState(null, '', `${window.location.pathname}?${query.toString()}`);
    setPage(page);
  }

  const filters = <div className="ui6-filterbar" aria-label={text('Evidence filters', 'مرشحات الأدلة')}>
    <label className="ui6-search"><Search size={16} /><span className="sr-only">{text('Search evidence', 'البحث في الأدلة')}</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder={text('Search evidence, code, source...', 'ابحث عن دليل أو رمز أو مصدر...')} /></label>
    <label><span className="sr-only">{text('Review status', 'حالة المراجعة')}</span><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">{text('All statuses', 'كل الحالات')}</option>{[...new Set(evidenceFiles.map(row => row.reviewStatus))].map(status => <option value={status} key={status}>{humanize(status)}</option>)}</select></label>
    <label><span className="sr-only">{text('Evidence type', 'نوع الدليل')}</span><select value={typeFilter} onChange={event => setTypeFilter(event.target.value)}><option value="all">{text('All types', 'كل الأنواع')}</option>{[...new Set(evidenceFiles.map(row => row.evidenceType))].map(type => <option value={type} key={type}>{humanize(type)}</option>)}</select></label>
    <label><span className="sr-only">{text('Sensitivity', 'الحساسية')}</span><select value={sensitivityFilter} onChange={event => setSensitivityFilter(event.target.value)}><option value="all">{text('All access levels', 'كل مستويات الوصول')}</option>{[...new Set(evidenceFiles.map(row => row.sensitivity))].map(value => <option value={value} key={value}>{humanize(value)}</option>)}</select></label>
    <button type="button" className="ui6-icon-button" title={text('Clear filters', 'مسح المرشحات')} onClick={() => { setSearch(''); setStatusFilter('all'); setTypeFilter('all'); setSensitivityFilter('all'); }}><ListFilter size={17} /></button>
  </div>;

  const repository = <div className="ui6-evidence-table" role="table" aria-label={text('Evidence repository', 'مستودع الأدلة')}>
    <div className="ui6-evidence-row ui6-evidence-row--head" role="row"><span>{text('Evidence', 'الدليل')}</span><span>{text('Type', 'النوع')}</span><span>{text('Source / Usage', 'المصدر والاستخدام')}</span><span>{text('Owner', 'المالك')}</span><span>{text('Status', 'الحالة')}</span><span>{text('Uploaded', 'تاريخ الرفع')}</span></div>
    {filteredEvidence.map(row => <button type="button" className="ui6-evidence-row" role="row" onClick={() => openEvidence(row)} key={row.id}>
      <span><strong>{row.code || 'EVD'} · {row.title}</strong><small>{row.restricted ? <><Lock size={12} />{text('Restricted metadata', 'بيانات وصفية مقيدة')}</> : row.fileName}</small></span>
      <span>{humanize(row.evidenceType)}</span>
      <span>{row.links.length ? `${row.links.length} ${text(row.links.length === 1 ? 'governed use' : 'governed uses', 'استخدام محكوم')}` : text('Unlinked', 'غير مرتبط')}</span>
      <span>{row.uploadedBy || text('Not available', 'غير متاح')}</span>
      <span><StatusChip tone={statusTone(row.reviewStatus)}>{humanize(row.reviewStatus)}</StatusChip></span>
      <span>{formatDate(row.createdAt)}</span>
    </button>)}
  </div>;

  function detailContent() {
    if (!selectedEvidence) return <EmptyPanel title={text('Evidence not found', 'لم يتم العثور على الدليل')} body={text('Return to the repository and select a visible record.', 'عد إلى المستودع واختر سجلاً ظاهراً.')} />;
    return <div className="ui6-detail" data-testid="ui6-evidence-detail">
      <button type="button" className="ui6-back" onClick={() => setView('repository')}><ArrowLeft size={16} />{text('Evidence Repository', 'مستودع الأدلة')}</button>
      <header className="ui6-record-header"><div><span>{selectedEvidence.code || 'EVD'} · {humanize(selectedEvidence.evidenceType)}</span><h1>{selectedEvidence.title}</h1><p>{selectedEvidence.restricted ? text('Restricted evidence metadata is shown only within the authorized evidence record scope.', 'تعرض البيانات الوصفية للدليل المقيد فقط ضمن نطاق سجل الدليل المصرح به.') : selectedEvidence.fileName || text('File metadata unavailable', 'بيانات الملف غير متاحة')}</p><div className="ui6-record-tags"><StatusChip tone={statusTone(selectedEvidence.reviewStatus)}>{humanize(selectedEvidence.reviewStatus)}</StatusChip><StatusChip tone={selectedEvidence.restricted ? 'danger' : 'neutral'}>{humanize(selectedEvidence.sensitivity)}</StatusChip>{selectedEvidence.links.length > 1 ? <StatusChip tone="primary">{text('Multi-source reuse', 'إعادة استخدام متعددة المصادر')}</StatusChip> : null}</div></div><div className="ui6-record-actions"><button type="button" className="ui6-secondary-button" onClick={() => setView('review')}><ShieldCheck size={16} />{text('Review & verification', 'المراجعة والتحقق')}</button></div></header>
      <div className="ui6-detail-grid"><main className="ui6-stack"><section className="ui6-surface"><div className="ui6-section-heading"><div><span>{text('Metadata', 'البيانات الوصفية')}</span><h2>{text('Governed evidence record', 'سجل الدليل المحكوم')}</h2></div><FileCheck2 size={20} /></div><dl className="ui6-data-grid"><div><dt>{text('Evidence code', 'رمز الدليل')}</dt><dd>{selectedEvidence.code || '—'}</dd></div><div><dt>{text('Type', 'النوع')}</dt><dd>{humanize(selectedEvidence.evidenceType)}</dd></div><div><dt>{text('Uploader', 'رافع الدليل')}</dt><dd>{selectedEvidence.uploadedBy || '—'}</dd></div><div><dt>{text('Upload date', 'تاريخ الرفع')}</dt><dd>{formatDate(selectedEvidence.createdAt)}</dd></div><div><dt>{text('Reviewer', 'المراجع')}</dt><dd>{selectedEvidence.reviewer || text('Pending assignment', 'بانتظار الإسناد')}</dd></div><div><dt>{text('Review state', 'حالة المراجعة')}</dt><dd>{humanize(selectedEvidence.reviewStatus)}</dd></div><div><dt>{text('Validity / expiry', 'الصلاحية والانتهاء')}</dt><dd>{selectedEvidence.expiryDate ? formatDate(selectedEvidence.expiryDate) : text('Not applicable', 'غير منطبق')}</dd></div><div><dt>{text('Version state', 'حالة الإصدار')}</dt><dd>{selectedEvidence.lockedAt ? text('Locked historical record', 'سجل تاريخي مقفل') : text('Current governed record', 'سجل محكوم حالي')}</dd></div></dl>{selectedEvidence.revisionRequired || selectedEvidence.reviewStatus === 'rejected' ? <div className="ui6-delay"><XCircle size={18} /><div><strong>{text('Replacement or revision required', 'يلزم الاستبدال أو المراجعة')}</strong><p>{text('The rejected record remains in history; a replacement does not silently overwrite it.', 'يبقى السجل المرفوض في التاريخ؛ لا يستبدله الدليل الجديد بصمت.')}</p></div></div> : null}</section><section className="ui6-surface" data-testid="ui6-evidence-relationships"><div className="ui6-section-heading"><div><span>{text('Relationships', 'العلاقات')}</span><h2>{text('Governed source usage', 'استخدام المصدر المحكوم')}</h2></div><Link2 size={20} /></div>{selectedEvidence.links.length ? <div className="ui6-lineage-list">{selectedEvidence.links.map(link => <div key={`${link.linked_item_type}:${link.linked_item_id}`}><span className="ui6-lineage-icon"><Link2 size={16} /></span><div><strong>{humanize(link.linked_item_type)} · {link.linked_item_title || link.linked_item_id}</strong><p>{[link.required_for_closure && text('Required for closure', 'مطلوب للإغلاق'), link.required_for_acceptance && text('Required for acceptance', 'مطلوب للقبول'), link.required_for_approval && text('Required for approval', 'مطلوب للاعتماد'), link.required_for_treatment && text('Required for treatment', 'مطلوب للمعالجة')].filter(Boolean).join(' · ') || text('Supporting relationship', 'علاقة داعمة')}</p></div>{relationshipRoute(link.linked_item_type) ? <button type="button" className="ui6-link-button" onClick={() => navigateToRelationship(link.linked_item_type)}>{text('Open source', 'فتح المصدر')}</button> : null}</div>)}</div> : <EmptyPanel title={text('No governed links visible', 'لا توجد روابط محكومة ظاهرة')} body={text('An unlinked record is not counted as sufficient evidence for any source.', 'لا يحتسب السجل غير المرتبط كدليل كاف لأي مصدر.')} />}</section></main><aside className="ui6-stack"><section className="ui6-surface"><div className="ui6-section-heading"><div><span>{text('File access', 'الوصول إلى الملف')}</span><h2>{selectedEvidence.restricted ? text('Restricted', 'مقيد') : text('Individually authorized', 'مصرح به فردياً')}</h2></div><Lock size={20} /></div><p className="ui6-context-note">{text('Seeing this relationship does not grant access to the underlying private file. Every view or download request is separately authorized and audited.', 'رؤية هذه العلاقة لا تمنح حق الوصول إلى الملف الخاص. يتم تفويض وتدقيق كل طلب عرض أو تنزيل بشكل مستقل.')}</p>{selectedEvidence.fileName ? <GovernedEvidenceAccess evidenceId={selectedEvidence.id} fileName={selectedEvidence.restricted ? text('Restricted evidence file', 'ملف دليل مقيد') : selectedEvidence.fileName} /> : null}</section><section className="ui6-surface"><div className="ui6-section-heading"><div><span>{text('Verification', 'التحقق')}</span><h2>{humanize(selectedEvidence.reviewStatus)}</h2></div><ShieldCheck size={20} /></div><div className="ui6-stat-list"><div><span>{text('Uploaded', 'تم الرفع')}</span><strong>{text('Yes', 'نعم')}</strong></div><div><span>{text('Verified / accepted', 'تم التحقق أو القبول')}</span><strong>{selectedEvidence.reviewStatus === 'accepted' ? text('Yes', 'نعم') : text('No', 'لا')}</strong></div><div><span>{text('Renewal required', 'يلزم التجديد')}</span><strong>{selectedEvidence.renewalRequired ? text('Yes', 'نعم') : text('No', 'لا')}</strong></div></div></section></aside></div>
    </div>;
  }

  return <section className="ui6-workspace ui6-evidence" data-testid="ui6-evidence-workspace">
    {view === 'review' ? <><button type="button" className="ui6-back" onClick={() => setView('status')}><ArrowLeft size={16} />{text('Evidence Center', 'مركز الأدلة')}</button><div className="ui6-governance-console" data-testid="ui6-evidence-review"><EvidenceGovernanceConsole /></div></> : view === 'detail' ? detailContent() : <>
      <header className="ui6-module-header"><div><span>{text('Evidence Center', 'مركز الأدلة')}</span><h1>{text('Governed evidence repository', 'مستودع الأدلة المحكوم')}</h1><p>{text('Traceable evidence metadata, verification, relationships, retention and private file access.', 'بيانات أدلة قابلة للتتبع والتحقق والعلاقات والاحتفاظ والوصول الخاص للملفات.')}</p></div>{canGovernEvidence && uploadTargets.length ? <button type="button" className="ui6-primary-button" onClick={() => setUploadTarget(uploadTargets[0])}><Upload size={17} />{text('Upload evidence', 'رفع دليل')}</button> : null}</header>
      <nav className="ui6-workspace-nav" aria-label={text('Evidence workspace views', 'عروض مساحة عمل الأدلة')}>{tabs.map(tab => <button type="button" className={view === tab.id ? 'active' : ''} aria-pressed={view === tab.id} onClick={() => setView(tab.id)} key={tab.id}>{tab.icon}<span>{tab.label}</span></button>)}</nav>
      {filters}
      <DataState loading={data.loading} error={data.error} empty={!data.loading && !data.error && !evidenceFiles.length} emptyTitle={text('No visible evidence', 'لا توجد أدلة ظاهرة')} emptyMessage={text('No governed evidence metadata is visible in the current role and organization scope.', 'لا توجد بيانات وصفية لأدلة محكومة ظاهرة ضمن نطاق الدور والمنشأة الحالي.')}>
        {view === 'overview' ? <div data-testid="ui6-evidence-overview"><div className="ui6-metric-grid ui6-metric-grid--five"><Metric icon={<FolderKanban size={20} />} label={text('Total evidence', 'إجمالي الأدلة')} value={evidenceFiles.length} note={text('Unique governed files', 'ملفات محكومة فريدة')} tone="primary" /><Metric icon={<CheckCircle2 size={20} />} label={text('Accepted', 'مقبول')} value={accepted.length} note={text('Independently reviewed', 'تمت مراجعته باستقلالية')} tone="good" /><Metric icon={<Clock3 size={20} />} label={text('Pending review', 'بانتظار المراجعة')} value={pending.length} note={text('Uploaded is not verified', 'الرفع لا يعني التحقق')} tone="warning" /><Metric icon={<CalendarClock size={20} />} label={text('Expiring in 90 days', 'ينتهي خلال 90 يوماً')} value={expiring.length} note={text('Validity metadata only', 'بيانات الصلاحية فقط')} tone="warning" /><Metric icon={<XCircle size={20} />} label={text('Rejected / expired', 'مرفوض أو منتهي')} value={rejected.length + expired.length} note={text('Needs governed action', 'يتطلب إجراءً محكوماً')} tone="danger" /></div><div className="ui6-dashboard-grid"><section className="ui6-surface ui6-span-7"><div className="ui6-section-heading"><div><span>{text('Evidence by type', 'الأدلة حسب النوع')}</span><h2>{text('Repository composition', 'تكوين المستودع')}</h2></div><BarChart3 size={20} /></div><div className="ui6-bar-list">{categories.slice(0, 7).map(category => <button type="button" onClick={() => { setTypeFilter(category.type); setView('categories'); }} key={category.type}><span><strong>{humanize(category.type)}</strong><small>{category.rows.length} {text('files', 'ملفات')}</small></span><span className="ui6-bar"><i style={{ width: `${evidenceFiles.length ? (category.rows.length / evidenceFiles.length) * 100 : 0}%` }} /></span><em>{Math.round(evidenceFiles.length ? (category.rows.length / evidenceFiles.length) * 100 : 0)}%</em></button>)}</div></section><section className="ui6-surface ui6-span-5"><div className="ui6-section-heading"><div><span>{text('Status', 'الحالة')}</span><h2>{text('Verification state', 'حالة التحقق')}</h2></div><ShieldCheck size={20} /></div><div className="ui6-status-stack"><div className="ui6-tone--good"><span>{text('Accepted', 'مقبول')}</span><strong>{accepted.length}</strong></div><div className="ui6-tone--warning"><span>{text('Pending review', 'بانتظار المراجعة')}</span><strong>{pending.length}</strong></div><div className="ui6-tone--danger"><span>{text('Rejected', 'مرفوض')}</span><strong>{rejected.length}</strong></div><div><span>{text('Restricted', 'مقيد')}</span><strong>{restricted.length}</strong></div></div></section><section className="ui6-surface ui6-span-12"><div className="ui6-section-heading"><div><span>{text('Recent Evidence', 'الأدلة الحديثة')}</span><h2>{text('Latest governed records', 'أحدث السجلات المحكومة')}</h2></div><Clock3 size={20} /></div>{repository}</section></div></div> : null}
        {view === 'repository' ? <section className="ui6-surface" data-testid="ui6-evidence-repository"><div className="ui6-section-heading"><div><span>{text('Evidence Repository', 'مستودع الأدلة')}</span><h2>{text('Searchable governed records', 'سجلات محكومة قابلة للبحث')}</h2></div><FolderKanban size={20} /></div>{filteredEvidence.length ? repository : <EmptyPanel title={text('No matching evidence', 'لا توجد أدلة مطابقة')} body={text('Adjust the active search or filters.', 'عدّل البحث أو المرشحات النشطة.')} />}</section> : null}
        {view === 'status' ? <div className="ui6-dashboard-grid" data-testid="ui6-evidence-status"><section className="ui6-surface ui6-span-7"><div className="ui6-section-heading"><div><span>{text('Evidence Status', 'حالة الأدلة')}</span><h2>{text('Review and verification queue', 'قائمة المراجعة والتحقق')}</h2></div><CheckCircle2 size={20} /></div><div className="ui6-record-list">{reviewQueue.map(row => <button type="button" onClick={() => { const file = evidenceFiles.find(item => item.id === row.evidence_file_id); if (file) openEvidence(file); }} key={row.evidence_file_id}><span><strong>{row.evidence_code} · {row.evidence_title}</strong><small>{row.reviewer_name || text('Reviewer unassigned', 'المراجع غير مسند')} · {formatDate(row.review_due_date)}</small></span><StatusChip tone={statusTone(row.review_status)}>{humanize(row.review_status)}</StatusChip></button>)}</div></section><section className="ui6-surface ui6-span-5"><div className="ui6-section-heading"><div><span>{text('Governed decisions', 'القرارات المحكومة')}</span><h2>{text('Reviewer workspace', 'مساحة عمل المراجع')}</h2></div><ShieldCheck size={20} /></div><p className="ui6-context-note">{text('Uploader and reviewer separation, acceptance, rejection, revision, locking, supersession, waiver gates and chain of custody remain in the existing Patch 23 workflow.', 'يبقى فصل الرافع عن المراجع والقبول والرفض والمراجعة والقفل والاستبدال والإعفاء وسلسلة الحيازة ضمن سير Patch 23 القائم.')}</p><button type="button" className="ui6-primary-button ui6-full-button" onClick={() => setView('review')}><ShieldCheck size={16} />{text('Open review & verification', 'فتح المراجعة والتحقق')}</button></section></div> : null}
        {view === 'categories' ? <div className="ui6-program-grid" data-testid="ui6-evidence-categories">{categories.map(category => <section className="ui6-surface" key={category.type}><div className="ui6-program-head"><div><span>{text('Evidence category', 'فئة الدليل')}</span><h2>{humanize(category.type)}</h2></div><StatusChip tone="primary">{category.rows.length}</StatusChip></div><div className="ui6-record-list">{category.rows.slice(0, 8).map(row => <button type="button" onClick={() => openEvidence(row)} key={row.id}><span><strong>{row.code || 'EVD'} · {row.title}</strong><small>{row.links[0]?.linked_item_title || text('No source title', 'لا يوجد عنوان مصدر')}</small></span><StatusChip tone={statusTone(row.reviewStatus)}>{humanize(row.reviewStatus)}</StatusChip></button>)}</div></section>)}</div> : null}
        {view === 'retention' ? <div className="ui6-dashboard-grid" data-testid="ui6-evidence-retention"><section className="ui6-surface ui6-span-8"><div className="ui6-section-heading"><div><span>{text('Expiration & Retention', 'الانتهاء والاحتفاظ')}</span><h2>{text('Validity-aware evidence', 'الأدلة المرتبطة بالصلاحية')}</h2></div><CalendarClock size={20} /></div><div className="ui6-record-list">{evidenceFiles.filter(row => row.expiryDate).map(row => <button type="button" onClick={() => openEvidence(row)} key={row.id}><span><strong>{row.code || 'EVD'} · {row.title}</strong><small>{text('Expires', 'ينتهي')} {formatDate(row.expiryDate)}</small></span><StatusChip tone={isExpired(row.expiryDate) ? 'danger' : isExpiring(row.expiryDate) ? 'warning' : 'good'}>{isExpired(row.expiryDate) ? text('Expired', 'منتهي') : isExpiring(row.expiryDate) ? text('Expiring', 'قرب الانتهاء') : text('Valid', 'صالح')}</StatusChip></button>)}</div></section><section className="ui6-surface ui6-span-4"><div className="ui6-section-heading"><div><span>{text('Retention boundary', 'حدود الاحتفاظ')}</span><h2>{text('Metadata-driven only', 'حسب البيانات الوصفية فقط')}</h2></div><Archive size={20} /></div><p className="ui6-context-note">{text('No expiry is invented for evidence without a governed validity date. Historical and superseded records remain preserved.', 'لا يتم اختلاق انتهاء لأدلة بلا تاريخ صلاحية محكوم. تبقى السجلات التاريخية والمستبدلة محفوظة.')}</p><div className="ui6-stat-list"><div><span>{text('With validity date', 'لها تاريخ صلاحية')}</span><strong>{evidenceFiles.filter(row => row.expiryDate).length}</strong></div><div><span>{text('Renewal required', 'يلزم التجديد')}</span><strong>{evidenceFiles.filter(row => row.renewalRequired).length}</strong></div><div><span>{text('Expired', 'منتهي')}</span><strong>{expired.length}</strong></div></div></section></div> : null}
        {view === 'requests' ? <section className="ui6-surface" data-testid="ui6-evidence-requests"><div className="ui6-section-heading"><div><span>{text('Evidence Requests', 'طلبات الأدلة')}</span><h2>{text('Requirements and gaps', 'المتطلبات والفجوات')}</h2></div><Clock3 size={20} /></div>{gaps.length ? <div className="ui6-request-grid">{gaps.map(row => <article key={row.requirement_id}><div><span>{humanize(row.linked_item_type)}</span><h3>{row.requirement_title}</h3><p>{row.accepted_evidence_count} / {row.minimum_accepted_files} {text('accepted files', 'ملفات مقبولة')}</p></div><StatusChip tone={row.gate_status === 'satisfied' ? 'good' : row.gate_status === 'overdue' ? 'danger' : 'warning'}>{humanize(row.gate_status)}</StatusChip></article>)}</div> : <EmptyPanel title={text('No evidence gaps visible', 'لا توجد فجوات أدلة ظاهرة')} body={text('Requests are backed by governed evidence requirements; no standalone fake request queue is created.', 'تستند الطلبات إلى متطلبات أدلة محكومة؛ لم يتم إنشاء قائمة طلبات وهمية مستقلة.')} />}</section> : null}
        {view === 'collections' ? <section className="ui6-surface" data-testid="ui6-evidence-collections"><div className="ui6-section-heading"><div><span>{text('Collections', 'المجموعات')}</span><h2>{text('Evidence packs by governed source', 'حزم الأدلة حسب المصدر المحكوم')}</h2></div><PackageCheck size={20} /></div><div className="ui6-collection-grid">{collections.map(collection => <article key={collection.key}><header><span>{humanize(collection.first.linked_item_type)}</span><h3>{collection.first.linked_item_title || collection.first.linked_item_id}</h3></header><div><strong>{collection.rows.length}</strong><small>{text('linked evidence records', 'سجلات أدلة مرتبطة')}</small></div><button type="button" className="ui6-link-button" onClick={() => { const file = evidenceFiles.find(row => row.id === collection.first.evidence_file_id); if (file) openEvidence(file); }}>{text('Open collection', 'فتح المجموعة')}</button></article>)}</div></section> : null}
        {view === 'storage' ? <div className="ui6-dashboard-grid" data-testid="ui6-evidence-storage"><section className="ui6-surface ui6-span-7"><div className="ui6-section-heading"><div><span>{text('Storage & Usage', 'التخزين والاستخدام')}</span><h2>{text('Private governed access', 'وصول خاص محكوم')}</h2></div><HardDrive size={20} /></div><div className="ui6-boundary"><Lock size={24} /><div><strong>{text('Storage paths remain private', 'تبقى مسارات التخزين خاصة')}</strong><p>{text('The browser receives no service-role credential or private storage path. View and download use the existing short-lived governed access function.', 'لا يتلقى المتصفح اعتماد خدمة أو مسار تخزين خاص. يستخدم العرض والتنزيل وظيفة الوصول المحكومة الحالية قصيرة العمر.')}</p></div></div><div className="ui6-stat-list">{sourceCounts.map(row => <div key={row.type}><span>{humanize(row.type)}</span><strong>{row.count}</strong></div>)}</div></section><section className="ui6-surface ui6-span-5"><div className="ui6-section-heading"><div><span>{text('Capacity boundary', 'حدود السعة')}</span><h2>{text('No fabricated storage metrics', 'لا مقاييس تخزين مختلقة')}</h2></div><ShieldCheck size={20} /></div><p className="ui6-context-note">{text('The canonical evidence read model does not expose trustworthy repository byte usage, so UI-6 does not invent a capacity chart.', 'لا يعرض نموذج قراءة الأدلة القانوني استخداماً موثوقاً لسعة المستودع، لذلك لا يختلق UI-6 مخطط سعة.')}</p><div className="ui6-stat-list"><div><span>{text('Restricted records', 'سجلات مقيدة')}</span><strong>{restricted.length}</strong></div><div><span>{text('Locked records', 'سجلات مقفلة')}</span><strong>{evidenceFiles.filter(row => row.lockedAt).length}</strong></div><div><span>{text('Multi-source reuse', 'إعادة استخدام متعددة المصادر')}</span><strong>{reused.length}</strong></div></div></section></div> : null}
        {view === 'actions' ? <section className="ui6-surface" data-testid="ui6-evidence-actions"><div className="ui6-section-heading"><div><span>{text('Quick Actions', 'إجراءات سريعة')}</span><h2>{text('Connected governed workflows', 'سير عمل محكوم ومترابط')}</h2></div><Plus size={20} /></div><div className="ui6-action-grid"><button type="button" disabled={!canGovernEvidence || !uploadTargets.length} title={!canGovernEvidence ? text('Your role cannot upload evidence', 'دورك لا يسمح برفع الأدلة') : !uploadTargets.length ? text('No eligible governed source is visible', 'لا يوجد مصدر محكوم مؤهل ظاهر') : ''} onClick={() => setUploadTarget(uploadTargets[0] || null)}><Upload size={21} /><span><strong>{text('Upload evidence', 'رفع دليل')}</strong><small>{text('To an existing project, milestone, or task', 'إلى مشروع أو مرحلة أو مهمة قائمة')}</small></span></button><button type="button" onClick={() => setView('review')}><ShieldCheck size={21} /><span><strong>{text('Review & verify', 'المراجعة والتحقق')}</strong><small>{text('Patch 23 reviewer workflow', 'سير مراجع Patch 23')}</small></span></button><button type="button" onClick={() => setView('requests')}><Clock3 size={21} /><span><strong>{text('Evidence requests', 'طلبات الأدلة')}</strong><small>{text('Requirements and closure gaps', 'المتطلبات وفجوات الإغلاق')}</small></span></button><button type="button" onClick={() => setView('collections')}><PackageCheck size={21} /><span><strong>{text('Open collections', 'فتح المجموعات')}</strong><small>{text('Source-based evidence packs', 'حزم أدلة حسب المصدر')}</small></span></button><button type="button" onClick={() => { setSensitivityFilter('restricted'); setView('search'); }}><Lock size={21} /><span><strong>{text('Restricted evidence', 'الأدلة المقيدة')}</strong><small>{text('Permission-aware metadata', 'بيانات وصفية حسب الصلاحيات')}</small></span></button><button type="button" onClick={() => setView('search')}><Search size={21} /><span><strong>{text('Advanced search', 'بحث متقدم')}</strong><small>{text('Type, status, sensitivity, source', 'النوع والحالة والحساسية والمصدر')}</small></span></button></div></section> : null}
        {view === 'search' ? <section className="ui6-surface" data-testid="ui6-evidence-search"><div className="ui6-section-heading"><div><span>{text('Evidence Search', 'البحث في الأدلة')}</span><h2>{text('Discover governed metadata', 'اكتشاف البيانات الوصفية المحكومة')}</h2></div><FileSearch size={20} /></div><div className="ui6-search-summary"><span>{filteredEvidence.length} {text('matching records', 'سجلات مطابقة')}</span><span>{new Set(filteredEvidence.flatMap(row => row.links.map(link => link.linked_item_type))).size} {text('source modules', 'وحدات مصدر')}</span></div>{filteredEvidence.length ? repository : <EmptyPanel title={text('No matching evidence', 'لا توجد أدلة مطابقة')} body={text('Adjust the evidence search filters.', 'عدّل مرشحات البحث في الأدلة.')} />}</section> : null}
      </DataState>
    </>}
    <Modal size="large" open={Boolean(uploadTarget)} title={text('Upload governed evidence', 'رفع دليل محكوم')} onClose={() => setUploadTarget(null)}>
      {uploadTarget && auth.profile?.organizationId ? <div className="ui6-upload-workflow">
        <label className="ui6-upload-target">
          <span>{text('Linked source', 'المصدر المرتبط')}</span>
          <select value={`${uploadTarget.linked_item_type}:${uploadTarget.linked_item_id}`} onChange={event => setUploadTarget(uploadTargets.find(row => `${row.linked_item_type}:${row.linked_item_id}` === event.target.value) || uploadTarget)}>
            {uploadTargets.map(row => <option key={`${row.linked_item_type}:${row.linked_item_id}`} value={`${row.linked_item_type}:${row.linked_item_id}`}>{humanize(row.linked_item_type)} · {row.linked_item_title || row.linked_item_id}</option>)}
          </select>
        </label>
        <EvidenceUploadForm key={`${uploadTarget.linked_item_type}:${uploadTarget.linked_item_id}`} organizationId={auth.profile.organizationId} itemType={uploadTarget.linked_item_type as EvidenceUploadItemType} itemId={uploadTarget.linked_item_id} onCancel={() => setUploadTarget(null)} onUploaded={() => { setUploadTarget(null); void data.refresh(); }} />
      </div> : <div className="ui6-empty"><AlertTriangle size={22} /><strong>{text('Organization context unavailable', 'سياق المنشأة غير متاح')}</strong></div>}
    </Modal>
  </section>;
}
