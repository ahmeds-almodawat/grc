import { isSupabaseConfigured, supabase } from './supabase';
import { emptyLiveArray, emptyLiveObject } from './liveData';
import { requireServerBridge, invokePrivilegedAction, throwRpcActionError } from './privilegedAction';
import { getRuntimeActionRegistrySummary, runtimeActionRegistry } from './runtimeActionRegistry';

export interface ProductionScorecard {
  goLiveScore: number;
  readinessSignal: 'go' | 'conditional' | 'blocked';
  blockingItems: number;
  warnings: number;
  passedItems: number;
  pendingItems: number;
  modulesReady: number;
  modulesTotal: number;
  supportOwnersReady: number;
  supportOwnersTotal: number;
}

export interface FinalControl {
  id: string;
  controlCode: string;
  controlGroup: string;
  title: string;
  description: string;
  ownerLabel: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'pass' | 'warning' | 'pending' | 'blocked' | 'accepted_risk';
  evidenceRequired: boolean;
  evidenceNote: string;
  goLiveBlocking: boolean;
}

export interface ModuleReadiness {
  id: string;
  moduleKey: string;
  moduleName: string;
  workspaceGroup: string;
  readinessPercent: number;
  status: 'ready' | 'needs_review' | 'blocked' | 'pilot_only';
  remainingWork: string;
  ownerLabel: string;
}

export interface SupportHandover {
  id: string;
  supportArea: string;
  ownerLabel: string;
  backupOwnerLabel: string;
  runbookReady: boolean;
  escalationPathReady: boolean;
  status: 'ready' | 'pending' | 'blocked';
  notes: string;
}

export interface PilotAcceptance {
  id: string;
  pilotArea: string;
  acceptanceOwner: string;
  targetDate: string | null;
  status: 'not_started' | 'in_progress' | 'accepted' | 'rejected' | 'blocked';
  acceptanceNote: string;
}

export interface ProductionFinishData {
  scorecard: ProductionScorecard;
  controls: FinalControl[];
  modules: ModuleReadiness[];
  handover: SupportHandover[];
  pilot: PilotAcceptance[];
}

const liveEmptyControls: FinalControl[] = emptyLiveArray<FinalControl>();

const liveEmptyModules: ModuleReadiness[] = emptyLiveArray<ModuleReadiness>();

const liveEmptyHandover: SupportHandover[] = emptyLiveArray<SupportHandover>();

const liveEmptyPilot: PilotAcceptance[] = emptyLiveArray<PilotAcceptance>();

function computeEmptyScorecard(): ProductionScorecard {
  const blockingItems = liveEmptyControls.filter(c => c.goLiveBlocking && c.status === 'blocked').length;
  const warnings = liveEmptyControls.filter(c => ['warning', 'pending'].includes(c.status)).length;
  const passedItems = liveEmptyControls.filter(c => c.status === 'pass' || c.status === 'accepted_risk').length;
  const pendingItems = liveEmptyControls.filter(c => c.status === 'pending').length;
  const modulesReady = liveEmptyModules.filter(m => m.status === 'ready').length;
  const supportOwnersReady = liveEmptyHandover.filter(h => h.status === 'ready').length;
  const totalSignals = liveEmptyControls.length + liveEmptyModules.length + liveEmptyHandover.length + liveEmptyPilot.length;
  const positiveSignals = passedItems + liveEmptyModules.filter(m => m.status === 'ready' || m.status === 'pilot_only').length + supportOwnersReady + liveEmptyPilot.filter(p => p.status === 'accepted').length;
  const goLiveScore = Math.round((positiveSignals / Math.max(totalSignals, 1)) * 100);
  return {
    goLiveScore,
    readinessSignal: blockingItems ? 'blocked' : warnings ? 'conditional' : 'go',
    blockingItems,
    warnings,
    passedItems,
    pendingItems,
    modulesReady,
    modulesTotal: liveEmptyModules.length,
    supportOwnersReady,
    supportOwnersTotal: liveEmptyHandover.length,
  };
}

