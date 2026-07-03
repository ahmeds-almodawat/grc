import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { useAsyncData } from '../hooks/useAsyncData';
import { DataState } from '../components/DataState';
import { ModernCard, StatusPill } from '../components/ModernCard';
import {
  getExecutiveTruthSummary,
  getModuleHealthScorecard,
  getOpenExecutiveRisks,
  getOverdueGovernanceItems,
  getEvidenceGapSummary,
  getWorkflowBottleneckSummary,
  getAccreditationReadinessSummary,
  getDepartmentGrcScorecards,
  getGovernanceExceptionRegister,
  getBoardPackTruthSnapshots,
  createExecutiveTruthSnapshot
} from '../lib/executiveTruthApi';
import { ShieldCheck, BarChart3, AlertTriangle, HelpCircle, RefreshCw, Layers, Award, FileSpreadsheet, Clock } from 'lucide-react';

export function ExecutiveTruthCenter() {
  const auth = useAuth();
  const { language } = useI18n();
  const [activeTab, setActiveTab] = useState<'kpis' | 'health' | 'overdue' | 'bottlenecks' | 'snapshots'>('kpis');
  const [snapshotTitle, setSnapshotTitle] = useState('');
  const [snapshotNotes, setSnapshotNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Load Data
  const summary = useAsyncData(getExecutiveTruthSummary, []);
  const health = useAsyncData(getModuleHealthScorecard, []);
  const risks = useAsyncData(getOpenExecutiveRisks, []);
  const overdue = useAsyncData(getOverdueGovernanceItems, []);
  const gaps = useAsyncData(getEvidenceGapSummary, []);
  const bottlenecks = useAsyncData(getWorkflowBottleneckSummary, []);
  const readiness = useAsyncData(getAccreditationReadinessSummary, []);
  const scorecards = useAsyncData(getDepartmentGrcScorecards, []);
  const exceptions = useAsyncData(getGovernanceExceptionRegister, []);
  const snapshots = useAsyncData(getBoardPackTruthSnapshots, []);

  // Bilingual text dictionary
  const text = language === 'ar' ? ar : en;

  const sumData = summary.data || {
    active_risks_count: 0,
    compliant_items_count: 0,
    non_compliant_items_count: 0,
    open_audit_findings_count: 0,
    pending_approvals_count: 0,
    total_evidence_files_count: 0
  };

  const readData = readiness.data || {
    standard_set: 'CBAHI',
    total_standards: 0,
    compliant_count: 0,
    non_compliant_count: 0,
    compliance_percentage: 0.0
  };

  const handleCaptureSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!snapshotTitle.trim()) return;
    setActionLoading(true);
    setActionError(null);
    try {
      if (!auth.profile?.id) throw new Error('User context missing');
      await createExecutiveTruthSnapshot({
        title: snapshotTitle,
        notes: snapshotNotes,
        actor_id: auth.profile.id
      });
      setSnapshotTitle('');
      setSnapshotNotes('');
      void snapshots.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to capture snapshot');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <section className="page-section executive-truth-page">
      <div className="section-heading command-hero">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h3>{text.title}</h3>
          <p className="section-subtitle">{text.subtitle}</p>
        </div>
      </div>

      {/* Stats Summary Grid */}
      <div className="stats-grid">
        <div className="stat-card danger">
          <AlertTriangle size={20} />
          <div className="stat-value">{sumData.active_risks_count}</div>
          <div className="stat-label">{text.activeRisks}</div>
        </div>
        <div className="stat-card success">
          <ShieldCheck size={20} />
          <div className="stat-value">{sumData.compliant_items_count}</div>
          <div className="stat-label">{text.compliantItems}</div>
        </div>
        <div className="stat-card warning">
          <Layers size={20} />
          <div className="stat-value">{sumData.non_compliant_items_count}</div>
          <div className="stat-label">{text.nonCompliant}</div>
        </div>
        <div className="stat-card">
          <Award size={20} />
          <div className="stat-value">{readData.compliance_percentage}%</div>
          <div className="stat-label">{text.cbahiReadiness}</div>
        </div>
      </div>

      {/* Hub navigation tabs */}
      <div className="hub-tab-layout">
        <div className="hub-tab-rail panel">
          <button 
            className={`hub-tab-button ${activeTab === 'kpis' ? 'active' : ''}`}
            onClick={() => setActiveTab('kpis')}
          >
            {text.tabKpis}
          </button>
          <button 
            className={`hub-tab-button ${activeTab === 'health' ? 'active' : ''}`}
            onClick={() => setActiveTab('health')}
          >
            {text.tabHealth}
          </button>
          <button 
            className={`hub-tab-button ${activeTab === 'overdue' ? 'active' : ''}`}
            onClick={() => setActiveTab('overdue')}
          >
            {text.tabOverdue}
          </button>
          <button 
            className={`hub-tab-button ${activeTab === 'bottlenecks' ? 'active' : ''}`}
            onClick={() => setActiveTab('bottlenecks')}
          >
            {text.tabBottlenecks}
          </button>
          <button 
            className={`hub-tab-button ${activeTab === 'snapshots' ? 'active' : ''}`}
            onClick={() => setActiveTab('snapshots')}
          >
            {text.tabSnapshots}
          </button>
        </div>

        {/* Tab content panel */}
        <div className="hub-tab-content">
          {activeTab === 'kpis' && (
            <div className="tab-pane" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Department Scorecard widget */}
                <ModernCard title={text.deptScorecardTitle} subtitle={text.deptScorecardSubtitle}>
                  <DataState loading={scorecards.loading} error={scorecards.error} empty={!scorecards.data?.length}>
                    <div className="table-wrap">
                      <table className="entity-table">
                        <thead>
                          <tr>
                            <th>{text.department}</th>
                            <th>{text.openRisksLabel}</th>
                            <th>{text.nonCompliantLabel}</th>
                            <th>{text.overdueTasksLabel}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(scorecards.data || []).map((row: any) => (
                            <tr key={row.department_id}>
                              <td><strong>{language === 'ar' ? row.department_name_ar || row.department_name_en : row.department_name_en}</strong></td>
                              <td>{row.open_risks}</td>
                              <td>{row.non_compliant_obligations}</td>
                              <td>{row.overdue_tasks}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </DataState>
                </ModernCard>

                {/* Executive Risk register */}
                <ModernCard title={text.executiveRisksTitle} subtitle={text.executiveRisksSubtitle}>
                  <DataState loading={risks.loading} error={risks.error} empty={!risks.data?.length}>
                    <div className="table-wrap">
                      <table className="entity-table">
                        <thead>
                          <tr>
                            <th>{text.riskTitleLabel}</th>
                            <th>{text.severity}</th>
                            <th>{text.controlsCount}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(risks.data || []).map((row: any) => (
                            <tr key={row.risk_id}>
                              <td>{row.risk_title}</td>
                              <td><StatusPill tone="danger">{row.risk_level}</StatusPill></td>
                              <td>{row.linked_controls_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </DataState>
                </ModernCard>
              </div>

              {/* Exception Register */}
              <ModernCard title={text.exceptionRegisterTitle} subtitle={text.exceptionRegisterSubtitle}>
                <DataState loading={exceptions.loading} error={exceptions.error} empty={!exceptions.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead>
                        <tr>
                          <th>{text.exceptionType}</th>
                          <th>{text.summaryLabel}</th>
                          <th>{text.loggedAt}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(exceptions.data || []).map((row: any, i: number) => (
                          <tr key={i}>
                            <td><StatusPill tone="warning">{row.exception_type}</StatusPill></td>
                            <td>{row.summary}</td>
                            <td>{new Date(row.logged_at).toLocaleString(language)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>
            </div>
          )}

          {activeTab === 'health' && (
            <div className="tab-pane">
              <ModernCard title={text.moduleHealthTitle} subtitle={text.moduleHealthSubtitle}>
                <DataState loading={health.loading} error={health.error} empty={!health.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead>
                        <tr>
                          <th>{text.moduleNameLabel}</th>
                          <th>{text.totalItemsLabel}</th>
                          <th>{text.completedItemsLabel}</th>
                          <th>{text.openItemsLabel}</th>
                          <th>{text.healthIndexLabel}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(health.data || []).map((row: any, i: number) => (
                          <tr key={i}>
                            <td><strong>{row.module_name}</strong></td>
                            <td>{row.total_items}</td>
                            <td>{row.closed_items}</td>
                            <td>{row.open_items}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ background: 'var(--border-color)', width: '80px', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                                  <div style={{ 
                                    background: row.health_index > 75 ? 'var(--success-color)' : row.health_index > 40 ? 'var(--warning-color)' : 'var(--danger-color)', 
                                    width: `${row.health_index}%`, 
                                    height: '100%' 
                                  }}></div>
                                </div>
                                <span>{row.health_index}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>
            </div>
          )}

          {activeTab === 'overdue' && (
            <div className="tab-pane" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <ModernCard title={text.overdueItemsTitle} subtitle={text.overdueItemsSubtitle}>
                <DataState loading={overdue.loading} error={overdue.error} empty={!overdue.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead>
                        <tr>
                          <th>{text.itemTypeLabel}</th>
                          <th>{text.itemTitleLabel}</th>
                          <th>{text.dueDateLabel}</th>
                          <th>{text.daysOverdueLabel}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(overdue.data || []).map((row: any) => (
                          <tr key={row.item_id}>
                            <td><StatusPill tone="danger">{row.item_type}</StatusPill></td>
                            <td>{row.item_title}</td>
                            <td>{row.due_date}</td>
                            <td>{row.days_overdue} {text.days}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>

              {/* Evidence Gaps Widget */}
              <ModernCard title={text.evidenceGapsTitle} subtitle={text.evidenceGapsSubtitle}>
                <DataState loading={gaps.loading} error={gaps.error} empty={!gaps.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead>
                        <tr>
                          <th>{text.moduleNameLabel}</th>
                          <th>{text.itemTitleLabel}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(gaps.data || []).map((row: any) => (
                          <tr key={row.item_id}>
                            <td><StatusPill tone="neutral">{row.module_name}</StatusPill></td>
                            <td>{row.item_title}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>
            </div>
          )}

          {activeTab === 'bottlenecks' && (
            <div className="tab-pane">
              <ModernCard title={text.bottlenecksTitle} subtitle={text.bottlenecksSubtitle}>
                <DataState loading={bottlenecks.loading} error={bottlenecks.error} empty={!bottlenecks.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead>
                        <tr>
                          <th>{text.workflowTypeLabel}</th>
                          <th>{text.itemTitleLabel}</th>
                          <th>{text.statusLabel}</th>
                          <th>{text.pendingDaysLabel}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(bottlenecks.data || []).map((row: any) => (
                          <tr key={row.item_id}>
                            <td><StatusPill tone="warning">{row.workflow_type}</StatusPill></td>
                            <td>{row.item_title}</td>
                            <td>{row.status}</td>
                            <td>{row.pending_days} {text.days}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>
            </div>
          )}

          {activeTab === 'snapshots' && (
            <div className="tab-pane" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Snapshot Capture Form */}
              <ModernCard title={text.captureSnapshotTitle} subtitle={text.captureSnapshotSubtitle}>
                <form onSubmit={handleCaptureSnapshot} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-group">
                    <label>{text.snapshotTitleLabel}</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={snapshotTitle} 
                      onChange={(e) => setSnapshotTitle(e.target.value)} 
                      placeholder={text.snapshotTitlePlaceholder}
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label>{text.snapshotNotesLabel}</label>
                    <textarea 
                      className="form-control" 
                      value={snapshotNotes} 
                      onChange={(e) => setSnapshotNotes(e.target.value)} 
                      placeholder={text.snapshotNotesPlaceholder}
                      rows={3}
                    />
                  </div>
                  {actionError && <div className="alert alert-danger">{actionError}</div>}
                  <button type="submit" className="button" disabled={actionLoading}>
                    {actionLoading ? text.capturingButton : text.captureButton}
                  </button>
                </form>
              </ModernCard>

              {/* Snapshots Log List */}
              <ModernCard title={text.snapshotsHistoryTitle} subtitle={text.snapshotsHistorySubtitle}>
                <DataState loading={snapshots.loading} error={snapshots.error} empty={!snapshots.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead>
                        <tr>
                          <th>{text.snapshotTitleLabel}</th>
                          <th>{text.capturedAtLabel}</th>
                          <th>{text.activeRisksLabel}</th>
                          <th>{text.compliantItemsLabel}</th>
                          <th>{text.openAuditFindingsLabel}</th>
                          <th>{text.notesLabel}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(snapshots.data || []).map((row: any) => (
                          <tr key={row.snapshot_id}>
                            <td><strong>{row.title}</strong></td>
                            <td>{new Date(row.captured_at).toLocaleString(language)}</td>
                            <td>{row.active_risks}</td>
                            <td>{row.compliant_items}</td>
                            <td>{row.open_audit_findings}</td>
                            <td>{row.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// English translations dictionary
const en = {
  eyebrow: 'Assurance & Governance Monitoring',
  title: 'Executive GRC Truth Center',
  subtitle: 'Reconciled dashboard displaying live GRC data signals from all operational modules.',
  activeRisks: 'Active Risks',
  compliantItems: 'Compliant Policies',
  nonCompliant: 'Non-Compliant Items',
  cbahiReadiness: 'CBAHI Compliance',
  tabKpis: 'Truth Summary',
  tabHealth: 'Module Health',
  tabOverdue: 'Exceptions & Gaps',
  tabBottlenecks: 'Bottlenecks',
  tabSnapshots: 'Board Snapshots',
  deptScorecardTitle: 'Department GRC Scorecard',
  deptScorecardSubtitle: 'Overview of operational GRC counts aggregated by functional department.',
  department: 'Department',
  openRisksLabel: 'Open Risks',
  nonCompliantLabel: 'Non-Compliant',
  overdueTasksLabel: 'Overdue Tasks',
  executiveRisksTitle: 'Active Executive Risks',
  executiveRisksSubtitle: 'High and Critical severity risks requiring executive-level reviews.',
  riskTitleLabel: 'Risk Scenario',
  severity: 'Risk Level',
  controlsCount: 'Active Controls',
  exceptionRegisterTitle: 'Governance Override & Exceptions Ledger',
  exceptionRegisterSubtitle: 'Log of rejected approvals, overrides, and security events.',
  exceptionType: 'Event Category',
  summaryLabel: 'Summary Description',
  loggedAt: 'Logged At',
  moduleHealthTitle: 'Module Health Scorecard',
  moduleHealthSubtitle: 'Completion percentages and health indexes across operational hubs.',
  moduleNameLabel: 'Operational Module',
  totalItemsLabel: 'Total Records',
  completedItemsLabel: 'Closed/Compliant',
  openItemsLabel: 'Pending/Active',
  healthIndexLabel: 'Health Index',
  overdueItemsTitle: 'Overdue Governance Items',
  overdueItemsSubtitle: 'Mandatory items past their set due dates.',
  itemTypeLabel: 'Item Type',
  dueDateLabel: 'Due Date',
  daysOverdueLabel: 'Overdue By',
  days: 'days',
  evidenceGapsTitle: 'Compliance Evidence Gap Registry',
  evidenceGapsSubtitle: 'Obligations and findings marked as required but missing attachments.',
  bottlenecksTitle: 'Active Workflow Bottlenecks',
  bottlenecksSubtitle: 'Approvals and reviews currently delayed in standard pipelines.',
  workflowTypeLabel: 'Workflow',
  statusLabel: 'Current Status',
  pendingDaysLabel: 'Pending Duration',
  captureSnapshotTitle: 'Capture Executive Truth Snapshot',
  captureSnapshotSubtitle: 'Freeze current live metrics to save as a board pack audit reference.',
  snapshotTitleLabel: 'Snapshot Title',
  snapshotTitlePlaceholder: 'e.g., Q3 Board Report Snapshot',
  snapshotNotesLabel: 'Explanatory Notes',
  snapshotNotesPlaceholder: 'Provide context for this snapshot capture...',
  captureButton: 'Capture Snapshot',
  capturingButton: 'Capturing state...',
  snapshotsHistoryTitle: 'Board Pack Snapshots Ledger',
  snapshotsHistorySubtitle: 'Historical truth snapshots captured for compliance and executive audits.',
  capturedAtLabel: 'Captured At',
  openAuditFindingsLabel: 'Open Findings',
  notesLabel: 'Notes',
  itemTitleLabel: 'Title',
  activeRisksLabel: 'Active Risks',
  compliantItemsLabel: 'Compliant Items'
};

// Arabic translations dictionary
const ar = {
  eyebrow: 'متابعة الضمان والحوكمة',
  title: 'مركز الحقيقة التنفيذية GRC',
  subtitle: 'لوحة تحكم موحدة تعرض إشارات بيانات GRC الفعلية من جميع الأقسام التشغيلية.',
  activeRisks: 'المخاطر النشطة',
  compliantItems: 'السياسات المتوافقة',
  nonCompliant: 'العناصر غير المتوافقة',
  cbahiReadiness: 'جاهزية سباهي',
  tabKpis: 'ملخص الحقيقة',
  tabHealth: 'صحة الأقسام',
  tabOverdue: 'الاستثناءات والفجوات',
  tabBottlenecks: 'الاختناقات التشغيلية',
  tabSnapshots: 'لقطات مجلس الإدارة',
  deptScorecardTitle: 'بطاقة أداء GRC للأقسام',
  deptScorecardSubtitle: 'نظرة عامة على أعداد GRC التشغيلية مجمعة حسب الأقسام الوظيفية.',
  department: 'القسم',
  openRisksLabel: 'المخاطر المفتوحة',
  nonCompliantLabel: 'غير متوافق',
  overdueTasksLabel: 'المهام المتأخرة',
  executiveRisksTitle: 'مخاطر الإدارة التنفيذية النشطة',
  executiveRisksSubtitle: 'المخاطر عالية والحرجة التي تتطلب مراجعة من الإدارة التنفيذية.',
  riskTitleLabel: 'سيناريو الخطر',
  severity: 'مستوى الخطر',
  controlsCount: 'الضوابط النشطة',
  exceptionRegisterTitle: 'سجل التجاوزات والاستثناءات الرقابية',
  exceptionRegisterSubtitle: 'سجل الطلبات المرفوضة والتجاوزات الإدارية والأحداث الأمنية.',
  exceptionType: 'فئة الحدث',
  summaryLabel: 'وصف الملخص',
  loggedAt: 'تاريخ التسجيل',
  moduleHealthTitle: 'بطاقة صحة الأقسام والأنظمة',
  moduleHealthSubtitle: 'معدلات الاكتمال ومؤشرات الصحة عبر المنصات التشغيلية.',
  moduleNameLabel: 'المنصة التشغيلية',
  totalItemsLabel: 'إجمالي السجلات',
  completedItemsLabel: 'مغلق/متوافق',
  openItemsLabel: 'معلق/نشط',
  healthIndexLabel: 'مؤشر الصحة',
  overdueItemsTitle: 'عناصر الحوكمة المتأخرة',
  overdueItemsSubtitle: 'العناصر الإلزامية التي تجاوزت تاريخ الاستحقاق المحدد.',
  itemTypeLabel: 'نوع العنصر',
  dueDateLabel: 'تاريخ الاستحقاق',
  daysOverdueLabel: 'متأخر منذ',
  days: 'يوم',
  evidenceGapsTitle: 'سجل فجوات أدلة الإثبات للالتزام',
  evidenceGapsSubtitle: 'الالتزامات والنتائج التي تم وسمها كإلزامية ولكنها تفتقر لمرفقات.',
  bottlenecksTitle: 'الاختناقات النشطة بمسارات العمل',
  bottlenecksSubtitle: 'الموافقات والمراجعات المتأخرة حالياً في مسارات المتابعة القياسية.',
  workflowTypeLabel: 'مسار العمل',
  statusLabel: 'الحالة الحالية',
  pendingDaysLabel: 'مدة الانتظار',
  captureSnapshotTitle: 'أخذ لقطة للحقيقة التنفيذية',
  captureSnapshotSubtitle: 'تجميد المؤشرات الحالية وحفظها كمرجع لتقارير مجلس الإدارة.',
  snapshotTitleLabel: 'عنوان اللقطة',
  snapshotTitlePlaceholder: 'مثال: لقطة تقرير مجلس الإدارة للربع الثالث',
  snapshotNotesLabel: 'ملاحظات تفسيرية',
  snapshotNotesPlaceholder: 'تقديم سياق إضافي لأخذ هذه اللقطة...',
  captureButton: 'أخذ اللقطة',
  capturingButton: 'جاري الحفظ...',
  snapshotsHistoryTitle: 'سجل لقطات مجلس الإدارة للحقيقة',
  snapshotsHistorySubtitle: 'اللقطات التاريخية المحفوظة للمطابقة والتدقيق التنفيذي.',
  capturedAtLabel: 'تاريخ الحفظ',
  openAuditFindingsLabel: 'النتائج المفتوحة',
  notesLabel: 'الملاحظات',
  itemTitleLabel: 'العنوان',
  activeRisksLabel: 'المخاطر النشطة',
  compliantItemsLabel: 'العناصر المتوافقة'
};
