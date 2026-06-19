import { isSupabaseConfigured, supabase } from './supabase';
import { emptyLiveArray } from './liveData';
import { requireServerBridge } from './privilegedAction';

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