function emptyProductionFinishData(): ProductionFinishData {
  return {
    scorecard: computeEmptyScorecard(),
    controls: liveEmptyControls,
    modules: liveEmptyModules,
    handover: liveEmptyHandover,
    pilot: liveEmptyPilot,
  };
}

function mapControl(row: any): FinalControl {
  return {
    id: row.id,
    controlCode: row.control_code,
    controlGroup: row.control_group,
    title: row.title,
    description: row.description ?? '',
    ownerLabel: row.owner_label ?? '—',
    severity: row.severity ?? 'medium',
    status: row.status ?? 'pending',
    evidenceRequired: Boolean(row.evidence_required),
    evidenceNote: row.evidence_note ?? '',
    goLiveBlocking: Boolean(row.go_live_blocking),
  };
}

function mapModule(row: any): ModuleReadiness {
  return {
    id: row.id,
    moduleKey: row.module_key,
    moduleName: row.module_name,
    workspaceGroup: row.workspace_group,
    readinessPercent: Number(row.readiness_percent ?? 0),
    status: row.status ?? 'needs_review',
    remainingWork: row.remaining_work ?? '',
    ownerLabel: row.owner_label ?? '—',
  };
}

function mapHandover(row: any): SupportHandover {
  return {
    id: row.id,
    supportArea: row.support_area,
    ownerLabel: row.owner_label ?? '—',
    backupOwnerLabel: row.backup_owner_label ?? '—',
    runbookReady: Boolean(row.runbook_ready),
    escalationPathReady: Boolean(row.escalation_path_ready),
    status: row.status ?? 'pending',
    notes: row.notes ?? '',
  };
}

function mapPilot(row: any): PilotAcceptance {
  return {
    id: row.id,
    pilotArea: row.pilot_area,
    acceptanceOwner: row.acceptance_owner ?? '—',
    targetDate: row.target_date ?? null,
    status: row.status ?? 'not_started',
    acceptanceNote: row.acceptance_note ?? '',
  };
}

export async function seedProductionFinishDefaults() {
  if (!isSupabaseConfigured || !supabase) return { seeded: false, reason: 'Supabase not configured' };
  return requireServerBridge(
    'Production finish default seeding',
    'seed_v31_finish_fast_defaults',
  );
}

export async function getProductionFinishData(): Promise<ProductionFinishData> {
  if (!isSupabaseConfigured || !supabase) return emptyProductionFinishData();

  try {
    const [scoreRes, controlsRes, modulesRes, handoverRes, pilotRes] = await Promise.all([
      supabase.from('v_v31_go_live_scorecard').select('*').maybeSingle(),
      supabase.from('v_v31_final_controls').select('*').order('go_live_blocking', { ascending: false }).order('severity_rank', { ascending: true }).order('control_code', { ascending: true }),
      supabase.from('v_v31_module_readiness').select('*').order('readiness_percent', { ascending: true }),
      supabase.from('v_v31_support_handover').select('*').order('status_rank', { ascending: true }).order('support_area', { ascending: true }),
      supabase.from('v_v31_pilot_acceptance').select('*').order('status_rank', { ascending: true }).order('pilot_area', { ascending: true }),
    ]);

    if (scoreRes.error || controlsRes.error || modulesRes.error || handoverRes.error || pilotRes.error) {
      console.warn('Production finish data emptyRows:', scoreRes.error || controlsRes.error || modulesRes.error || handoverRes.error || pilotRes.error);
      return emptyProductionFinishData();
    }

    const controls = (controlsRes.data ?? []).map(mapControl);
    const modules = (modulesRes.data ?? []).map(mapModule);
    const handover = (handoverRes.data ?? []).map(mapHandover);
    const pilot = (pilotRes.data ?? []).map(mapPilot);
    const row: any = scoreRes.data ?? {};

    return {
      scorecard: {
        goLiveScore: Number(row.go_live_score ?? computeEmptyScorecard().goLiveScore),
        readinessSignal: row.readiness_signal ?? 'blocked',
        blockingItems: Number(row.blocking_items ?? 0),
        warnings: Number(row.warning_items ?? 0),
        passedItems: Number(row.passed_items ?? 0),
        pendingItems: Number(row.pending_items ?? 0),
        modulesReady: Number(row.modules_ready ?? 0),
        modulesTotal: Number(row.modules_total ?? modules.length),
        supportOwnersReady: Number(row.support_owners_ready ?? 0),
        supportOwnersTotal: Number(row.support_owners_total ?? handover.length),
      },
      controls,
      modules,
      handover,
      pilot,
    };
  } catch (error) {
    console.warn('Production finish data emptyRows:', error);
    return emptyProductionFinishData();
  }
}

