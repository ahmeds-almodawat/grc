import { useMemo, useState } from 'react';
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
  getHospitalOperationsReadinessOverlay,
  getHospitalOperationsLaunchBlockers,
  getHospitalDepartmentLaunchPacks,
  getHospitalLaunchChecklistItems,
  getHospitalSupportReadinessRecords,
  getHospitalPolicyAttestationReadiness,
  getHospitalAdoptionReadinessReviews,
  getProofSuiteReadinessSummary,
  getControlledPilotReadinessSummary,
  getExecutiveProductionReadinessSummary,
  getControlledProductionCutoverDecisions,
  getControlledProductionCutoverDecisionEvents,
  getControlledCutoverGateSummary,
  createControlledProductionCutoverDecision,
  getLivePilotSessions,
  getLivePilotIssues,
  getLivePilotDepartmentAcceptances,
  getLivePilotIssueBurndownSummary,
  getLivePilotExitReadinessSummary,
  createLivePilotSession,
  updateLivePilotSessionStatus,
  createLivePilotIssue,
  updateLivePilotIssueStatus,
  recordLivePilotDepartmentAcceptance,
  getIdentityRoleIntegrityReviews,
  getIdentityRoleIntegrityFindings,
  getPrivilegedRoleRecertifications,
  getIdentityRoleIntegrityDashboardSummary,
  createIdentityRoleIntegrityReview,
  updateIdentityRoleIntegrityReviewStatus,
  recordIdentityRoleIntegrityFinding,
  updateIdentityRoleIntegrityFindingStatus,
  recordPrivilegedRoleRecertification,
  getProductionHypercareWindows,
  getProductionHypercareItems,
  getExecutiveGovernanceBoardPacks,
  getProductionOperationsDashboardSummary,
  createProductionHypercareWindow,
  updateProductionHypercareWindowStatus,
  recordProductionHypercareItem,
  updateProductionHypercareItemStatus,
  createExecutiveGovernanceBoardPack,
  updateExecutiveGovernanceBoardPackStatus,
  type ControlledProductionCutoverDecisionState,
  type LivePilotSessionStatus,
  type LivePilotIssueStatus,
  type LivePilotIssueSeverity,
  type LivePilotRetestStatus,
  type LivePilotDepartmentAcceptanceStatus,
  type IdentityRoleIntegrityReviewStatus,
  type IdentityRoleFindingType,
  type IdentityRoleFindingSeverity,
  type IdentityRoleFindingStatus,
  type PrivilegedRoleRecertificationStatus,
  type ProductionHypercareStatus,
  type ProductionHypercareItemType,
  type ProductionHypercareItemStatus,
  type ExecutiveBoardPackStatus
} from '../lib/productionReadinessApi';
import { ShieldCheck, BarChart3, AlertTriangle, FileCheck, RefreshCw, Smartphone, Award, ClipboardList, Database, Languages } from 'lucide-react';

