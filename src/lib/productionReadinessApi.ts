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

export type ControlledProductionCutoverDecisionState =
  | 'executive_review_required'
  | 'blocked'
  | 'deferred'
  | 'approved_for_controlled_pilot_cutover'
  | 'approved_with_limitations';

export interface ControlledProductionCutoverDecision {
  id: string;
  organization_id: string | null;
  decision_state: ControlledProductionCutoverDecisionState;
  decision_scope: string;
  decision_title: string;
  decision_summary: string | null;
  critical_blockers_count: number;
  limitations_count: number;
  limitations_reviewed: boolean;
  cutover_checklist_complete: boolean;
  evidence_gate_snapshot: Record<string, unknown>;
  decision_rationale: string;
  decided_by: string | null;
  decided_at: string;
  created_at: string;
  updated_at: string;
}

export interface ControlledProductionCutoverDecisionEvent {
  id: string;
  decision_id: string | null;
  organization_id: string | null;
  event_type: string;
  event_summary: string;
  event_payload: Record<string, unknown>;
  actor_id: string | null;
  created_at: string;
}

export interface ControlledProductionCutoverDecisionRequest {
  decision_state: ControlledProductionCutoverDecisionState;
  decision_title: string;
  decision_summary?: string | null;
  critical_blockers_count: number;
  limitations_count: number;
  limitations_reviewed: boolean;
  cutover_checklist_complete: boolean;
  evidence_gate_snapshot?: Record<string, unknown>;
  decision_rationale: string;
}

export interface ControlledCutoverGateSummary {
  current_state: ControlledProductionCutoverDecisionState;
  critical_blockers_count: number;
  limitations_count: number;
  limitations_reviewed: boolean;
  cutover_checklist_complete: boolean;
  decision_count: number;
  latest_decision_title: string;
  latest_decision_at: string | null;
  required_actions: string[];
  next_action_required: string;
  caveat: string;
  live_transition_caveat: string;
}

export type LivePilotSessionStatus =
  | 'planned'
  | 'active'
  | 'issue_burndown'
  | 'exit_review_required'
  | 'accepted'
  | 'blocked'
  | 'deferred';

export type LivePilotIssueSeverity = 'low' | 'medium' | 'high' | 'critical';
export type LivePilotIssueStatus = 'open' | 'in_progress' | 'retest_required' | 'closed' | 'deferred' | 'accepted_limitation';
export type LivePilotRetestStatus = 'not_started' | 'pending' | 'passed' | 'failed' | 'not_required';
export type LivePilotDepartmentAcceptanceStatus = 'pending' | 'accepted' | 'accepted_with_limitations' | 'blocked' | 'deferred';
export type IdentityRoleIntegrityReviewStatus = 'in_review' | 'remediation_required' | 'ready_for_access_integrity_review' | 'accepted_with_limitations' | 'blocked' | 'deferred';
export type IdentityRoleFindingType =
  | 'duplicate_role'
  | 'privileged_role_review'
  | 'dormant_account'
  | 'inactive_account'
  | 'archived_user_access'
  | 'missing_owner'
  | 'missing_reviewer'
  | 'department_accountability_gap'
  | 'station_accountability_gap'
  | 'sso_mfa_readiness_gap'
  | 'access_export_required'
  | 'data_integrity_gap';
export type IdentityRoleFindingSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IdentityRoleFindingStatus = 'open' | 'in_progress' | 'resolved' | 'accepted_limitation' | 'deferred' | 'blocked';
export type PrivilegedRoleRecertificationStatus = 'pending' | 'recertified' | 'revocation_required' | 'deferred' | 'blocked';
export type SsoMfaReadinessStatus = 'review_required' | 'ready_for_it_review' | 'blocked' | 'not_applicable';
export type AccessExportStatus = 'not_ready' | 'ready_for_export' | 'exported_for_review' | 'blocked';
export type ProductionHypercareStatus = 'planned' | 'active' | 'monitoring' | 'exit_review_required' | 'blocked' | 'deferred' | 'closed_with_limitations';
export type ProductionOperatingDayStatus = 'not_started' | 'in_progress' | 'review_required' | 'accepted' | 'blocked' | 'deferred';
export type ProductionEvidencePackStatus = 'incomplete' | 'collecting' | 'ready_for_review' | 'accepted_with_limitations' | 'blocked';
export type ExecutiveBoardPackStatus = 'draft' | 'review_required' | 'ready_for_board_review' | 'accepted_with_limitations' | 'blocked' | 'deferred';
export type ProductionHypercareItemType =
  | 'support_issue'
  | 'incident_trend'
  | 'department_launch_health'
  | 'known_limitation'
  | 'corrective_action'
  | 'evidence_pack_gap'
  | 'board_pack_gap'
  | 'training_gap'
  | 'dr_restore_gap'
  | 'access_review_gap';
export type ProductionHypercareItemStatus = 'open' | 'in_progress' | 'evidence_required' | 'review_required' | 'closed' | 'accepted_limitation' | 'deferred' | 'blocked';