const logApiWarning = (label: string, error: unknown) => {
  // eslint-disable-next-line no-console
  console.warn(`[Production Hardening live-data unavailable] ${label}`, error);
};

export async function getProductionReadinessSignoffRegister(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch44_production_readiness_summary')
      .select('*');
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getProductionReadinessSignoffRegister', error);
    return emptyLiveArray();
  }
}

export async function getGoNoGoDashboard(): Promise<any> {
  if (!supabase) return emptyLiveObject('getGoNoGoDashboard');
  try {
    const { data, error } = await supabase
      .from('v_patch44_pilot_go_no_go_dashboard')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || emptyLiveObject('getGoNoGoDashboard');
  } catch (error) {
    logApiWarning('getGoNoGoDashboard', error);
    return emptyLiveObject('getGoNoGoDashboard');
  }
}

export async function getKnownLimitationsRegister(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch44_known_limitations_summary')
      .select('*');
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getKnownLimitationsRegister', error);
    return emptyLiveArray();
  }
}

export async function getBlockingLimitations(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch44_pilot_blocker_register')
      .select('*');
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getBlockingLimitations', error);
    return emptyLiveArray();
  }
}

export async function getBackupRestoreOperationsDashboard(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch44_backup_restore_readiness_summary')
      .select('*');
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getBackupRestoreOperationsDashboard', error);
    return emptyLiveArray();
  }
}

export async function getBilingualReadinessDashboard(): Promise<any> {
  if (!supabase) return emptyLiveObject('getBilingualReadinessDashboard');
  try {
    const { data, error } = await supabase
      .from('v_patch44_bilingual_readiness_summary')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || emptyLiveObject('getBilingualReadinessDashboard');
  } catch (error) {
    logApiWarning('getBilingualReadinessDashboard', error);
    return emptyLiveObject('getBilingualReadinessDashboard');
  }
}

export async function getMissingTranslationRegister(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch40_missing_translation_register')
      .select('*');
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getMissingTranslationRegister', error);
    return emptyLiveArray();
  }
}

export async function getNavigationSimplificationRegister(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch44_navigation_readiness_map')
      .select('*');
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getNavigationSimplificationRegister', error);
    return emptyLiveArray();
  }
}

export async function getRuntimeRpcSignoffDashboard(): Promise<any> {
  if (!supabase) return emptyLiveObject('getRuntimeRpcSignoffDashboard');
  try {
    const { data, error } = await supabase
      .from('v_patch40_runtime_rpc_signoff_dashboard')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || emptyLiveObject('getRuntimeRpcSignoffDashboard');
  } catch (error) {
    logApiWarning('getRuntimeRpcSignoffDashboard', error);
    return emptyLiveObject('getRuntimeRpcSignoffDashboard');
  }
}

