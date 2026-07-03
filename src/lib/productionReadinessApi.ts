import { isSupabaseConfigured, supabase } from './supabase';
import { emptyLiveArray, emptyLiveObject } from './liveData';
import { requireServerBridge, invokePrivilegedAction, throwRpcActionError } from './privilegedAction';

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


