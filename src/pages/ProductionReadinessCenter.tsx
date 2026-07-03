import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { useAsyncData } from '../hooks/useAsyncData';
import { DataState } from '../components/DataState';
import { ModernCard, StatusPill } from '../components/ModernCard';
import {
  getProductionReadinessSignoffRegister,
  getGoNoGoDashboard,
  getKnownLimitationsRegister,
  getBlockingLimitations,
  getBackupRestoreOperationsDashboard,
  getBilingualReadinessDashboard,
  getMissingTranslationRegister,
  getNavigationSimplificationRegister,
  getRuntimeRpcSignoffDashboard,
  getProofSuiteReadinessSummary,
  getControlledPilotReadinessSummary,
  getExecutiveProductionReadinessSummary
} from '../lib/productionReadinessApi';
import { ShieldCheck, BarChart3, AlertTriangle, FileCheck, RefreshCw, Smartphone, Award, ClipboardList, Database, Languages } from 'lucide-react';

export function ProductionReadinessCenter() {
  const auth = useAuth();
  const { language } = useI18n();
  const [activeTab, setActiveTab] = useState<'status' | 'limitations' | 'operations' | 'rpc_nav'>('status');

  // Load Data
  const signoffs = useAsyncData(getProductionReadinessSignoffRegister, []);
  const gonogo = useAsyncData(getGoNoGoDashboard, []);
  const limitations = useAsyncData(getKnownLimitationsRegister, []);
  const blocking = useAsyncData(getBlockingLimitations, []);
  const backups = useAsyncData(getBackupRestoreOperationsDashboard, []);
  const bilingual = useAsyncData(getBilingualReadinessDashboard, []);
  const missingTrans = useAsyncData(getMissingTranslationRegister, []);
  const navProposals = useAsyncData(getNavigationSimplificationRegister, []);
  const rpcDashboard = useAsyncData(getRuntimeRpcSignoffDashboard, []);
  const proofSummary = useAsyncData(getProofSuiteReadinessSummary, []);
  const pilotSummary = useAsyncData(getControlledPilotReadinessSummary, []);
  const execSummary = useAsyncData(getExecutiveProductionReadinessSummary, []);

  // Bilingual dictionary
  const text = language === 'ar' ? ar : en;

  const summary = execSummary.data || {
    total_signoffs: 0,
    ready_signoffs: 0,
    blocked_signoffs: 0,
    overall_status: 'pending'
  };

  const gonogoData = gonogo.data || {
    readiness_percentage: 0.0
  };

  const rpcData = rpcDashboard.data || {
    total_runtime_rpcs: 0,
    approved: 0,
    pending_review: 0,
    privileged_review: 0,
    rejected_blocked: 0,
    service_role_only_frontend_calls: 0,
    broad_security_definer_execute_grants: 0
  };

  const bilingualSummary = bilingual.data || {
    total_items: 0,
    ready_items: 0,
    incomplete_items: 0,
    review_items: 0
  };

  return (
    <section className="page-section production-readiness-page">
      <div className="section-heading command-hero">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h3>{text.title}</h3>
          <p className="section-subtitle">{text.subtitle}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <ShieldCheck size={20} />
          <div className="stat-value">{summary.total_signoffs}</div>
          <div className="stat-label">{text.totalSignoffs}</div>
        </div>
        <div className="stat-card success">
          <FileCheck size={20} />
          <div className="stat-value">{summary.ready_signoffs}</div>
          <div className="stat-label">{text.approvedSignoffs}</div>
        </div>
        <div className="stat-card danger">
          <AlertTriangle size={20} />
          <div className="stat-value">{summary.blocked_signoffs}</div>
          <div className="stat-label">{text.blockedSignoffs}</div>
        </div>
        <div className="stat-card warning">
          <Award size={20} />
          <div className="stat-value">
            <StatusPill tone={
              summary.overall_status === 'ready' ? 'good' :
              summary.overall_status === 'ready_with_limitations' ? 'warning' :
              summary.overall_status === 'blocked' ? 'danger' : 'neutral'
            }>
              {summary.overall_status}
            </StatusPill>
          </div>
          <div className="stat-label">{text.overallStatus}</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="hub-tab-layout">
        <div className="hub-tab-rail panel">
          <button 
            className={`hub-tab-button ${activeTab === 'status' ? 'active' : ''}`}
            onClick={() => setActiveTab('status')}
          >
            {text.tabStatus}
          </button>
          <button 
            className={`hub-tab-button ${activeTab === 'limitations' ? 'active' : ''}`}
            onClick={() => setActiveTab('limitations')}
          >
            {text.tabLimitations}
          </button>
          <button 
            className={`hub-tab-button ${activeTab === 'operations' ? 'active' : ''}`}
            onClick={() => setActiveTab('operations')}
          >
            {text.tabOperations}
          </button>
          <button 
            className={`hub-tab-button ${activeTab === 'rpc_nav' ? 'active' : ''}`}
            onClick={() => setActiveTab('rpc_nav')}
          >
            {text.tabRpcNav}
          </button>
        </div>

        {/* Tab Content */}
        <div className="hub-tab-content">
          {activeTab === 'status' && (
            <div className="tab-pane" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Go/No-Go Dashboard */}
                <ModernCard title={text.goNoGoTitle} subtitle={text.goNoGoSubtitle}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center', justifyContent: 'center', minHeight: '150px' }}>
                    <div style={{ position: 'relative', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ 
                        border: '8px solid var(--border-color)', 
                        borderTop: '8px solid var(--success-color)', 
                        borderRadius: '50%', 
                        position: 'absolute', 
                        top: 0, left: 0, right: 0, bottom: 0,
                        transform: `rotate(${gonogoData.readiness_percentage * 3.6}deg)`
                      }}></div>
                      <span style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{gonogoData.readiness_percentage}%</span>
                    </div>
                    <span style={{ fontWeight: '500' }}>{text.readinessScore}</span>
                    <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{gonogoData.approved_reviews ?? 0}</div>
                        <small>{language === 'ar' ? 'مراجعات معتمدة' : 'Approved Reviews'}</small>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--danger-color)' }}>{gonogoData.blocking_issues ?? 0}</div>
                        <small>{language === 'ar' ? 'مشاكل معطلة' : 'Blocking Issues'}</small>
                      </div>
                    </div>
                  </div>
                </ModernCard>

                {/* Controlled Pilot Summary */}
                <ModernCard title={text.pilotReadinessTitle} subtitle={text.pilotReadinessSubtitle}>
                  <DataState loading={pilotSummary.loading} error={pilotSummary.error} empty={!pilotSummary.data?.length}>
                    <div className="table-wrap">
                      <table className="entity-table">
                        <thead>
                          <tr>
                            <th>{text.signoffArea}</th>
                            <th>{text.status}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(pilotSummary.data || []).map((row: any, i: number) => (
                            <tr key={i}>
                              <td><strong>{row.signoff_area}</strong></td>
                              <td>
                                <StatusPill tone={row.signoff_status === 'ready' ? 'good' : 'warning'}>
                                  {row.signoff_status}
                                </StatusPill>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </DataState>
                </ModernCard>
              </div>

              {/* Signoff Register */}
              <ModernCard title={text.signoffRegisterTitle} subtitle={text.signoffRegisterSubtitle}>
                <DataState loading={signoffs.loading} error={signoffs.error} empty={!signoffs.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead>
                        <tr>
                          <th>{text.signoffArea}</th>
                          <th>{text.status}</th>
                          <th>{text.notes}</th>
                          <th>{text.evidence}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(signoffs.data || []).map((row: any) => (
                          <tr key={row.id}>
                            <td><strong>{row.signoff_area}</strong></td>
                            <td>
                              <StatusPill tone={
                                row.signoff_status === 'ready' ? 'good' :
                                row.signoff_status === 'blocked' ? 'danger' :
                                row.signoff_status === 'ready_with_limitations' ? 'warning' : 'neutral'
                              }>
                                {row.signoff_status}
                              </StatusPill>
                            </td>
                            <td>{row.signoff_notes || '-'}</td>
                            <td><code>{row.evidence_reference || '-'}</code></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>

              {/* Proof Suite Readiness summary */}
              <ModernCard title={text.proofSuitesTitle} subtitle={text.proofSuitesSubtitle}>
                <DataState loading={proofSummary.loading} error={proofSummary.error} empty={!proofSummary.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead>
                        <tr>
                          <th>{text.suiteName}</th>
                          <th>{text.status}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(proofSummary.data || []).map((row: any, i: number) => (
                          <tr key={i}>
                            <td><code>{row.signoff_area}</code></td>
                            <td><StatusPill tone={row.signoff_status === 'ready' ? 'good' : 'danger'}>{row.signoff_status}</StatusPill></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>
            </div>
          )}

          {activeTab === 'limitations' && (
            <div className="tab-pane" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Blocking Limitations */}
              <ModernCard title={text.blockingLimitationsTitle} subtitle={text.blockingLimitationsSubtitle}>
                <DataState loading={blocking.loading} error={blocking.error} empty={!blocking.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead>
                        <tr>
                          <th>{text.limitationTitle}</th>
                          <th>{text.severity}</th>
                          <th>{text.mitigationPlan}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(blocking.data || []).map((row: any) => (
                          <tr key={row.id}>
                            <td><strong>{row.limitation_title}</strong></td>
                            <td><StatusPill tone="danger">{row.severity}</StatusPill></td>
                            <td>{row.mitigation_plan || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>

              {/* Limitations Register */}
              <ModernCard title={text.limitationsRegisterTitle} subtitle={text.limitationsRegisterSubtitle}>
                <DataState loading={limitations.loading} error={limitations.error} empty={!limitations.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead>
                        <tr>
                          <th>{text.limitationTitle}</th>
                          <th>{text.area}</th>
                          <th>{text.severity}</th>
                          <th>{text.status}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(limitations.data || []).map((row: any) => (
                          <tr key={row.id}>
                            <td>{row.limitation_title}</td>
                            <td><StatusPill tone="neutral">{row.limitation_area}</StatusPill></td>
                            <td>
                              <StatusPill tone={
                                row.severity === 'critical' ? 'danger' :
                                row.severity === 'high' ? 'warning' : 'neutral'
                              }>
                                {row.severity}
                              </StatusPill>
                            </td>
                            <td>{row.limitation_status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>
            </div>
          )}

          {activeTab === 'operations' && (
            <div className="tab-pane" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Backup / Restore Operations */}
              <ModernCard title={text.backupOperationsTitle} subtitle={text.backupOperationsSubtitle}>
                <DataState loading={backups.loading} error={backups.error} empty={!backups.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead>
                        <tr>
                          <th>{text.operationType}</th>
                          <th>{text.status}</th>
                          <th>{text.summary}</th>
                          <th>{text.evidence}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(backups.data || []).map((row: any) => (
                          <tr key={row.id}>
                            <td><strong>{row.operation_type}</strong></td>
                            <td>
                              <StatusPill tone={
                                row.operation_status === 'passed' ? 'good' :
                                row.operation_status === 'failed' ? 'danger' : 'warning'
                              }>
                                {row.operation_status}
                              </StatusPill>
                            </td>
                            <td>{row.operation_summary}</td>
                            <td><code>{row.evidence_reference || '-'}</code></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>

              {/* Bilingual readiness items */}
              <ModernCard title={text.bilingualReadinessTitle} subtitle={text.bilingualReadinessSubtitle}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '14px', marginBottom: '20px' }}>
                  <div className="stat-card">
                    <Languages size={18} />
                    <div className="stat-value">{bilingualSummary.total_items}</div>
                    <div className="stat-label">{text.totalKeys}</div>
                  </div>
                  <div className="stat-card success">
                    <Languages size={18} />
                    <div className="stat-value">{bilingualSummary.ready_items}</div>
                    <div className="stat-label">{text.translatedKeys}</div>
                  </div>
                  <div className="stat-card danger">
                    <Languages size={18} />
                    <div className="stat-value">{bilingualSummary.incomplete_items}</div>
                    <div className="stat-label">{text.missingKeys}</div>
                  </div>
                  <div className="stat-card warning">
                    <Languages size={18} />
                    <div className="stat-value">{bilingualSummary.review_items}</div>
                    <div className="stat-label">{text.reviewKeys}</div>
                  </div>
                </div>

                <DataState loading={missingTrans.loading} error={missingTrans.error} empty={!missingTrans.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead>
                        <tr>
                          <th>{text.itemKey}</th>
                          <th>{text.area}</th>
                          <th>{text.englishText}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(missingTrans.data || []).map((row: any) => (
                          <tr key={row.id}>
                            <td><code>{row.item_key}</code></td>
                            <td>{row.item_area}</td>
                            <td>{row.english_text || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>
            </div>
          )}

          {activeTab === 'rpc_nav' && (
            <div className="tab-pane" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Runtime RPC signoff dashboard */}
              <ModernCard title={text.rpcDashboardTitle} subtitle={text.rpcDashboardSubtitle}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '14px', marginBottom: '20px' }}>
                  <div className="stat-card">
                    <div className="stat-value">{rpcData.total_runtime_rpcs}</div>
                    <div className="stat-label">{text.totalRpcs}</div>
                  </div>
                  <div className="stat-card success">
                    <div className="stat-value">{rpcData.approved}</div>
                    <div className="stat-label">{text.approvedRpcs}</div>
                  </div>
                  <div className="stat-card warning">
                    <div className="stat-value">{rpcData.pending_review}</div>
                    <div className="stat-label">{text.pendingRpcs}</div>
                  </div>
                  <div className="stat-card danger">
                    <div className="stat-value">{rpcData.service_role_only_frontend_calls}</div>
                    <div className="stat-label">{text.serviceRoleFrontend}</div>
                  </div>
                </div>

                <div className="alert alert-info">
                  <strong>{text.securityHardeningInfo}: </strong>
                  {text.securityHardeningDesc}
                </div>
              </ModernCard>

              {/* Navigation proposals */}
              <ModernCard title={text.navigationProposalsTitle} subtitle={text.navigationProposalsSubtitle}>
                <DataState loading={navProposals.loading} error={navProposals.error} empty={!navProposals.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead>
                        <tr>
                          <th>{text.routeKey}</th>
                          <th>{text.routeLabel}</th>
                          <th>{text.currentGroup}</th>
                          <th>{text.proposedGroup}</th>
                          <th>{text.status}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(navProposals.data || []).map((row: any) => (
                          <tr key={row.id}>
                            <td><code>{row.route_key}</code></td>
                            <td>{row.route_label}</td>
                            <td>{row.current_group || '-'}</td>
                            <td>{row.proposed_group || '-'}</td>
                            <td>
                              <StatusPill tone={
                                row.simplification_status === 'completed' ? 'good' :
                                row.simplification_status === 'deprecated' ? 'danger' : 'warning'
                              }>
                                {row.simplification_status}
                              </StatusPill>
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
        </div>
      </div>
    </section>
  );
}

// Translations dictionaries
const en = {
  eyebrow: 'Production Quality Gate',
  title: 'Production Readiness Center',
  subtitle: 'Unified dashboard displaying go/no-go sign-offs, known limitations, and backup drills.',
  totalSignoffs: 'Total Sign-offs',
  approvedSignoffs: 'Ready Sign-offs',
  blockedSignoffs: 'Blocked Sign-offs',
  overallStatus: 'Overall Status',
  tabStatus: 'Readiness & Go/No-Go',
  tabLimitations: 'Limitations Registry',
  tabOperations: 'Operations & Translation',
  tabRpcNav: 'RPC & Routing Review',
  goNoGoTitle: 'Overall GRC Readiness Gate',
  goNoGoSubtitle: 'Calculated score indicating readiness for pilot system deployment.',
  readinessScore: 'Overall Readiness Score',
  pilotReadinessTitle: 'Controlled Pilot Scope Sign-off',
  pilotReadinessSubtitle: 'Readiness checks for critical frontend/backend workflows.',
  signoffArea: 'Sign-off Area / Scope',
  status: 'Status',
  signoffRegisterTitle: 'Formal Production Sign-off Registry',
  signoffRegisterSubtitle: 'Formal confirmation log from governance, security, and medical quality leaders.',
  notes: 'Review Notes',
  evidence: 'Evidence Reference',
  proofSuitesTitle: 'Proof Suite Verification Status',
  proofSuitesSubtitle: 'Status of automated audit suites.',
  suiteName: 'Proof Suite Identifier',
  blockingLimitationsTitle: 'Production Blocking Limitations',
  blockingLimitationsSubtitle: 'High and Critical issues blocking pilot roll-out.',
  limitationTitle: 'Limitation Title',
  severity: 'Severity',
  mitigationPlan: 'Mitigation Plan',
  limitationsRegisterTitle: 'Known Limitations Log',
  limitationsRegisterSubtitle: 'Full registry of known exceptions accepted for controlled pilot operations.',
  area: 'Functional Area',
  backupOperationsTitle: 'Disaster Recovery & Backup Verify Drills',
  backupOperationsSubtitle: 'Immutable verification log of restore dry-runs and database checks.',
  operationType: 'Verify Operation',
  summary: 'Verification Summary',
  bilingualReadinessTitle: 'Bilingual translation tracker',
  bilingualReadinessSubtitle: 'Missing or partial translation keys requiring localization checks.',
  totalKeys: 'Total Keys',
  translatedKeys: 'Local Ready',
  missingKeys: 'Missing/Partial',
  reviewKeys: 'Needs Review',
  itemKey: 'Translation Key ID',
  englishText: 'Source English Text',
  rpcDashboardTitle: 'Runtime RPC Security Classification Gate',
  rpcDashboardSubtitle: 'Sign-off and verification metrics for client-invokable database functions.',
  totalRpcs: 'Total RPCs',
  approvedRpcs: 'Approved',
  pendingRpcs: 'Pending Security',
  serviceRoleFrontend: 'Direct Public Calls',
  securityHardeningInfo: 'Database Hardening Enforcement',
  securityHardeningDesc: 'Zero remaining broad SECURITY DEFINER execute grants verified. All client RPC triggers route securely through edge-bridge layers.',
  navigationProposalsTitle: 'Controlled Route Simplification proposals',
  navigationProposalsSubtitle: 'Register mapping deprecated, consolidated, or hidden routes before production release.',
  routeKey: 'Route ID',
  routeLabel: 'Label Name',
  currentGroup: 'Current Group',
  proposedGroup: 'Proposed Group'
};

const ar = {
  eyebrow: 'بوابة الجودة الإنتاجية',
  title: 'مركز جاهزية الإطلاق والتشغيل',
  subtitle: 'لوحة التحكم الموحدة لمتابعة الاعتمادات، وحصر محددات النظام، وتجارب استعادة النسخ الاحتياطي.',
  totalSignoffs: 'إجمالي الاعتمادات',
  approvedSignoffs: 'الاعتمادات الجاهزة',
  blockedSignoffs: 'الاعتمادات المعطلة',
  overallStatus: 'الحالة العامة',
  tabStatus: 'الجاهزية وقرار الإطلاق',
  tabLimitations: 'سجل محددات النظام',
  tabOperations: 'الصيانة والترجمة',
  tabRpcNav: 'مراجعة المسارات والـ RPC',
  goNoGoTitle: 'بوابة جاهزية النظام العامة',
  goNoGoSubtitle: 'المعدل المحسوب الذي يشير إلى جاهزية إطلاق النظام التجريبي.',
  readinessScore: 'درجة الجاهزية العامة',
  pilotReadinessTitle: 'اعتمادات النطاق التجريبي المنضبط',
  pilotReadinessSubtitle: 'الفحوصات الخاصة بمسارات العمل الأساسية في الواجهة الأمامية والخلفية.',
  signoffArea: 'مجال / نطاق الاعتماد',
  status: 'الحالة',
  signoffRegisterTitle: 'سجل اعتمادات التشغيل الإنتاجي الرسمي',
  signoffRegisterSubtitle: 'سجل التوثيق الرسمي من مسؤولي الحوكمة والأمن وجودة الخدمات الطبية.',
  notes: 'ملاحظات المراجعة',
  evidence: 'مرجع دليل الإثبات',
  proofSuitesTitle: 'حالة التحقق من أدلة الإثبات',
  proofSuitesSubtitle: 'حالة مجموعات التدقيق التلقائية.',
  suiteName: 'معرف مجموعة التدقيق',
  blockingLimitationsTitle: 'المحددات المعطلة للتشغيل',
  blockingLimitationsSubtitle: 'المشكلات العالية والحرجة التي تمنع بدء التشغيل التجريبي.',
  limitationTitle: 'عنوان المحدد/المشكلة',
  severity: 'درجة الخطورة',
  mitigationPlan: 'خطة المعالجة/التقليل',
  limitationsRegisterTitle: 'سجل محددات النظام المعروفة',
  limitationsRegisterSubtitle: 'سجل كامل بالاستثناءات والمحددات المقبولة للتشغيل التجريبي.',
  area: 'المجال الوظيفي',
  backupOperationsTitle: 'تجارب التحقق من النسخ واستعادة البيانات',
  backupOperationsSubtitle: 'سجل غير قابل للتعديل لتجارب محاكاة الاستعادة وفحوصات السلامة.',
  operationType: 'عملية التحقق',
  summary: 'ملخص التحقق',
  bilingualReadinessTitle: 'متتبع الترجمة ثنائية اللغة',
  bilingualReadinessSubtitle: 'مفاتيح الترجمة المفقودة أو الجزئية التي تحتاج تدقيق التعريب.',
  totalKeys: 'إجمالي المفاتيح',
  translatedKeys: 'معرب جاهز',
  missingKeys: 'مفقود/جزئي',
  reviewKeys: 'تحت التدقيق',
  itemKey: 'معرف مفتاح الترجمة',
  englishText: 'النص الإنجليزي المصدر',
  rpcDashboardTitle: 'بوابة تصنيف أمان استدعاءات الـ RPC',
  rpcDashboardSubtitle: 'مؤشرات الاعتماد والتحقق للوظائف البرمجية القابلة للاستدعاء.',
  totalRpcs: 'إجمالي الـ RPCs',
  approvedRpcs: 'المعتمدة',
  pendingRpcs: 'معلقة للأمان',
  serviceRoleFrontend: 'الاستدعاءات العامة المباشرة',
  securityHardeningInfo: 'تعزيز أمان قاعدة البيانات',
  securityHardeningDesc: 'تم التحقق من وجود 0 صلاحيات execute عامة للوظائف بصلاحية SECURITY DEFINER. جميع استدعاءات الواجهة الأمامية تمر بشكل آمن.',
  navigationProposalsTitle: 'مقترحات تبسيط وإدارة مسارات التنقل',
  navigationProposalsSubtitle: 'سجل يوضح المسارات الملغاة أو المدمجة أو المخفية قبل الإطلاق الإنتاجي.',
  routeKey: 'معرف المسار',
  routeLabel: 'اسم التسمية',
  currentGroup: 'المجموعة الحالية',
  proposedGroup: 'المجموعة المقترحة'
};