export async function getRuntimeActionAuthorizationOverlay(): Promise<any> {
  const registrySummary = getRuntimeActionRegistrySummary();
  if (!supabase) return registrySummary;
  try {
    const { data, error } = await supabase
      .from('v_patch45_production_security_readiness_overlay')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data || Number(data.runtime_action_total ?? 0) === 0) return registrySummary;
    return data;
  } catch (error) {
    logApiWarning('getRuntimeActionAuthorizationOverlay', error);
    return registrySummary;
  }
}

export async function getRuntimeActionReviewRegister(): Promise<any[]> {
  if (!supabase) return runtimeActionRegistry;
  try {
    const { data, error } = await supabase
      .from('v_patch45_runtime_action_register')
      .select('*')
      .order('risk_level', { ascending: true })
      .order('action_name', { ascending: true });
    if (error) throw error;
    if (!data || data.length === 0) return runtimeActionRegistry;
    return data;
  } catch (error) {
    logApiWarning('getRuntimeActionReviewRegister', error);
    return runtimeActionRegistry;
  }
}

export async function getRuntimeDirectBrowserRpcExceptions(): Promise<any[]> {
  const directBrowserEntries = runtimeActionRegistry.filter(action => action.directBrowserException);
  if (!supabase) return directBrowserEntries;
  try {
    const { data, error } = await supabase
      .from('v_patch45_direct_browser_rpc_exception_register')
      .select('*')
      .order('action_name', { ascending: true });
    if (error) throw error;
    if (!data || data.length === 0) return directBrowserEntries;
    return data;
  } catch (error) {
    logApiWarning('getRuntimeDirectBrowserRpcExceptions', error);
    return directBrowserEntries;
  }
}

function getRuntimeAccessReviewStaticRegister() {
  return runtimeActionRegistry.map(action => ({
    action_name: action.actionName,
    action_transport: action.actionTransport,
    module_name: action.moduleName,
    risk_level: action.riskLevel,
    classification: action.classification,
    classification_review_status: action.reviewStatus,
    required_access_level: action.requiredAccessLevel,
    owner_role: action.ownerRole,
    direct_browser_exception: action.directBrowserException,
    signoff_id: null,
    reviewer_role: action.ownerRole,
    reviewer_user_id: null,
    signoff_status: 'pending',
    risk_acceptance_required: action.riskLevel === 'critical' || action.riskLevel === 'high' || action.directBrowserException,
    limitation_summary: null,
    evidence_reference: null,
    due_at: null,
    signed_off_at: null,
    created_at: null,
    is_overdue: false,
    blocker_reason: action.riskLevel === 'critical' || action.riskLevel === 'high'
      ? 'high-risk runtime action pending signoff'
      : 'missing access-review signoff',
  }));
}

function getRuntimeAccessReviewStaticSummary() {
  const register = getRuntimeAccessReviewStaticRegister();
  const pendingHighRisk = register.filter(row => row.signoff_status === 'pending' && ['critical', 'high'].includes(row.risk_level)).length;
  const directBrowserPending = register.filter(row => row.direct_browser_exception && row.signoff_status === 'pending').length;
  return {
    total_runtime_actions: register.length,
    approved_signoffs: 0,
    pending_signoffs: register.length,
    overdue_signoffs: 0,
    rejected_signoffs: 0,
    approved_with_limitation_signoffs: 0,
    direct_browser_rpc_exception_count: register.filter(row => row.direct_browser_exception).length,
    direct_browser_rpc_exception_pending_count: directBrowserPending,
    risk_acceptance_required_count: register.filter(row => row.risk_acceptance_required).length,
    pending_high_risk_signoffs: pendingHighRisk,
    blocker_count: register.filter(row => row.blocker_reason).length,
    access_review_readiness_status: 'pending_review',
    next_action_required: 'Complete pending runtime access review signoffs, starting with critical and high-risk actions.',
  };
}