export function ProductionReadinessCenter() {
  const auth = useAuth();
  const { language } = useI18n();
  const [activeTab, setActiveTab] = useState<'status' | 'limitations' | 'operations' | 'rpc_nav'>('status');
  const [cutoverRationale, setCutoverRationale] = useState('');
  const [cutoverMessage, setCutoverMessage] = useState<string | null>(null);
  const [cutoverBusy, setCutoverBusy] = useState(false);
  const [pilotSessionTitle, setPilotSessionTitle] = useState('');
  const [pilotIssueTitle, setPilotIssueTitle] = useState('');
  const [pilotIssueSeverity, setPilotIssueSeverity] = useState<LivePilotIssueSeverity>('medium');
  const [pilotMessage, setPilotMessage] = useState<string | null>(null);
  const [pilotBusy, setPilotBusy] = useState(false);
  const [identityReviewTitle, setIdentityReviewTitle] = useState('');
  const [identityFindingTitle, setIdentityFindingTitle] = useState('');
  const [identityFindingType, setIdentityFindingType] = useState<IdentityRoleFindingType>('missing_owner');
  const [identityFindingSeverity, setIdentityFindingSeverity] = useState<IdentityRoleFindingSeverity>('medium');
  const [identityRoleName, setIdentityRoleName] = useState('');
  const [identityUserId, setIdentityUserId] = useState('');
  const [identityMessage, setIdentityMessage] = useState<string | null>(null);
  const [identityBusy, setIdentityBusy] = useState(false);
  const [operationsHypercareTitle, setOperationsHypercareTitle] = useState('');
  const [operationsItemTitle, setOperationsItemTitle] = useState('');
  const [operationsItemType, setOperationsItemType] = useState<ProductionHypercareItemType>('support_issue');
  const [operationsBoardPackTitle, setOperationsBoardPackTitle] = useState('');
  const [operationsReportingPeriod, setOperationsReportingPeriod] = useState('');
  const [operationsMessage, setOperationsMessage] = useState<string | null>(null);
  const [operationsBusy, setOperationsBusy] = useState(false);

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
  const hospitalOperations = useAsyncData(getHospitalOperationsReadinessOverlay, []);
  const hospitalBlockers = useAsyncData(getHospitalOperationsLaunchBlockers, []);
  const hospitalLaunchPacks = useAsyncData(getHospitalDepartmentLaunchPacks, []);
  const hospitalChecklist = useAsyncData(getHospitalLaunchChecklistItems, []);
  const hospitalSupport = useAsyncData(getHospitalSupportReadinessRecords, []);
  const hospitalPolicy = useAsyncData(getHospitalPolicyAttestationReadiness, []);
  const hospitalAdoption = useAsyncData(getHospitalAdoptionReadinessReviews, []);
  const proofSummary = useAsyncData(getProofSuiteReadinessSummary, []);
  const pilotSummary = useAsyncData(getControlledPilotReadinessSummary, []);
  const execSummary = useAsyncData(getExecutiveProductionReadinessSummary, []);
  const cutoverDecisions = useAsyncData(getControlledProductionCutoverDecisions, []);
  const cutoverEvents = useAsyncData(() => getControlledProductionCutoverDecisionEvents(), []);
  const livePilotSessions = useAsyncData(getLivePilotSessions, []);
  const livePilotIssues = useAsyncData(getLivePilotIssues, []);
  const livePilotAcceptances = useAsyncData(getLivePilotDepartmentAcceptances, []);
  const identityReviews = useAsyncData(getIdentityRoleIntegrityReviews, []);
  const identityFindings = useAsyncData(getIdentityRoleIntegrityFindings, []);
  const privilegedRecertifications = useAsyncData(getPrivilegedRoleRecertifications, []);
  const operationsWindows = useAsyncData(getProductionHypercareWindows, []);
  const operationsItems = useAsyncData(getProductionHypercareItems, []);
  const boardPacks = useAsyncData(getExecutiveGovernanceBoardPacks, []);

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

  const hospitalOperationsData = hospitalOperations.data || {
    total_department_launch_packs: 0,
    ready_departments: 0,
    ready_with_limitations_departments: 0,
    blocked_departments: 0,
    evidence_required_departments: 0,
    incomplete_launch_checklist_items: 0,
    missing_owner_count: 0,
    support_readiness_blockers: 0,
    policy_attestation_gaps: 0,
    low_adoption_departments: 0,
    inactive_users: 0,
    training_incomplete_count: 0,
    failed_workflow_attempt_count: 0,
    critical_support_issues: 0,
    department_launch_blocker_count: 0,
    hospital_operations_readiness_status: 'evidence_required',
    next_action_required: '-'
  };

  const currentCutoverCriticalBlockers =
    Number(pilotClosureData.blocked_or_deferred_closures ?? 0)
    + Number(pilotClosureData.failed_or_blocked_workflows ?? 0)
    + Number(pilotClosureData.open_high_critical_live_issues ?? 0)
    + Number(livePilotExecutionData.workflow_blocker_count ?? 0)
    + Number(hospitalOperationsData.department_launch_blocker_count ?? 0);
  const currentCutoverLimitations =
    Number(pilotClosureData.accepted_limitations ?? 0)
    + Number(hospitalOperationsData.ready_with_limitations_departments ?? 0);
  const currentLimitationsReviewed =
    currentCutoverLimitations > 0
    && Number(pilotClosureData.pending_limitation_reviews ?? 0) === 0;
  const currentCutoverChecklistComplete =
    currentCutoverCriticalBlockers === 0
    && Number(pilotClosureData.missing_golive_decisions ?? 0) === 0
    && Number(livePilotExecutionData.missing_evidence_count ?? 0) === 0
    && Number(hospitalOperationsData.incomplete_launch_checklist_items ?? 0) === 0;
  const cutoverGateSummary = useMemo(
    () => getControlledCutoverGateSummary(cutoverDecisions.data || []),
    [cutoverDecisions.data],
  );
  const approvedGateAvailable = currentCutoverCriticalBlockers === 0 && currentCutoverChecklistComplete;
  const limitationGateAvailable = approvedGateAvailable && currentCutoverLimitations > 0 && currentLimitationsReviewed;
  const livePilotIssueBurndown = useMemo(
    () => getLivePilotIssueBurndownSummary(livePilotIssues.data || []),
    [livePilotIssues.data],
  );
  const livePilotExitReadiness = useMemo(
    () => getLivePilotExitReadinessSummary(
      livePilotSessions.data || [],
      livePilotIssues.data || [],
      livePilotAcceptances.data || [],
    ),
    [livePilotSessions.data, livePilotIssues.data, livePilotAcceptances.data],
  );
  const selectedPilotSession = useMemo(() => (livePilotSessions.data || [])[0], [livePilotSessions.data]);
  const identityIntegritySummary = useMemo(
    () => getIdentityRoleIntegrityDashboardSummary(
      identityReviews.data || [],
      identityFindings.data || [],
      privilegedRecertifications.data || [],
    ),
    [identityReviews.data, identityFindings.data, privilegedRecertifications.data],
  );
  const selectedIdentityReview = useMemo(() => (identityReviews.data || [])[0], [identityReviews.data]);
  const selectedIdentityFinding = useMemo(() => (identityFindings.data || [])[0], [identityFindings.data]);
  const operationsGovernanceSummary = useMemo(
    () => getProductionOperationsDashboardSummary(
      operationsWindows.data || [],
      operationsItems.data || [],
      boardPacks.data || [],
    ),
    [operationsWindows.data, operationsItems.data, boardPacks.data],
  );
  const selectedOperationsWindow = useMemo(() => (operationsWindows.data || [])[0], [operationsWindows.data]);
  const selectedOperationsItem = useMemo(() => (operationsItems.data || [])[0], [operationsItems.data]);
  const selectedBoardPack = useMemo(() => (boardPacks.data || [])[0], [boardPacks.data]);

  async function refreshLivePilotData() {
    await Promise.all([
      livePilotSessions.refresh(),
      livePilotIssues.refresh(),
      livePilotAcceptances.refresh(),
    ]);
  }

  async function runPilotAction(action: () => Promise<{ message?: string }>, fallbackMessage: string) {
    setPilotBusy(true);
    setPilotMessage(null);
    try {
      const result = await action();
      setPilotMessage(result.message || fallbackMessage);
      await refreshLivePilotData();
    } catch (error) {
      setPilotMessage(error instanceof Error ? error.message : fallbackMessage);
    } finally {
      setPilotBusy(false);
    }
  }

  async function handleCreatePilotSession() {
    const sessionTitle = pilotSessionTitle.trim();
    if (!sessionTitle) {
      setPilotMessage(text.pilotSessionTitleRequired);
      return;
    }
    await runPilotAction(
      () => createLivePilotSession({ session_title: sessionTitle }),
      text.pilotSessionCreated,
    );
    setPilotSessionTitle('');
  }

  async function handleCreatePilotIssue() {
    const issueTitle = pilotIssueTitle.trim();
    if (!selectedPilotSession?.id) {
      setPilotMessage(text.pilotSessionRequired);
      return;
    }
    if (!issueTitle) {
      setPilotMessage(text.pilotIssueTitleRequired);
      return;
    }
    await runPilotAction(
      () => createLivePilotIssue({
        pilot_session_id: selectedPilotSession.id,
        issue_title: issueTitle,
        severity: pilotIssueSeverity,
        department_id: selectedPilotSession.department_id,
        retest_required: true,
      }),
      text.pilotIssueRecorded,
    );
    setPilotIssueTitle('');
  }

  async function handlePilotSessionStatus(sessionStatus: LivePilotSessionStatus) {
    if (!selectedPilotSession?.id) {
      setPilotMessage(text.pilotSessionRequired);
      return;
    }
    await runPilotAction(
      () => updateLivePilotSessionStatus({
        session_id: selectedPilotSession.id,
        session_status: sessionStatus,
        exit_review_notes: `${sessionStatus}. ${text.pilotReadinessCaveat}`,
        exit_criteria_met: sessionStatus === 'exit_review_required' && livePilotIssueBurndown.issue_burndown_state === 'Ready for pilot exit review',
      }),
      text.pilotSessionUpdated,
    );
  }

  async function handlePilotIssueStatus(issueId: string, issueStatus: LivePilotIssueStatus, retestStatus?: LivePilotRetestStatus) {
    await runPilotAction(
      () => updateLivePilotIssueStatus({
        issue_id: issueId,
        issue_status: issueStatus,
        retest_status: retestStatus,
        retest_evidence_summary: retestStatus ? `${text.retestEvidenceRequired}: ${retestStatus}` : null,
        closure_summary: issueStatus === 'closed' ? text.pilotIssueClosureSummary : null,
      }),
      text.pilotIssueUpdated,
    );
  }

  async function handleDepartmentAcceptance(acceptanceStatus: LivePilotDepartmentAcceptanceStatus) {
    if (!selectedPilotSession?.id || !selectedPilotSession.department_id) {
      setPilotMessage(text.pilotDepartmentRequired);
      return;
    }
    const canAccept = acceptanceStatus !== 'accepted'
      || (
        livePilotIssueBurndown.issue_burndown_state === 'Ready for pilot exit review'
        && livePilotIssueBurndown.retest_evidence_required === 0
      );
    await runPilotAction(
      () => recordLivePilotDepartmentAcceptance({
        pilot_session_id: selectedPilotSession.id,
        department_id: selectedPilotSession.department_id as string,
        acceptance_status: acceptanceStatus,
        acceptance_notes: `${acceptanceStatus}. ${text.pilotReadinessCaveat}`,
        open_blockers_count: canAccept ? 0 : livePilotIssueBurndown.high_critical_open_issues + livePilotIssueBurndown.open_issues,
        training_confirmed: canAccept,
        issue_burndown_confirmed: livePilotIssueBurndown.issue_burndown_state === 'Ready for pilot exit review',
      }),
      text.pilotAcceptanceRecorded,
    );
  }

  async function refreshIdentityIntegrityData() {
    await Promise.all([
      identityReviews.refresh(),
      identityFindings.refresh(),
      privilegedRecertifications.refresh(),
    ]);
  }

  async function runIdentityAction(action: () => Promise<{ message?: string }>, fallbackMessage: string) {
    setIdentityBusy(true);
    setIdentityMessage(null);
    try {
      const result = await action();
      setIdentityMessage(result.message || fallbackMessage);
      await refreshIdentityIntegrityData();
    } catch (error) {
      setIdentityMessage(error instanceof Error ? error.message : fallbackMessage);
    } finally {
      setIdentityBusy(false);
    }
  }

  async function handleCreateIdentityReview() {
    const reviewTitle = identityReviewTitle.trim();
    if (!reviewTitle) {
      setIdentityMessage(text.identityReviewTitleRequired);
      return;
    }
    await runIdentityAction(
      () => createIdentityRoleIntegrityReview({
        review_title: reviewTitle,
        review_notes: text.identityReviewDefaultNote,
        sso_mfa_readiness_status: 'review_required',
        access_export_status: 'not_ready',
      }),
      text.identityReviewCreated,
    );
    setIdentityReviewTitle('');
  }

  async function handleIdentityReviewStatus(reviewStatus: IdentityRoleIntegrityReviewStatus) {
    if (!selectedIdentityReview?.id) {
      setIdentityMessage(text.identityReviewRequired);
      return;
    }
    await runIdentityAction(
      () => updateIdentityRoleIntegrityReviewStatus({
        review_id: selectedIdentityReview.id,
        review_status: reviewStatus,
        review_notes: `${reviewStatus}. ${text.accessIntegrityCaveat}`,
        access_export_status: reviewStatus === 'ready_for_access_integrity_review' ? 'ready_for_export' : null,
      }),
      text.identityReviewUpdated,
    );
  }

  async function handleRecordIdentityFinding() {
    const findingTitle = identityFindingTitle.trim();
    if (!selectedIdentityReview?.id) {
      setIdentityMessage(text.identityReviewRequired);
      return;
    }
    if (!findingTitle) {
      setIdentityMessage(text.identityFindingTitleRequired);
      return;
    }
    await runIdentityAction(
      () => recordIdentityRoleIntegrityFinding({
        review_id: selectedIdentityReview.id,
        finding_type: identityFindingType,
        severity: identityFindingSeverity,
        entity_type: identityFindingType.includes('account') || identityFindingType.includes('role') ? 'user' : 'department',
        finding_title: findingTitle,
        finding_summary: text.identityFindingDefaultSummary,
      }),
      text.identityFindingRecorded,
    );
    setIdentityFindingTitle('');
  }

  async function handleIdentityFindingStatus(findingStatus: IdentityRoleFindingStatus) {
    if (!selectedIdentityFinding?.id) {
      setIdentityMessage(text.identityFindingRequired);
      return;
    }
    await runIdentityAction(
      () => updateIdentityRoleIntegrityFindingStatus({
        finding_id: selectedIdentityFinding.id,
        finding_status: findingStatus,
        resolution_summary: `${findingStatus}. ${text.integrityFindingsRemainOpen}`,
      }),
      text.identityFindingUpdated,
    );
  }

  async function handlePrivilegedRoleRecertification(recertificationStatus: PrivilegedRoleRecertificationStatus) {
    if (!selectedIdentityReview?.id) {
      setIdentityMessage(text.identityReviewRequired);
      return;
    }
    if (!identityUserId.trim() || !identityRoleName.trim()) {
      setIdentityMessage(text.identityRecertificationRequired);
      return;
    }
    await runIdentityAction(
      () => recordPrivilegedRoleRecertification({
        review_id: selectedIdentityReview.id,
        user_id: identityUserId.trim(),
        role_name: identityRoleName.trim(),
        recertification_status: recertificationStatus,
        recertification_rationale: recertificationStatus === 'recertified'
          ? text.privilegedRoleRecertificationRationale
          : text.privilegedRoleRecertificationNote,
      }),
      text.identityRecertificationRecorded,
    );
    setIdentityUserId('');
    setIdentityRoleName('');
  }

  async function refreshOperationsGovernanceData() {
    await Promise.all([
      operationsWindows.refresh(),
      operationsItems.refresh(),
      boardPacks.refresh(),
    ]);
  }

  async function runOperationsAction(action: () => Promise<{ message?: string }>, fallbackMessage: string) {
    setOperationsBusy(true);
    setOperationsMessage(null);
    try {
      const result = await action();
      setOperationsMessage(result.message || fallbackMessage);
      await refreshOperationsGovernanceData();
    } catch (error) {
      setOperationsMessage(error instanceof Error ? error.message : fallbackMessage);
    } finally {
      setOperationsBusy(false);
    }
  }

  async function handleCreateOperationsWindow() {
    const title = operationsHypercareTitle.trim();
    if (!title) {
      setOperationsMessage(text.hypercareTitleRequired);
      return;
    }
    await runOperationsAction(
      () => createProductionHypercareWindow({
        hypercare_title: title,
        exit_review_notes: text.operationsDefaultNote,
      }),
      text.hypercareWindowCreated,
    );
    setOperationsHypercareTitle('');
  }

  async function handleOperationsWindowStatus(hypercareStatus: ProductionHypercareStatus) {
    if (!selectedOperationsWindow?.id) {
      setOperationsMessage(text.hypercareWindowRequired);
      return;
    }
    await runOperationsAction(
      () => updateProductionHypercareWindowStatus({
        hypercare_window_id: selectedOperationsWindow.id,
        hypercare_status: hypercareStatus,
        day_30_status: hypercareStatus === 'exit_review_required' ? 'review_required' : null,
        day_60_status: hypercareStatus === 'exit_review_required' ? 'review_required' : null,
        day_90_status: hypercareStatus === 'exit_review_required' ? 'review_required' : null,
        evidence_pack_status: hypercareStatus === 'exit_review_required' ? 'ready_for_review' : null,
        board_pack_status: hypercareStatus === 'exit_review_required' ? 'review_required' : null,
        exit_review_notes: `${hypercareStatus}. ${text.boardClosureCaveat}`,
      }),
      text.hypercareWindowUpdated,
    );
  }

  async function handleRecordOperationsItem() {
    const title = operationsItemTitle.trim();
    if (!selectedOperationsWindow?.id) {
      setOperationsMessage(text.hypercareWindowRequired);
      return;
    }
    if (!title) {
      setOperationsMessage(text.operationsItemTitleRequired);
      return;
    }
    await runOperationsAction(
      () => recordProductionHypercareItem({
        hypercare_window_id: selectedOperationsWindow.id,
        item_type: operationsItemType,
        item_title: title,
        severity: operationsItemType === 'incident_trend' ? 'high' : 'medium',
        item_summary: text.operationsItemDefaultSummary,
      }),
      text.operationsItemRecorded,
    );
    setOperationsItemTitle('');
  }

  async function handleOperationsItemStatus(itemStatus: ProductionHypercareItemStatus) {
    if (!selectedOperationsItem?.id) {
      setOperationsMessage(text.operationsItemRequired);
      return;
    }
    await runOperationsAction(
      () => updateProductionHypercareItemStatus({
        item_id: selectedOperationsItem.id,
        item_status: itemStatus,
        evidence_summary: `${text.realExecutionEvidenceRequired}`,
        closure_summary: `${itemStatus}. ${text.operationsItemClosureSummary}`,
      }),
      text.operationsItemUpdated,
    );
  }

  async function handleCreateBoardPack() {
    const title = operationsBoardPackTitle.trim();
    const period = operationsReportingPeriod.trim();
    if (!title || !period) {
      setOperationsMessage(text.boardPackRequired);
      return;
    }
    await runOperationsAction(
      () => createExecutiveGovernanceBoardPack({
        pack_title: title,
        reporting_period: period,
        hypercare_window_id: selectedOperationsWindow?.id ?? null,
        executive_summary: text.executiveMonthlyGovernanceReport,
      }),
      text.boardPackCreated,
    );
    setOperationsBoardPackTitle('');
    setOperationsReportingPeriod('');
  }

  async function handleBoardPackStatus(packStatus: ExecutiveBoardPackStatus) {
    if (!selectedBoardPack?.id) {
      setOperationsMessage(text.boardPackSelectRequired);
      return;
    }
    await runOperationsAction(
      () => updateExecutiveGovernanceBoardPackStatus({
        board_pack_id: selectedBoardPack.id,
        pack_status: packStatus,
        board_review_notes: `${packStatus}. ${text.boardClosureCaveat}`,
      }),
      text.boardPackUpdated,
    );
  }

  async function recordCutoverDecision(decisionState: ControlledProductionCutoverDecisionState) {
    setCutoverBusy(true);
    setCutoverMessage(null);
    try {
      const title = decisionState === 'approved_for_controlled_pilot_cutover'
        ? 'Approved for controlled pilot cutover'
        : decisionState === 'approved_with_limitations'
          ? 'Approved with limitations'
          : decisionState === 'blocked'
            ? 'Blocked'
            : decisionState === 'deferred'
              ? 'Deferred'
              : 'Executive review required';
      const result = await createControlledProductionCutoverDecision({
        decision_state: decisionState,
        decision_title: title,
        decision_summary: `${title}. This decision record does not automatically launch the system.`,
        critical_blockers_count: currentCutoverCriticalBlockers,
        limitations_count: currentCutoverLimitations,
        limitations_reviewed: currentLimitationsReviewed,
        cutover_checklist_complete: currentCutoverChecklistComplete,
        evidence_gate_snapshot: {
          critical_blockers_count: currentCutoverCriticalBlockers,
          limitations_count: currentCutoverLimitations,
          limitations_reviewed: currentLimitationsReviewed,
          cutover_checklist_complete: currentCutoverChecklistComplete,
          pilot_closure_status: pilotClosureData.production_golive_readiness_status,
          hospital_operations_status: hospitalOperationsData.hospital_operations_readiness_status,
        },
        decision_rationale: cutoverRationale || 'Executive review required before controlled cutover decision can be closed.',
      });
      setCutoverMessage(result.message);
      setCutoverRationale('');
      await Promise.all([cutoverDecisions.refresh(), cutoverEvents.refresh()]);
    } catch (error) {
      setCutoverMessage(error instanceof Error ? error.message : 'Controlled cutover decision could not be recorded.');
    } finally {
      setCutoverBusy(false);
    }
  }

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

              <ModernCard title={text.identityIntegrityTitle} subtitle={text.identityIntegritySubtitle}>
                <DataState
                  loading={identityReviews.loading || identityFindings.loading || privilegedRecertifications.loading}
                  error={identityReviews.error || identityFindings.error || privilegedRecertifications.error}
                  empty={false}
                >
                  <div className="alert alert-warning">
                    <strong>{text.accessIntegrityReview}: </strong>{identityIntegritySummary.access_integrity_review_state}
                    <br />
                    <strong>{text.caveat}: </strong>{text.accessIntegrityCaveat}
                    <br />
                    <strong>{text.caveat}: </strong>{text.controlledAuthorityCaveat}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '14px', marginBottom: '18px' }}>
                    <div className="stat-card">
                      <div className="stat-value"><StatusPill tone={identityIntegritySummary.access_integrity_review_state === 'ready_for_access_integrity_review' ? 'good' : identityIntegritySummary.access_integrity_review_state === 'blocked' ? 'danger' : 'warning'}>{identityIntegritySummary.access_integrity_review_state}</StatusPill></div>
                      <div className="stat-label">{text.accessIntegrityReview}</div>
                    </div>
                    <div className="stat-card warning"><div className="stat-value">{identityIntegritySummary.privileged_role_recertification_pending}</div><div className="stat-label">{text.privilegedRoleRecertification}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{identityIntegritySummary.dormant_account_review_count}</div><div className="stat-label">{text.dormantAccountReview}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{identityIntegritySummary.inactive_account_review_count}</div><div className="stat-label">{text.inactiveAccountReview}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{identityIntegritySummary.archived_user_access_review_count}</div><div className="stat-label">{text.archivedUserAccessReview}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{identityIntegritySummary.role_duplication_review_count}</div><div className="stat-label">{text.roleDuplicationReview}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{identityIntegritySummary.department_accountability_gap_count}</div><div className="stat-label">{text.departmentOwnerAccountability}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{identityIntegritySummary.station_accountability_gap_count}</div><div className="stat-label">{text.stationAccountability}</div></div>
                    <div className="stat-card danger"><div className="stat-value">{identityIntegritySummary.missing_owner_reviewer_count}</div><div className="stat-label">{text.missingOwnerReviewerRepair}</div></div>
                    <div className="stat-card danger"><div className="stat-value">{identityIntegritySummary.open_high_risk_finding_count}</div><div className="stat-label">{text.openHighRiskFindings}</div></div>
                    <div className="stat-card"><div className="stat-value"><StatusPill tone={identityIntegritySummary.sso_mfa_readiness_status === 'ready_for_it_review' ? 'good' : identityIntegritySummary.sso_mfa_readiness_status === 'blocked' ? 'danger' : 'warning'}>{identityIntegritySummary.sso_mfa_readiness_status}</StatusPill></div><div className="stat-label">{text.ssoMfaReadinessChecklist}</div></div>
                    <div className="stat-card"><div className="stat-value"><StatusPill tone={identityIntegritySummary.access_export_status === 'ready_for_export' || identityIntegritySummary.access_export_status === 'exported_for_review' ? 'good' : identityIntegritySummary.access_export_status === 'blocked' ? 'danger' : 'warning'}>{identityIntegritySummary.access_export_status}</StatusPill></div><div className="stat-label">{text.accessExportItSecurityReview}</div></div>
                  </div>
                  <div className="alert alert-info">
                    <strong>{text.requiredActionsBeforeAccessIntegrityReview}: </strong>{identityIntegritySummary.required_actions.join(' ')}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '14px', margin: '14px 0' }}>
                    <label style={{ display: 'grid', gap: '6px' }}>
                      <span style={{ fontWeight: 700 }}>{text.identityReviewTitleLabel}</span>
                      <input className="text-input" value={identityReviewTitle} onChange={event => setIdentityReviewTitle(event.target.value)} placeholder={text.identityReviewTitlePlaceholder} />
                    </label>
                    <div style={{ display: 'flex', alignItems: 'end', gap: '10px', flexWrap: 'wrap' }}>
                      <button className="secondary-action" type="button" disabled={identityBusy} onClick={() => void handleCreateIdentityReview()}>{text.createAccessIntegrityReview}</button>
                      <button className="secondary-action" type="button" disabled={identityBusy || !selectedIdentityReview} onClick={() => void handleIdentityReviewStatus('remediation_required')}>{text.markReviewRemediationRequired}</button>
                      <button className="secondary-action" type="button" disabled={identityBusy || !selectedIdentityReview} onClick={() => void handleIdentityReviewStatus('blocked')}>{text.markReviewBlocked}</button>
                      <button className="secondary-action" type="button" disabled={identityBusy || !selectedIdentityReview || identityIntegritySummary.required_actions.length > 1 || identityIntegritySummary.required_actions[0] !== 'Ready for access integrity review.'} onClick={() => void handleIdentityReviewStatus('ready_for_access_integrity_review')}>{text.markReadyForAccessIntegrityReview}</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px 160px auto', gap: '14px', marginBottom: '14px' }}>
                    <label style={{ display: 'grid', gap: '6px' }}>
                      <span style={{ fontWeight: 700 }}>{text.identityFindingTitleLabel}</span>
                      <input className="text-input" value={identityFindingTitle} onChange={event => setIdentityFindingTitle(event.target.value)} placeholder={text.identityFindingTitlePlaceholder} />
                    </label>
                    <label style={{ display: 'grid', gap: '6px' }}>
                      <span style={{ fontWeight: 700 }}>{text.findingType}</span>
                      <select className="text-input" value={identityFindingType} onChange={event => setIdentityFindingType(event.target.value as IdentityRoleFindingType)}>
                        <option value="duplicate_role">{text.duplicateRole}</option>
                        <option value="privileged_role_review">{text.privilegedRoleReview}</option>
                        <option value="dormant_account">{text.dormantAccountReview}</option>
                        <option value="inactive_account">{text.inactiveAccountReview}</option>
                        <option value="archived_user_access">{text.archivedUserAccessReview}</option>
                        <option value="missing_owner">{text.missingOwner}</option>
                        <option value="missing_reviewer">{text.missingReviewer}</option>
                        <option value="department_accountability_gap">{text.departmentOwnerAccountability}</option>
                        <option value="station_accountability_gap">{text.stationAccountability}</option>
                        <option value="sso_mfa_readiness_gap">{text.ssoMfaReadinessChecklist}</option>
                        <option value="access_export_required">{text.accessExportItSecurityReview}</option>
                        <option value="data_integrity_gap">{text.dataIntegrityGap}</option>
                      </select>
                    </label>
                    <label style={{ display: 'grid', gap: '6px' }}>
                      <span style={{ fontWeight: 700 }}>{text.severity}</span>
                      <select className="text-input" value={identityFindingSeverity} onChange={event => setIdentityFindingSeverity(event.target.value as IdentityRoleFindingSeverity)}>
                        <option value="low">low</option>
                        <option value="medium">medium</option>
                        <option value="high">high</option>
                        <option value="critical">critical</option>
                      </select>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'end' }}>
                      <button className="secondary-action" type="button" disabled={identityBusy || !selectedIdentityReview} onClick={() => void handleRecordIdentityFinding()}>{text.recordIdentityFinding}</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '14px', marginBottom: '14px' }}>
                    <label style={{ display: 'grid', gap: '6px' }}>
                      <span style={{ fontWeight: 700 }}>{text.userIdForReview}</span>
                      <input className="text-input" value={identityUserId} onChange={event => setIdentityUserId(event.target.value)} placeholder={text.userIdForReviewPlaceholder} />
                    </label>
                    <label style={{ display: 'grid', gap: '6px' }}>
                      <span style={{ fontWeight: 700 }}>{text.roleNameForReview}</span>
                      <input className="text-input" value={identityRoleName} onChange={event => setIdentityRoleName(event.target.value)} placeholder={text.roleNameForReviewPlaceholder} />
                    </label>
                    <div style={{ display: 'flex', alignItems: 'end', gap: '10px', flexWrap: 'wrap' }}>
                      <button className="secondary-action" type="button" disabled={identityBusy || !selectedIdentityReview} onClick={() => void handlePrivilegedRoleRecertification('pending')}>{text.recordRecertificationPending}</button>
                      <button className="secondary-action" type="button" disabled={identityBusy || !selectedIdentityReview} onClick={() => void handlePrivilegedRoleRecertification('recertified')}>{text.recordRecertified}</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
                    <button className="secondary-action" type="button" disabled={identityBusy || !selectedIdentityFinding} onClick={() => void handleIdentityFindingStatus('in_progress')}>{text.markFindingInProgress}</button>
                    <button className="secondary-action" type="button" disabled={identityBusy || !selectedIdentityFinding} onClick={() => void handleIdentityFindingStatus('resolved')}>{text.markFindingResolved}</button>
                    <button className="secondary-action" type="button" disabled={identityBusy || !selectedIdentityFinding} onClick={() => void handleIdentityFindingStatus('accepted_limitation')}>{text.markFindingAcceptedLimitation}</button>
                  </div>
                  {identityMessage ? <div className="alert alert-info">{identityMessage}</div> : null}
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead><tr><th>{text.finding}</th><th>{text.findingType}</th><th>{text.severity}</th><th>{text.status}</th><th>{text.owner}</th></tr></thead>
                      <tbody>
                        {(identityFindings.data || []).slice(0, 20).map(finding => (
                          <tr key={finding.id}>
                            <td><strong>{finding.finding_title}</strong></td>
                            <td>{finding.finding_type}</td>
                            <td><StatusPill tone={finding.severity === 'critical' || finding.severity === 'high' ? 'danger' : finding.severity === 'medium' ? 'warning' : 'neutral'}>{finding.severity}</StatusPill></td>
                            <td><StatusPill tone={finding.finding_status === 'resolved' ? 'good' : finding.finding_status === 'blocked' ? 'danger' : 'warning'}>{finding.finding_status}</StatusPill></td>
                            <td>{finding.owner_id || text.missingOwnerReviewerRepair}</td>
                          </tr>
                        ))}
                        {!(identityFindings.data || []).length ? (
                          <tr><td colSpan={5}>{text.noIdentityFindingsRecorded}</td></tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>

              <ModernCard title={text.productionOperationsGovernanceTitle} subtitle={text.productionOperationsGovernanceSubtitle}>
                <DataState
                  loading={operationsWindows.loading || operationsItems.loading || boardPacks.loading}
                  error={operationsWindows.error || operationsItems.error || boardPacks.error}
                  empty={false}
                >
                  <div className="alert alert-warning">
                    <strong>{text.hypercareCommandCenter}: </strong>{operationsGovernanceSummary.hypercare_command_center_status}
                    <br />
                    <strong>{text.boardClosurePack}: </strong>{operationsGovernanceSummary.board_pack_status}
                    <br />
                    <strong>{text.caveat}: </strong>{text.boardClosureCaveat}
                    <br />
                    <strong>{text.caveat}: </strong>{text.controlledAuthorityCaveat}
                    <br />
                    <strong>{text.caveat}: </strong>{text.liveTransitionCaveat}
                    <br />
                    <strong>{text.caveat}: </strong>{text.realExecutionEvidenceRequired}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '14px', marginBottom: '18px' }}>
                    <div className="stat-card"><div className="stat-value"><StatusPill tone={operationsGovernanceSummary.hypercare_command_center_status === 'exit_review_required' ? 'good' : operationsGovernanceSummary.hypercare_command_center_status === 'blocked' ? 'danger' : 'warning'}>{operationsGovernanceSummary.hypercare_command_center_status}</StatusPill></div><div className="stat-label">{text.hypercareCommandCenter}</div></div>
                    <div className="stat-card"><div className="stat-value">{operationsGovernanceSummary.day_30_status}</div><div className="stat-label">{text.day30OperatingView}</div></div>
                    <div className="stat-card"><div className="stat-value">{operationsGovernanceSummary.day_60_status}</div><div className="stat-label">{text.day60OperatingView}</div></div>
                    <div className="stat-card"><div className="stat-value">{operationsGovernanceSummary.day_90_status}</div><div className="stat-label">{text.day90OperatingView}</div></div>
                    <div className="stat-card danger"><div className="stat-value">{operationsGovernanceSummary.critical_incident_count}</div><div className="stat-label">{text.supportIncidentTrendSummary}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{operationsGovernanceSummary.open_support_issue_count}</div><div className="stat-label">{text.openSupportIssues}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{operationsGovernanceSummary.department_launch_gap_count}</div><div className="stat-label">{text.departmentLaunchHealth}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{operationsGovernanceSummary.unresolved_limitation_count}</div><div className="stat-label">{text.knownLimitationsRegister}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{operationsGovernanceSummary.corrective_action_open_count}</div><div className="stat-label">{text.postCutoverCorrectiveActionQueue}</div></div>
                    <div className="stat-card"><div className="stat-value"><StatusPill tone={operationsGovernanceSummary.executive_monthly_governance_report_status === 'ready_for_board_review' ? 'good' : operationsGovernanceSummary.executive_monthly_governance_report_status === 'blocked' ? 'danger' : 'warning'}>{operationsGovernanceSummary.executive_monthly_governance_report_status}</StatusPill></div><div className="stat-label">{text.executiveMonthlyGovernanceReport}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{operationsGovernanceSummary.accreditation_evidence_pack_gap_count}</div><div className="stat-label">{text.accreditationEvidencePackTracking}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{operationsGovernanceSummary.dr_support_access_training_gap_count}</div><div className="stat-label">{text.drSupportAccessTrainingEvidence}</div></div>
                  </div>
                  <div className="alert alert-info">
                    <strong>{text.requiredActionsBeforeHypercareExitReview}: </strong>{operationsGovernanceSummary.required_actions_before_hypercare_exit.join(' ')}
                    <br />
                    <strong>{text.requiredActionsBeforeBoardReview}: </strong>{operationsGovernanceSummary.required_actions_before_board_review.join(' ')}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '14px', margin: '14px 0' }}>
                    <label style={{ display: 'grid', gap: '6px' }}>
                      <span style={{ fontWeight: 700 }}>{text.hypercareWindowTitleLabel}</span>
                      <input className="text-input" value={operationsHypercareTitle} onChange={event => setOperationsHypercareTitle(event.target.value)} placeholder={text.hypercareWindowTitlePlaceholder} />
                    </label>
                    <div style={{ display: 'flex', alignItems: 'end', gap: '10px', flexWrap: 'wrap' }}>
                      <button className="secondary-action" type="button" disabled={operationsBusy} onClick={() => void handleCreateOperationsWindow()}>{text.createHypercareWindow}</button>
                      <button className="secondary-action" type="button" disabled={operationsBusy || !selectedOperationsWindow} onClick={() => void handleOperationsWindowStatus('blocked')}>{text.markHypercareBlocked}</button>
                      <button className="secondary-action" type="button" disabled={operationsBusy || !selectedOperationsWindow} onClick={() => void handleOperationsWindowStatus('deferred')}>{text.markHypercareDeferred}</button>
                      <button className="secondary-action" type="button" disabled={operationsBusy || !selectedOperationsWindow || operationsGovernanceSummary.required_actions_before_hypercare_exit.length > 1 || operationsGovernanceSummary.required_actions_before_hypercare_exit[0] !== 'Hypercare exit review required.'} onClick={() => void handleOperationsWindowStatus('exit_review_required')}>{text.markHypercareExitReviewRequired}</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px auto', gap: '14px', marginBottom: '14px' }}>
                    <label style={{ display: 'grid', gap: '6px' }}>
                      <span style={{ fontWeight: 700 }}>{text.operationsItemTitleLabel}</span>
                      <input className="text-input" value={operationsItemTitle} onChange={event => setOperationsItemTitle(event.target.value)} placeholder={text.operationsItemTitlePlaceholder} />
                    </label>
                    <label style={{ display: 'grid', gap: '6px' }}>
                      <span style={{ fontWeight: 700 }}>{text.itemType}</span>
                      <select className="text-input" value={operationsItemType} onChange={event => setOperationsItemType(event.target.value as ProductionHypercareItemType)}>
                        <option value="support_issue">{text.supportIssue}</option>
                        <option value="incident_trend">{text.incidentTrend}</option>
                        <option value="department_launch_health">{text.departmentLaunchHealth}</option>
                        <option value="known_limitation">{text.knownLimitationsRegister}</option>
                        <option value="corrective_action">{text.postCutoverCorrectiveActionQueue}</option>
                        <option value="evidence_pack_gap">{text.accreditationEvidencePackTracking}</option>
                        <option value="board_pack_gap">{text.boardClosurePack}</option>
                        <option value="training_gap">{text.trainingGap}</option>
                        <option value="dr_restore_gap">{text.drRestoreGap}</option>
                        <option value="access_review_gap">{text.accessReviewGap}</option>
                      </select>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'end' }}>
                      <button className="secondary-action" type="button" disabled={operationsBusy || !selectedOperationsWindow} onClick={() => void handleRecordOperationsItem()}>{text.recordHypercareItem}</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px auto', gap: '14px', marginBottom: '14px' }}>
                    <label style={{ display: 'grid', gap: '6px' }}>
                      <span style={{ fontWeight: 700 }}>{text.boardPackTitleLabel}</span>
                      <input className="text-input" value={operationsBoardPackTitle} onChange={event => setOperationsBoardPackTitle(event.target.value)} placeholder={text.boardPackTitlePlaceholder} />
                    </label>
                    <label style={{ display: 'grid', gap: '6px' }}>
                      <span style={{ fontWeight: 700 }}>{text.reportingPeriod}</span>
                      <input className="text-input" value={operationsReportingPeriod} onChange={event => setOperationsReportingPeriod(event.target.value)} placeholder={text.reportingPeriodPlaceholder} />
                    </label>
                    <div style={{ display: 'flex', alignItems: 'end', gap: '10px', flexWrap: 'wrap' }}>
                      <button className="secondary-action" type="button" disabled={operationsBusy} onClick={() => void handleCreateBoardPack()}>{text.createBoardPack}</button>
                      <button className="secondary-action" type="button" disabled={operationsBusy || !selectedBoardPack} onClick={() => void handleBoardPackStatus('review_required')}>{text.markBoardReviewRequired}</button>
                      <button className="secondary-action" type="button" disabled={operationsBusy || !selectedBoardPack || operationsGovernanceSummary.required_actions_before_board_review.length > 1 || operationsGovernanceSummary.required_actions_before_board_review[0] !== 'Ready for board review.'} onClick={() => void handleBoardPackStatus('ready_for_board_review')}>{text.markReadyForBoardReview}</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
                    <button className="secondary-action" type="button" disabled={operationsBusy || !selectedOperationsItem} onClick={() => void handleOperationsItemStatus('in_progress')}>{text.markItemInProgress}</button>
                    <button className="secondary-action" type="button" disabled={operationsBusy || !selectedOperationsItem} onClick={() => void handleOperationsItemStatus('review_required')}>{text.markItemReviewRequired}</button>
                    <button className="secondary-action" type="button" disabled={operationsBusy || !selectedOperationsItem} onClick={() => void handleOperationsItemStatus('closed')}>{text.markItemClosed}</button>
                  </div>
                  {operationsMessage ? <div className="alert alert-info">{operationsMessage}</div> : null}
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead><tr><th>{text.item}</th><th>{text.itemType}</th><th>{text.severity}</th><th>{text.status}</th><th>{text.evidence}</th></tr></thead>
                      <tbody>
                        {(operationsItems.data || []).slice(0, 20).map(item => (
                          <tr key={item.id}>
                            <td><strong>{item.item_title}</strong></td>
                            <td>{item.item_type}</td>
                            <td><StatusPill tone={item.severity === 'critical' || item.severity === 'high' ? 'danger' : item.severity === 'medium' ? 'warning' : 'neutral'}>{item.severity}</StatusPill></td>
                            <td><StatusPill tone={item.item_status === 'closed' ? 'good' : item.item_status === 'blocked' ? 'danger' : 'warning'}>{item.item_status}</StatusPill></td>
                            <td>{item.evidence_summary || text.operationalReadinessEvidenceIncomplete}</td>
                          </tr>
                        ))}
                        {!(operationsItems.data || []).length ? (
                          <tr><td colSpan={5}>{text.noOperationsItemsRecorded}</td></tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>

              <ModernCard title={text.livePilotBurndownTitle} subtitle={text.livePilotBurndownSubtitle}>
                <DataState
                  loading={livePilotSessions.loading || livePilotIssues.loading || livePilotAcceptances.loading}
                  error={livePilotSessions.error || livePilotIssues.error || livePilotAcceptances.error}
                  empty={false}
                >
                  <div className="alert alert-warning">
                    <strong>{text.livePilotExecution}: </strong>{text.livePilotExecutionSummary}
                    <br />
                    <strong>{text.pilotIssueBurndown}: </strong>{livePilotIssueBurndown.issue_burndown_state}
                    <br />
                    <strong>{text.caveat}: </strong>{text.pilotReadinessCaveat}
                    <br />
                    <strong>{text.caveat}: </strong>{text.controlledAuthorityCaveat}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '14px', marginBottom: '18px' }}>
                    <div className="stat-card">
                      <div className="stat-value"><StatusPill tone={livePilotExitReadiness.pilot_exit_state === 'Ready for pilot exit review' ? 'good' : livePilotExitReadiness.pilot_exit_state === 'Pilot blockers remain' ? 'danger' : 'warning'}>{livePilotExitReadiness.pilot_exit_state}</StatusPill></div>
                      <div className="stat-label">{text.pilotExitCriteria}</div>
                    </div>
                    <div className="stat-card"><div className="stat-value">{livePilotExitReadiness.session_count}</div><div className="stat-label">{text.pilotSessions}</div></div>
                    <div className="stat-card"><div className="stat-value">{livePilotExitReadiness.department_participation_count}</div><div className="stat-label">{text.departmentPilotParticipation}</div></div>
                    <div className="stat-card danger"><div className="stat-value">{livePilotIssueBurndown.high_critical_open_issues}</div><div className="stat-label">{text.highCriticalIssues}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{livePilotIssueBurndown.retest_evidence_required}</div><div className="stat-label">{text.retestEvidenceRequired}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{livePilotIssueBurndown.open_issues}</div><div className="stat-label">{text.openIssues}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{livePilotIssueBurndown.retest_required_issues}</div><div className="stat-label">{text.retestRequiredIssues}</div></div>
                    <div className="stat-card success"><div className="stat-value">{livePilotIssueBurndown.closed_issues}</div><div className="stat-label">{text.closedIssues}</div></div>
                    <div className="stat-card success"><div className="stat-value">{livePilotExitReadiness.department_acceptance_accepted}</div><div className="stat-label">{text.departmentPilotAcceptance}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{livePilotExitReadiness.department_acceptance_pending}</div><div className="stat-label">{text.pendingDepartmentSignoffs}</div></div>
                  </div>
                  <div className="alert alert-info">
                    <strong>{text.requiredActionsBeforePilotExit}: </strong>{livePilotExitReadiness.required_actions.join(' ')}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', margin: '14px 0' }}>
                    <label style={{ display: 'grid', gap: '6px' }}>
                      <span style={{ fontWeight: 700 }}>{text.pilotSessionTitle}</span>
                      <input className="text-input" value={pilotSessionTitle} onChange={event => setPilotSessionTitle(event.target.value)} placeholder={text.pilotSessionTitlePlaceholder} />
                    </label>
                    <div style={{ display: 'flex', alignItems: 'end', gap: '10px', flexWrap: 'wrap' }}>
                      <button className="secondary-action" type="button" disabled={pilotBusy} onClick={() => void handleCreatePilotSession()}>{text.createPilotSession}</button>
                      <button className="secondary-action" type="button" disabled={pilotBusy || !selectedPilotSession} onClick={() => void handlePilotSessionStatus('issue_burndown')}>{text.markIssueBurndown}</button>
                      <button className="secondary-action" type="button" disabled={pilotBusy || !selectedPilotSession} onClick={() => void handlePilotSessionStatus('exit_review_required')}>{text.markPilotExitReviewRequired}</button>
                      <button className="secondary-action" type="button" disabled={pilotBusy || !selectedPilotSession} onClick={() => void handlePilotSessionStatus('blocked')}>{text.markPilotBlocked}</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px auto', gap: '14px', marginBottom: '14px' }}>
                    <label style={{ display: 'grid', gap: '6px' }}>
                      <span style={{ fontWeight: 700 }}>{text.pilotIssueTitle}</span>
                      <input className="text-input" value={pilotIssueTitle} onChange={event => setPilotIssueTitle(event.target.value)} placeholder={text.pilotIssueTitlePlaceholder} />
                    </label>
                    <label style={{ display: 'grid', gap: '6px' }}>
                      <span style={{ fontWeight: 700 }}>{text.severity}</span>
                      <select className="text-input" value={pilotIssueSeverity} onChange={event => setPilotIssueSeverity(event.target.value as LivePilotIssueSeverity)}>
                        <option value="low">low</option>
                        <option value="medium">medium</option>
                        <option value="high">high</option>
                        <option value="critical">critical</option>
                      </select>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'end' }}>
                      <button className="secondary-action" type="button" disabled={pilotBusy || !selectedPilotSession} onClick={() => void handleCreatePilotIssue()}>{text.recordPilotIssue}</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
                    <button className="secondary-action" type="button" disabled={pilotBusy || !selectedPilotSession?.department_id} onClick={() => void handleDepartmentAcceptance('accepted_with_limitations')}>{text.recordDepartmentAcceptedWithLimitations}</button>
                    <button className="secondary-action" type="button" disabled={pilotBusy || !selectedPilotSession?.department_id || livePilotIssueBurndown.issue_burndown_state !== 'Ready for pilot exit review'} onClick={() => void handleDepartmentAcceptance('accepted')}>{text.recordDepartmentAccepted}</button>
                    <button className="secondary-action" type="button" disabled={pilotBusy || !selectedPilotSession?.department_id} onClick={() => void handleDepartmentAcceptance('blocked')}>{text.recordDepartmentBlocked}</button>
                  </div>
                  {pilotMessage ? <div className="alert alert-info">{pilotMessage}</div> : null}
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead><tr><th>{text.issue}</th><th>{text.severity}</th><th>{text.status}</th><th>{text.retestEvidenceRequired}</th><th>{text.action}</th></tr></thead>
                      <tbody>
                        {(livePilotIssues.data || []).slice(0, 20).map(issue => (
                          <tr key={issue.id}>
                            <td><strong>{issue.issue_title}</strong></td>
                            <td><StatusPill tone={issue.severity === 'critical' || issue.severity === 'high' ? 'danger' : issue.severity === 'medium' ? 'warning' : 'neutral'}>{issue.severity}</StatusPill></td>
                            <td><StatusPill tone={issue.issue_status === 'closed' ? 'good' : issue.issue_status === 'accepted_limitation' ? 'warning' : issue.severity === 'critical' || issue.severity === 'high' ? 'danger' : 'neutral'}>{issue.issue_status}</StatusPill></td>
                            <td>{issue.retest_required ? `${text.yes} (${issue.retest_status})` : text.no}</td>
                            <td>
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <button className="secondary-action" type="button" disabled={pilotBusy} onClick={() => void handlePilotIssueStatus(issue.id, 'retest_required', 'pending')}>{text.requestRetest}</button>
                                <button className="secondary-action" type="button" disabled={pilotBusy} onClick={() => void handlePilotIssueStatus(issue.id, 'closed', 'passed')}>{text.closeAfterRetest}</button>
                                <button className="secondary-action" type="button" disabled={pilotBusy} onClick={() => void handlePilotIssueStatus(issue.id, 'accepted_limitation', 'not_required')}>{text.acceptAsLimitation}</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {!(livePilotIssues.data || []).length ? (
                          <tr><td colSpan={5}>{text.noPilotIssuesRecorded}</td></tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>

              <ModernCard title={text.controlledProductionAuthorityTitle} subtitle={text.controlledProductionAuthoritySubtitle}>
                <DataState loading={cutoverDecisions.loading || cutoverEvents.loading} error={cutoverDecisions.error || cutoverEvents.error} empty={false}>
                  <div className="alert alert-warning">
                    <strong>{text.controlledProductionAuthority}: </strong>{text.controlledCutoverDecision}<br />
                    <strong>{text.caveat}: </strong>This decision record does not automatically launch the system.<br />
                    <strong>{text.caveat}: </strong>Live transition requires separate operational execution.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '14px', marginBottom: '18px' }}>
                    <div className="stat-card">
                      <div className="stat-value">
                        <StatusPill tone={
                          cutoverGateSummary.current_state === 'approved_for_controlled_pilot_cutover' ? 'good' :
                          cutoverGateSummary.current_state === 'approved_with_limitations' ? 'warning' :
                          cutoverGateSummary.current_state === 'blocked' ? 'danger' : 'neutral'
                        }>
                          {cutoverGateSummary.current_state}
                        </StatusPill>
                      </div>
                      <div className="stat-label">{text.controlledCutoverDecision}</div>
                    </div>
                    <div className="stat-card danger"><div className="stat-value">{currentCutoverCriticalBlockers}</div><div className="stat-label">{text.criticalBlockers}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{currentCutoverLimitations}</div><div className="stat-label">{text.limitations}</div></div>
                    <div className="stat-card"><div className="stat-value">{currentLimitationsReviewed ? text.yes : text.no}</div><div className="stat-label">{text.limitationsReviewed}</div></div>
                    <div className="stat-card"><div className="stat-value">{currentCutoverChecklistComplete ? text.yes : text.no}</div><div className="stat-label">{text.cutoverChecklistComplete}</div></div>
                  </div>
                  <div className="alert alert-info">
                    <strong>{text.requiredActionsBeforeControlledCutover}: </strong>{cutoverGateSummary.required_actions.join(' ')}<br />
                    <strong>{text.evidenceGateSnapshot}: </strong>
                    {currentCutoverCriticalBlockers > 0 ? 'Critical blockers prevent approval. ' : ''}
                    {currentCutoverLimitations > 0 && !currentLimitationsReviewed ? 'Limitation review required. ' : ''}
                    {!currentCutoverChecklistComplete ? 'Cutover checklist incomplete.' : 'Checklist gate is ready for review.'}
                  </div>
                  <label style={{ display: 'grid', gap: '6px', marginBottom: '12px' }}>
                    <span style={{ fontWeight: 700 }}>{text.decisionRationale}</span>
                    <textarea
                      className="text-input"
                      value={cutoverRationale}
                      onChange={event => setCutoverRationale(event.target.value)}
                      rows={3}
                      placeholder={text.decisionRationalePlaceholder}
                    />
                  </label>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
                    <button className="secondary-action" type="button" disabled={cutoverBusy} onClick={() => void recordCutoverDecision('executive_review_required')}>
                      {text.recordExecutiveReviewRequired}
                    </button>
                    <button className="secondary-action" type="button" disabled={cutoverBusy} onClick={() => void recordCutoverDecision('blocked')}>
                      {text.recordBlockedDecision}
                    </button>
                    <button className="secondary-action" type="button" disabled={cutoverBusy} onClick={() => void recordCutoverDecision('deferred')}>
                      {text.recordDeferredDecision}
                    </button>
                    <button className="secondary-action" type="button" disabled={cutoverBusy || !approvedGateAvailable} onClick={() => void recordCutoverDecision('approved_for_controlled_pilot_cutover')}>
                      {text.recordApprovedControlledPilotCutover}
                    </button>
                    <button className="secondary-action" type="button" disabled={cutoverBusy || !limitationGateAvailable} onClick={() => void recordCutoverDecision('approved_with_limitations')}>
                      {text.recordApprovedWithLimitations}
                    </button>
                  </div>
                  {cutoverMessage ? <div className="alert alert-info">{cutoverMessage}</div> : null}
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead><tr><th>{text.review}</th><th>{text.status}</th><th>{text.notes}</th><th>{text.decidedAt}</th></tr></thead>
                      <tbody>
                        {(cutoverDecisions.data || []).slice(0, 10).map((row: any) => (
                          <tr key={row.id}>
                            <td><strong>{row.decision_title}</strong></td>
                            <td><StatusPill tone={row.decision_state === 'approved_for_controlled_pilot_cutover' ? 'good' : row.decision_state === 'approved_with_limitations' ? 'warning' : row.decision_state === 'blocked' ? 'danger' : 'neutral'}>{row.decision_state}</StatusPill></td>
                            <td>{row.decision_summary || row.decision_rationale}</td>
                            <td>{row.decided_at ? new Date(row.decided_at).toLocaleString() : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="alert alert-info" style={{ marginTop: '14px' }}>
                    <strong>{text.decisionHistory}: </strong>
                    {(cutoverEvents.data || []).length
                      ? (cutoverEvents.data || []).slice(0, 5).map((event: any) => event.event_summary).join(' ')
                      : text.noDecisionHistory}
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

              <ModernCard title={text.hospitalOperationsTitle} subtitle={text.hospitalOperationsSubtitle}>
                <DataState loading={hospitalOperations.loading} error={hospitalOperations.error} empty={!hospitalOperations.data}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '14px', marginBottom: '20px' }}>
                    <div className="stat-card">
                      <div className="stat-value">
                        <StatusPill tone={
                          hospitalOperationsData.hospital_operations_readiness_status === 'ready' ? 'good' :
                          hospitalOperationsData.hospital_operations_readiness_status === 'ready_with_limitations' || hospitalOperationsData.hospital_operations_readiness_status === 'in_progress' ? 'warning' :
                          hospitalOperationsData.hospital_operations_readiness_status === 'blocked' ? 'danger' : 'neutral'
                        }>
                          {hospitalOperationsData.hospital_operations_readiness_status}
                        </StatusPill>
                      </div>
                      <div className="stat-label">{text.hospitalReadiness}</div>
                    </div>
                    <div className="stat-card"><div className="stat-value">{hospitalOperationsData.total_department_launch_packs}</div><div className="stat-label">{text.departmentLaunchPacks}</div></div>
                    <div className="stat-card success"><div className="stat-value">{hospitalOperationsData.ready_departments}</div><div className="stat-label">{text.readyDepartments}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{hospitalOperationsData.ready_with_limitations_departments}</div><div className="stat-label">{text.limitedDepartments}</div></div>
                    <div className="stat-card danger"><div className="stat-value">{hospitalOperationsData.blocked_departments}</div><div className="stat-label">{text.blockedDepartments}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{hospitalOperationsData.evidence_required_departments}</div><div className="stat-label">{text.evidenceRequiredDepartments}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{hospitalOperationsData.incomplete_launch_checklist_items}</div><div className="stat-label">{text.incompleteChecklist}</div></div>
                    <div className="stat-card danger"><div className="stat-value">{hospitalOperationsData.missing_owner_count}</div><div className="stat-label">{text.missingOwners}</div></div>
                    <div className="stat-card danger"><div className="stat-value">{hospitalOperationsData.support_readiness_blockers}</div><div className="stat-label">{text.supportBlockers}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{hospitalOperationsData.policy_attestation_gaps}</div><div className="stat-label">{text.policyGaps}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{hospitalOperationsData.low_adoption_departments}</div><div className="stat-label">{text.lowAdoption}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{hospitalOperationsData.inactive_users}</div><div className="stat-label">{text.inactiveUsers}</div></div>
                    <div className="stat-card warning"><div className="stat-value">{hospitalOperationsData.training_incomplete_count}</div><div className="stat-label">{text.trainingIncomplete}</div></div>
                    <div className="stat-card danger"><div className="stat-value">{hospitalOperationsData.failed_workflow_attempt_count}</div><div className="stat-label">{text.failedWorkflowAttempts}</div></div>
                    <div className="stat-card danger"><div className="stat-value">{hospitalOperationsData.critical_support_issues}</div><div className="stat-label">{text.criticalSupportIssues}</div></div>
                  </div>
                  <div className="alert alert-info">
                    <strong>{text.nextActionRequired}: </strong>{hospitalOperationsData.next_action_required}
                  </div>
                </DataState>
              </ModernCard>

              <ModernCard title={text.hospitalBlockersTitle} subtitle={text.hospitalBlockersSubtitle}>
                <DataState loading={hospitalBlockers.loading} error={hospitalBlockers.error} empty={!hospitalBlockers.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead><tr><th>{text.department}</th><th>{text.area}</th><th>{text.blockerReason}</th><th>{text.evidence}</th></tr></thead>
                      <tbody>
                        {(hospitalBlockers.data || []).slice(0, 60).map((row: any, index: number) => (
                          <tr key={`${row.department_name}-${row.blocker_type}-${index}`}>
                            <td><strong>{row.department_name || '-'}</strong></td>
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

              <ModernCard title={text.departmentLaunchRegisterTitle} subtitle={text.departmentLaunchRegisterSubtitle}>
                <DataState loading={hospitalLaunchPacks.loading} error={hospitalLaunchPacks.error} empty={!hospitalLaunchPacks.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead><tr><th>{text.department}</th><th>{text.status}</th><th>{text.owner}</th><th>{text.support}</th><th>{text.evidence}</th></tr></thead>
                      <tbody>
                        {(hospitalLaunchPacks.data || []).slice(0, 60).map((row: any) => (
                          <tr key={row.id}>
                            <td><strong>{row.department_name || row.launch_label}</strong></td>
                            <td><StatusPill tone={row.launch_status === 'ready' ? 'good' : row.launch_status === 'ready_with_limitations' ? 'warning' : row.launch_status === 'blocked' ? 'danger' : 'neutral'}>{row.launch_status}</StatusPill></td>
                            <td>{row.department_owner_user_id ? text.assigned : text.evidenceRequired}</td>
                            <td>{row.support_owner_user_id ? text.assigned : text.evidenceRequired}</td>
                            <td><code>{row.evidence_reference || '-'}</code></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <ModernCard title={text.launchChecklistTitle} subtitle={text.launchChecklistSubtitle}>
                  <DataState loading={hospitalChecklist.loading} error={hospitalChecklist.error} empty={!hospitalChecklist.data?.length}>
                    <div className="table-wrap">
                      <table className="entity-table">
                        <thead><tr><th>{text.department}</th><th>{text.checklist}</th><th>{text.status}</th><th>{text.evidence}</th></tr></thead>
                        <tbody>
                          {(hospitalChecklist.data || []).slice(0, 40).map((row: any) => (
                            <tr key={row.id}>
                              <td>{row.department_name || '-'}</td>
                              <td><strong>{row.checklist_key}</strong></td>
                              <td><StatusPill tone={row.checklist_status === 'complete' || row.checklist_status === 'not_applicable' ? 'good' : row.checklist_status === 'blocked' ? 'danger' : 'warning'}>{row.checklist_status}</StatusPill></td>
                              <td><code>{row.evidence_reference || '-'}</code></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </DataState>
                </ModernCard>

                <ModernCard title={text.supportReadinessTitle} subtitle={text.supportReadinessSubtitle}>
                  <DataState loading={hospitalSupport.loading} error={hospitalSupport.error} empty={!hospitalSupport.data?.length}>
                    <div className="table-wrap">
                      <table className="entity-table">
                        <thead><tr><th>{text.department}</th><th>{text.status}</th><th>{text.slaTier}</th><th>{text.criticalSupportIssues}</th></tr></thead>
                        <tbody>
                          {(hospitalSupport.data || []).slice(0, 40).map((row: any) => (
                            <tr key={row.id}>
                              <td>{row.department_name || '-'}</td>
                              <td><StatusPill tone={row.support_status === 'ready' ? 'good' : row.support_status === 'blocked' || row.critical_support_issue_count > 0 ? 'danger' : 'warning'}>{row.support_status}</StatusPill></td>
                              <td>{row.sla_tier || '-'}</td>
                              <td>{row.critical_support_issue_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </DataState>
                </ModernCard>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <ModernCard title={text.policyAttestationTitle} subtitle={text.policyAttestationSubtitle}>
                  <DataState loading={hospitalPolicy.loading} error={hospitalPolicy.error} empty={!hospitalPolicy.data?.length}>
                    <div className="table-wrap">
                      <table className="entity-table">
                        <thead><tr><th>{text.department}</th><th>{text.policy}</th><th>{text.status}</th><th>{text.completed}</th></tr></thead>
                        <tbody>
                          {(hospitalPolicy.data || []).slice(0, 40).map((row: any) => (
                            <tr key={row.id}>
                              <td>{row.department_name || '-'}</td>
                              <td><strong>{row.policy_title}</strong></td>
                              <td><StatusPill tone={row.attestation_status === 'attested' || row.attestation_status === 'waived' ? 'good' : row.attestation_status === 'blocked' || row.attestation_status === 'overdue' ? 'danger' : 'warning'}>{row.attestation_status}</StatusPill></td>
                              <td>{row.completed_attestation_count} / {row.required_attestation_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </DataState>
                </ModernCard>

                <ModernCard title={text.adoptionReadinessTitle} subtitle={text.adoptionReadinessSubtitle}>
                  <DataState loading={hospitalAdoption.loading} error={hospitalAdoption.error} empty={!hospitalAdoption.data?.length}>
                    <div className="table-wrap">
                      <table className="entity-table">
                        <thead><tr><th>{text.department}</th><th>{text.adoption}</th><th>{text.inactiveUsers}</th><th>{text.trainingIncomplete}</th><th>{text.failedWorkflowAttempts}</th></tr></thead>
                        <tbody>
                          {(hospitalAdoption.data || []).slice(0, 40).map((row: any) => (
                            <tr key={row.id}>
                              <td>{row.department_name || '-'}</td>
                              <td><StatusPill tone={row.adoption_status === 'on_track' ? 'good' : row.adoption_status === 'low_adoption' || row.adoption_status === 'blocked' ? 'danger' : 'warning'}>{row.adoption_status}</StatusPill></td>
                              <td>{row.inactive_user_count}</td>
                              <td>{row.training_incomplete_count}</td>
                              <td>{row.failed_workflow_attempt_count}</td>
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
  livePilotBurndownTitle: 'Live Pilot Execution and Issue Burn-Down',
  livePilotBurndownSubtitle: 'Pilot session, department pilot participation, issue burn-down, retest evidence, department pilot acceptance, and pilot exit criteria.',
  livePilotExecution: 'Live pilot execution',
  livePilotExecutionSummary: 'Operate pilot sessions, capture issues, review retest evidence, and prepare department acceptance without approving production launch.',
  pilotIssueBurndown: 'Pilot issue burn-down',
  pilotReadinessCaveat: 'Pilot readiness does not approve production launch.',
  controlledAuthorityCaveat: 'Controlled production authority remains separate.',
  pilotExitCriteria: 'Pilot exit criteria',
  pilotSessions: 'Pilot sessions',
  departmentPilotParticipation: 'Department pilot participation',
  retestEvidenceRequired: 'Retest evidence required',
  openIssues: 'Open issues',
  retestRequiredIssues: 'Retest required',
  closedIssues: 'Closed issues',
  departmentPilotAcceptance: 'Department pilot acceptance',
  requiredActionsBeforePilotExit: 'Required actions before pilot exit review',
  pilotSessionTitle: 'Pilot session title',
  pilotSessionTitlePlaceholder: 'Enter the live pilot session title',
  createPilotSession: 'Create pilot session',
  markIssueBurndown: 'Mark issue burn-down',
  markPilotExitReviewRequired: 'Pilot exit review required',
  markPilotBlocked: 'Mark pilot blocked',
  pilotIssueTitle: 'Pilot issue title',
  pilotIssueTitlePlaceholder: 'Record the live pilot issue',
  recordPilotIssue: 'Record pilot issue',
  recordDepartmentAcceptedWithLimitations: 'Record department accepted with limitations',
  recordDepartmentAccepted: 'Record department accepted',
  recordDepartmentBlocked: 'Record department blocked',
  requestRetest: 'Request retest',
  closeAfterRetest: 'Close after retest',
  acceptAsLimitation: 'Accept as limitation',
  noPilotIssuesRecorded: 'No pilot issues have been recorded.',
  pilotSessionTitleRequired: 'Pilot session title is required.',
  pilotSessionCreated: 'Pilot session recorded.',
  pilotSessionRequired: 'Create or select a pilot session first.',
  pilotIssueTitleRequired: 'Pilot issue title is required.',
  pilotIssueRecorded: 'Pilot issue recorded.',
  pilotSessionUpdated: 'Pilot session status updated.',
  pilotIssueClosureSummary: 'Issue closed after retest evidence review.',
  pilotIssueUpdated: 'Pilot issue status updated.',
  pilotDepartmentRequired: 'Pilot department is required before recording department acceptance.',
  pilotAcceptanceRecorded: 'Department pilot acceptance recorded.',
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
  identityIntegrityTitle: 'Identity, Role, and Data Integrity',
  identityIntegritySubtitle: 'Access integrity review, privileged role recertification, dormant/inactive account review, department accountability, and IT/security export readiness.',
  accessIntegrityReview: 'Access integrity review',
  privilegedRoleRecertification: 'Privileged role recertification',
  dormantAccountReview: 'Dormant account review',
  inactiveAccountReview: 'Inactive account review',
  archivedUserAccessReview: 'Archived user access review',
  roleDuplicationReview: 'Role duplication review required',
  departmentOwnerAccountability: 'Department owner accountability',
  stationAccountability: 'Station accountability',
  missingOwnerReviewerRepair: 'Missing owner/reviewer repair required',
  ssoMfaReadinessChecklist: 'SSO/MFA readiness checklist',
  accessExportItSecurityReview: 'Access export for IT/security review',
  openHighRiskFindings: 'Open high-risk findings',
  requiredActionsBeforeAccessIntegrityReview: 'Required actions before access integrity review',
  accessIntegrityCaveat: 'Access integrity review does not approve production launch.',
  identityReviewTitleLabel: 'Access integrity review title',
  identityReviewTitlePlaceholder: 'Record the access integrity review title',
  createAccessIntegrityReview: 'Create access integrity review',
  markReviewRemediationRequired: 'Mark remediation required',
  markReviewBlocked: 'Mark review blocked',
  markReadyForAccessIntegrityReview: 'Mark ready for access integrity review',
  identityFindingTitleLabel: 'Identity, role, or data finding',
  identityFindingTitlePlaceholder: 'Record the access or data integrity finding',
  findingType: 'Finding type',
  duplicateRole: 'Duplicate role',
  privilegedRoleReview: 'Privileged role review',
  missingOwner: 'Missing owner',
  missingReviewer: 'Missing reviewer',
  dataIntegrityGap: 'Data integrity gap',
  recordIdentityFinding: 'Record identity finding',
  userIdForReview: 'User ID for review',
  userIdForReviewPlaceholder: 'Paste user ID for recertification evidence',
  roleNameForReview: 'Role name for review',
  roleNameForReviewPlaceholder: 'Example: governance_admin',
  recordRecertificationPending: 'Record recertification pending',
  recordRecertified: 'Record recertified',
  markFindingInProgress: 'Mark finding in progress',
  markFindingResolved: 'Mark finding resolved',
  markFindingAcceptedLimitation: 'Mark finding accepted limitation',
  finding: 'Finding',
  noIdentityFindingsRecorded: 'No identity, role, or data integrity findings have been recorded.',
  identityReviewTitleRequired: 'Access integrity review title is required.',
  identityReviewDefaultNote: 'Access integrity review opened for governance, IT, and security follow-up.',
  identityReviewCreated: 'Access integrity review recorded.',
  identityReviewRequired: 'Create or select an access integrity review first.',
  identityReviewUpdated: 'Access integrity review status updated.',
  identityFindingTitleRequired: 'Finding title is required.',
  identityFindingDefaultSummary: 'Integrity finding remains open for governance review.',
  identityFindingRecorded: 'Identity, role, or data integrity finding recorded.',
  identityFindingRequired: 'Record or select an integrity finding first.',
  identityFindingUpdated: 'Identity integrity finding status updated.',
  identityRecertificationRequired: 'User ID and role name are required for privileged role recertification.',
  privilegedRoleRecertificationRationale: 'Privileged role recertification reviewed and rationale recorded.',
  privilegedRoleRecertificationNote: 'Privileged role recertification evidence recorded for review.',
  identityRecertificationRecorded: 'Privileged role recertification evidence recorded.',
  integrityFindingsRemainOpen: 'Integrity findings remain open until evidence is reviewed.',
  productionOperationsGovernanceTitle: 'Production Operations Governance',
  productionOperationsGovernanceSubtitle: 'Hypercare command center, 30/60/90 operating view, executive monthly governance report, accreditation/evidence pack tracking, and board closure pack readiness.',
  hypercareCommandCenter: 'Hypercare command center',
  day30OperatingView: '30/60/90 operating view - day 30',
  day60OperatingView: '30/60/90 operating view - day 60',
  day90OperatingView: '30/60/90 operating view - day 90',
  supportIncidentTrendSummary: 'Support and incident trend summary',
  openSupportIssues: 'Open support issues',
  departmentLaunchHealth: 'Department launch health',
  knownLimitationsRegister: 'Known limitations register',
  postCutoverCorrectiveActionQueue: 'Post-cutover corrective action queue',
  executiveMonthlyGovernanceReport: 'Executive monthly governance report',
  accreditationEvidencePackTracking: 'Accreditation/evidence pack tracking',
  drSupportAccessTrainingEvidence: 'DR/support/access/training evidence summary',
  boardClosurePack: 'Board closure pack',
  requiredActionsBeforeHypercareExitReview: 'Required actions before hypercare exit review',
  requiredActionsBeforeBoardReview: 'Required actions before board review',
  boardClosureCaveat: 'Board closure does not approve production launch.',
  liveTransitionCaveat: 'Live transition requires separate operational execution.',
  realExecutionEvidenceRequired: 'Real hospital execution evidence is still required.',
  operationalReadinessEvidenceIncomplete: 'Operational readiness evidence incomplete.',
  hypercareWindowTitleLabel: 'Hypercare command center title',
  hypercareWindowTitlePlaceholder: 'Record the hypercare command center title',
  createHypercareWindow: 'Create hypercare window',
  markHypercareBlocked: 'Mark hypercare blocked',
  markHypercareDeferred: 'Mark hypercare deferred',
  markHypercareExitReviewRequired: 'Mark hypercare exit review required',
  operationsItemTitleLabel: 'Operations governance item',
  operationsItemTitlePlaceholder: 'Record support, incident, evidence, or board pack item',
  itemType: 'Item type',
  supportIssue: 'Support issue',
  incidentTrend: 'Incident trend',
  trainingGap: 'Training gap',
  drRestoreGap: 'DR restore gap',
  accessReviewGap: 'Access review gap',
  recordHypercareItem: 'Record hypercare item',
  boardPackTitleLabel: 'Board closure pack title',
  boardPackTitlePlaceholder: 'Record the board closure pack title',
  reportingPeriod: 'Reporting period',
  reportingPeriodPlaceholder: 'Example: 2026-07',
  createBoardPack: 'Create board pack',
  markBoardReviewRequired: 'Mark board review required',
  markReadyForBoardReview: 'Mark ready for board review',
  markItemInProgress: 'Mark item in progress',
  markItemReviewRequired: 'Mark item review required',
  markItemClosed: 'Mark item closed',
  item: 'Item',
  noOperationsItemsRecorded: 'No production operations governance items have been recorded.',
  hypercareTitleRequired: 'Hypercare command center title is required.',
  operationsDefaultNote: 'Production operations governance opened for hypercare and board review tracking.',
  hypercareWindowCreated: 'Hypercare command center recorded.',
  hypercareWindowRequired: 'Create or select a hypercare command center first.',
  hypercareWindowUpdated: 'Hypercare command center status updated.',
  operationsItemTitleRequired: 'Operations governance item title is required.',
  operationsItemDefaultSummary: 'Operational governance item remains open for review.',
  operationsItemRecorded: 'Production operations governance item recorded.',
  operationsItemRequired: 'Record or select a production operations governance item first.',
  operationsItemClosureSummary: 'Operations governance item reviewed for hypercare and board pack readiness.',
  operationsItemUpdated: 'Production operations governance item status updated.',
  boardPackRequired: 'Board closure pack title and reporting period are required.',
  boardPackCreated: 'Executive monthly governance report and board closure pack recorded.',
  boardPackSelectRequired: 'Create or select a board closure pack first.',
  boardPackUpdated: 'Board closure pack status updated.',
  controlledProductionAuthorityTitle: 'Controlled Production Authority',
  controlledProductionAuthoritySubtitle: 'Controlled cutover decision record with executive review, blocker checks, limitation review, and checklist gates.',
  controlledProductionAuthority: 'Controlled production authority',
  controlledCutoverDecision: 'Controlled cutover decision',
  criticalBlockers: 'Critical blockers',
  limitations: 'Limitations',
  limitationsReviewed: 'Limitations reviewed',
  cutoverChecklistComplete: 'Cutover checklist complete',
  requiredActionsBeforeControlledCutover: 'Required actions before controlled cutover decision',
  evidenceGateSnapshot: 'Evidence gate snapshot',
  decisionRationale: 'Decision rationale',
  decisionRationalePlaceholder: 'Record the rationale for this controlled decision.',
  recordExecutiveReviewRequired: 'Record executive review required decision',
  recordBlockedDecision: 'Record blocked decision',
  recordDeferredDecision: 'Record deferred decision',
  recordApprovedControlledPilotCutover: 'Record approved for controlled pilot cutover decision',
  recordApprovedWithLimitations: 'Record approved with limitations',
  decisionHistory: 'Decision history',
  noDecisionHistory: 'No decision history has been recorded.',
  decidedAt: 'Decided at',
  caveat: 'Caveat',
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
  hospitalOperationsTitle: 'Hospital Operations Readiness Pack',
  hospitalOperationsSubtitle: 'Department launch packs, support readiness, policy attestation, adoption health, and remaining launch blockers.',
  hospitalReadiness: 'Hospital Readiness',
  departmentLaunchPacks: 'Launch Packs',
  readyDepartments: 'Ready Departments',
  limitedDepartments: 'Limited Departments',
  blockedDepartments: 'Blocked Departments',
  evidenceRequiredDepartments: 'Evidence Required',
  incompleteChecklist: 'Incomplete Checklist',
  missingOwners: 'Missing Owners',
  supportBlockers: 'Support Blockers',
  policyGaps: 'Policy Gaps',
  inactiveUsers: 'Inactive Users',
  trainingIncomplete: 'Training Incomplete',
  failedWorkflowAttempts: 'Workflow Attempts',
  criticalSupportIssues: 'Critical Support',
  hospitalBlockersTitle: 'Hospital Launch Blockers',
  hospitalBlockersSubtitle: 'Department, support, policy, adoption, training, user, and workflow gaps that must be cleared before broader hospital launch.',
  departmentLaunchRegisterTitle: 'Department Launch Pack Register',
  departmentLaunchRegisterSubtitle: 'Department owner, support owner, evidence, status, and launch readiness by department.',
  launchChecklistTitle: 'Launch Checklist',
  launchChecklistSubtitle: 'Go-live checklist items, evidence references, ownership, and completion status.',
  checklist: 'Checklist',
  supportReadinessTitle: 'Support Readiness',
  supportReadinessSubtitle: 'Department support owner, escalation path, SLA tier, and open critical support issues.',
  slaTier: 'SLA Tier',
  policyAttestationTitle: 'Policy and SOP Attestation',
  policyAttestationSubtitle: 'Required policy/SOP acknowledgments and department attestation completion.',
  policy: 'Policy / SOP',
  completed: 'Completed',
  adoptionReadinessTitle: 'Adoption Readiness',
  adoptionReadinessSubtitle: 'Department adoption status, inactive users, training gaps, and failed workflow attempts.',
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
  livePilotBurndownTitle: 'تنفيذ التشغيل التجريبي وحرق المشكلات',
  livePilotBurndownSubtitle: 'جلسة التشغيل التجريبي، ومشاركة الأقسام، وحرق المشكلات، وأدلة إعادة الاختبار، وقبول القسم، ومعايير الخروج.',
  livePilotExecution: 'تنفيذ التشغيل التجريبي الفعلي',
  livePilotExecutionSummary: 'تشغيل جلسات التجربة، وتسجيل المشكلات، ومراجعة أدلة إعادة الاختبار، وتجهيز قبول الأقسام دون اعتماد الإطلاق الإنتاجي.',
  pilotIssueBurndown: 'حرق مشكلات التشغيل التجريبي',
  pilotReadinessCaveat: 'جاهزية التشغيل التجريبي لا تعتمد الإطلاق الإنتاجي.',
  controlledAuthorityCaveat: 'صلاحية القرار الإنتاجي المنضبط منفصلة.',
  pilotExitCriteria: 'معايير خروج التشغيل التجريبي',
  pilotSessions: 'جلسات التشغيل التجريبي',
  departmentPilotParticipation: 'مشاركة القسم في التشغيل التجريبي',
  retestEvidenceRequired: 'دليل إعادة الاختبار مطلوب',
  openIssues: 'مشكلات مفتوحة',
  retestRequiredIssues: 'إعادة اختبار مطلوبة',
  closedIssues: 'مشكلات مغلقة',
  departmentPilotAcceptance: 'قبول القسم للتشغيل التجريبي',
  requiredActionsBeforePilotExit: 'الإجراءات المطلوبة قبل مراجعة خروج التشغيل التجريبي',
  pilotSessionTitle: 'عنوان جلسة التشغيل التجريبي',
  pilotSessionTitlePlaceholder: 'أدخل عنوان جلسة التشغيل التجريبي الفعلية',
  createPilotSession: 'إنشاء جلسة تشغيل تجريبي',
  markIssueBurndown: 'تحديد حرق المشكلات',
  markPilotExitReviewRequired: 'تحديد أن مراجعة الخروج مطلوبة',
  markPilotBlocked: 'تحديد التشغيل التجريبي كمعطل',
  pilotIssueTitle: 'عنوان مشكلة التشغيل التجريبي',
  pilotIssueTitlePlaceholder: 'سجل مشكلة التشغيل التجريبي الفعلية',
  recordPilotIssue: 'تسجيل مشكلة تشغيل تجريبي',
  recordDepartmentAcceptedWithLimitations: 'تسجيل قبول القسم مع محددات',
  recordDepartmentAccepted: 'تسجيل قبول القسم',
  recordDepartmentBlocked: 'تسجيل تعطل القسم',
  requestRetest: 'طلب إعادة اختبار',
  closeAfterRetest: 'إغلاق بعد إعادة الاختبار',
  acceptAsLimitation: 'قبول كمحدد',
  noPilotIssuesRecorded: 'لم يتم تسجيل مشكلات تشغيل تجريبي.',
  pilotSessionTitleRequired: 'عنوان جلسة التشغيل التجريبي مطلوب.',
  pilotSessionCreated: 'تم تسجيل جلسة التشغيل التجريبي.',
  pilotSessionRequired: 'أنشئ أو اختر جلسة تشغيل تجريبي أولا.',
  pilotIssueTitleRequired: 'عنوان مشكلة التشغيل التجريبي مطلوب.',
  pilotIssueRecorded: 'تم تسجيل مشكلة التشغيل التجريبي.',
  pilotSessionUpdated: 'تم تحديث حالة جلسة التشغيل التجريبي.',
  pilotIssueClosureSummary: 'تم إغلاق المشكلة بعد مراجعة دليل إعادة الاختبار.',
  pilotIssueUpdated: 'تم تحديث حالة مشكلة التشغيل التجريبي.',
  pilotDepartmentRequired: 'القسم مطلوب قبل تسجيل قبول القسم.',
  pilotAcceptanceRecorded: 'تم تسجيل قبول القسم للتشغيل التجريبي.',
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
  identityIntegrityTitle: 'سلامة الهوية والأدوار والبيانات',
  identityIntegritySubtitle: 'مراجعة سلامة الوصول، وإعادة اعتماد الأدوار الحساسة، ومراجعة الحسابات الخاملة وغير النشطة، ومساءلة الأقسام، وجاهزية التصدير لتقنية المعلومات والأمن.',
  accessIntegrityReview: 'مراجعة سلامة الوصول',
  privilegedRoleRecertification: 'إعادة اعتماد الدور الحساس',
  dormantAccountReview: 'مراجعة الحسابات الخاملة',
  inactiveAccountReview: 'مراجعة الحسابات غير النشطة',
  archivedUserAccessReview: 'مراجعة وصول المستخدم المؤرشف',
  roleDuplicationReview: 'مراجعة تكرار الأدوار مطلوبة',
  departmentOwnerAccountability: 'مساءلة مالك القسم',
  stationAccountability: 'مساءلة المحطة',
  missingOwnerReviewerRepair: 'إصلاح المالك/المراجع المفقود مطلوب',
  ssoMfaReadinessChecklist: 'قائمة جاهزية الدخول الموحد والمصادقة المتعددة',
  accessExportItSecurityReview: 'تصدير الوصول لمراجعة تقنية المعلومات والأمن',
  openHighRiskFindings: 'نتائج عالية المخاطر مفتوحة',
  requiredActionsBeforeAccessIntegrityReview: 'الإجراءات المطلوبة قبل مراجعة سلامة الوصول',
  accessIntegrityCaveat: 'مراجعة سلامة الوصول لا تعتمد الإطلاق الإنتاجي.',
  identityReviewTitleLabel: 'عنوان مراجعة سلامة الوصول',
  identityReviewTitlePlaceholder: 'سجل عنوان مراجعة سلامة الوصول',
  createAccessIntegrityReview: 'إنشاء مراجعة سلامة الوصول',
  markReviewRemediationRequired: 'تحديد أن المعالجة مطلوبة',
  markReviewBlocked: 'تحديد المراجعة كمعطلة',
  markReadyForAccessIntegrityReview: 'تحديد الجاهزية لمراجعة سلامة الوصول',
  identityFindingTitleLabel: 'نتيجة هوية أو دور أو بيانات',
  identityFindingTitlePlaceholder: 'سجل نتيجة سلامة الوصول أو البيانات',
  findingType: 'نوع النتيجة',
  duplicateRole: 'دور مكرر',
  privilegedRoleReview: 'مراجعة دور حساس',
  missingOwner: 'مالك مفقود',
  missingReviewer: 'مراجع مفقود',
  dataIntegrityGap: 'فجوة سلامة البيانات',
  recordIdentityFinding: 'تسجيل نتيجة هوية',
  userIdForReview: 'معرف المستخدم للمراجعة',
  userIdForReviewPlaceholder: 'ألصق معرف المستخدم لدليل إعادة الاعتماد',
  roleNameForReview: 'اسم الدور للمراجعة',
  roleNameForReviewPlaceholder: 'مثال: governance_admin',
  recordRecertificationPending: 'تسجيل إعادة اعتماد معلقة',
  recordRecertified: 'تسجيل إعادة الاعتماد',
  markFindingInProgress: 'تحديد النتيجة قيد المعالجة',
  markFindingResolved: 'تحديد النتيجة محلولة',
  markFindingAcceptedLimitation: 'تحديد النتيجة كمحدد مقبول',
  finding: 'النتيجة',
  noIdentityFindingsRecorded: 'لم يتم تسجيل نتائج سلامة الهوية أو الأدوار أو البيانات.',
  identityReviewTitleRequired: 'عنوان مراجعة سلامة الوصول مطلوب.',
  identityReviewDefaultNote: 'تم فتح مراجعة سلامة الوصول لمتابعة الحوكمة وتقنية المعلومات والأمن.',
  identityReviewCreated: 'تم تسجيل مراجعة سلامة الوصول.',
  identityReviewRequired: 'أنشئ أو اختر مراجعة سلامة الوصول أولا.',
  identityReviewUpdated: 'تم تحديث حالة مراجعة سلامة الوصول.',
  identityFindingTitleRequired: 'عنوان النتيجة مطلوب.',
  identityFindingDefaultSummary: 'نتيجة السلامة تبقى مفتوحة لمراجعة الحوكمة.',
  identityFindingRecorded: 'تم تسجيل نتيجة سلامة الهوية أو الدور أو البيانات.',
  identityFindingRequired: 'سجل أو اختر نتيجة سلامة أولا.',
  identityFindingUpdated: 'تم تحديث حالة نتيجة سلامة الهوية.',
  identityRecertificationRequired: 'معرف المستخدم واسم الدور مطلوبان لإعادة اعتماد الدور الحساس.',
  privilegedRoleRecertificationRationale: 'تمت مراجعة إعادة اعتماد الدور الحساس وتسجيل المبرر.',
  privilegedRoleRecertificationNote: 'تم تسجيل دليل إعادة اعتماد الدور الحساس للمراجعة.',
  identityRecertificationRecorded: 'تم تسجيل دليل إعادة اعتماد الدور الحساس.',
  integrityFindingsRemainOpen: 'تبقى نتائج السلامة مفتوحة حتى تتم مراجعة الأدلة.',
  productionOperationsGovernanceTitle: 'حوكمة عمليات التشغيل',
  productionOperationsGovernanceSubtitle: 'مركز قيادة المتابعة، وعرض تشغيل 30/60/90، والتقرير التنفيذي الشهري، وتتبع حزمة الاعتماد/الأدلة، وجاهزية حزمة إغلاق المجلس.',
  hypercareCommandCenter: 'مركز قيادة المتابعة',
  day30OperatingView: 'عرض تشغيل 30/60/90 - يوم 30',
  day60OperatingView: 'عرض تشغيل 30/60/90 - يوم 60',
  day90OperatingView: 'عرض تشغيل 30/60/90 - يوم 90',
  supportIncidentTrendSummary: 'ملخص اتجاهات الدعم والحوادث',
  openSupportIssues: 'مشكلات دعم مفتوحة',
  departmentLaunchHealth: 'صحة إطلاق القسم',
  knownLimitationsRegister: 'سجل المحددات المعروفة',
  postCutoverCorrectiveActionQueue: 'قائمة إجراءات المعالجة بعد التحويل',
  executiveMonthlyGovernanceReport: 'تقرير الحوكمة التنفيذي الشهري',
  accreditationEvidencePackTracking: 'تتبع حزمة الاعتماد/الأدلة',
  drSupportAccessTrainingEvidence: 'ملخص أدلة الاستعادة والدعم والوصول والتدريب',
  boardClosurePack: 'حزمة إغلاق المجلس',
  requiredActionsBeforeHypercareExitReview: 'الإجراءات المطلوبة قبل مراجعة خروج المتابعة',
  requiredActionsBeforeBoardReview: 'الإجراءات المطلوبة قبل مراجعة المجلس',
  boardClosureCaveat: 'إغلاق المجلس لا يعتمد الإطلاق الإنتاجي.',
  liveTransitionCaveat: 'الانتقال للتشغيل الفعلي يتطلب تنفيذا تشغيليا منفصلا.',
  realExecutionEvidenceRequired: 'دليل التنفيذ الفعلي في المستشفى ما زال مطلوبا.',
  operationalReadinessEvidenceIncomplete: 'دليل الجاهزية التشغيلية غير مكتمل.',
  hypercareWindowTitleLabel: 'عنوان مركز قيادة المتابعة',
  hypercareWindowTitlePlaceholder: 'سجل عنوان مركز قيادة المتابعة',
  createHypercareWindow: 'إنشاء نافذة متابعة',
  markHypercareBlocked: 'تحديد المتابعة كمعطلة',
  markHypercareDeferred: 'تحديد المتابعة كمؤجلة',
  markHypercareExitReviewRequired: 'تحديد أن مراجعة خروج المتابعة مطلوبة',
  operationsItemTitleLabel: 'بند حوكمة العمليات',
  operationsItemTitlePlaceholder: 'سجل بند دعم أو حادث أو دليل أو حزمة مجلس',
  itemType: 'نوع البند',
  supportIssue: 'مشكلة دعم',
  incidentTrend: 'اتجاه حادث',
  trainingGap: 'فجوة تدريب',
  drRestoreGap: 'فجوة استعادة كوارث',
  accessReviewGap: 'فجوة مراجعة وصول',
  recordHypercareItem: 'تسجيل بند متابعة',
  boardPackTitleLabel: 'عنوان حزمة إغلاق المجلس',
  boardPackTitlePlaceholder: 'سجل عنوان حزمة إغلاق المجلس',
  reportingPeriod: 'فترة التقرير',
  reportingPeriodPlaceholder: 'مثال: 2026-07',
  createBoardPack: 'إنشاء حزمة مجلس',
  markBoardReviewRequired: 'تحديد أن مراجعة المجلس مطلوبة',
  markReadyForBoardReview: 'تحديد الجاهزية لمراجعة المجلس',
  markItemInProgress: 'تحديد البند قيد المعالجة',
  markItemReviewRequired: 'تحديد أن مراجعة البند مطلوبة',
  markItemClosed: 'تحديد البند مغلق',
  item: 'البند',
  noOperationsItemsRecorded: 'لم يتم تسجيل بنود حوكمة عمليات التشغيل.',
  hypercareTitleRequired: 'عنوان مركز قيادة المتابعة مطلوب.',
  operationsDefaultNote: 'تم فتح حوكمة عمليات التشغيل لتتبع المتابعة ومراجعة المجلس.',
  hypercareWindowCreated: 'تم تسجيل مركز قيادة المتابعة.',
  hypercareWindowRequired: 'أنشئ أو اختر مركز قيادة متابعة أولا.',
  hypercareWindowUpdated: 'تم تحديث حالة مركز قيادة المتابعة.',
  operationsItemTitleRequired: 'عنوان بند حوكمة العمليات مطلوب.',
  operationsItemDefaultSummary: 'يبقى بند حوكمة العمليات مفتوحا للمراجعة.',
  operationsItemRecorded: 'تم تسجيل بند حوكمة عمليات التشغيل.',
  operationsItemRequired: 'سجل أو اختر بند حوكمة عمليات تشغيل أولا.',
  operationsItemClosureSummary: 'تمت مراجعة بند حوكمة العمليات لجاهزية المتابعة وحزمة المجلس.',
  operationsItemUpdated: 'تم تحديث حالة بند حوكمة عمليات التشغيل.',
  boardPackRequired: 'عنوان حزمة إغلاق المجلس وفترة التقرير مطلوبان.',
  boardPackCreated: 'تم تسجيل تقرير الحوكمة التنفيذي الشهري وحزمة إغلاق المجلس.',
  boardPackSelectRequired: 'أنشئ أو اختر حزمة إغلاق مجلس أولا.',
  boardPackUpdated: 'تم تحديث حالة حزمة إغلاق المجلس.',
  controlledProductionAuthorityTitle: 'صلاحية القرار الإنتاجي المنضبط',
  controlledProductionAuthoritySubtitle: 'سجل قرار التحويل المنضبط مع المراجعة التنفيذية، وفحوصات المعوقات، ومراجعة المحددات، وبوابات قائمة التحقق.',
  controlledProductionAuthority: 'صلاحية القرار الإنتاجي المنضبط',
  controlledCutoverDecision: 'قرار التحويل المنضبط',
  criticalBlockers: 'معوقات حرجة',
  limitations: 'محددات',
  limitationsReviewed: 'تمت مراجعة المحددات',
  cutoverChecklistComplete: 'قائمة التحويل مكتملة',
  requiredActionsBeforeControlledCutover: 'الإجراءات المطلوبة قبل قرار التحويل المنضبط',
  evidenceGateSnapshot: 'ملخص بوابة الأدلة',
  decisionRationale: 'مبرر القرار',
  decisionRationalePlaceholder: 'سجل مبرر هذا القرار المنضبط.',
  recordExecutiveReviewRequired: 'تسجيل قرار يتطلب مراجعة تنفيذية',
  recordBlockedDecision: 'تسجيل قرار معطل',
  recordDeferredDecision: 'تسجيل قرار مؤجل',
  recordApprovedControlledPilotCutover: 'تسجيل قرار موافق عليه للتحويل التجريبي المنضبط',
  recordApprovedWithLimitations: 'تسجيل قرار موافق عليه مع محددات',
  decisionHistory: 'سجل القرار',
  noDecisionHistory: 'لم يتم تسجيل سجل قرار بعد.',
  decidedAt: 'تاريخ القرار',
  caveat: 'تنبيه',
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
  hospitalOperationsTitle: 'حزمة جاهزية تشغيل المستشفى',
  hospitalOperationsSubtitle: 'حزم إطلاق الأقسام، وجاهزية الدعم، واعتمادات السياسات، وصحة التبني، ومعوقات الإطلاق المتبقية.',
  hospitalReadiness: 'جاهزية المستشفى',
  departmentLaunchPacks: 'حزم الإطلاق',
  readyDepartments: 'أقسام جاهزة',
  limitedDepartments: 'جاهزة بمحددات',
  blockedDepartments: 'أقسام معطلة',
  evidenceRequiredDepartments: 'الدليل مطلوب',
  incompleteChecklist: 'قائمة غير مكتملة',
  missingOwners: 'مسؤولون ناقصون',
  supportBlockers: 'معوقات الدعم',
  policyGaps: 'فجوات السياسات',
  inactiveUsers: 'مستخدمون غير نشطين',
  trainingIncomplete: 'تدريب غير مكتمل',
  failedWorkflowAttempts: 'محاولات العمل',
  criticalSupportIssues: 'دعم حرج',
  hospitalBlockersTitle: 'معوقات إطلاق المستشفى',
  hospitalBlockersSubtitle: 'فجوات الأقسام والدعم والسياسات والتبني والتدريب والمستخدمين ومسارات العمل التي يجب إغلاقها قبل التوسع.',
  departmentLaunchRegisterTitle: 'سجل حزم إطلاق الأقسام',
  departmentLaunchRegisterSubtitle: 'مسؤول القسم، ومسؤول الدعم، والأدلة، والحالة، وجاهزية الإطلاق لكل قسم.',
  launchChecklistTitle: 'قائمة تحقق الإطلاق',
  launchChecklistSubtitle: 'بنود التحقق قبل التشغيل، ومراجع الأدلة، والملكية، وحالة الإنجاز.',
  checklist: 'قائمة التحقق',
  supportReadinessTitle: 'جاهزية الدعم',
  supportReadinessSubtitle: 'مسؤول الدعم، ومسار التصعيد، ومستوى الخدمة، ومشكلات الدعم الحرجة المفتوحة.',
  slaTier: 'مستوى الخدمة',
  policyAttestationTitle: 'اعتماد السياسات وإجراءات التشغيل',
  policyAttestationSubtitle: 'إقرارات السياسات وإجراءات التشغيل المطلوبة ونسبة اكتمال الاعتماد حسب القسم.',
  policy: 'سياسة / إجراء',
  completed: 'مكتمل',
  adoptionReadinessTitle: 'جاهزية التبني',
  adoptionReadinessSubtitle: 'حالة تبني القسم، والمستخدمون غير النشطين، وفجوات التدريب، ومحاولات العمل الفاشلة.',
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