export interface LivePilotSession {
  id: string;
  organization_id: string | null;
  session_title: string;
  session_scope: string;
  department_id: string | null;
  owner_id: string;
  session_status: LivePilotSessionStatus;
  started_at: string | null;
  completed_at: string | null;
  participant_count: number;
  completed_participant_count: number;
  critical_issue_count: number;
  open_issue_count: number;
  retest_required_count: number;
  acceptance_required: boolean;
  exit_criteria_met: boolean;
  exit_review_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LivePilotIssue {
  id: string;
  organization_id: string | null;
  pilot_session_id: string;
  issue_title: string;
  issue_description: string | null;
  severity: LivePilotIssueSeverity;
  issue_status: LivePilotIssueStatus;
  owner_id: string | null;
  department_id: string | null;
  due_date: string | null;
  retest_required: boolean;
  retest_status: LivePilotRetestStatus;
  retest_evidence_summary: string | null;
  closure_summary: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface LivePilotDepartmentAcceptance {
  id: string;
  organization_id: string | null;
  pilot_session_id: string;
  department_id: string;
  acceptance_status: LivePilotDepartmentAcceptanceStatus;
  accepted_by: string | null;
  accepted_at: string | null;
  acceptance_notes: string | null;
  open_blockers_count: number;
  training_confirmed: boolean;
  issue_burndown_confirmed: boolean;
  created_at: string;
  updated_at: string;
}

export interface IdentityRoleIntegrityReview {
  id: string;
  organization_id: string | null;
  review_title: string;
  review_scope: string;
  review_status: IdentityRoleIntegrityReviewStatus;
  duplicate_role_count: number;
  privileged_user_count: number;
  privileged_pending_recertification_count: number;
  dormant_account_count: number;
  inactive_account_count: number;
  archived_user_access_count: number;
  missing_owner_count: number;
  missing_reviewer_count: number;
  department_accountability_gap_count: number;
  station_accountability_gap_count: number;
  open_high_risk_finding_count: number;
  sso_mfa_readiness_status: SsoMfaReadinessStatus;
  access_export_status: AccessExportStatus;
  review_notes: string | null;
  created_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IdentityRoleIntegrityFinding {
  id: string;
  organization_id: string | null;
  review_id: string;
  finding_type: IdentityRoleFindingType;
  severity: IdentityRoleFindingSeverity;
  entity_type: string;
  entity_id: string | null;
  department_id: string | null;
  finding_title: string;
  finding_summary: string | null;
  owner_id: string | null;
  due_date: string | null;
  finding_status: IdentityRoleFindingStatus;
  resolution_summary: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PrivilegedRoleRecertification {
  id: string;
  organization_id: string | null;
  review_id: string;
  user_id: string;
  role_name: string;
  department_id: string | null;
  recertification_status: PrivilegedRoleRecertificationStatus;
  recertification_rationale: string | null;
  recertified_by: string | null;
  recertified_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface IdentityRoleIntegrityDashboardSummary {
  review_count: number;
  latest_review_title: string;
  access_integrity_review_state: IdentityRoleIntegrityReviewStatus | 'review_required';
  privileged_role_recertification_pending: number;
  dormant_account_review_count: number;
  inactive_account_review_count: number;
  archived_user_access_review_count: number;
  role_duplication_review_count: number;
  department_accountability_gap_count: number;
  station_accountability_gap_count: number;
  missing_owner_reviewer_count: number;
  sso_mfa_readiness_status: SsoMfaReadinessStatus;
  access_export_status: AccessExportStatus;
  open_high_risk_finding_count: number;
  required_actions: string[];
  next_action_required: string;
  caveat: string;
  controlled_authority_caveat: string;
}

export interface ProductionHypercareWindow {
  id: string;
  organization_id: string | null;
  hypercare_title: string;
  hypercare_scope: string;
  hypercare_status: ProductionHypercareStatus;
  day_30_status: ProductionOperatingDayStatus;
  day_60_status: ProductionOperatingDayStatus;
  day_90_status: ProductionOperatingDayStatus;
  open_support_issue_count: number;
  critical_incident_count: number;
  unresolved_limitation_count: number;
  corrective_action_open_count: number;
  department_launch_gap_count: number;
  evidence_pack_status: ProductionEvidencePackStatus;
  board_pack_status: ExecutiveBoardPackStatus;
  hypercare_exit_ready: boolean;
  exit_review_notes: string | null;
  created_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductionHypercareItem {
  id: string;
  organization_id: string | null;
  hypercare_window_id: string;
  item_type: ProductionHypercareItemType;
  severity: IdentityRoleFindingSeverity;
  item_status: ProductionHypercareItemStatus;
  department_id: string | null;
  owner_id: string | null;
  item_title: string;
  item_summary: string | null;
  due_date: string | null;
  evidence_summary: string | null;
  closure_summary: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ExecutiveGovernanceBoardPack {
  id: string;
  organization_id: string | null;
  hypercare_window_id: string | null;
  pack_title: string;
  reporting_period: string;
  pack_status: ExecutiveBoardPackStatus;
  executive_summary: string | null;
  support_trend_summary: string | null;
  incident_trend_summary: string | null;
  department_health_summary: string | null;
  limitation_summary: string | null;
  corrective_action_summary: string | null;
  accreditation_evidence_summary: string | null;
  dr_support_access_training_summary: string | null;
  board_review_notes: string | null;
  prepared_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductionOperationsDashboardSummary {
  hypercare_window_count: number;
  latest_hypercare_title: string;
  hypercare_command_center_status: ProductionHypercareStatus | 'review_required';
  day_30_status: ProductionOperatingDayStatus;
  day_60_status: ProductionOperatingDayStatus;
  day_90_status: ProductionOperatingDayStatus;
  open_support_issue_count: number;
  critical_incident_count: number;
  department_launch_gap_count: number;
  unresolved_limitation_count: number;
  corrective_action_open_count: number;
  evidence_pack_status: ProductionEvidencePackStatus;
  board_pack_status: ExecutiveBoardPackStatus;
  executive_monthly_governance_report_status: ExecutiveBoardPackStatus | 'draft';
  accreditation_evidence_pack_gap_count: number;
  dr_support_access_training_gap_count: number;
  required_actions_before_hypercare_exit: string[];
  required_actions_before_board_review: string[];
  next_action_required: string;
  caveat: string;
  controlled_authority_caveat: string;
  live_transition_caveat: string;
  real_execution_caveat: string;
}

export interface LivePilotIssueBurndownSummary {
  total_issues: number;
  open_issues: number;
  in_progress_issues: number;
  retest_required_issues: number;
  closed_issues: number;
  accepted_limitation_issues: number;
  high_critical_open_issues: number;
  retest_evidence_required: number;
  issue_burndown_state: 'Pilot blockers remain' | 'Retest evidence required' | 'Ready for pilot exit review';
}

export interface LivePilotExitReadinessSummary {
  session_count: number;
  active_sessions: number;
  blocked_or_deferred_sessions: number;
  department_participation_count: number;
  department_acceptance_pending: number;
  department_acceptance_blocked: number;
  department_acceptance_accepted: number;
  pilot_exit_state: 'Pilot exit review required' | 'Pilot blockers remain' | 'Ready for pilot exit review';
  required_actions: string[];
  caveat: string;
  controlled_authority_caveat: string;
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

export async function getExecutiveProductionSignoffs(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('executive_production_signoffs')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getExecutiveProductionSignoffs', error);
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
    latest_run_label: 'No environment evidence run recorded',
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
    run_notes: 'Environment setup, role testing, access-control checks, and recovery evidence have not been captured in the live evidence register.',
    completed_at: null,
    staging_evidence_readiness_status: 'evidence_required',
    next_action_required: 'Capture environment setup, role testing, access-control, and recovery evidence before production readiness signoff.',
  };
}

function getStagingEvidenceRequiredBlockers() {
  return [
    {
      id: 'patch47-evidence-required',
      run_label: 'No environment evidence run recorded',
      environment_type: 'local_clean',
      run_status: 'evidence_required',
      failure_count: 0,
      evidence_path: null,
      run_notes: 'No live environment evidence run is available.',
      blocker_reason: 'environment setup, role testing, and access-control evidence required',
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

function getRealPilotSetupEvidenceRequiredSummary() {
  return {
    activation_run_id: null,
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
    limitation_exception_count: 0,
    launch_blocker_count: 1,
    participant_coverage_percentage: 0,
    setup_readiness_status: 'evidence_required',
    next_action_required: 'Complete real department, owner, participant, role, training, and signoff setup before pilot launch.',
  };
}

function getRealPilotSetupEvidenceRequiredBlockers() {
  return [
    {
      activation_run_id: null,
      department_name: 'Real pilot setup',
      blocker_type: 'setup_evidence_required',
      severity: 'high',
      blocker_summary: 'Real department owners, participant coverage, roles, training confirmation, and signoffs must be verified before launch.',
      evidence_reference: null,
    },
  ];
}

export async function getRealPilotSetupOverlay(): Promise<any> {
  const evidenceRequired = getRealPilotSetupEvidenceRequiredSummary();
  if (!supabase) return evidenceRequired;
  try {
    const { data, error } = await supabase
      .from('v_patch50_production_readiness_real_pilot_setup_overlay')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data || !data.activation_run_id) return evidenceRequired;
    return data;
  } catch (error) {
    logApiWarning('getRealPilotSetupOverlay', error);
    return evidenceRequired;
  }
}

export async function getRealPilotLaunchBlockers(): Promise<any[]> {
  const evidenceRequired = getRealPilotSetupEvidenceRequiredBlockers();
  if (!supabase) return evidenceRequired;
  try {
    const { data, error } = await supabase
      .from('v_patch50_real_pilot_launch_blocker_register')
      .select('*');
    if (error) throw error;
    if (!data || data.length === 0) return evidenceRequired;
    return data;
  } catch (error) {
    logApiWarning('getRealPilotLaunchBlockers', error);
    return evidenceRequired;
  }
}

export async function getRealPilotSetupChecklistRegister(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch50_department_setup_checklist_register')
      .select('*')
      .order('checklist_area', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getRealPilotSetupChecklistRegister', error);
    return emptyLiveArray();
  }
}

export async function getRealPilotParticipantSetupGaps(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch50_pilot_participant_setup_gap_register')
      .select('*')
      .order('department_name', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getRealPilotParticipantSetupGaps', error);
    return emptyLiveArray();
  }
}

export async function getRealPilotTrainingGaps(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch50_pilot_training_gap_register')
      .select('*')
      .order('department_name', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getRealPilotTrainingGaps', error);
    return emptyLiveArray();
  }
}

export async function getRealPilotMasterDataExceptions(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch50_real_pilot_master_data_exception_register')
      .select('*')
      .order('severity', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getRealPilotMasterDataExceptions', error);
    return emptyLiveArray();
  }
}

function getLivePilotExecutionEvidenceRequiredSummary() {
  return {
    critical_workflows_total: 0,
    workflows_completed: 0,
    workflows_passed: 0,
    workflows_passed_with_limitations: 0,
    workflows_failed: 0,
    workflows_blocked: 0,
    workflows_pending: 0,
    missing_evidence_count: 1,
    open_high_critical_issues: 0,
    evidence_needing_review: 0,
    workflow_blocker_count: 1,
    live_execution_readiness_status: 'evidence_required',
    next_action_required: 'Record live workflow walkthroughs and capture evidence before pilot approval.',
  };
}

function getLivePilotExecutionEvidenceRequiredBlockers() {
  return [
    {
      workflow_label: 'Live pilot workflow walkthroughs',
      blocker_area: 'workflow_walkthrough',
      blocker_type: 'evidence_required',
      blocker_summary: 'Critical hospital workflows must be walked through with captured evidence before pilot approval.',
      evidence_reference: null,
    },
  ];
}

export async function getLivePilotExecutionOverlay(): Promise<any> {
  const evidenceRequired = getLivePilotExecutionEvidenceRequiredSummary();
  if (!supabase) return evidenceRequired;
  try {
    const { data, error } = await supabase
      .from('v_patch51_production_readiness_live_pilot_execution_overlay')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data || data.critical_workflows_total === 0) return evidenceRequired;
    return data;
  } catch (error) {
    logApiWarning('getLivePilotExecutionOverlay', error);
    return evidenceRequired;
  }
}

export async function getLivePilotWorkflowBlockers(): Promise<any[]> {
  const evidenceRequired = getLivePilotExecutionEvidenceRequiredBlockers();
  if (!supabase) return evidenceRequired;
  try {
    const { data, error } = await supabase
      .from('v_patch51_workflow_execution_blocker_register')
      .select('*');
    if (error) throw error;
    if (!data || data.length === 0) return evidenceRequired;
    return data;
  } catch (error) {
    logApiWarning('getLivePilotWorkflowBlockers', error);
    return evidenceRequired;
  }
}

export async function getLivePilotPendingWalkthroughs(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch51_pending_workflow_walkthrough_register')
      .select('*')
      .order('workflow_label', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getLivePilotPendingWalkthroughs', error);
    return emptyLiveArray();
  }
}

export async function getLivePilotFailedWalkthroughs(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch51_failed_workflow_walkthrough_register')
      .select('*')
      .order('workflow_label', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getLivePilotFailedWalkthroughs', error);
    return emptyLiveArray();
  }
}

function getPilotClosureEvidenceRequiredSummary() {
  return {
    closure_review_total: 0,
    closure_reviews_in_review: 0,
    closure_reviews_ready_for_decision: 0,
    blocked_or_deferred_closures: 0,
    closure_reviews_approved_with_limitations: 0,
    open_remediation_actions: 0,
    overdue_remediation_actions: 0,
    high_critical_remediation_actions: 0,
    accepted_limitations: 0,
    high_critical_accepted_limitations: 0,
    pending_limitation_reviews: 0,
    expiring_limitations: 0,
    pending_golive_decisions: 0,
    rejected_or_deferred_decisions: 0,
    approved_golive_decisions: 0,
    approved_with_limitations_decisions: 0,
    missing_golive_decisions: 1,
    failed_or_blocked_workflows: 0,
    missing_workflow_evidence_count: 0,
    open_high_critical_live_issues: 0,
    production_golive_readiness_status: 'evidence_required',
    next_action_required: 'Create a pilot closure review and record executive go-live decision evidence.',
  };
}

function getPilotClosureEvidenceRequiredBlockers() {
  return [
    {
      closure_label: 'Pilot closure and go-live decision',
      blocker_area: 'go_live_decision',
      blocker_type: 'evidence_required',
      blocker_summary: 'Pilot closure review and executive go-live decision evidence must be recorded before production launch.',
      evidence_reference: null,
    },
  ];
}

export async function getPilotClosureGoLiveOverlay(): Promise<any> {
  const evidenceRequired = getPilotClosureEvidenceRequiredSummary();
  if (!supabase) return evidenceRequired;
  try {
    const { data, error } = await supabase
      .from('v_patch52_production_readiness_golive_decision_overlay')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data || data.closure_review_total === 0) return evidenceRequired;
    return data;
  } catch (error) {
    logApiWarning('getPilotClosureGoLiveOverlay', error);
    return evidenceRequired;
  }
}

export async function getPilotClosureBlockers(): Promise<any[]> {
  const evidenceRequired = getPilotClosureEvidenceRequiredBlockers();
  if (!supabase) return evidenceRequired;
  try {
    const { data, error } = await supabase
      .from('v_patch52_pilot_closure_blocker_register')
      .select('*');
    if (error) throw error;
    if (!data || data.length === 0) return evidenceRequired;
    return data;
  } catch (error) {
    logApiWarning('getPilotClosureBlockers', error);
    return evidenceRequired;
  }
}

export async function getPilotRemediationActions(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch52_pilot_remediation_action_register')
      .select('*')
      .order('severity', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getPilotRemediationActions', error);
    return emptyLiveArray();
  }
}

export async function getPilotAcceptedLimitations(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch52_accepted_limitation_register')
      .select('*')
      .order('severity', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getPilotAcceptedLimitations', error);
    return emptyLiveArray();
  }
}

export async function getProductionGoLiveDecisions(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch52_production_golive_decision_register')
      .select('*')
      .order('decision_level', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getProductionGoLiveDecisions', error);
    return emptyLiveArray();
  }
}

export async function getControlledProductionCutoverDecisions(): Promise<ControlledProductionCutoverDecision[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('controlled_production_cutover_decisions')
      .select('*')
      .order('decided_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data || []) as ControlledProductionCutoverDecision[];
  } catch (error) {
    logApiWarning('getControlledProductionCutoverDecisions', error);
    return emptyLiveArray();
  }
}

export async function getControlledProductionCutoverDecisionEvents(decisionId?: string | null): Promise<ControlledProductionCutoverDecisionEvent[]> {
  if (!supabase) return emptyLiveArray();
  try {
    let query = supabase
      .from('controlled_production_cutover_decision_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (decisionId) query = query.eq('decision_id', decisionId);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as ControlledProductionCutoverDecisionEvent[];
  } catch (error) {
    logApiWarning('getControlledProductionCutoverDecisionEvents', error);
    return emptyLiveArray();
  }
}

export function getControlledCutoverGateSummary(decisions: ControlledProductionCutoverDecision[] = []): ControlledCutoverGateSummary {
  const latest = decisions[0];
  const currentState = latest?.decision_state ?? 'executive_review_required';
  const criticalBlockers = Number(latest?.critical_blockers_count ?? 0) || 0;
  const limitations = Number(latest?.limitations_count ?? 0) || 0;
  const limitationsReviewed = Boolean(latest?.limitations_reviewed);
  const checklistComplete = Boolean(latest?.cutover_checklist_complete);
  const requiredActions = new Set<string>();

  if (!latest) requiredActions.add('Executive review required.');
  if (criticalBlockers > 0) requiredActions.add('Critical blockers prevent approval.');
  if (limitations > 0 && !limitationsReviewed) requiredActions.add('Limitation review required.');
  if (!checklistComplete) requiredActions.add('Cutover checklist incomplete.');
  if (currentState === 'blocked') requiredActions.add('Resolve blockers or record a deferred decision.');
  if (currentState === 'deferred') requiredActions.add('Review deferred decision conditions before controlled cutover decision.');

  return {
    current_state: currentState,
    critical_blockers_count: criticalBlockers,
    limitations_count: limitations,
    limitations_reviewed: limitationsReviewed,
    cutover_checklist_complete: checklistComplete,
    decision_count: decisions.length,
    latest_decision_title: latest?.decision_title ?? 'Controlled cutover decision evidence has not been recorded.',
    latest_decision_at: latest?.decided_at ?? null,
    required_actions: requiredActions.size ? [...requiredActions] : ['Ready for controlled cutover decision review.'],
    next_action_required: requiredActions.size
      ? [...requiredActions][0]
      : 'Record or review controlled production authority decision evidence.',
    caveat: 'This decision record does not automatically launch the system.',
    live_transition_caveat: 'Live transition requires separate operational execution.',
  };
}

export async function createControlledProductionCutoverDecision(payload: ControlledProductionCutoverDecisionRequest): Promise<{ id: string; decision_state: string; message: string }> {
  try {
    return await invokePrivilegedAction<{ id: string; decision_state: string; message: string }>(
      'create_controlled_production_cutover_decision',
      payload as unknown as Record<string, unknown>,
    );
  } catch (error) {
    return throwRpcActionError(error, 'Create Controlled Cutover Decision', 'create_controlled_production_cutover_decision');
  }
}

export async function recordControlledProductionCutoverDecisionEvent(payload: {
  decision_id: string;
  event_type: string;
  event_summary: string;
  event_payload?: Record<string, unknown>;
}): Promise<{ id: string; message: string }> {
  try {
    return await invokePrivilegedAction<{ id: string; message: string }>(
      'record_controlled_production_cutover_decision_event',
      payload,
    );
  } catch (error) {
    return throwRpcActionError(error, 'Record Controlled Cutover Decision Event', 'record_controlled_production_cutover_decision_event');
  }
}

export async function getLivePilotSessions(): Promise<LivePilotSession[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('live_pilot_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data || []) as LivePilotSession[];
  } catch (error) {
    logApiWarning('getLivePilotSessions', error);
    return emptyLiveArray();
  }
}

export async function getLivePilotIssues(): Promise<LivePilotIssue[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('live_pilot_issues')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data || []) as LivePilotIssue[];
  } catch (error) {
    logApiWarning('getLivePilotIssues', error);
    return emptyLiveArray();
  }
}

export async function getLivePilotDepartmentAcceptances(): Promise<LivePilotDepartmentAcceptance[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('live_pilot_department_acceptances')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data || []) as LivePilotDepartmentAcceptance[];
  } catch (error) {
    logApiWarning('getLivePilotDepartmentAcceptances', error);
    return emptyLiveArray();
  }
}

export function getLivePilotIssueBurndownSummary(issues: LivePilotIssue[] = []): LivePilotIssueBurndownSummary {
  const openIssues = issues.filter(issue => issue.issue_status === 'open').length;
  const inProgressIssues = issues.filter(issue => issue.issue_status === 'in_progress').length;
  const retestRequiredIssues = issues.filter(issue => issue.issue_status === 'retest_required').length;
  const closedIssues = issues.filter(issue => issue.issue_status === 'closed').length;
  const acceptedLimitationIssues = issues.filter(issue => issue.issue_status === 'accepted_limitation').length;
  const highCriticalOpenIssues = issues.filter(issue =>
    ['high', 'critical'].includes(issue.severity)
    && ['open', 'in_progress', 'retest_required'].includes(issue.issue_status)
  ).length;
  const retestEvidenceRequired = issues.filter(issue =>
    issue.retest_required
    && issue.issue_status !== 'closed'
    && !['passed', 'not_required'].includes(issue.retest_status)
  ).length;

  return {
    total_issues: issues.length,
    open_issues: openIssues,
    in_progress_issues: inProgressIssues,
    retest_required_issues: retestRequiredIssues,
    closed_issues: closedIssues,
    accepted_limitation_issues: acceptedLimitationIssues,
    high_critical_open_issues: highCriticalOpenIssues,
    retest_evidence_required: retestEvidenceRequired,
    issue_burndown_state: highCriticalOpenIssues || openIssues || inProgressIssues
      ? 'Pilot blockers remain'
      : retestEvidenceRequired || retestRequiredIssues
        ? 'Retest evidence required'
        : 'Ready for pilot exit review',
  };
}

export function getLivePilotExitReadinessSummary(
  sessions: LivePilotSession[] = [],
  issues: LivePilotIssue[] = [],
  acceptances: LivePilotDepartmentAcceptance[] = [],
): LivePilotExitReadinessSummary {
  const burndown = getLivePilotIssueBurndownSummary(issues);
  const blockedOrDeferredSessions = sessions.filter(session => ['blocked', 'deferred'].includes(session.session_status)).length;
  const activeSessions = sessions.filter(session => ['active', 'issue_burndown', 'exit_review_required'].includes(session.session_status)).length;
  const departmentAcceptancePending = acceptances.filter(row => row.acceptance_status === 'pending').length;
  const departmentAcceptanceBlocked = acceptances.filter(row => row.acceptance_status === 'blocked').length;
  const departmentAcceptanceAccepted = acceptances.filter(row => ['accepted', 'accepted_with_limitations'].includes(row.acceptance_status)).length;
  const requiredActions = new Set<string>();

  if (!sessions.length) requiredActions.add('Create a pilot session.');
  if (blockedOrDeferredSessions > 0 || burndown.high_critical_open_issues > 0) requiredActions.add('Pilot blockers remain.');
  if (burndown.retest_evidence_required > 0) requiredActions.add('Retest evidence required.');
  if (departmentAcceptancePending > 0 || departmentAcceptanceBlocked > 0 || !acceptances.length) requiredActions.add('Department pilot acceptance required.');
  if (sessions.some(session => !session.exit_criteria_met)) requiredActions.add('Pilot exit criteria must be reviewed.');

  return {
    session_count: sessions.length,
    active_sessions: activeSessions,
    blocked_or_deferred_sessions: blockedOrDeferredSessions,
    department_participation_count: acceptances.length,
    department_acceptance_pending: departmentAcceptancePending,
    department_acceptance_blocked: departmentAcceptanceBlocked,
    department_acceptance_accepted: departmentAcceptanceAccepted,
    pilot_exit_state: blockedOrDeferredSessions || burndown.issue_burndown_state === 'Pilot blockers remain'
      ? 'Pilot blockers remain'
      : requiredActions.size
        ? 'Pilot exit review required'
        : 'Ready for pilot exit review',
    required_actions: requiredActions.size ? [...requiredActions] : ['Ready for pilot exit review.'],
    caveat: 'Pilot readiness does not approve production launch.',
    controlled_authority_caveat: 'Controlled production authority remains separate.',
  };
}

export async function createLivePilotSession(payload: {
  session_title: string;
  department_id?: string | null;
  participant_count?: number;
}): Promise<{ id: string; message: string }> {
  try {
    return await invokePrivilegedAction<{ id: string; message: string }>('create_live_pilot_session', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Create Live Pilot Session', 'create_live_pilot_session');
  }
}

export async function updateLivePilotSessionStatus(payload: {
  session_id: string;
  session_status: LivePilotSessionStatus;
  exit_review_notes?: string | null;
  exit_criteria_met?: boolean;
}): Promise<{ id: string; session_status: string; message: string }> {
  try {
    return await invokePrivilegedAction<{ id: string; session_status: string; message: string }>('update_live_pilot_session_status', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Update Live Pilot Session Status', 'update_live_pilot_session_status');
  }
}

export async function createLivePilotIssue(payload: {
  pilot_session_id: string;
  issue_title: string;
  issue_description?: string | null;
  severity?: LivePilotIssueSeverity;
  owner_id?: string | null;
  department_id?: string | null;
  due_date?: string | null;
  retest_required?: boolean;
}): Promise<{ id: string; message: string }> {
  try {
    return await invokePrivilegedAction<{ id: string; message: string }>('create_live_pilot_issue', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Create Live Pilot Issue', 'create_live_pilot_issue');
  }
}

export async function updateLivePilotIssueStatus(payload: {
  issue_id: string;
  issue_status: LivePilotIssueStatus;
  retest_status?: LivePilotRetestStatus | null;
  retest_evidence_summary?: string | null;
  closure_summary?: string | null;
}): Promise<{ id: string; issue_status: string; message: string }> {
  try {
    return await invokePrivilegedAction<{ id: string; issue_status: string; message: string }>('update_live_pilot_issue_status', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Update Live Pilot Issue Status', 'update_live_pilot_issue_status');
  }
}

export async function recordLivePilotDepartmentAcceptance(payload: {
  pilot_session_id: string;
  department_id: string;
  acceptance_status: LivePilotDepartmentAcceptanceStatus;
  acceptance_notes?: string | null;
  open_blockers_count?: number;
  training_confirmed?: boolean;
  issue_burndown_confirmed?: boolean;
}): Promise<{ id: string; acceptance_status: string; message: string }> {
  try {
    return await invokePrivilegedAction<{ id: string; acceptance_status: string; message: string }>('record_live_pilot_department_acceptance', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Record Department Pilot Acceptance', 'record_live_pilot_department_acceptance');
  }
}

export async function getIdentityRoleIntegrityReviews(): Promise<IdentityRoleIntegrityReview[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('identity_role_integrity_reviews')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data || []) as IdentityRoleIntegrityReview[];
  } catch (error) {
    logApiWarning('getIdentityRoleIntegrityReviews', error);
    return emptyLiveArray();
  }
}

export async function getIdentityRoleIntegrityFindings(): Promise<IdentityRoleIntegrityFinding[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('identity_role_integrity_findings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data || []) as IdentityRoleIntegrityFinding[];
  } catch (error) {
    logApiWarning('getIdentityRoleIntegrityFindings', error);
    return emptyLiveArray();
  }
}

export async function getPrivilegedRoleRecertifications(): Promise<PrivilegedRoleRecertification[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('privileged_role_recertifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data || []) as PrivilegedRoleRecertification[];
  } catch (error) {
    logApiWarning('getPrivilegedRoleRecertifications', error);
    return emptyLiveArray();
  }
}

export function getAccessIntegrityRequiredActions(
  reviews: IdentityRoleIntegrityReview[] = [],
  findings: IdentityRoleIntegrityFinding[] = [],
  recertifications: PrivilegedRoleRecertification[] = [],
): string[] {
  const latest = reviews[0];
  const requiredActions = new Set<string>();
  const highRiskFindings = findings.filter(finding => ['high', 'critical'].includes(finding.severity) && ['open', 'in_progress', 'blocked'].includes(finding.finding_status)).length;
  const missingOwnerReviewer = findings.filter(finding => ['missing_owner', 'missing_reviewer'].includes(finding.finding_type) && ['open', 'in_progress', 'blocked'].includes(finding.finding_status)).length;
  const pendingRecertifications = recertifications.filter(row => ['pending', 'blocked'].includes(row.recertification_status)).length;

  if (!reviews.length) requiredActions.add('Create access integrity review.');
  if (highRiskFindings > 0) requiredActions.add('Integrity findings remain open.');
  if (pendingRecertifications > 0) requiredActions.add('Privileged role recertification required.');
  if (missingOwnerReviewer > 0) requiredActions.add('Missing owner/reviewer repair required.');
  if (latest && !['ready_for_export', 'exported_for_review'].includes(latest.access_export_status)) requiredActions.add('Access export for IT/security review required.');
  if (latest && latest.sso_mfa_readiness_status === 'review_required') requiredActions.add('SSO/MFA readiness checklist requires review.');

  return requiredActions.size ? [...requiredActions] : ['Ready for access integrity review.'];
}

export function getIdentityRoleIntegrityDashboardSummary(
  reviews: IdentityRoleIntegrityReview[] = [],
  findings: IdentityRoleIntegrityFinding[] = [],
  recertifications: PrivilegedRoleRecertification[] = [],
): IdentityRoleIntegrityDashboardSummary {
  const latest = reviews[0];
  const requiredActions = getAccessIntegrityRequiredActions(reviews, findings, recertifications);
  const highRiskFindings = findings.filter(finding => ['high', 'critical'].includes(finding.severity) && ['open', 'in_progress', 'blocked'].includes(finding.finding_status)).length;
  const findingCount = (type: IdentityRoleFindingType) =>
    findings.filter(finding => finding.finding_type === type && ['open', 'in_progress', 'blocked'].includes(finding.finding_status)).length;
  const pendingRecertifications = recertifications.filter(row => ['pending', 'blocked'].includes(row.recertification_status)).length;
  const missingOwnerReviewer = findingCount('missing_owner') + findingCount('missing_reviewer');

  return {
    review_count: reviews.length,
    latest_review_title: latest?.review_title ?? 'Identity, role, and data integrity review has not been recorded.',
    access_integrity_review_state: latest?.review_status ?? 'review_required',
    privileged_role_recertification_pending: latest?.privileged_pending_recertification_count ?? pendingRecertifications,
    dormant_account_review_count: latest?.dormant_account_count ?? findingCount('dormant_account'),
    inactive_account_review_count: latest?.inactive_account_count ?? findingCount('inactive_account'),
    archived_user_access_review_count: latest?.archived_user_access_count ?? findingCount('archived_user_access'),
    role_duplication_review_count: latest?.duplicate_role_count ?? findingCount('duplicate_role'),
    department_accountability_gap_count: latest?.department_accountability_gap_count ?? findingCount('department_accountability_gap'),
    station_accountability_gap_count: latest?.station_accountability_gap_count ?? findingCount('station_accountability_gap'),
    missing_owner_reviewer_count: (latest?.missing_owner_count ?? findingCount('missing_owner')) + (latest?.missing_reviewer_count ?? findingCount('missing_reviewer')),
    sso_mfa_readiness_status: latest?.sso_mfa_readiness_status ?? 'review_required',
    access_export_status: latest?.access_export_status ?? 'not_ready',
    open_high_risk_finding_count: latest?.open_high_risk_finding_count ?? highRiskFindings,
    required_actions: requiredActions,
    next_action_required: requiredActions[0] ?? 'Ready for access integrity review.',
    caveat: 'Access integrity review does not approve production launch.',
    controlled_authority_caveat: 'Controlled production authority remains separate.',
  };
}

export async function createIdentityRoleIntegrityReview(payload: {
  review_title: string;
  review_notes?: string | null;
  sso_mfa_readiness_status?: SsoMfaReadinessStatus;
  access_export_status?: AccessExportStatus;
}): Promise<{ id: string; message: string }> {
  try {
    return await invokePrivilegedAction<{ id: string; message: string }>('create_identity_role_integrity_review', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Create Access Integrity Review', 'create_identity_role_integrity_review');
  }
}

export async function updateIdentityRoleIntegrityReviewStatus(payload: {
  review_id: string;
  review_status: IdentityRoleIntegrityReviewStatus;
  review_notes?: string | null;
  sso_mfa_readiness_status?: SsoMfaReadinessStatus | null;
  access_export_status?: AccessExportStatus | null;
}): Promise<{ id: string; review_status: string; message: string }> {
  try {
    return await invokePrivilegedAction<{ id: string; review_status: string; message: string }>('update_identity_role_integrity_review_status', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Update Access Integrity Review', 'update_identity_role_integrity_review_status');
  }
}

export async function recordIdentityRoleIntegrityFinding(payload: {
  review_id: string;
  finding_type: IdentityRoleFindingType;
  severity?: IdentityRoleFindingSeverity;
  entity_type?: string;
  finding_title: string;
  finding_summary?: string | null;
  entity_id?: string | null;
  department_id?: string | null;
  owner_id?: string | null;
  due_date?: string | null;
}): Promise<{ id: string; message: string }> {
  try {
    return await invokePrivilegedAction<{ id: string; message: string }>('record_identity_role_integrity_finding', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Record Identity Integrity Finding', 'record_identity_role_integrity_finding');
  }
}

export async function updateIdentityRoleIntegrityFindingStatus(payload: {
  finding_id: string;
  finding_status: IdentityRoleFindingStatus;
  resolution_summary?: string | null;
}): Promise<{ id: string; finding_status: string; message: string }> {
  try {
    return await invokePrivilegedAction<{ id: string; finding_status: string; message: string }>('update_identity_role_integrity_finding_status', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Update Identity Integrity Finding', 'update_identity_role_integrity_finding_status');
  }
}

export async function recordPrivilegedRoleRecertification(payload: {
  review_id: string;
  user_id: string;
  role_name: string;
  recertification_status: PrivilegedRoleRecertificationStatus;
  recertification_rationale?: string | null;
  department_id?: string | null;
}): Promise<{ id: string; recertification_status: string; message: string }> {
  try {
    return await invokePrivilegedAction<{ id: string; recertification_status: string; message: string }>('record_privileged_role_recertification', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Record Privileged Role Recertification', 'record_privileged_role_recertification');
  }
}

export async function getProductionHypercareWindows(): Promise<ProductionHypercareWindow[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('production_hypercare_windows')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data || []) as ProductionHypercareWindow[];
  } catch (error) {
    logApiWarning('getProductionHypercareWindows', error);
    return emptyLiveArray();
  }
}

export async function getProductionHypercareItems(): Promise<ProductionHypercareItem[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('production_hypercare_items')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(250);
    if (error) throw error;
    return (data || []) as ProductionHypercareItem[];
  } catch (error) {
    logApiWarning('getProductionHypercareItems', error);
    return emptyLiveArray();
  }
}

export async function getExecutiveGovernanceBoardPacks(): Promise<ExecutiveGovernanceBoardPack[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('executive_governance_board_packs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data || []) as ExecutiveGovernanceBoardPack[];
  } catch (error) {
    logApiWarning('getExecutiveGovernanceBoardPacks', error);
    return emptyLiveArray();
  }
}

const openProductionOperationItemStatuses = new Set<ProductionHypercareItemStatus>([
  'open',
  'in_progress',
  'evidence_required',
  'review_required',
  'blocked',
]);

function summarizeProductionHypercareItems(items: ProductionHypercareItem[] = []) {
  const openByType: Record<ProductionHypercareItemType, number> = {
    support_issue: 0,
    incident_trend: 0,
    department_launch_health: 0,
    known_limitation: 0,
    corrective_action: 0,
    evidence_pack_gap: 0,
    board_pack_gap: 0,
    training_gap: 0,
    dr_restore_gap: 0,
    access_review_gap: 0,
  };
  let highCriticalOpen = 0;
  let evidencePackGaps = 0;
  let supportIssues = 0;
  let criticalIncidents = 0;

  for (const item of items) {
    const isOpen = openProductionOperationItemStatuses.has(item.item_status);
    if (isOpen) openByType[item.item_type] += 1;
    if (['high', 'critical'].includes(item.severity) && isOpen) highCriticalOpen += 1;
    if (item.item_type === 'evidence_pack_gap' && item.item_status !== 'closed') evidencePackGaps += 1;
    if (item.item_type === 'support_issue' && isOpen) supportIssues += 1;
    if (item.item_type === 'incident_trend' && item.severity === 'critical' && item.item_status !== 'closed') criticalIncidents += 1;
  }

  return {
    openByType,
    highCriticalOpen,
    evidencePackGaps,
    supportIssues,
    criticalIncidents,
  };
}

export function getBoardClosureRequiredActions(
  windows: ProductionHypercareWindow[] = [],
  items: ProductionHypercareItem[] = [],
  boardPacks: ExecutiveGovernanceBoardPack[] = [],
  itemSummary = summarizeProductionHypercareItems(items),
): { hypercare: string[]; board: string[] } {
  const latestWindow = windows[0];
  const latestPack = boardPacks[0];
  const hypercare = new Set<string>();
  const board = new Set<string>();

  if (!windows.length) hypercare.add('Create hypercare command center.');
  if (itemSummary.criticalIncidents > 0 || (latestWindow?.critical_incident_count ?? 0) > 0) hypercare.add('Critical incidents block hypercare exit review.');
  if (itemSummary.supportIssues > 0 || (latestWindow?.open_support_issue_count ?? 0) > 0) hypercare.add('Open support issues require limitation review or closure.');
  if (itemSummary.evidencePackGaps > 0 || latestWindow?.evidence_pack_status === 'incomplete' || latestWindow?.evidence_pack_status === 'blocked') hypercare.add('Accreditation/evidence pack tracking requires review.');
  if (!latestWindow || ['draft', 'blocked'].includes(latestWindow.board_pack_status)) hypercare.add('Board closure pack requires review.');

  if (!boardPacks.length) board.add('Create executive monthly governance report.');
  if (itemSummary.highCriticalOpen > 0) board.add('High/critical operations items require closure or limitation review.');
  if (latestPack?.pack_status === 'draft' || !latestPack) board.add('Board review required.');

  return {
    hypercare: hypercare.size ? [...hypercare] : ['Hypercare exit review required.'],
    board: board.size ? [...board] : ['Ready for board review.'],
  };
}

export function getProductionOperationsDashboardSummary(
  windows: ProductionHypercareWindow[] = [],
  items: ProductionHypercareItem[] = [],
  boardPacks: ExecutiveGovernanceBoardPack[] = [],
): ProductionOperationsDashboardSummary {
  const latestWindow = windows[0];
  const latestPack = boardPacks[0];
  const itemSummary = summarizeProductionHypercareItems(items);
  const actions = getBoardClosureRequiredActions(windows, items, boardPacks, itemSummary);
  const itemCount = (type: ProductionHypercareItemType) => itemSummary.openByType[type];

  return {
    hypercare_window_count: windows.length,
    latest_hypercare_title: latestWindow?.hypercare_title ?? 'Hypercare command center has not been recorded.',
    hypercare_command_center_status: latestWindow?.hypercare_status ?? 'review_required',
    day_30_status: latestWindow?.day_30_status ?? 'not_started',
    day_60_status: latestWindow?.day_60_status ?? 'not_started',
    day_90_status: latestWindow?.day_90_status ?? 'not_started',
    open_support_issue_count: latestWindow?.open_support_issue_count ?? itemCount('support_issue'),
    critical_incident_count: latestWindow?.critical_incident_count ?? itemSummary.criticalIncidents,
    department_launch_gap_count: latestWindow?.department_launch_gap_count ?? itemCount('department_launch_health'),
    unresolved_limitation_count: latestWindow?.unresolved_limitation_count ?? itemCount('known_limitation'),
    corrective_action_open_count: latestWindow?.corrective_action_open_count ?? itemCount('corrective_action'),
    evidence_pack_status: latestWindow?.evidence_pack_status ?? 'incomplete',
    board_pack_status: latestWindow?.board_pack_status ?? latestPack?.pack_status ?? 'draft',
    executive_monthly_governance_report_status: latestPack?.pack_status ?? 'draft',
    accreditation_evidence_pack_gap_count: itemCount('evidence_pack_gap'),
    dr_support_access_training_gap_count: itemCount('dr_restore_gap') + itemCount('access_review_gap') + itemCount('training_gap'),
    required_actions_before_hypercare_exit: actions.hypercare,
    required_actions_before_board_review: actions.board,
    next_action_required: actions.hypercare[0] ?? actions.board[0] ?? 'Board review required.',
    caveat: 'Board closure does not approve production launch.',
    controlled_authority_caveat: 'Controlled production authority remains separate.',
    live_transition_caveat: 'Live transition requires separate operational execution.',
    real_execution_caveat: 'Real hospital execution evidence is still required.',
  };
}

export async function createProductionHypercareWindow(payload: {
  hypercare_title: string;
  exit_review_notes?: string | null;
}): Promise<{ id: string; message: string }> {
  try {
    return await invokePrivilegedAction<{ id: string; message: string }>('create_production_hypercare_window', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Create Production Hypercare Window', 'create_production_hypercare_window');
  }
}

export async function updateProductionHypercareWindowStatus(payload: {
  hypercare_window_id: string;
  hypercare_status: ProductionHypercareStatus;
  day_30_status?: ProductionOperatingDayStatus | null;
  day_60_status?: ProductionOperatingDayStatus | null;
  day_90_status?: ProductionOperatingDayStatus | null;
  evidence_pack_status?: ProductionEvidencePackStatus | null;
  board_pack_status?: ExecutiveBoardPackStatus | null;
  exit_review_notes?: string | null;
}): Promise<{ id: string; hypercare_status: string; message: string }> {
  try {
    return await invokePrivilegedAction<{ id: string; hypercare_status: string; message: string }>('update_production_hypercare_window_status', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Update Production Hypercare Window', 'update_production_hypercare_window_status');
  }
}

export async function recordProductionHypercareItem(payload: {
  hypercare_window_id: string;
  item_type: ProductionHypercareItemType;
  item_title: string;
  severity?: IdentityRoleFindingSeverity;
  item_summary?: string | null;
  department_id?: string | null;
  owner_id?: string | null;
  due_date?: string | null;
}): Promise<{ id: string; message: string }> {
  try {
    return await invokePrivilegedAction<{ id: string; message: string }>('record_production_hypercare_item', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Record Production Hypercare Item', 'record_production_hypercare_item');
  }
}

export async function updateProductionHypercareItemStatus(payload: {
  item_id: string;
  item_status: ProductionHypercareItemStatus;
  evidence_summary?: string | null;
  closure_summary?: string | null;
}): Promise<{ id: string; item_status: string; message: string }> {
  try {
    return await invokePrivilegedAction<{ id: string; item_status: string; message: string }>('update_production_hypercare_item_status', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Update Production Hypercare Item', 'update_production_hypercare_item_status');
  }
}

export async function createExecutiveGovernanceBoardPack(payload: {
  pack_title: string;
  reporting_period: string;
  hypercare_window_id?: string | null;
  executive_summary?: string | null;
}): Promise<{ id: string; message: string }> {
  try {
    return await invokePrivilegedAction<{ id: string; message: string }>('create_executive_governance_board_pack', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Create Executive Governance Board Pack', 'create_executive_governance_board_pack');
  }
}

export async function updateExecutiveGovernanceBoardPackStatus(payload: {
  board_pack_id: string;
  pack_status: ExecutiveBoardPackStatus;
  board_review_notes?: string | null;
}): Promise<{ id: string; pack_status: string; message: string }> {
  try {
    return await invokePrivilegedAction<{ id: string; pack_status: string; message: string }>('update_executive_governance_board_pack_status', payload);
  } catch (error) {
    return throwRpcActionError(error, 'Update Executive Governance Board Pack', 'update_executive_governance_board_pack_status');
  }
}

function getHypercareEvidenceRequiredSummary() {
  return {
    hypercare_period_total: 0,
    active_hypercare_periods: 0,
    at_risk_or_blocked_periods: 0,
    days_remaining: 0,
    open_hypercare_issues: 0,
    overdue_hypercare_issues: 0,
    high_critical_hypercare_issues: 0,
    missed_cadence_events: 0,
    departments_missing_feedback: 1,
    low_adoption_departments: 0,
    support_needed_feedback_count: 0,
    training_needed_feedback_count: 0,
    inherited_unresolved_live_pilot_issues: 0,
    inherited_high_critical_remediation_count: 0,
    hypercare_blocker_count: 1,
    production_stability_status: 'evidence_required',
    next_action_required: 'Create a production hypercare period and begin operating cadence evidence capture.',
  };
}

function getHypercareEvidenceRequiredBlockers() {
  return [
    {
      hypercare_label: 'Production hypercare operating cadence',
      blocker_area: 'hypercare_period',
      blocker_type: 'evidence_required',
      blocker_summary: 'A production hypercare period, cadence, and department feedback evidence must be recorded after go-live.',
      evidence_reference: null,
    },
  ];
}

export async function getProductionHypercareOverlay(): Promise<any> {
  const evidenceRequired = getHypercareEvidenceRequiredSummary();
  if (!supabase) return evidenceRequired;
  try {
    const { data, error } = await supabase
      .from('v_patch53_production_readiness_hypercare_overlay')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data || data.hypercare_period_total === 0) return evidenceRequired;
    return data;
  } catch (error) {
    logApiWarning('getProductionHypercareOverlay', error);
    return evidenceRequired;
  }
}

export async function getProductionHypercareBlockers(): Promise<any[]> {
  const evidenceRequired = getHypercareEvidenceRequiredBlockers();
  if (!supabase) return evidenceRequired;
  try {
    const { data, error } = await supabase
      .from('v_patch53_hypercare_blocker_register')
      .select('*');
    if (error) throw error;
    if (!data || data.length === 0) return evidenceRequired;
    return data;
  } catch (error) {
    logApiWarning('getProductionHypercareBlockers', error);
    return evidenceRequired;
  }
}

export async function getProductionHypercareIssues(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch53_hypercare_issue_register')
      .select('*')
      .order('severity', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getProductionHypercareIssues', error);
    return emptyLiveArray();
  }
}

export async function getProductionOperatingCadenceEvents(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch53_operating_cadence_event_register')
      .select('*')
      .order('scheduled_at', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getProductionOperatingCadenceEvents', error);
    return emptyLiveArray();
  }
}

export async function getProductionAdoptionFeedback(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch53_department_adoption_feedback_register')
      .select('*')
      .order('department_name', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getProductionAdoptionFeedback', error);
    return emptyLiveArray();
  }
}

function getHospitalOperationsEvidenceRequiredSummary() {
  return {
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
    department_launch_blocker_count: 1,
    hospital_operations_readiness_status: 'evidence_required',
    next_action_required: 'Create department launch packs and record owners, checklist evidence, training, policy/SOP attestations, support readiness, and signoffs before hospital-wide rollout.',
  };
}

function getHospitalOperationsEvidenceRequiredBlockers() {
  return [
    {
      department_name: 'Hospital operations readiness',
      blocker_type: 'evidence_required',
      blocker_reason: 'Department launch packs, owners, checklist evidence, training, policy/SOP attestations, support readiness, and signoffs must be recorded before hospital-wide rollout.',
      evidence_reference: null,
    },
  ];
}

export async function getHospitalOperationsReadinessOverlay(): Promise<any> {
  const evidenceRequired = getHospitalOperationsEvidenceRequiredSummary();
  if (!supabase) return evidenceRequired;
  try {
    const { data, error } = await supabase
      .from('v_patch55_production_readiness_hospital_operations_overlay')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data || Number(data.total_department_launch_packs ?? 0) === 0) return evidenceRequired;
    return data;
  } catch (error) {
    logApiWarning('getHospitalOperationsReadinessOverlay', error);
    return evidenceRequired;
  }
}

export async function getHospitalOperationsLaunchBlockers(): Promise<any[]> {
  const evidenceRequired = getHospitalOperationsEvidenceRequiredBlockers();
  if (!supabase) return evidenceRequired;
  try {
    const { data, error } = await supabase
      .from('v_patch55_department_launch_blocker_register')
      .select('*');
    if (error) throw error;
    if (!data || data.length === 0) return evidenceRequired;
    return data;
  } catch (error) {
    logApiWarning('getHospitalOperationsLaunchBlockers', error);
    return evidenceRequired;
  }
}

export async function getHospitalDepartmentLaunchPacks(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch55_department_launch_pack_register')
      .select('*')
      .order('launch_label', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getHospitalDepartmentLaunchPacks', error);
    return emptyLiveArray();
  }
}

export async function getHospitalLaunchChecklistItems(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch55_department_launch_checklist_register')
      .select('*')
      .order('checklist_key', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getHospitalLaunchChecklistItems', error);
    return emptyLiveArray();
  }
}

export async function getHospitalSupportReadinessRecords(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch55_department_support_readiness_register')
      .select('*')
      .order('department_name', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getHospitalSupportReadinessRecords', error);
    return emptyLiveArray();
  }
}

export async function getHospitalPolicyAttestationReadiness(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch55_policy_attestation_readiness_register')
      .select('*')
      .order('policy_title', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getHospitalPolicyAttestationReadiness', error);
    return emptyLiveArray();
  }
}

export async function getHospitalAdoptionReadinessReviews(): Promise<any[]> {
  if (!supabase) return emptyLiveArray();
  try {
    const { data, error } = await supabase
      .from('v_patch55_department_adoption_readiness_register')
      .select('*')
      .order('department_name', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    logApiWarning('getHospitalAdoptionReadinessReviews', error);
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