export async function getRuntimeAccessReviewOverlay(): Promise<any> {
  const staticSummary = getRuntimeAccessReviewStaticSummary();
  if (!supabase) return staticSummary;
  try {
    const { data, error } = await supabase
      .from('v_patch46_production_readiness_access_review_overlay')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data || Number(data.total_runtime_actions ?? 0) === 0) return staticSummary;
    return data;
  } catch (error) {
    logApiWarning('getRuntimeAccessReviewOverlay', error);
    return staticSummary;
  }
}

export async function getRuntimeAccessReviewRegister(): Promise<any[]> {
  const staticRegister = getRuntimeAccessReviewStaticRegister();
  if (!supabase) return staticRegister;
  try {
    const { data, error } = await supabase
      .from('v_patch46_runtime_access_review_register')
      .select('*')
      .order('risk_level', { ascending: true })
      .order('action_name', { ascending: true });
    if (error) throw error;
    if (!data || data.length === 0) return staticRegister;
    return data;
  } catch (error) {
    logApiWarning('getRuntimeAccessReviewRegister', error);
    return staticRegister;
  }
}

export async function getRuntimeAccessReviewBlockers(): Promise<any[]> {
  const staticBlockers = getRuntimeAccessReviewStaticRegister().filter(row => row.blocker_reason);
  if (!supabase) return staticBlockers;
  try {
    const { data, error } = await supabase
      .from('v_patch46_runtime_access_review_blockers')
      .select('*')
      .order('risk_level', { ascending: true })
      .order('action_name', { ascending: true });
    if (error) throw error;
    if (!data || data.length === 0) return staticBlockers;
    return data;
  } catch (error) {
    logApiWarning('getRuntimeAccessReviewBlockers', error);
    return staticBlockers;
  }
}

function getStagingEvidenceRequiredSummary() {
  return {
    evidence_run_count: 0,
    passed_run_count: 0,
    blocked_run_count: 0,
    evidence_required_run_count: 1,
    latest_run_id: null,
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
    run_notes: 'Staging or local-clean migration replay/persona SQL evidence has not been captured in the live evidence register.',
    completed_at: null,
    staging_evidence_readiness_status: 'evidence_required',
    next_action_required: 'Run local-clean or staging migration/persona SQL evidence capture before production readiness signoff.',
  };
}

function getStagingEvidenceRequiredBlockers() {
  return [
    {
      id: 'patch47-evidence-required',
      run_label: 'No staging/local-clean evidence run recorded',
      environment_type: 'local_clean',
      run_status: 'evidence_required',
      failure_count: 0,
      evidence_path: null,
      run_notes: 'No live staging/local-clean evidence run is available.',
      blocker_reason: 'staging migration replay and persona SQL evidence required',
    },
  ];
}

export async function getStagingEvidenceOverlay(): Promise<any> {
  const evidenceRequired = getStagingEvidenceRequiredSummary();
  if (!supabase) return evidenceRequired;
  try {
    const { data, error } = await supabase
      .from('v_patch47_production_readiness_staging_overlay')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data || Number(data.evidence_run_count ?? 0) === 0) return evidenceRequired;
    return data;
  } catch (error) {
    logApiWarning('getStagingEvidenceOverlay', error);
    return evidenceRequired;
  }
}

export async function getStagingEvidenceBlockers(): Promise<any[]> {
  const evidenceRequired = getStagingEvidenceRequiredBlockers();
  if (!supabase) return evidenceRequired;
  try {
    const { data, error } = await supabase
      .from('v_patch47_staging_security_blockers')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (!data || data.length === 0) return evidenceRequired;
    return data;
  } catch (error) {
    logApiWarning('getStagingEvidenceBlockers', error);
    return evidenceRequired;
  }
}

