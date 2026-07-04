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
  getLivePilotExecutionOverlay,
  getLivePilotWorkflowBlockers,
  getLivePilotPendingWalkthroughs,
  getLivePilotFailedWalkthroughs,
  getPilotClosureGoLiveOverlay,
  getPilotClosureBlockers,
  getPilotRemediationActions,
  getPilotAcceptedLimitations,
  getProductionGoLiveDecisions,
  getProductionHypercareOverlay,
  getProductionHypercareBlockers,
  getProductionHypercareIssues,
  getProductionOperatingCadenceEvents,
  getProductionAdoptionFeedback,
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
  const livePilotExecution = useAsyncData(getLivePilotExecutionOverlay, []);
  const livePilotBlockers = useAsyncData(getLivePilotWorkflowBlockers, []);
  const livePilotPending = useAsyncData(getLivePilotPendingWalkthroughs, []);
  const livePilotFailed = useAsyncData(getLivePilotFailedWalkthroughs, []);
  const pilotClosure = useAsyncData(getPilotClosureGoLiveOverlay, []);
  const pilotClosureBlockers = useAsyncData(getPilotClosureBlockers, []);
  const pilotRemediations = useAsyncData(getPilotRemediationActions, []);
  const pilotLimitations = useAsyncData(getPilotAcceptedLimitations, []);
  const goliveDecisions = useAsyncData(getProductionGoLiveDecisions, []);
  const hypercare = useAsyncData(getProductionHypercareOverlay, []);
  const hypercareBlockers = useAsyncData(getProductionHypercareBlockers, []);
  const hypercareIssues = useAsyncData(getProductionHypercareIssues, []);
  const cadenceEvents = useAsyncData(getProductionOperatingCadenceEvents, []);
  const adoptionFeedback = useAsyncData(getProductionAdoptionFeedback, []);
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

  const livePilotExecutionData = livePilotExecution.data || {
    critical_workflows_total: 0,
    workflows_completed: 0,
    workflows_passed: 0,
    workflows_passed_with_limitations: 0,
    workflows_failed: 0,
    workflows_blocked: 0,
    workflows_pending: 0,
    missing_evidence_count: 0,
    open_high_critical_issues: 0,
    evidence_needing_review: 0,
    workflow_blocker_count: 0,
    live_execution_readiness_status: 'evidence_required',
    next_action_required: '-'
  };

  const pilotClosureData = pilotClosure.data || {
    closure_review_total: 0,
    closure_reviews_in_review: 0,
    closure_reviews_ready_for_decision: 0,
    blocked_or_deferred_closures: 0,
    open_remediation_actions: 0,
    overdue_remediation_actions: 0,
    high_critical_remediation_actions: 0,
    accepted_limitations: 0,
    high_critical_accepted_limitations: 0,
    pending_limitation_reviews: 0,
    pending_golive_decisions: 0,
    rejected_or_deferred_decisions: 0,
    approved_golive_decisions: 0,
    approved_with_limitations_decisions: 0,
    missing_golive_decisions: 0,
    failed_or_blocked_workflows: 0,
    missing_workflow_evidence_count: 0,
    open_high_critical_live_issues: 0,
    production_golive_readiness_status: 'evidence_required',
    next_action_required: '-'
  };

  const hypercareData = hypercare.data || {
    hypercare_period_total: 0,
    active_hypercare_periods: 0,
    at_risk_or_blocked_periods: 0,
    days_remaining: 0,
    open_hypercare_issues: 0,
    overdue_hypercare_issues: 0,
    high_critical_hypercare_issues: 0,
    missed_cadence_events: 0,
    departments_missing_feedback: 0,
    low_adoption_departments: 0,
    support_needed_feedback_count: 0,
    training_needed_feedback_count: 0,
    inherited_unresolved_live_pilot_issues: 0,
    inherited_high_critical_remediation_count: 0,
    hypercare_blocker_count: 0,
    production_stability_status: 'evidence_required',
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

              <ModernCard title={text.livePilotExecutionTitle} subtitle={text.livePilotExecutionSubtitle}>
                <DataState loading={livePilotExecution.loading} error={livePilotExecution.error} empty={!livePilotExecution.data}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '14px', marginBottom: '20px' }}>
                    <div className="stat-card">
                      <div className="stat-value">
                        <StatusPill tone={
                          livePilotExecutionData.live_execution_readiness_status === 'ready' ? 'good' :
                          livePilotExecutionData.live_execution_readiness_status === 'ready_with_limitations' ? 'warning' :
                          livePilotExecutionData.live_execution_readiness_status === 'blocked' ? 'danger' : 'neutral'
                        }>
                          {livePilotExecutionData.live_execution_readiness_status}
                        </StatusPill>
                      </div>
                      <div className="stat-label">{text.liveExecutionReadiness}</div>
                    </div>
                    <div className="stat-card"><div className="stat-value">{livePilotExecutionData.critical_workflows_total}</div><div className="stat-label">{text.criticalWorkflows}</div></div>
                    <div className="stat-card success"><div className="stat-value">{livePilotExecutionData.workflows_passed}</div><div className="stat-label">{text.workflowsPassed}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{livePilotExecutionData.workflows_passed_with_limitations}</div><div className="stat-label">{text.workflowsLimited}</div></div>
                    <div className="stat-card danger"><div className="stat-value">{livePilotExecutionData.workflows_failed}</div><div className="stat-label">{text.workflowsFailed}</div></div>
                    <div className="stat-card danger"><div className="stat-value">{livePilotExecutionData.workflows_blocked}</div><div className="stat-label">{text.workflowsBlocked}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{livePilotExecutionData.workflows_pending}</div><div className="stat-label">{text.pendingWalkthroughs}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{livePilotExecutionData.missing_evidence_count}</div><div className="stat-label">{text.missingEvidence}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{livePilotExecutionData.evidence_needing_review}</div><div className="stat-label">{text.evidenceNeedingReview}</div></div>
                    <div className="stat-card danger"><div className="stat-value">{livePilotExecutionData.open_high_critical_issues}</div><div className="stat-label">{text.highCriticalIssues}</div></div>
                  </div>
                  <div className="alert alert-info">
                    <strong>{text.nextActionRequired}: </strong>{livePilotExecutionData.next_action_required}
                  </div>
                </DataState>
              </ModernCard>

              <ModernCard title={text.livePilotBlockersTitle} subtitle={text.livePilotBlockersSubtitle}>
                <DataState loading={livePilotBlockers.loading} error={livePilotBlockers.error} empty={!livePilotBlockers.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead><tr><th>{text.workflow}</th><th>{text.area}</th><th>{text.blockerReason}</th><th>{text.evidence}</th></tr></thead>
                      <tbody>
                        {(livePilotBlockers.data || []).slice(0, 60).map((row: any, index: number) => (
                          <tr key={`${row.workflow_label}-${row.blocker_type}-${index}`}>
                            <td><strong>{row.workflow_label}</strong></td>
                            <td>{row.blocker_area || row.blocker_type}</td>
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
                <ModernCard title={text.pendingWalkthroughsTitle} subtitle={text.pendingWalkthroughsSubtitle}>
                  <DataState loading={livePilotPending.loading} error={livePilotPending.error} empty={!livePilotPending.data?.length}>
                    <div className="table-wrap">
                      <table className="entity-table">
                        <thead><tr><th>{text.workflow}</th><th>{text.department}</th><th>{text.status}</th><th>{text.owner}</th></tr></thead>
                        <tbody>
                          {(livePilotPending.data || []).slice(0, 40).map((row: any) => (
                            <tr key={row.id}>
                              <td><strong>{row.workflow_label}</strong></td>
                              <td>{row.department_name || '-'}</td>
                              <td>{row.run_status}</td>
                              <td>{row.owner_user_id ? text.assigned : text.evidenceRequired}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </DataState>
                </ModernCard>

                <ModernCard title={text.failedWalkthroughsTitle} subtitle={text.failedWalkthroughsSubtitle}>
                  <DataState loading={livePilotFailed.loading} error={livePilotFailed.error} empty={!livePilotFailed.data?.length}>
                    <div className="table-wrap">
                      <table className="entity-table">
                        <thead><tr><th>{text.workflow}</th><th>{text.status}</th><th>{text.blockerReason}</th><th>{text.evidence}</th></tr></thead>
                        <tbody>
                          {(livePilotFailed.data || []).slice(0, 40).map((row: any) => (
                            <tr key={row.id}>
                              <td><strong>{row.workflow_label}</strong></td>
                              <td><StatusPill tone="danger">{row.run_status}</StatusPill></td>
                              <td>{row.blocker_summary || '-'}</td>
                              <td><code>{row.evidence_summary || '-'}</code></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </DataState>
                </ModernCard>
              </div>

              <ModernCard title={text.pilotClosureTitle} subtitle={text.pilotClosureSubtitle}>
                <DataState loading={pilotClosure.loading} error={pilotClosure.error} empty={!pilotClosure.data}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '14px', marginBottom: '20px' }}>
                    <div className="stat-card">
                      <div className="stat-value">
                        <StatusPill tone={
                          pilotClosureData.production_golive_readiness_status === 'ready' ? 'good' :
                          pilotClosureData.production_golive_readiness_status === 'ready_with_limitations' ? 'warning' :
                          pilotClosureData.production_golive_readiness_status === 'blocked' ? 'danger' : 'neutral'
                        }>
                          {pilotClosureData.production_golive_readiness_status}
                        </StatusPill>
                      </div>
                      <div className="stat-label">{text.productionGoLiveReadiness}</div>
                    </div>
                    <div className="stat-card"><div className="stat-value">{pilotClosureData.closure_review_total}</div><div className="stat-label">{text.closureReviews}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{pilotClosureData.closure_reviews_in_review}</div><div className="stat-label">{text.inReview}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{pilotClosureData.missing_golive_decisions}</div><div className="stat-label">{text.missingGoLiveDecisions}</div></div>
                    <div className="stat-card danger"><div className="stat-value">{pilotClosureData.rejected_or_deferred_decisions}</div><div className="stat-label">{text.rejectedDeferredDecisions}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{pilotClosureData.open_remediation_actions}</div><div className="stat-label">{text.openRemediations}</div></div>
                    <div className="stat-card danger"><div className="stat-value">{pilotClosureData.overdue_remediation_actions}</div><div className="stat-label">{text.overdueRemediations}</div></div>
                    <div className="stat-card danger"><div className="stat-value">{pilotClosureData.high_critical_remediation_actions}</div><div className="stat-label">{text.highCriticalRemediations}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{pilotClosureData.accepted_limitations}</div><div className="stat-label">{text.acceptedLimitations}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{pilotClosureData.pending_limitation_reviews}</div><div className="stat-label">{text.pendingLimitationReviews}</div></div>
                    <div className="stat-card danger"><div className="stat-value">{pilotClosureData.failed_or_blocked_workflows}</div><div className="stat-label">{text.failedBlockedWorkflows}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{pilotClosureData.missing_workflow_evidence_count}</div><div className="stat-label">{text.missingEvidence}</div></div>
                    <div className="stat-card danger"><div className="stat-value">{pilotClosureData.open_high_critical_live_issues}</div><div className="stat-label">{text.highCriticalIssues}</div></div>
                  </div>
                  <div className="alert alert-info">
                    <strong>{text.nextActionRequired}: </strong>{pilotClosureData.next_action_required}
                  </div>
                </DataState>
              </ModernCard>

              <ModernCard title={text.pilotClosureBlockersTitle} subtitle={text.pilotClosureBlockersSubtitle}>
                <DataState loading={pilotClosureBlockers.loading} error={pilotClosureBlockers.error} empty={!pilotClosureBlockers.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead><tr><th>{text.review}</th><th>{text.area}</th><th>{text.blockerReason}</th><th>{text.evidence}</th></tr></thead>
                      <tbody>
                        {(pilotClosureBlockers.data || []).slice(0, 60).map((row: any, index: number) => (
                          <tr key={`${row.closure_label}-${row.blocker_type}-${index}`}>
                            <td><strong>{row.closure_label || '-'}</strong></td>
                            <td>{row.blocker_area || row.blocker_type}</td>
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
                <ModernCard title={text.remediationActionsTitle} subtitle={text.remediationActionsSubtitle}>
                  <DataState loading={pilotRemediations.loading} error={pilotRemediations.error} empty={!pilotRemediations.data?.length}>
                    <div className="table-wrap">
                      <table className="entity-table">
                        <thead><tr><th>{text.action}</th><th>{text.status}</th><th>{text.severity}</th><th>{text.dueDate}</th></tr></thead>
                        <tbody>
                          {(pilotRemediations.data || []).slice(0, 40).map((row: any) => (
                            <tr key={row.id}>
                              <td><strong>{row.remediation_title}</strong></td>
                              <td>{row.remediation_status}</td>
                              <td><StatusPill tone={row.severity === 'critical' || row.severity === 'high' ? 'danger' : row.severity === 'medium' ? 'warning' : 'neutral'}>{row.severity}</StatusPill></td>
                              <td>{row.due_at ? new Date(row.due_at).toLocaleDateString() : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </DataState>
                </ModernCard>

                <ModernCard title={text.acceptedLimitationsTitle} subtitle={text.acceptedLimitationsSubtitle}>
                  <DataState loading={pilotLimitations.loading} error={pilotLimitations.error} empty={!pilotLimitations.data?.length}>
                    <div className="table-wrap">
                      <table className="entity-table">
                        <thead><tr><th>{text.limitation}</th><th>{text.status}</th><th>{text.severity}</th><th>{text.expires}</th></tr></thead>
                        <tbody>
                          {(pilotLimitations.data || []).slice(0, 40).map((row: any) => (
                            <tr key={row.id}>
                              <td><strong>{row.limitation_title}</strong></td>
                              <td>{row.limitation_status}</td>
                              <td><StatusPill tone={row.severity === 'critical' || row.severity === 'high' ? 'danger' : row.severity === 'medium' ? 'warning' : 'neutral'}>{row.severity}</StatusPill></td>
                              <td>{row.expires_at ? new Date(row.expires_at).toLocaleDateString() : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </DataState>
                </ModernCard>
              </div>

              <ModernCard title={text.goLiveDecisionTitle} subtitle={text.goLiveDecisionSubtitle}>
                <DataState loading={goliveDecisions.loading} error={goliveDecisions.error} empty={!goliveDecisions.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead><tr><th>{text.review}</th><th>{text.level}</th><th>{text.status}</th><th>{text.notes}</th><th>{text.evidence}</th></tr></thead>
                      <tbody>
                        {(goliveDecisions.data || []).slice(0, 40).map((row: any) => (
                          <tr key={row.id}>
                            <td><strong>{row.closure_label || '-'}</strong></td>
                            <td>{row.decision_level}</td>
                            <td><StatusPill tone={row.decision_status === 'approved' ? 'good' : row.decision_status === 'approved_with_limitations' ? 'warning' : row.decision_status === 'rejected' || row.decision_status === 'deferred' || row.decision_status === 'revoked' ? 'danger' : 'neutral'}>{row.decision_status}</StatusPill></td>
                            <td>{row.decision_summary || row.conditions_summary || '-'}</td>
                            <td><code>{row.evidence_reference || '-'}</code></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>

              <ModernCard title={text.hypercareTitle} subtitle={text.hypercareSubtitle}>
                <DataState loading={hypercare.loading} error={hypercare.error} empty={!hypercare.data}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '14px', marginBottom: '20px' }}>
                    <div className="stat-card">
                      <div className="stat-value">
                        <StatusPill tone={
                          hypercareData.production_stability_status === 'stable' ? 'good' :
                          hypercareData.production_stability_status === 'stable_with_limitations' || hypercareData.production_stability_status === 'at_risk' ? 'warning' :
                          hypercareData.production_stability_status === 'blocked' ? 'danger' : 'neutral'
                        }>
                          {hypercareData.production_stability_status}
                        </StatusPill>
                      </div>
                      <div className="stat-label">{text.productionStability}</div>
                    </div>
                    <div className="stat-card"><div className="stat-value">{hypercareData.active_hypercare_periods}</div><div className="stat-label">{text.activeHypercare}</div></div>
                    <div className="stat-card"><div className="stat-value">{hypercareData.days_remaining}</div><div className="stat-label">{text.daysRemaining}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{hypercareData.open_hypercare_issues}</div><div className="stat-label">{text.openHypercareIssues}</div></div>
                    <div className="stat-card danger"><div className="stat-value">{hypercareData.overdue_hypercare_issues}</div><div className="stat-label">{text.overdueIssues}</div></div>
                    <div className="stat-card danger"><div className="stat-value">{hypercareData.high_critical_hypercare_issues}</div><div className="stat-label">{text.highCriticalIssues}</div></div>
                    <div className="stat-card danger"><div className="stat-value">{hypercareData.missed_cadence_events}</div><div className="stat-label">{text.missedCadence}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{hypercareData.departments_missing_feedback}</div><div className="stat-label">{text.missingFeedback}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{hypercareData.low_adoption_departments}</div><div className="stat-label">{text.lowAdoption}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{hypercareData.support_needed_feedback_count}</div><div className="stat-label">{text.supportNeeded}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{hypercareData.training_needed_feedback_count}</div><div className="stat-label">{text.trainingNeeded}</div></div>
                    <div className="stat-card danger"><div className="stat-value">{hypercareData.inherited_unresolved_live_pilot_issues}</div><div className="stat-label">{text.unresolvedPilotIssues}</div></div>
                    <div className="stat-card danger"><div className="stat-value">{hypercareData.inherited_high_critical_remediation_count}</div><div className="stat-label">{text.inheritedRemediation}</div></div>
                  </div>
                  <div className="alert alert-info">
                    <strong>{text.nextActionRequired}: </strong>{hypercareData.next_action_required}
                  </div>
                </DataState>
              </ModernCard>

              <ModernCard title={text.hypercareBlockersTitle} subtitle={text.hypercareBlockersSubtitle}>
                <DataState loading={hypercareBlockers.loading} error={hypercareBlockers.error} empty={!hypercareBlockers.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead><tr><th>{text.period}</th><th>{text.area}</th><th>{text.blockerReason}</th><th>{text.evidence}</th></tr></thead>
                      <tbody>
                        {(hypercareBlockers.data || []).slice(0, 60).map((row: any, index: number) => (
                          <tr key={`${row.hypercare_label}-${row.blocker_type}-${index}`}>
                            <td><strong>{row.hypercare_label || '-'}</strong></td>
                            <td>{row.blocker_area || row.blocker_type}</td>
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
                <ModernCard title={text.hypercareIssuesTitle} subtitle={text.hypercareIssuesSubtitle}>
                  <DataState loading={hypercareIssues.loading} error={hypercareIssues.error} empty={!hypercareIssues.data?.length}>
                    <div className="table-wrap">
                      <table className="entity-table">
                        <thead><tr><th>{text.issue}</th><th>{text.status}</th><th>{text.severity}</th><th>{text.dueDate}</th></tr></thead>
                        <tbody>
                          {(hypercareIssues.data || []).slice(0, 40).map((row: any) => (
                            <tr key={row.id}>
                              <td><strong>{row.issue_title}</strong></td>
                              <td>{row.issue_status}</td>
                              <td><StatusPill tone={row.severity === 'critical' || row.severity === 'high' ? 'danger' : row.severity === 'medium' ? 'warning' : 'neutral'}>{row.severity}</StatusPill></td>
                              <td>{row.due_at ? new Date(row.due_at).toLocaleDateString() : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </DataState>
                </ModernCard>

                <ModernCard title={text.operatingCadenceTitle} subtitle={text.operatingCadenceSubtitle}>
                  <DataState loading={cadenceEvents.loading} error={cadenceEvents.error} empty={!cadenceEvents.data?.length}>
                    <div className="table-wrap">
                      <table className="entity-table">
                        <thead><tr><th>{text.cadence}</th><th>{text.status}</th><th>{text.scheduled}</th><th>{text.evidence}</th></tr></thead>
                        <tbody>
                          {(cadenceEvents.data || []).slice(0, 40).map((row: any) => (
                            <tr key={row.id}>
                              <td><strong>{row.cadence_type}</strong></td>
                              <td><StatusPill tone={row.event_status === 'completed' ? 'good' : row.event_status === 'missed' ? 'danger' : 'neutral'}>{row.event_status}</StatusPill></td>
                              <td>{row.scheduled_at ? new Date(row.scheduled_at).toLocaleDateString() : '-'}</td>
                              <td><code>{row.evidence_reference || '-'}</code></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </DataState>
                </ModernCard>
              </div>

              <ModernCard title={text.adoptionFeedbackTitle} subtitle={text.adoptionFeedbackSubtitle}>
                <DataState loading={adoptionFeedback.loading} error={adoptionFeedback.error} empty={!adoptionFeedback.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead><tr><th>{text.department}</th><th>{text.feedback}</th><th>{text.adoption}</th><th>{text.support}</th><th>{text.training}</th></tr></thead>
                      <tbody>
                        {(adoptionFeedback.data || []).slice(0, 40).map((row: any) => (
                          <tr key={row.id}>
                            <td><strong>{row.department_name || '-'}</strong></td>
                            <td>{row.feedback_status}</td>
                            <td><StatusPill tone={row.adoption_status === 'adopted' ? 'good' : row.adoption_status === 'low_adoption' || row.adoption_status === 'blocked' ? 'danger' : 'warning'}>{row.adoption_status}</StatusPill></td>
                            <td>{row.support_needed ? text.yes : text.no}</td>
                            <td>{row.training_needed ? text.yes : text.no}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>

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

              {/* Operational assurance summary */}
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
              {/* System action signoff dashboard */}
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
  tabRpcNav: 'Access & System Actions',
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
  livePilotExecutionTitle: 'Live Pilot Workflow Execution',
  livePilotExecutionSubtitle: 'Recorded walkthroughs, captured evidence, participation, issues, and final readiness for critical hospital workflows.',
  liveExecutionReadiness: 'Execution Readiness',
  criticalWorkflows: 'Critical Workflows',
  workflowsPassed: 'Passed',
  workflowsLimited: 'Limited Passes',
  workflowsFailed: 'Failed',
  workflowsBlocked: 'Blocked',
  pendingWalkthroughs: 'Pending Walkthroughs',
  missingEvidence: 'Missing Evidence',
  evidenceNeedingReview: 'Evidence Review',
  highCriticalIssues: 'High/Critical Issues',
  livePilotBlockersTitle: 'Live Workflow Blockers',
  livePilotBlockersSubtitle: 'Incomplete walkthroughs, failed steps, missing evidence, rejected evidence, and high-risk execution issues.',
  pendingWalkthroughsTitle: 'Pending Workflow Walkthroughs',
  pendingWalkthroughsSubtitle: 'Critical workflows scheduled, not started, or still in progress.',
  failedWalkthroughsTitle: 'Failed or Blocked Walkthroughs',
  failedWalkthroughsSubtitle: 'Workflow runs that must be corrected before pilot approval.',
  pilotClosureTitle: 'Pilot Closure & Go-Live Decision',
  pilotClosureSubtitle: 'Formal closure status, remediation, accepted limitations, and executive decision readiness before production use.',
  productionGoLiveReadiness: 'Go-Live Readiness',
  closureReviews: 'Closure Reviews',
  inReview: 'In Review',
  missingGoLiveDecisions: 'Missing Decisions',
  rejectedDeferredDecisions: 'Rejected / Deferred',
  openRemediations: 'Open Remediation',
  overdueRemediations: 'Overdue Remediation',
  highCriticalRemediations: 'High/Critical Remediation',
  acceptedLimitations: 'Accepted Limitations',
  pendingLimitationReviews: 'Pending Limitation Review',
  failedBlockedWorkflows: 'Failed / Blocked Workflows',
  pilotClosureBlockersTitle: 'Pilot Closure Blockers',
  pilotClosureBlockersSubtitle: 'Open remediation, pending decisions, unresolved limitations, failed workflows, missing evidence, and high-risk issues.',
  review: 'Review',
  remediationActionsTitle: 'Remediation Actions',
  remediationActionsSubtitle: 'Open, overdue, completed, and risk-accepted actions required for pilot closure.',
  action: 'Action',
  dueDate: 'Due Date',
  acceptedLimitationsTitle: 'Accepted Limitations',
  acceptedLimitationsSubtitle: 'Limitations under review or accepted for controlled production launch conditions.',
  limitation: 'Limitation',
  expires: 'Expires',
  goLiveDecisionTitle: 'Production Go-Live Decision Register',
  goLiveDecisionSubtitle: 'Quality, Audit, IT/Admin, executive, and board-level launch decisions with evidence and conditions.',
  level: 'Level',
  hypercareTitle: 'Production Hypercare & Operating Cadence',
  hypercareSubtitle: 'First 30/60/90 day operating rhythm for stability, issue triage, department feedback, adoption, and executive escalation.',
  productionStability: 'Production Stability',
  activeHypercare: 'Active Hypercare',
  daysRemaining: 'Days Remaining',
  openHypercareIssues: 'Open Issues',
  overdueIssues: 'Overdue Issues',
  missedCadence: 'Missed Cadence',
  missingFeedback: 'Missing Feedback',
  lowAdoption: 'Low Adoption',
  supportNeeded: 'Support Needed',
  trainingNeeded: 'Training Needed',
  unresolvedPilotIssues: 'Pilot Issues',
  inheritedRemediation: 'High/Critical Remediation',
  hypercareBlockersTitle: 'Hypercare Stability Blockers',
  hypercareBlockersSubtitle: 'Open production issues, missed operating cadence, feedback gaps, adoption gaps, support needs, and inherited pilot blockers.',
  period: 'Period',
  hypercareIssuesTitle: 'Hypercare Issue Triage',
  hypercareIssuesSubtitle: 'Production issues requiring owner action, SLA follow-up, evidence, or risk acceptance.',
  issue: 'Issue',
  operatingCadenceTitle: 'Operating Cadence',
  operatingCadenceSubtitle: 'Daily huddles, weekly reviews, executive reviews, department check-ins, and closure meetings.',
  cadence: 'Cadence',
  scheduled: 'Scheduled',
  adoptionFeedbackTitle: 'Department Adoption & Feedback',
  adoptionFeedbackSubtitle: 'Department feedback, adoption status, support needs, and training follow-up during hypercare.',
  feedback: 'Feedback',
  adoption: 'Adoption',
  support: 'Support',
  training: 'Training',
  yes: 'Yes',
  no: 'No',
  workflow: 'Workflow',
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
  proofSuitesTitle: 'Operational Assurance Checks',
  proofSuitesSubtitle: 'Status of required automated readiness checks.',
  suiteName: 'Assurance Area',
  stagingEvidenceTitle: 'Environment and access evidence',
  stagingEvidenceSubtitle: 'Operational evidence that environment setup, role testing, access checks, and recovery validation are complete.',
  migrationsReplayed: 'Environment Checks',
  personaSqlStatus: 'Role Test Status',
  securityProofStatus: 'Access Control Status',
  stagingEvidenceReadiness: 'Evidence Readiness',
  latestRun: 'Latest Run',
  environment: 'Environment',
  restoreDryRun: 'Restore Dry-run',
  ready: 'Ready',
  evidenceRequired: 'Evidence Required',
  stagingBlockersTitle: 'Environment Evidence Blockers',
  stagingBlockersSubtitle: 'Missing or failed environment evidence that blocks final production readiness.',
  blockingLimitationsTitle: 'Production Blocking Limitations',
  blockingLimitationsSubtitle: 'High and Critical issues blocking pilot roll-out.',
  limitationTitle: 'Limitation Title',
  severity: 'Severity',
  mitigationPlan: 'Mitigation Plan',
  limitationsRegisterTitle: 'Known Limitations Log',
  limitationsRegisterSubtitle: 'Full registry of known exceptions accepted for controlled pilot operations.',
  area: 'Functional Area',
  backupOperationsTitle: 'Backup and Recovery Readiness',
  backupOperationsSubtitle: 'Recovery validation log, latest restore evidence, and database integrity checks.',
  operationType: 'Recovery Check',
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
  rpcDashboardSubtitle: 'Sign-off and verification metrics for controlled system actions.',
  totalRpcs: 'Total Actions',
  approvedRpcs: 'Approved',
  pendingRpcs: 'Pending Review',
  serviceRoleFrontend: 'Direct Public Calls',
  securityHardeningInfo: 'System Hardening Enforcement',
  securityHardeningDesc: 'No open public execution paths are recorded. User actions follow controlled authorization routes.',
  runtimeActionReviewTitle: 'Access Authorization Review',
  runtimeActionReviewSubtitle: 'Classification, owner, risk, and review status for system actions.',
  runtimeActions: 'System Actions',
  classifiedActions: 'Classified',
  pendingAccessReview: 'Pending Review',
  directBrowserExceptions: 'Browser-Scoped Actions',
  nextActionRequired: 'Next action',
  securityRuntimeChecks: 'Security checks',
  serviceRoleOnlyCalls: 'Restricted action calls',
  broadDefinerGrants: 'Open execution grants',
  runtimeAccessReviewTitle: 'Access Review Closure',
  runtimeAccessReviewSubtitle: 'Operational closure for action approvals, limitations, rejected signoffs, and risk acceptance.',
  approvedRuntimeSignoffs: 'Approved Signoffs',
  pendingSignoffs: 'Pending Signoffs',
  overdueSignoffs: 'Overdue Signoffs',
  rejectedSignoffs: 'Rejected Signoffs',
  approvedWithLimitationSignoffs: 'Approved With Limitation',
  riskAcceptanceRequired: 'Risk Acceptance Required',
  accessReviewReadinessStatus: 'Access Review Readiness',
  directBrowserExceptionReview: 'Browser-scoped action review',
  accessReviewBlockersTitle: 'Access Review Blockers',
  accessReviewBlockersSubtitle: 'Pending high-risk, overdue, rejected, and missing-evidence signoffs.',
  blockerReason: 'Blocker Reason',
  accessReviewRegisterTitle: 'Access Review Register',
  accessReviewRegisterSubtitle: 'Reviewer assignment, due date, signoff status, and closure evidence for actions.',
  reviewer: 'Reviewer',
  dueAt: 'Due',
  evidenceReference: 'Evidence',
  limitationSummary: 'Limitation Notes',
  directBrowserExceptionTitle: 'Browser-Scoped Action Register',
  directBrowserExceptionSubtitle: 'Tracked browser-scoped actions that require review evidence.',
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
  tabRpcNav: 'الصلاحيات وإجراءات النظام',
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
  livePilotExecutionTitle: 'تنفيذ مسارات التشغيل التجريبي الفعلي',
  livePilotExecutionSubtitle: 'الجولات المسجلة، والأدلة الملتقطة، والمشاركة، والمشكلات، والجاهزية النهائية لمسارات العمل الحرجة.',
  liveExecutionReadiness: 'جاهزية التنفيذ',
  criticalWorkflows: 'مسارات حرجة',
  workflowsPassed: 'ناجحة',
  workflowsLimited: 'نجاح بمحددات',
  workflowsFailed: 'فاشلة',
  workflowsBlocked: 'معطلة',
  pendingWalkthroughs: 'جولات معلقة',
  missingEvidence: 'أدلة مفقودة',
  evidenceNeedingReview: 'مراجعة الأدلة',
  highCriticalIssues: 'مشكلات عالية/حرجة',
  livePilotBlockersTitle: 'معوقات مسارات العمل الفعلية',
  livePilotBlockersSubtitle: 'الجولات غير المكتملة، والخطوات الفاشلة، والأدلة المفقودة أو المرفوضة، ومشكلات التنفيذ عالية المخاطر.',
  pendingWalkthroughsTitle: 'جولات مسارات العمل المعلقة',
  pendingWalkthroughsSubtitle: 'مسارات العمل الحرجة المجدولة أو غير التي لم تبدأ أو ما زالت قيد التنفيذ.',
  failedWalkthroughsTitle: 'جولات فاشلة أو معطلة',
  failedWalkthroughsSubtitle: 'مسارات العمل التي يجب تصحيحها قبل اعتماد التشغيل التجريبي.',
  pilotClosureTitle: 'إغلاق التشغيل التجريبي وقرار الإطلاق',
  pilotClosureSubtitle: 'حالة الإغلاق الرسمية، والمعالجات، والمحددات المقبولة، وجاهزية القرار التنفيذي قبل التشغيل الإنتاجي.',
  productionGoLiveReadiness: 'جاهزية الإطلاق',
  closureReviews: 'مراجعات الإغلاق',
  inReview: 'قيد المراجعة',
  missingGoLiveDecisions: 'قرارات ناقصة',
  rejectedDeferredDecisions: 'مرفوض / مؤجل',
  openRemediations: 'معالجات مفتوحة',
  overdueRemediations: 'معالجات متأخرة',
  highCriticalRemediations: 'معالجات عالية/حرجة',
  acceptedLimitations: 'محددات مقبولة',
  pendingLimitationReviews: 'محددات قيد المراجعة',
  failedBlockedWorkflows: 'مسارات فاشلة / معطلة',
  pilotClosureBlockersTitle: 'معوقات إغلاق التشغيل التجريبي',
  pilotClosureBlockersSubtitle: 'المعالجات المفتوحة، والقرارات المعلقة، والمحددات غير المغلقة، والمسارات الفاشلة، والأدلة المفقودة، والمشكلات عالية المخاطر.',
  review: 'المراجعة',
  remediationActionsTitle: 'إجراءات المعالجة',
  remediationActionsSubtitle: 'الإجراءات المفتوحة أو المتأخرة أو المكتملة أو المقبولة كمخاطر والمطلوبة لإغلاق التشغيل التجريبي.',
  action: 'الإجراء',
  dueDate: 'تاريخ الاستحقاق',
  acceptedLimitationsTitle: 'المحددات المقبولة',
  acceptedLimitationsSubtitle: 'المحددات قيد المراجعة أو المقبولة كاشتراطات للتشغيل الإنتاجي المنضبط.',
  limitation: 'المحدد',
  expires: 'ينتهي',
  goLiveDecisionTitle: 'سجل قرارات الإطلاق الإنتاجي',
  goLiveDecisionSubtitle: 'قرارات الجودة والتدقيق وتقنية المعلومات والإدارة التنفيذية والمجلس مع الأدلة والاشتراطات.',
  level: 'المستوى',
  hypercareTitle: 'دعم ما بعد الإطلاق وإيقاع التشغيل',
  hypercareSubtitle: 'إيقاع أول 30/60/90 يوم لمتابعة الاستقرار، وفرز المشكلات، وملاحظات الأقسام، والتبني، والتصعيد التنفيذي.',
  productionStability: 'استقرار التشغيل',
  activeHypercare: 'دعم نشط',
  daysRemaining: 'الأيام المتبقية',
  openHypercareIssues: 'مشكلات مفتوحة',
  overdueIssues: 'مشكلات متأخرة',
  missedCadence: 'اجتماعات فائتة',
  missingFeedback: 'ملاحظات ناقصة',
  lowAdoption: 'تبن منخفض',
  supportNeeded: 'يحتاج دعم',
  trainingNeeded: 'يحتاج تدريب',
  unresolvedPilotIssues: 'مشكلات تجريبية',
  inheritedRemediation: 'معالجات عالية/حرجة',
  hypercareBlockersTitle: 'معوقات استقرار ما بعد الإطلاق',
  hypercareBlockersSubtitle: 'مشكلات التشغيل المفتوحة، والاجتماعات الفائتة، وفجوات الملاحظات، وفجوات التبني، واحتياج الدعم، ومعوقات التشغيل التجريبي الموروثة.',
  period: 'الفترة',
  hypercareIssuesTitle: 'فرز مشكلات ما بعد الإطلاق',
  hypercareIssuesSubtitle: 'مشكلات الإنتاج التي تتطلب إجراء من المالك أو متابعة اتفاقية الخدمة أو دليل إغلاق أو قبول مخاطر.',
  issue: 'المشكلة',
  operatingCadenceTitle: 'إيقاع التشغيل',
  operatingCadenceSubtitle: 'اجتماعات يومية، ومراجعات أسبوعية، ومراجعات تنفيذية، ومتابعات الأقسام، واجتماعات الإغلاق.',
  cadence: 'الإيقاع',
  scheduled: 'مجدول',
  adoptionFeedbackTitle: 'تبني الأقسام وملاحظاتها',
  adoptionFeedbackSubtitle: 'ملاحظات الأقسام، وحالة التبني، واحتياج الدعم، ومتابعة التدريب أثناء فترة الدعم.',
  feedback: 'الملاحظات',
  adoption: 'التبني',
  support: 'الدعم',
  training: 'التدريب',
  yes: 'نعم',
  no: 'لا',
  workflow: 'مسار العمل',
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
  proofSuitesTitle: 'فحوصات الجاهزية التشغيلية',
  proofSuitesSubtitle: 'حالة فحوصات الجاهزية الآلية المطلوبة.',
  suiteName: 'مجال التحقق',
  stagingEvidenceTitle: 'أدلة البيئة والصلاحيات',
  stagingEvidenceSubtitle: 'أدلة تشغيلية لاكتمال إعداد البيئة، واختبارات الأدوار، وفحوصات الصلاحيات، والتحقق من الاستعادة.',
  migrationsReplayed: 'فحوصات البيئة',
  personaSqlStatus: 'حالة اختبار الأدوار',
  securityProofStatus: 'حالة ضوابط الصلاحيات',
  stagingEvidenceReadiness: 'جاهزية الأدلة',
  latestRun: 'آخر تشغيل',
  environment: 'البيئة',
  restoreDryRun: 'تجربة الاستعادة',
  ready: 'جاهز',
  evidenceRequired: 'الدليل مطلوب',
  stagingBlockersTitle: 'معوقات أدلة البيئة',
  stagingBlockersSubtitle: 'الأدلة المفقودة أو الفاشلة التي تمنع اعتماد الجاهزية النهائية للتشغيل.',
  blockingLimitationsTitle: 'المحددات المعطلة للتشغيل',
  blockingLimitationsSubtitle: 'المشكلات العالية والحرجة التي تمنع بدء التشغيل التجريبي.',
  limitationTitle: 'عنوان المحدد/المشكلة',
  severity: 'درجة الخطورة',
  mitigationPlan: 'خطة المعالجة/التقليل',
  limitationsRegisterTitle: 'سجل محددات النظام المعروفة',
  limitationsRegisterSubtitle: 'سجل كامل بالاستثناءات والمحددات المقبولة للتشغيل التجريبي.',
  area: 'المجال الوظيفي',
  backupOperationsTitle: 'جاهزية النسخ الاحتياطي والاستعادة',
  backupOperationsSubtitle: 'سجل التحقق من الاستعادة وأحدث أدلة الاستعادة وفحوصات سلامة البيانات.',
  operationType: 'فحص الاستعادة',
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
  rpcDashboardSubtitle: 'مؤشرات الاعتماد والتحقق لإجراءات النظام المحكومة.',
  totalRpcs: 'إجمالي الإجراءات',
  approvedRpcs: 'المعتمدة',
  pendingRpcs: 'معلقة للأمان',
  serviceRoleFrontend: 'استدعاءات عامة مباشرة',
  securityHardeningInfo: 'تعزيز أمان النظام',
  securityHardeningDesc: 'لا توجد مسارات تنفيذ عامة مفتوحة مسجلة. إجراءات المستخدم تمر عبر مسارات صلاحيات محكومة.',
  runtimeActionReviewTitle: 'مراجعة صلاحيات الوصول',
  runtimeActionReviewSubtitle: 'التصنيف، المالك، المخاطر، وحالة المراجعة لإجراءات النظام.',
  runtimeActions: 'إجراءات النظام',
  classifiedActions: 'مصنفة',
  pendingAccessReview: 'بانتظار المراجعة',
  directBrowserExceptions: 'إجراءات مقيدة بالمتصفح',
  nextActionRequired: 'الإجراء التالي',
  securityRuntimeChecks: 'فحوصات أمان التشغيل',
  serviceRoleOnlyCalls: 'استدعاءات إجراءات مقيدة',
  broadDefinerGrants: 'صلاحيات تنفيذ مفتوحة',
  runtimeAccessReviewTitle: 'إغلاق اعتمادات الصلاحيات',
  runtimeAccessReviewSubtitle: 'إغلاق اعتمادات الإجراءات والمحددات والرفض والمراجعات.',
  approvedRuntimeSignoffs: 'اعتمادات موافق عليها',
  pendingSignoffs: 'اعتمادات معلقة',
  overdueSignoffs: 'اعتمادات متأخرة',
  rejectedSignoffs: 'اعتمادات مرفوضة',
  approvedWithLimitationSignoffs: 'موافق مع محددات',
  riskAcceptanceRequired: 'يتطلب قبول مخاطر',
  accessReviewReadinessStatus: 'جاهزية مراجعة الصلاحيات',
  directBrowserExceptionReview: 'مراجعة إجراء مقيد بالمتصفح',
  accessReviewBlockersTitle: 'معوقات مراجعة الصلاحيات',
  accessReviewBlockersSubtitle: 'اعتمادات معلقة عالية المخاطر أو ناقصة الدليل.',
  blockerReason: 'سبب التعطيل',
  accessReviewRegisterTitle: 'سجل اعتمادات الصلاحيات',
  accessReviewRegisterSubtitle: 'المراجع وتاريخ الاستحقاق والحالة ودليل الإغلاق للإجراءات.',
  reviewer: 'المراجع',
  dueAt: 'الاستحقاق',
  evidenceReference: 'الدليل',
  limitationSummary: 'ملاحظات المحددات',
  directBrowserExceptionTitle: 'سجل الإجراءات المقيدة بالمتصفح',
  directBrowserExceptionSubtitle: 'إجراءات المتصفح المقيدة التي تتطلب دليل مراجعة.',
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
