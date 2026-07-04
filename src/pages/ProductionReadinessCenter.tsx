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
  getRuntimeActionAuthorizationOverlay,
  getRuntimeActionReviewRegister,
  getRuntimeDirectBrowserRpcExceptions,
  getRuntimeAccessReviewOverlay,
  getRuntimeAccessReviewRegister,
  getRuntimeAccessReviewBlockers,
  getStagingEvidenceOverlay,
  getStagingEvidenceBlockers,
  getPilotActivationOverlay,
  getPilotActivationBlockers,
  getPilotDepartmentReadinessRegister,
  getPilotDepartmentSignoffRegister,
  getPilotParticipantCoverage,
  getRealPilotSetupOverlay,
  getRealPilotLaunchBlockers,
  getRealPilotSetupChecklistRegister,
  getRealPilotParticipantSetupGaps,
  getRealPilotTrainingGaps,
  getRealPilotMasterDataExceptions,
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
  const runtimeAuthorization = useAsyncData(getRuntimeActionAuthorizationOverlay, []);
  const runtimeActionRegister = useAsyncData(getRuntimeActionReviewRegister, []);
  const directRpcExceptions = useAsyncData(getRuntimeDirectBrowserRpcExceptions, []);
  const runtimeAccessReview = useAsyncData(getRuntimeAccessReviewOverlay, []);
  const runtimeAccessRegister = useAsyncData(getRuntimeAccessReviewRegister, []);
  const runtimeAccessBlockers = useAsyncData(getRuntimeAccessReviewBlockers, []);
  const stagingEvidence = useAsyncData(getStagingEvidenceOverlay, []);
  const stagingBlockers = useAsyncData(getStagingEvidenceBlockers, []);
  const pilotActivation = useAsyncData(getPilotActivationOverlay, []);
  const pilotBlockers = useAsyncData(getPilotActivationBlockers, []);
  const pilotDepartments = useAsyncData(getPilotDepartmentReadinessRegister, []);
  const pilotSignoffs = useAsyncData(getPilotDepartmentSignoffRegister, []);
  const pilotParticipants = useAsyncData(getPilotParticipantCoverage, []);
  const realPilotSetup = useAsyncData(getRealPilotSetupOverlay, []);
  const realPilotBlockers = useAsyncData(getRealPilotLaunchBlockers, []);
  const realPilotChecklist = useAsyncData(getRealPilotSetupChecklistRegister, []);
  const realPilotParticipantGaps = useAsyncData(getRealPilotParticipantSetupGaps, []);
  const realPilotTrainingGaps = useAsyncData(getRealPilotTrainingGaps, []);
  const realPilotExceptions = useAsyncData(getRealPilotMasterDataExceptions, []);
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

  const runtimeAuthData = runtimeAuthorization.data || {
    runtime_action_total: 0,
    classified_action_count: 0,
    unknown_requires_review_count: 0,
    pending_review_count: 0,
    privileged_action_count: 0,
    direct_browser_rpc_exception_count: 0,
    service_role_only_frontend_calls: 0,
    broad_security_definer_execute_grants: 0,
    readiness_status: 'needs_access_review',
    next_action_required: '-'
  };

  const runtimeAccessData = runtimeAccessReview.data || {
    total_runtime_actions: 0,
    approved_signoffs: 0,
    pending_signoffs: 0,
    overdue_signoffs: 0,
    rejected_signoffs: 0,
    approved_with_limitation_signoffs: 0,
    direct_browser_rpc_exception_count: 0,
    direct_browser_rpc_exception_pending_count: 0,
    risk_acceptance_required_count: 0,
    access_review_readiness_status: 'pending_review',
    next_action_required: '-'
  };

  const stagingEvidenceData = stagingEvidence.data || {
    evidence_run_count: 0,
    latest_run_label: 'No staging/local-clean evidence run recorded',
    latest_environment_type: 'local_clean',
    latest_run_status: 'evidence_required',
    latest_migration_count: 0,
    migrations_replayed: false,
    persona_sql_executed: false,
    rls_check_passed: false,
    function_check_passed: false,
    view_check_passed: false,
    restore_dryrun_passed: false,
    failure_count: 0,
    evidence_path: null,
    staging_evidence_readiness_status: 'evidence_required',
    next_action_required: '-'
  };

  const pilotActivationData = pilotActivation.data || {
    run_label: 'No controlled pilot activation run recorded',
    activation_status: 'planning',
    departments_in_scope: 0,
    departments_ready: 0,
    departments_blocked: 0,
    missing_department_owners: 0,
    pending_signoffs: 0,
    overdue_signoffs: 0,
    approved_with_limitation_signoffs: 0,
    participant_count: 0,
    confirmed_participants: 0,
    training_required_participants: 0,
    pilot_readiness_status: 'evidence_required',
    next_action_required: '-'
  };

  const realPilotSetupData = realPilotSetup.data || {
    run_label: 'No controlled pilot activation run recorded',
    activation_status: 'planning',
    departments_in_scope: 0,
    departments_missing_owners: 0,
    departments_blocked: 0,
    required_participants: 0,
    confirmed_participants: 0,
    participant_count: 0,
    participant_gap_count: 0,
    training_gap_count: 0,
    pending_signoffs: 0,
    overdue_signoffs: 0,
    missing_signoff_owners: 0,
    open_exception_count: 0,
    critical_exception_count: 0,
    high_exception_count: 0,
    launch_blocker_count: 0,
    participant_coverage_percentage: 0,
    setup_readiness_status: 'evidence_required',
    next_action_required: '-'
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

              <ModernCard title={text.pilotActivationTitle} subtitle={text.pilotActivationSubtitle}>
                <DataState loading={pilotActivation.loading} error={pilotActivation.error} empty={!pilotActivation.data}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '14px', marginBottom: '20px' }}>
                    <div className="stat-card">
                      <div className="stat-value">
                        <StatusPill tone={
                          pilotActivationData.pilot_readiness_status === 'ready' ? 'good' :
                          pilotActivationData.pilot_readiness_status === 'ready_with_limitations' ? 'warning' :
                          pilotActivationData.pilot_readiness_status === 'blocked' ? 'danger' : 'neutral'
                        }>
                          {pilotActivationData.pilot_readiness_status}
                        </StatusPill>
                      </div>
                      <div className="stat-label">{text.pilotReadinessStatus}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{pilotActivationData.departments_in_scope}</div>
                      <div className="stat-label">{text.departmentsInScope}</div>
                    </div>
                    <div className="stat-card success">
                      <div className="stat-value">{pilotActivationData.departments_ready}</div>
                      <div className="stat-label">{text.departmentsReady}</div>
                    </div>
                    <div className="stat-card danger">
                      <div className="stat-value">{pilotActivationData.departments_blocked}</div>
                      <div className="stat-label">{text.departmentsBlocked}</div>
                    </div>
                    <div className="stat-card warning">
                      <div className="stat-value">{pilotActivationData.missing_department_owners}</div>
                      <div className="stat-label">{text.missingDepartmentOwners}</div>
                    </div>
                    <div className="stat-card warning">
                      <div className="stat-value">{pilotActivationData.pending_signoffs}</div>
                      <div className="stat-label">{text.pendingDepartmentSignoffs}</div>
                    </div>
                    <div className="stat-card danger">
                      <div className="stat-value">{pilotActivationData.overdue_signoffs}</div>
                      <div className="stat-label">{text.overdueDepartmentSignoffs}</div>
                    </div>
                    <div className="stat-card warning">
                      <div className="stat-value">{pilotActivationData.approved_with_limitation_signoffs}</div>
                      <div className="stat-label">{text.limitedDepartmentSignoffs}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{pilotActivationData.confirmed_participants} / {pilotActivationData.participant_count}</div>
                      <div className="stat-label">{text.participantCoverage}</div>
                    </div>
                    <div className="stat-card warning">
                      <div className="stat-value">{pilotActivationData.training_required_participants}</div>
                      <div className="stat-label">{text.trainingRequiredParticipants}</div>
                    </div>
                  </div>
                  <div className="alert alert-info">
                    <strong>{text.currentPilotActivation}: </strong>{pilotActivationData.run_label} ({pilotActivationData.activation_status})
                    <br />
                    <strong>{text.nextActionRequired}: </strong>{pilotActivationData.next_action_required}
                  </div>
                </DataState>
              </ModernCard>

              <ModernCard title={text.pilotBlockersTitle} subtitle={text.pilotBlockersSubtitle}>
                <DataState loading={pilotBlockers.loading} error={pilotBlockers.error} empty={!pilotBlockers.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead>
                        <tr>
                          <th>{text.department}</th>
                          <th>{text.area}</th>
                          <th>{text.blockerReason}</th>
                          <th>{text.evidence}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(pilotBlockers.data || []).slice(0, 60).map((row: any, index: number) => (
                          <tr key={`${row.department_name}-${row.blocker_type}-${index}`}>
                            <td><strong>{row.department_name}</strong></td>
                            <td>{row.blocker_type}</td>
                            <td>{row.blocker_reason}</td>
                            <td><code>{row.evidence_reference || '-'}</code></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <ModernCard title={text.departmentReadinessTitle} subtitle={text.departmentReadinessSubtitle}>
                  <DataState loading={pilotDepartments.loading} error={pilotDepartments.error} empty={!pilotDepartments.data?.length}>
                    <div className="table-wrap">
                      <table className="entity-table">
                        <thead>
                          <tr>
                            <th>{text.department}</th>
                            <th>{text.owner}</th>
                            <th>{text.status}</th>
                            <th>{text.participants}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(pilotDepartments.data || []).slice(0, 40).map((row: any) => (
                            <tr key={row.id}>
                              <td><strong>{row.department_name}</strong></td>
                              <td>{row.owner_user_id ? text.assigned : row.missing_owner_reason || text.evidenceRequired}</td>
                              <td><StatusPill tone={row.pilot_status === 'ready' ? 'good' : row.pilot_status === 'blocked' ? 'danger' : 'warning'}>{row.pilot_status}</StatusPill></td>
                              <td>{row.confirmed_participant_count} / {row.required_participant_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </DataState>
                </ModernCard>

                <ModernCard title={text.participantCoverageTitle} subtitle={text.participantCoverageSubtitle}>
                  <DataState loading={pilotParticipants.loading} error={pilotParticipants.error} empty={!pilotParticipants.data?.length}>
                    <div className="table-wrap">
                      <table className="entity-table">
                        <thead>
                          <tr>
                            <th>{text.department}</th>
                            <th>{text.confirmedParticipants}</th>
                            <th>{text.pendingParticipants}</th>
                            <th>{text.trainingRequiredParticipants}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(pilotParticipants.data || []).slice(0, 40).map((row: any, index: number) => (
                            <tr key={`${row.department_name}-${index}`}>
                              <td><strong>{row.department_name}</strong></td>
                              <td>{row.confirmed_participant_count} / {row.participant_count}</td>
                              <td>{row.pending_participant_count}</td>
                              <td>{row.training_required_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </DataState>
                </ModernCard>
              </div>

              <ModernCard title={text.departmentSignoffTitle} subtitle={text.departmentSignoffSubtitle}>
                <DataState loading={pilotSignoffs.loading} error={pilotSignoffs.error} empty={!pilotSignoffs.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead>
                        <tr>
                          <th>{text.department}</th>
                          <th>{text.signoffRole}</th>
                          <th>{text.status}</th>
                          <th>{text.dueAt}</th>
                          <th>{text.evidence}</th>
                          <th>{text.limitationSummary}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(pilotSignoffs.data || []).slice(0, 60).map((row: any) => (
                          <tr key={row.id}>
                            <td><strong>{row.department_name}</strong></td>
                            <td>{row.signoff_role}</td>
                            <td><StatusPill tone={row.signoff_status === 'approved' ? 'good' : row.signoff_status === 'rejected' || row.is_overdue ? 'danger' : 'warning'}>{row.signoff_status}</StatusPill></td>
                            <td>{row.due_at ? new Date(row.due_at).toLocaleDateString() : '-'}</td>
                            <td><code>{row.evidence_reference || '-'}</code></td>
                            <td>{row.limitation_summary || row.rejection_reason || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>

              <ModernCard title={text.realPilotSetupTitle} subtitle={text.realPilotSetupSubtitle}>
                <DataState loading={realPilotSetup.loading} error={realPilotSetup.error} empty={!realPilotSetup.data}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '14px', marginBottom: '20px' }}>
                    <div className="stat-card">
                      <div className="stat-value">
                        <StatusPill tone={
                          realPilotSetupData.setup_readiness_status === 'ready' ? 'good' :
                          realPilotSetupData.setup_readiness_status === 'ready_with_limitations' ? 'warning' :
                          realPilotSetupData.setup_readiness_status === 'blocked' ? 'danger' : 'neutral'
                        }>
                          {realPilotSetupData.setup_readiness_status}
                        </StatusPill>
                      </div>
                      <div className="stat-label">{text.setupReadinessStatus}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{realPilotSetupData.departments_in_scope}</div>
                      <div className="stat-label">{text.departmentsInScope}</div>
                    </div>
                    <div className="stat-card warning">
                      <div className="stat-value">{realPilotSetupData.departments_missing_owners}</div>
                      <div className="stat-label">{text.missingDepartmentOwners}</div>
                    </div>
                    <div className="stat-card danger">
                      <div className="stat-value">{realPilotSetupData.departments_blocked}</div>
                      <div className="stat-label">{text.departmentsBlocked}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{realPilotSetupData.participant_coverage_percentage}%</div>
                      <div className="stat-label">{text.participantCoverage}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{realPilotSetupData.confirmed_participants} / {realPilotSetupData.required_participants}</div>
                      <div className="stat-label">{text.requiredParticipants}</div>
                    </div>
                    <div className="stat-card warning">
                      <div className="stat-value">{realPilotSetupData.participant_gap_count}</div>
                      <div className="stat-label">{text.participantGaps}</div>
                    </div>
                    <div className="stat-card warning">
                      <div className="stat-value">{realPilotSetupData.training_gap_count}</div>
                      <div className="stat-label">{text.trainingGaps}</div>
                    </div>
                    <div className="stat-card warning">
                      <div className="stat-value">{realPilotSetupData.pending_signoffs}</div>
                      <div className="stat-label">{text.pendingDepartmentSignoffs}</div>
                    </div>
                    <div className="stat-card danger">
                      <div className="stat-value">{realPilotSetupData.launch_blocker_count}</div>
                      <div className="stat-label">{text.launchBlockers}</div>
                    </div>
                  </div>
                  <div className="alert alert-info">
                    <strong>{text.currentPilotActivation}: </strong>{realPilotSetupData.run_label} ({realPilotSetupData.activation_status})
                    <br />
                    <strong>{text.nextActionRequired}: </strong>{realPilotSetupData.next_action_required}
                  </div>
                </DataState>
              </ModernCard>

              <ModernCard title={text.realPilotLaunchBlockersTitle} subtitle={text.realPilotLaunchBlockersSubtitle}>
                <DataState loading={realPilotBlockers.loading} error={realPilotBlockers.error} empty={!realPilotBlockers.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead>
                        <tr>
                          <th>{text.department}</th>
                          <th>{text.area}</th>
                          <th>{text.severity}</th>
                          <th>{text.blockerReason}</th>
                          <th>{text.evidence}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(realPilotBlockers.data || []).slice(0, 60).map((row: any, index: number) => (
                          <tr key={`${row.department_name}-${row.blocker_type}-${index}`}>
                            <td><strong>{row.department_name}</strong></td>
                            <td>{row.blocker_type}</td>
                            <td><StatusPill tone={row.severity === 'critical' || row.severity === 'high' ? 'danger' : 'warning'}>{row.severity}</StatusPill></td>
                            <td>{row.blocker_summary}</td>
                            <td><code>{row.evidence_reference || '-'}</code></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <ModernCard title={text.realPilotChecklistTitle} subtitle={text.realPilotChecklistSubtitle}>
                  <DataState loading={realPilotChecklist.loading} error={realPilotChecklist.error} empty={!realPilotChecklist.data?.length}>
                    <div className="table-wrap">
                      <table className="entity-table">
                        <thead>
                          <tr>
                            <th>{text.area}</th>
                            <th>{text.status}</th>
                            <th>{text.owner}</th>
                            <th>{text.blockerReason}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(realPilotChecklist.data || []).slice(0, 40).map((row: any) => (
                            <tr key={row.id}>
                              <td><strong>{row.item_label}</strong><br /><small>{row.checklist_area}</small></td>
                              <td><StatusPill tone={row.item_status === 'ready' ? 'good' : row.item_status === 'blocked' ? 'danger' : 'warning'}>{row.item_status}</StatusPill></td>
                              <td>{row.owner_user_id ? text.assigned : text.evidenceRequired}</td>
                              <td>{row.checklist_gap_reason || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </DataState>
                </ModernCard>

                <ModernCard title={text.realPilotExceptionsTitle} subtitle={text.realPilotExceptionsSubtitle}>
                  <DataState loading={realPilotExceptions.loading} error={realPilotExceptions.error} empty={!realPilotExceptions.data?.length}>
                    <div className="table-wrap">
                      <table className="entity-table">
                        <thead>
                          <tr>
                            <th>{text.area}</th>
                            <th>{text.severity}</th>
                            <th>{text.status}</th>
                            <th>{text.summary}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(realPilotExceptions.data || []).slice(0, 40).map((row: any) => (
                            <tr key={row.id}>
                              <td>{row.exception_type}</td>
                              <td><StatusPill tone={row.severity === 'critical' || row.severity === 'high' ? 'danger' : 'warning'}>{row.severity}</StatusPill></td>
                              <td>{row.exception_status}</td>
                              <td>{row.exception_summary}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </DataState>
                </ModernCard>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <ModernCard title={text.realPilotParticipantGapsTitle} subtitle={text.realPilotParticipantGapsSubtitle}>
                  <DataState loading={realPilotParticipantGaps.loading} error={realPilotParticipantGaps.error} empty={!realPilotParticipantGaps.data?.length}>
                    <div className="table-wrap">
                      <table className="entity-table">
                        <thead>
                          <tr>
                            <th>{text.department}</th>
                            <th>{text.participants}</th>
                            <th>{text.status}</th>
                            <th>{text.blockerReason}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(realPilotParticipantGaps.data || []).slice(0, 40).map((row: any) => (
                            <tr key={row.participant_id}>
                              <td>{row.department_name}</td>
                              <td><strong>{row.display_name}</strong><br /><small>{row.participant_role || text.evidenceRequired}</small></td>
                              <td>{row.participation_status}</td>
                              <td>{row.gap_summary}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </DataState>
                </ModernCard>

                <ModernCard title={text.realPilotTrainingGapsTitle} subtitle={text.realPilotTrainingGapsSubtitle}>
                  <DataState loading={realPilotTrainingGaps.loading} error={realPilotTrainingGaps.error} empty={!realPilotTrainingGaps.data?.length}>
                    <div className="table-wrap">
                      <table className="entity-table">
                        <thead>
                          <tr>
                            <th>{text.department}</th>
                            <th>{text.participants}</th>
                            <th>{text.signoffRole}</th>
                            <th>{text.blockerReason}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(realPilotTrainingGaps.data || []).slice(0, 40).map((row: any) => (
                            <tr key={row.participant_id}>
                              <td>{row.department_name}</td>
                              <td><strong>{row.display_name}</strong></td>
                              <td>{row.participant_role}</td>
                              <td>{row.gap_summary}</td>
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

              <ModernCard title={text.stagingEvidenceTitle} subtitle={text.stagingEvidenceSubtitle}>
                <DataState loading={stagingEvidence.loading} error={stagingEvidence.error} empty={!stagingEvidence.data}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '14px', marginBottom: '20px' }}>
                    <div className="stat-card">
                      <div className="stat-value">{stagingEvidenceData.latest_migration_count}</div>
                      <div className="stat-label">{text.migrationsReplayed}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">
                        <StatusPill tone={stagingEvidenceData.persona_sql_executed ? 'good' : 'warning'}>
                          {stagingEvidenceData.persona_sql_executed ? text.ready : text.evidenceRequired}
                        </StatusPill>
                      </div>
                      <div className="stat-label">{text.personaSqlStatus}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">
                        <StatusPill tone={stagingEvidenceData.rls_check_passed && stagingEvidenceData.function_check_passed && stagingEvidenceData.view_check_passed ? 'good' : 'warning'}>
                          {stagingEvidenceData.rls_check_passed && stagingEvidenceData.function_check_passed && stagingEvidenceData.view_check_passed ? text.ready : text.evidenceRequired}
                        </StatusPill>
                      </div>
                      <div className="stat-label">{text.securityProofStatus}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">
                        <StatusPill tone={stagingEvidenceData.staging_evidence_readiness_status === 'ready' ? 'good' : stagingEvidenceData.staging_evidence_readiness_status === 'blocked' || stagingEvidenceData.staging_evidence_readiness_status === 'failed' ? 'danger' : 'warning'}>
                          {stagingEvidenceData.staging_evidence_readiness_status}
                        </StatusPill>
                      </div>
                      <div className="stat-label">{text.stagingEvidenceReadiness}</div>
                    </div>
                  </div>
                  <div className="table-wrap" style={{ marginBottom: '16px' }}>
                    <table className="entity-table">
                      <thead>
                        <tr>
                          <th>{text.latestRun}</th>
                          <th>{text.environment}</th>
                          <th>{text.restoreDryRun}</th>
                          <th>{text.evidence}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><strong>{stagingEvidenceData.latest_run_label}</strong></td>
                          <td>{stagingEvidenceData.latest_environment_type}</td>
                          <td>
                            <StatusPill tone={stagingEvidenceData.restore_dryrun_passed ? 'good' : 'warning'}>
                              {stagingEvidenceData.restore_dryrun_passed ? text.ready : text.evidenceRequired}
                            </StatusPill>
                          </td>
                          <td><code>{stagingEvidenceData.evidence_path || '-'}</code></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="alert alert-info">
                    <strong>{text.nextActionRequired}: </strong>{stagingEvidenceData.next_action_required}
                  </div>
                </DataState>
              </ModernCard>

              <ModernCard title={text.stagingBlockersTitle} subtitle={text.stagingBlockersSubtitle}>
                <DataState loading={stagingBlockers.loading} error={stagingBlockers.error} empty={!stagingBlockers.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead>
                        <tr>
                          <th>{text.latestRun}</th>
                          <th>{text.status}</th>
                          <th>{text.blockerReason}</th>
                          <th>{text.notes}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(stagingBlockers.data || []).slice(0, 40).map((row: any) => (
                          <tr key={row.id ?? row.run_label}>
                            <td><strong>{row.run_label}</strong></td>
                            <td><StatusPill tone={row.run_status === 'failed' || row.run_status === 'blocked' ? 'danger' : 'warning'}>{row.run_status}</StatusPill></td>
                            <td>{row.blocker_reason ?? '-'}</td>
                            <td>{row.run_notes ?? '-'}</td>
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

              <ModernCard title={text.runtimeActionReviewTitle} subtitle={text.runtimeActionReviewSubtitle}>
                <DataState loading={runtimeAuthorization.loading} error={runtimeAuthorization.error} empty={!runtimeAuthorization.data}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '14px', marginBottom: '20px' }}>
                    <div className="stat-card">
                      <div className="stat-value">{runtimeAuthData.runtime_action_total ?? runtimeAuthData.total_runtime_actions}</div>
                      <div className="stat-label">{text.runtimeActions}</div>
                    </div>
                    <div className="stat-card success">
                      <div className="stat-value">{runtimeAuthData.classified_action_count ?? runtimeAuthData.classified_actions}</div>
                      <div className="stat-label">{text.classifiedActions}</div>
                    </div>
                    <div className="stat-card warning">
                      <div className="stat-value">{runtimeAuthData.pending_review_count ?? runtimeAuthData.pending_review_actions}</div>
                      <div className="stat-label">{text.pendingAccessReview}</div>
                    </div>
                    <div className="stat-card danger">
                      <div className="stat-value">{runtimeAuthData.direct_browser_rpc_exception_count ?? runtimeAuthData.direct_browser_rpc_exceptions}</div>
                      <div className="stat-label">{text.directBrowserExceptions}</div>
                    </div>
                  </div>
                  <div className="alert alert-info">
                    <strong>{text.nextActionRequired}: </strong>{runtimeAuthData.next_action_required}
                    <br />
                    <strong>{text.securityRuntimeChecks}: </strong>
                    {text.serviceRoleOnlyCalls}: {runtimeAuthData.service_role_only_frontend_calls}; {text.broadDefinerGrants}: {runtimeAuthData.broad_security_definer_execute_grants}
                  </div>
                </DataState>
              </ModernCard>

              <ModernCard title={text.runtimeAccessReviewTitle} subtitle={text.runtimeAccessReviewSubtitle}>
                <DataState loading={runtimeAccessReview.loading} error={runtimeAccessReview.error} empty={!runtimeAccessReview.data}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '14px', marginBottom: '20px' }}>
                    <div className="stat-card">
                      <div className="stat-value">{runtimeAccessData.total_runtime_actions}</div>
                      <div className="stat-label">{text.runtimeActions}</div>
                    </div>
                    <div className="stat-card success">
                      <div className="stat-value">{runtimeAccessData.approved_signoffs}</div>
                      <div className="stat-label">{text.approvedRuntimeSignoffs}</div>
                    </div>
                    <div className="stat-card warning">
                      <div className="stat-value">{runtimeAccessData.pending_signoffs}</div>
                      <div className="stat-label">{text.pendingSignoffs}</div>
                    </div>
                    <div className="stat-card danger">
                      <div className="stat-value">{runtimeAccessData.overdue_signoffs}</div>
                      <div className="stat-label">{text.overdueSignoffs}</div>
                    </div>
                    <div className="stat-card danger">
                      <div className="stat-value">{runtimeAccessData.rejected_signoffs}</div>
                      <div className="stat-label">{text.rejectedSignoffs}</div>
                    </div>
                    <div className="stat-card warning">
                      <div className="stat-value">{runtimeAccessData.approved_with_limitation_signoffs}</div>
                      <div className="stat-label">{text.approvedWithLimitationSignoffs}</div>
                    </div>
                    <div className="stat-card warning">
                      <div className="stat-value">{runtimeAccessData.risk_acceptance_required_count}</div>
                      <div className="stat-label">{text.riskAcceptanceRequired}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">
                        <StatusPill tone={
                          runtimeAccessData.access_review_readiness_status === 'ready' ? 'good' :
                          runtimeAccessData.access_review_readiness_status === 'ready_with_limitations' ? 'warning' :
                          runtimeAccessData.access_review_readiness_status === 'blocked' ? 'danger' : 'neutral'
                        }>
                          {runtimeAccessData.access_review_readiness_status}
                        </StatusPill>
                      </div>
                      <div className="stat-label">{text.accessReviewReadinessStatus}</div>
                    </div>
                  </div>
                  <div className="alert alert-info">
                    <strong>{text.directBrowserExceptionReview}: </strong>
                    {runtimeAccessData.direct_browser_rpc_exception_pending_count} / {runtimeAccessData.direct_browser_rpc_exception_count} {text.pendingSignoffs}
                    <br />
                    <strong>{text.nextActionRequired}: </strong>{runtimeAccessData.next_action_required}
                  </div>
                </DataState>
              </ModernCard>

              <ModernCard title={text.accessReviewBlockersTitle} subtitle={text.accessReviewBlockersSubtitle}>
                <DataState loading={runtimeAccessBlockers.loading} error={runtimeAccessBlockers.error} empty={!runtimeAccessBlockers.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead>
                        <tr>
                          <th>{text.actionName}</th>
                          <th>{text.moduleName}</th>
                          <th>{text.riskLevel}</th>
                          <th>{text.reviewStatus}</th>
                          <th>{text.blockerReason}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(runtimeAccessBlockers.data || []).slice(0, 80).map((row: any) => (
                          <tr key={row.action_name ?? row.actionName}>
                            <td><code>{row.action_name ?? row.actionName}</code></td>
                            <td>{row.module_name ?? row.moduleName}</td>
                            <td><StatusPill tone={row.risk_level === 'critical' ? 'danger' : row.risk_level === 'high' ? 'warning' : 'neutral'}>{row.risk_level ?? row.riskLevel}</StatusPill></td>
                            <td><StatusPill tone={row.signoff_status === 'rejected' ? 'danger' : row.signoff_status === 'approved_with_limitation' ? 'warning' : 'neutral'}>{row.signoff_status ?? row.signoffStatus}</StatusPill></td>
                            <td>{row.blocker_reason ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>

              <ModernCard title={text.accessReviewRegisterTitle} subtitle={text.accessReviewRegisterSubtitle}>
                <DataState loading={runtimeAccessRegister.loading} error={runtimeAccessRegister.error} empty={!runtimeAccessRegister.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead>
                        <tr>
                          <th>{text.actionName}</th>
                          <th>{text.reviewer}</th>
                          <th>{text.reviewStatus}</th>
                          <th>{text.dueAt}</th>
                          <th>{text.evidenceReference}</th>
                          <th>{text.limitationSummary}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(runtimeAccessRegister.data || []).slice(0, 80).map((row: any) => (
                          <tr key={row.action_name ?? row.actionName}>
                            <td><code>{row.action_name ?? row.actionName}</code></td>
                            <td>{row.reviewer_role ?? row.reviewerRole}</td>
                            <td><StatusPill tone={
                              row.signoff_status === 'approved' ? 'good' :
                              row.signoff_status === 'approved_with_limitation' ? 'warning' :
                              row.signoff_status === 'rejected' || row.is_overdue ? 'danger' : 'neutral'
                            }>{row.signoff_status ?? row.signoffStatus}</StatusPill></td>
                            <td>{row.due_at ? new Date(row.due_at).toLocaleDateString() : '-'}</td>
                            <td><code>{row.evidence_reference ?? '-'}</code></td>
                            <td>{row.limitation_summary ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>

              <ModernCard title={text.directBrowserExceptionTitle} subtitle={text.directBrowserExceptionSubtitle}>
                <DataState loading={directRpcExceptions.loading} error={directRpcExceptions.error} empty={!directRpcExceptions.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead>
                        <tr>
                          <th>{text.actionName}</th>
                          <th>{text.classification}</th>
                          <th>{text.riskLevel}</th>
                          <th>{text.justification}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(directRpcExceptions.data || []).map((row: any) => (
                          <tr key={row.action_name ?? row.actionName}>
                            <td><code>{row.action_name ?? row.actionName}</code></td>
                            <td><StatusPill tone="warning">{row.classification}</StatusPill></td>
                            <td><StatusPill tone={row.risk_level === 'critical' || row.riskLevel === 'critical' ? 'danger' : 'warning'}>{row.risk_level ?? row.riskLevel}</StatusPill></td>
                            <td>{row.review_notes ?? row.notes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>

              <ModernCard title={text.runtimeActionRegisterTitle} subtitle={text.runtimeActionRegisterSubtitle}>
                <DataState loading={runtimeActionRegister.loading} error={runtimeActionRegister.error} empty={!runtimeActionRegister.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead>
                        <tr>
                          <th>{text.actionName}</th>
                          <th>{text.moduleName}</th>
                          <th>{text.transport}</th>
                          <th>{text.classification}</th>
                          <th>{text.reviewStatus}</th>
                          <th>{text.ownerRole}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(runtimeActionRegister.data || []).slice(0, 80).map((row: any) => (
                          <tr key={row.action_name ?? row.actionName}>
                            <td><code>{row.action_name ?? row.actionName}</code></td>
                            <td>{row.module_name ?? row.moduleName}</td>
                            <td>{row.action_transport ?? row.actionTransport}</td>
                            <td><StatusPill tone={(row.classification ?? '').includes('unknown') ? 'danger' : 'good'}>{row.classification}</StatusPill></td>
                            <td><StatusPill tone={(row.review_status ?? row.reviewStatus) === 'pending_review' ? 'warning' : 'good'}>{row.review_status ?? row.reviewStatus}</StatusPill></td>
                            <td>{row.owner_role ?? row.ownerRole}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DataState>
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
  tabRpcNav: 'System Routing & Actions',
  goNoGoTitle: 'Overall GRC Readiness Gate',
  goNoGoSubtitle: 'Calculated score indicating readiness for pilot system deployment.',
  readinessScore: 'Overall Readiness Score',
  pilotReadinessTitle: 'Controlled Pilot Scope Sign-off',
  pilotReadinessSubtitle: 'Readiness checks for critical frontend/backend workflows.',
  pilotActivationTitle: 'Controlled Pilot Activation',
  pilotActivationSubtitle: 'Department readiness, participant coverage, owner assignment, and executive go/no-go visibility for the first controlled rollout.',
  pilotReadinessStatus: 'Pilot Readiness',
  currentPilotActivation: 'Current pilot activation',
  departmentsInScope: 'Departments In Scope',
  departmentsReady: 'Departments Ready',
  departmentsBlocked: 'Departments Blocked',
  missingDepartmentOwners: 'Missing Department Owners',
  pendingDepartmentSignoffs: 'Pending Signoffs',
  overdueDepartmentSignoffs: 'Overdue Signoffs',
  limitedDepartmentSignoffs: 'Limited Approvals',
  participantCoverage: 'Participant Coverage',
  trainingRequiredParticipants: 'Training Required',
  pilotBlockersTitle: 'Controlled Pilot Blockers',
  pilotBlockersSubtitle: 'Departments, signoffs, owner gaps, and participant readiness items that must be cleared before pilot activation.',
  departmentReadinessTitle: 'Department Readiness',
  departmentReadinessSubtitle: 'Owner assignment, department pilot status, and required participant coverage.',
  participantCoverageTitle: 'Participant Coverage',
  participantCoverageSubtitle: 'Confirmed participants, pending participants, and training confirmation by department.',
  departmentSignoffTitle: 'Department Signoff Pack',
  departmentSignoffSubtitle: 'Formal department, quality, internal audit, IT, and executive signoffs for controlled pilot activation.',
  realPilotSetupTitle: 'Real Pilot Setup Readiness',
  realPilotSetupSubtitle: 'Operational onboarding status for real departments, owners, participants, roles, training coverage, signoffs, and launch blockers.',
  setupReadinessStatus: 'Setup Readiness',
  requiredParticipants: 'Required Participants',
  participantGaps: 'Participant Gaps',
  trainingGaps: 'Training Gaps',
  launchBlockers: 'Launch Blockers',
  realPilotLaunchBlockersTitle: 'Real Pilot Launch Blockers',
  realPilotLaunchBlockersSubtitle: 'Real setup gaps that must be resolved before the controlled pilot can launch.',
  realPilotChecklistTitle: 'Setup Checklist',
  realPilotChecklistSubtitle: 'Department scope, owner assignment, participant mapping, roles, training, signoffs, and launch review.',
  realPilotExceptionsTitle: 'Master Data Exceptions',
  realPilotExceptionsSubtitle: 'Open setup exceptions, accepted limitations, ownership, and evidence status.',
  realPilotParticipantGapsTitle: 'Participant Setup Gaps',
  realPilotParticipantGapsSubtitle: 'Pending, unavailable, inactive, or training-required pilot participants.',
  realPilotTrainingGapsTitle: 'Training Readiness Gaps',
  realPilotTrainingGapsSubtitle: 'Participants whose required training is not yet confirmed.',
  department: 'Department',
  owner: 'Owner',
  assigned: 'Assigned',
  participants: 'Participants',
  confirmedParticipants: 'Confirmed',
  pendingParticipants: 'Pending',
  signoffRole: 'Signoff Role',
  signoffArea: 'Sign-off Area / Scope',
  status: 'Status',
  signoffRegisterTitle: 'Formal Production Sign-off Registry',
  signoffRegisterSubtitle: 'Formal confirmation log from governance, security, and medical quality leaders.',
  notes: 'Review Notes',
  evidence: 'Evidence Reference',
  proofSuitesTitle: 'Proof Suite Verification Status',
  proofSuitesSubtitle: 'Status of automated audit suites.',
  suiteName: 'Proof Suite Identifier',
  stagingEvidenceTitle: 'Staging migration and persona evidence',
  stagingEvidenceSubtitle: 'Operational proof that migration replay, persona SQL, RLS/function/view checks, and restore dry-run evidence are complete.',
  migrationsReplayed: 'Migrations Replayed',
  personaSqlStatus: 'Persona SQL Status',
  securityProofStatus: 'RLS / Function / View Proof',
  stagingEvidenceReadiness: 'Staging Evidence Readiness',
  latestRun: 'Latest Run',
  environment: 'Environment',
  restoreDryRun: 'Restore Dry-run',
  ready: 'Ready',
  evidenceRequired: 'Evidence Required',
  stagingBlockersTitle: 'Staging evidence blockers',
  stagingBlockersSubtitle: 'Missing or failed staging/local-clean evidence that blocks final production readiness.',
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
  rpcDashboardTitle: 'System Action Security Gate',
  rpcDashboardSubtitle: 'Sign-off and verification metrics for backend functions.',
  totalRpcs: 'Total Actions',
  approvedRpcs: 'Approved',
  pendingRpcs: 'Pending Review',
  serviceRoleFrontend: 'Direct Public Calls',
  securityHardeningInfo: 'System Hardening Enforcement',
  securityHardeningDesc: 'Zero open public execute grants verified. All client triggers route securely.',
  runtimeActionReviewTitle: 'Access Authorization Review',
  runtimeActionReviewSubtitle: 'Classification, owner, risk, and review status for system actions.',
  runtimeActions: 'System Actions',
  classifiedActions: 'Classified',
  pendingAccessReview: 'Pending Review',
  directBrowserExceptions: 'Browser Exceptions',
  nextActionRequired: 'Next action',
  securityRuntimeChecks: 'Security checks',
  serviceRoleOnlyCalls: 'Internal-only calls',
  broadDefinerGrants: 'Broad definer grants',
  runtimeAccessReviewTitle: 'Access Review Closure',
  runtimeAccessReviewSubtitle: 'Operational closure for action approvals, limitations, rejected signoffs, and risk acceptance.',
  approvedRuntimeSignoffs: 'Approved Signoffs',
  pendingSignoffs: 'Pending Signoffs',
  overdueSignoffs: 'Overdue Signoffs',
  rejectedSignoffs: 'Rejected Signoffs',
  approvedWithLimitationSignoffs: 'Approved With Limitation',
  riskAcceptanceRequired: 'Risk Acceptance Required',
  accessReviewReadinessStatus: 'Access Review Readiness',
  directBrowserExceptionReview: 'Browser action review',
  accessReviewBlockersTitle: 'Access Review Blockers',
  accessReviewBlockersSubtitle: 'Pending high-risk, overdue, rejected, and missing-evidence signoffs.',
  blockerReason: 'Blocker Reason',
  accessReviewRegisterTitle: 'Access Review Register',
  accessReviewRegisterSubtitle: 'Reviewer assignment, due date, signoff status, and closure evidence for actions.',
  reviewer: 'Reviewer',
  dueAt: 'Due',
  evidenceReference: 'Evidence',
  limitationSummary: 'Limitation Notes',
  directBrowserExceptionTitle: 'Browser Action Exception Register',
  directBrowserExceptionSubtitle: 'Tracked direct browser calls that require proof.',
  runtimeActionRegisterTitle: 'System Action Register',
  runtimeActionRegisterSubtitle: 'Current registry of actions, ownership, risk, and review status.',
  actionName: 'Action',
  classification: 'Classification',
  riskLevel: 'Risk',
  justification: 'Justification',
  moduleName: 'Module',
  transport: 'Transport',
  reviewStatus: 'Review Status',
  ownerRole: 'Owner Role',
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
  tabRpcNav: 'توجيه النظام والإجراءات',
  goNoGoTitle: 'بوابة جاهزية النظام العامة',
  goNoGoSubtitle: 'المعدل المحسوب الذي يشير إلى جاهزية إطلاق النظام التجريبي.',
  readinessScore: 'درجة الجاهزية العامة',
  pilotReadinessTitle: 'اعتمادات النطاق التجريبي المنضبط',
  pilotReadinessSubtitle: 'الفحوصات الخاصة بمسارات العمل الأساسية في الواجهة الأمامية والخلفية.',
  pilotActivationTitle: 'تفعيل التشغيل التجريبي المنضبط',
  pilotActivationSubtitle: 'جاهزية الأقسام، وتغطية المشاركين، وتعيين المسؤولين، ووضوح قرار الانطلاق التنفيذي لأول تشغيل منضبط.',
  pilotReadinessStatus: 'جاهزية التشغيل التجريبي',
  currentPilotActivation: 'تفعيل التشغيل الحالي',
  departmentsInScope: 'الأقسام ضمن النطاق',
  departmentsReady: 'الأقسام الجاهزة',
  departmentsBlocked: 'الأقسام المعطلة',
  missingDepartmentOwners: 'مسؤولو أقسام غير محددين',
  pendingDepartmentSignoffs: 'اعتمادات معلقة',
  overdueDepartmentSignoffs: 'اعتمادات متأخرة',
  limitedDepartmentSignoffs: 'اعتمادات بمحددات',
  participantCoverage: 'تغطية المشاركين',
  trainingRequiredParticipants: 'يتطلب تدريب',
  pilotBlockersTitle: 'معوقات التشغيل التجريبي',
  pilotBlockersSubtitle: 'الأقسام والاعتمادات وفجوات المسؤولين وجاهزية المشاركين التي يجب إغلاقها قبل التفعيل.',
  departmentReadinessTitle: 'جاهزية الأقسام',
  departmentReadinessSubtitle: 'تعيين المسؤول وحالة القسم وتغطية المشاركين المطلوبة.',
  participantCoverageTitle: 'تغطية المشاركين',
  participantCoverageSubtitle: 'المشاركون المؤكدون والمعلقون وتأكيد التدريب حسب القسم.',
  departmentSignoffTitle: 'حزمة اعتمادات الأقسام',
  departmentSignoffSubtitle: 'اعتمادات الأقسام والجودة والتدقيق الداخلي وتقنية المعلومات والتنفيذيين لتفعيل التشغيل التجريبي.',
  realPilotSetupTitle: 'جاهزية إعداد التشغيل التجريبي الفعلي',
  realPilotSetupSubtitle: 'حالة تجهيز الأقسام الفعلية، والمسؤولين، والمشاركين، والأدوار، والتدريب، والاعتمادات، ومعوقات الإطلاق.',
  setupReadinessStatus: 'جاهزية الإعداد',
  requiredParticipants: 'المشاركون المطلوبون',
  participantGaps: 'فجوات المشاركين',
  trainingGaps: 'فجوات التدريب',
  launchBlockers: 'معوقات الإطلاق',
  realPilotLaunchBlockersTitle: 'معوقات إطلاق التشغيل الفعلي',
  realPilotLaunchBlockersSubtitle: 'فجوات الإعداد الفعلية التي يجب حلها قبل إطلاق التشغيل التجريبي المنضبط.',
  realPilotChecklistTitle: 'قائمة تحقق الإعداد',
  realPilotChecklistSubtitle: 'نطاق الأقسام، وتعيين المسؤولين، وربط المشاركين، والأدوار، والتدريب، والاعتمادات، ومراجعة الإطلاق.',
  realPilotExceptionsTitle: 'استثناءات البيانات الأساسية',
  realPilotExceptionsSubtitle: 'استثناءات الإعداد المفتوحة والمحددات المقبولة والملكية وحالة الأدلة.',
  realPilotParticipantGapsTitle: 'فجوات إعداد المشاركين',
  realPilotParticipantGapsSubtitle: 'المشاركون المعلقون أو غير المتاحين أو غير النشطين أو الذين يحتاجون إلى تدريب.',
  realPilotTrainingGapsTitle: 'فجوات جاهزية التدريب',
  realPilotTrainingGapsSubtitle: 'المشاركون الذين لم يتم تأكيد تدريبهم المطلوب بعد.',
  department: 'القسم',
  owner: 'المسؤول',
  assigned: 'محدد',
  participants: 'المشاركون',
  confirmedParticipants: 'مؤكد',
  pendingParticipants: 'معلق',
  signoffRole: 'دور الاعتماد',
  signoffArea: 'مجال / نطاق الاعتماد',
  status: 'الحالة',
  signoffRegisterTitle: 'سجل اعتمادات التشغيل الإنتاجي الرسمي',
  signoffRegisterSubtitle: 'سجل التوثيق الرسمي من مسؤولي الحوكمة والأمن وجودة الخدمات الطبية.',
  notes: 'ملاحظات المراجعة',
  evidence: 'مرجع دليل الإثبات',
  proofSuitesTitle: 'حالة التحقق من أدلة الإثبات',
  proofSuitesSubtitle: 'حالة مجموعات التدقيق التلقائية.',
  suiteName: 'معرف مجموعة التدقيق',
  stagingEvidenceTitle: 'أدلة الترحيل وPersona في بيئة التدقيق',
  stagingEvidenceSubtitle: 'إثبات تشغيلي لاكتمال إعادة تشغيل الترحيلات، واختبارات Persona SQL، وفحوصات RLS/الدوال/العروض، وتجربة الاستعادة.',
  migrationsReplayed: 'الترحيلات المعادة',
  personaSqlStatus: 'حالة Persona SQL',
  securityProofStatus: 'إثبات RLS / الدوال / العروض',
  stagingEvidenceReadiness: 'جاهزية أدلة التدقيق',
  latestRun: 'آخر تشغيل',
  environment: 'البيئة',
  restoreDryRun: 'تجربة الاستعادة',
  ready: 'جاهز',
  evidenceRequired: 'الدليل مطلوب',
  stagingBlockersTitle: 'معوقات أدلة بيئة التدقيق',
  stagingBlockersSubtitle: 'الأدلة المفقودة أو الفاشلة التي تمنع اعتماد الجاهزية النهائية للتشغيل.',
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
  rpcDashboardTitle: 'بوابة أمان إجراءات النظام',
  rpcDashboardSubtitle: 'مؤشرات الاعتماد والتحقق للوظائف البرمجية.',
  totalRpcs: 'إجمالي الإجراءات',
  approvedRpcs: 'المعتمدة',
  pendingRpcs: 'معلقة للأمان',
  serviceRoleFrontend: 'الاستدعاءات العامة المباشرة',
  securityHardeningInfo: 'تعزيز أمان قاعدة البيانات',
  securityHardeningDesc: 'تم التحقق من وجود 0 صلاحيات execute عامة للوظائف بصلاحية SECURITY DEFINER. جميع استدعاءات الواجهة الأمامية تمر بشكل آمن.',
  runtimeActionReviewTitle: 'مراجعة صلاحيات الوصول',
  runtimeActionReviewSubtitle: 'التصنيف، المالك، المخاطر، وحالة المراجعة لإجراءات النظام.',
  runtimeActions: 'إجراءات النظام',
  classifiedActions: 'مصنفة',
  pendingAccessReview: 'بانتظار المراجعة',
  directBrowserExceptions: 'استثناءات مباشرة',
  nextActionRequired: 'الإجراء التالي',
  securityRuntimeChecks: 'فحوصات أمان التشغيل',
  serviceRoleOnlyCalls: 'استدعاءات service-role من الواجهة',
  broadDefinerGrants: 'صلاحيات definer العامة',
  runtimeAccessReviewTitle: 'إغلاق اعتمادات الصلاحيات',
  runtimeAccessReviewSubtitle: 'إغلاق اعتمادات الإجراءات والمحددات والرفض والمراجعات.',
  approvedRuntimeSignoffs: 'اعتمادات موافق عليها',
  pendingSignoffs: 'اعتمادات معلقة',
  overdueSignoffs: 'اعتمادات متأخرة',
  rejectedSignoffs: 'اعتمادات مرفوضة',
  approvedWithLimitationSignoffs: 'موافق مع محددات',
  riskAcceptanceRequired: 'يتطلب قبول مخاطر',
  accessReviewReadinessStatus: 'جاهزية مراجعة الصلاحيات',
  directBrowserExceptionReview: 'مراجعة استثناء المتصفح',
  accessReviewBlockersTitle: 'معوقات مراجعة الصلاحيات',
  accessReviewBlockersSubtitle: 'اعتمادات معلقة عالية المخاطر أو ناقصة الدليل.',
  blockerReason: 'سبب التعطيل',
  accessReviewRegisterTitle: 'سجل اعتمادات الصلاحيات',
  accessReviewRegisterSubtitle: 'المراجع وتاريخ الاستحقاق والحالة ودليل الإغلاق للإجراءات.',
  reviewer: 'المراجع',
  dueAt: 'الاستحقاق',
  evidenceReference: 'الدليل',
  limitationSummary: 'ملاحظات المحددات',
  directBrowserExceptionTitle: 'سجل استثناءات المتصفح',
  directBrowserExceptionSubtitle: 'استدعاءات المتصفح التي تتطلب إثبات.',
  runtimeActionRegisterTitle: 'سجل إجراءات النظام',
  runtimeActionRegisterSubtitle: 'السجل الحالي للإجراءات والمالك والمخاطر وحالة المراجعة.',
  actionName: 'الإجراء',
  classification: 'التصنيف',
  riskLevel: 'المخاطر',
  justification: 'المبرر',
  moduleName: 'الوحدة',
  transport: 'طريقة الاستدعاء',
  reviewStatus: 'حالة المراجعة',
  ownerRole: 'دور المالك',
  navigationProposalsTitle: 'مقترحات تبسيط وإدارة مسارات التنقل',
  navigationProposalsSubtitle: 'سجل يوضح المسارات الملغاة أو المدمجة أو المخفية قبل الإطلاق الإنتاجي.',
  routeKey: 'معرف المسار',
  routeLabel: 'اسم التسمية',
  currentGroup: 'المجموعة الحالية',
  proposedGroup: 'المجموعة المقترحة'
};