function getPilotActivationEvidenceRequiredSummary() {
  return {
    activation_run_id: null,
    run_label: 'No controlled pilot activation run recorded',
    activation_status: 'planning',
    pilot_scope: 'controlled_internal_pilot',
    departments_in_scope: 0,
    departments_ready: 0,
    departments_blocked: 0,
    missing_department_owners: 0,
    pending_signoffs: 0,
    overdue_signoffs: 0,
    rejected_signoffs: 0,
    approved_with_limitation_signoffs: 0,
    participant_count: 0,
    confirmed_participants: 0,
    training_required_participants: 0,
    blocker_count: 1,
    pilot_readiness_status: 'evidence_required',
    next_action_required: 'Create a controlled pilot activation run, assign department owners, and collect department readiness signoffs.',
  };
}

function getPilotActivationEvidenceRequiredBlockers() {
  return [
    {
      activation_run_id: null,
      department_name: 'Controlled pilot scope',
      blocker_type: 'activation_required',
      blocker_reason: 'controlled pilot activation run and department readiness signoffs required',
      evidence_reference: null,
    },
  ];
}

export async function getPilotActivationOverlay(): Promise<any> {
  const evidenceRequired = getPilotActivationEvidenceRequiredSummary();
  if (!supabase) return evidenceRequired;
  try {
    const { data, error } = await supabase
      .from('v_patch49_production_readiness_pilot_activation_overlay')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data || !data.activation_run_id) return evidenceRequired;
    return data;
  } catch (error) {
    logApiWarning('getPilotActivationOverlay', error);
    return evidenceRequired;
  }
}

export async function getPilotActivationBlockers(): Promise<any[]> {
  const evidenceRequired = getPilotActivationEvidenceRequiredBlockers();
  if (!supabase) return evidenceRequired;
  try {
    const { data, error } = await supabase
      .from('v_patch49_controlled_pilot_blockers')
      .select('*');
    if (error) throw error;
    if (!data || data.length === 0) return evidenceRequired;
    return data;
  } catch (error) {
    logApiWarning('getPilotActivationBlockers', error);
    return evidenceRequired;
  }
}

export async function getPilotDepartmentReadinessRegister(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch49_department_pilot_readiness_register')
      .select('*')
      .order('department_name', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getPilotDepartmentReadinessRegister', error);
    return emptyLiveArray();
  }
}

export async function getPilotDepartmentSignoffRegister(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch49_department_signoff_register')
      .select('*')
      .order('department_name', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getPilotDepartmentSignoffRegister', error);
    return emptyLiveArray();
  }
}

export async function getPilotParticipantCoverage(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch49_pilot_participant_coverage')
      .select('*')
      .order('department_name', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getPilotParticipantCoverage', error);
    return emptyLiveArray();
  }
}

export async function getProofSuiteReadinessSummary(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch40_proof_suite_readiness_summary')
      .select('*');
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getProofSuiteReadinessSummary', error);
    return emptyLiveArray();
  }
}

export async function getControlledPilotReadinessSummary(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch40_controlled_pilot_readiness_summary')
      .select('*');
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getControlledPilotReadinessSummary', error);
    return emptyLiveArray();
  }
}

export async function getExecutiveProductionReadinessSummary(): Promise<any> {
  if (!supabase) return emptyLiveObject('getExecutiveProductionReadinessSummary');
  try {
    const { data, error } = await supabase
      .from('v_patch44_executive_readiness_summary')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || emptyLiveObject('getExecutiveProductionReadinessSummary');
  } catch (error) {
    logApiWarning('getExecutiveProductionReadinessSummary', error);
    return emptyLiveObject('getExecutiveProductionReadinessSummary');
  }
}

// Mutation edge bridge wrappers
export async function createProductionReadinessSignoff(payload: {
  signoff_area: string;
  signoff_status: string;
  notes: string;
  evidence_ref: string | null;
  actor_id: string;
}): Promise<string> {
  try {
    return await invokePrivilegedAction<string>('create_production_readiness_signoff', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Create Signoff', 'create_production_readiness_signoff');
  }
}

export async function updateProductionReadinessSignoffStatus(payload: {
  id: string;
  status: string;
  notes: string;
  actor_id: string;
}): Promise<void> {
  try {
    await invokePrivilegedAction<void>('update_production_readiness_signoff_status', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Update Signoff Status', 'update_production_readiness_signoff_status');
  }
}

export async function createKnownLimitation(payload: {
  title: string;
  description: string | null;
  area: string;
  severity: string;
  mitigation: string | null;
  actor_id: string;
}): Promise<string> {
  try {
    return await invokePrivilegedAction<string>('create_known_limitation', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Create Limitation', 'create_known_limitation');
  }
}

export async function updateKnownLimitationStatus(payload: {
  id: string;
  status: string;
  mitigation: string | null;
  actor_id: string;
}): Promise<void> {
  try {
    await invokePrivilegedAction<void>('update_known_limitation_status', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Update Limitation Status', 'update_known_limitation_status');
  }
}

export async function createBackupRestoreOperation(payload: {
  type: string;
  status: string;
  summary: string;
  evidence: string | null;
  actor_id: string;
}): Promise<string> {
  try {
    return await invokePrivilegedAction<string>('create_backup_restore_operation', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Create Backup Operation', 'create_backup_restore_operation');
  }
}

export async function updateBackupRestoreOperationStatus(payload: {
  id: string;
  status: string;
  summary: string;
  actor_id: string;
}): Promise<void> {
  try {
    await invokePrivilegedAction<void>('update_backup_restore_operation_status', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Update Backup Operation Status', 'update_backup_restore_operation_status');
  }
}

export async function createBilingualReadinessItem(payload: {
  key: string;
  area: string;
  lang: string;
  status: string;
  eng: string | null;
  loc: string | null;
  actor_id: string;
}): Promise<string> {
  try {
    return await invokePrivilegedAction<string>('create_bilingual_readiness_item', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Create Bilingual Item', 'create_bilingual_readiness_item');
  }
}

export async function updateBilingualReadinessStatus(payload: {
  id: string;
  status: string;
  loc: string | null;
  actor_id: string;
}): Promise<void> {
  try {
    await invokePrivilegedAction<void>('update_bilingual_readiness_status', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Update Bilingual Status', 'update_bilingual_readiness_status');
  }
}

export async function createNavigationSimplificationItem(payload: {
  key: string;
  label: string;
  curr: string | null;
  prop: string | null;
  status: string;
  actor_id: string;
}): Promise<string> {
  try {
    return await invokePrivilegedAction<string>('create_navigation_simplification_item', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Create Navigation proposal', 'create_navigation_simplification_item');
  }
}

export async function updateNavigationSimplificationStatus(payload: {
  id: string;
  status: string;
  notes: string | null;
  actor_id: string;
}): Promise<void> {
  try {
    await invokePrivilegedAction<void>('update_navigation_simplification_status', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Update Navigation status', 'update_navigation_simplification_status');
  }
}

export async function createPilotGoNoGoReview(payload: {
  title: string;
  actor_id: string;
}): Promise<string> {
  try {
    return await invokePrivilegedAction<string>('create_pilot_go_no_go_review', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Create Pilot Review', 'create_pilot_go_no_go_review');
  }
}

export async function updatePilotGoNoGoReviewStatus(payload: {
  review_id: string;
  status: string;
  notes: string;
  actor_id: string;
}): Promise<void> {
  try {
    await invokePrivilegedAction<void>('update_pilot_go_no_go_review_status', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Update Pilot Review Status', 'update_pilot_go_no_go_review_status');
  }
}

export async function recordPilotGoNoGoEvent(payload: {
  review_id: string;
  event_type: string;
  event_summary: string;
  actor_id: string;
}): Promise<void> {
  try {
    await invokePrivilegedAction<void>('record_pilot_go_no_go_event', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Record Pilot Event', 'record_pilot_go_no_go_event');
  }
}


