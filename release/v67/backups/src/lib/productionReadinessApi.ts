import { isSupabaseConfigured, supabase } from './supabase';

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

const fallbackControls: FinalControl[] = [
  {
    id: 'fresh-migrations',
    controlCode: 'FF-001',
    controlGroup: 'Release integrity',
    title: 'Fresh migration run 001 → latest',
    description: 'Run all SQL migrations in a clean Supabase project and record the result before any pilot rollout.',
    ownerLabel: 'IT / System Admin',
    severity: 'critical',
    status: 'blocked',
    evidenceRequired: true,
    evidenceNote: 'Screenshot or export of successful migration run',
    goLiveBlocking: true,
  },
  {
    id: 'rls-personas',
    controlCode: 'FF-002',
    controlGroup: 'Security',
    title: 'RLS persona testing complete',
    description: 'Test CEO, Governance, Department Manager, Quality, Auditor and Employee accounts with real scoped data.',
    ownerLabel: 'Governance + IT',
    severity: 'critical',
    status: 'blocked',
    evidenceRequired: true,
    evidenceNote: 'Persona screenshots and pass/fail log',
    goLiveBlocking: true,
  },
  {
    id: 'ovr-loop',
    controlCode: 'FF-003',
    controlGroup: 'Quality safety',
    title: 'OVR end-to-end workflow verified',
    description: 'Submit, supervisor review, Quality review, corrective action, evidence and closure must be tested.',
    ownerLabel: 'Quality Manager',
    severity: 'high',
    status: 'pending',
    evidenceRequired: true,
    evidenceNote: 'One closed test OVR with audit trail',
    goLiveBlocking: true,
  },
  {
    id: 'backup-restore',
    controlCode: 'FF-004',
    controlGroup: 'Recovery',
    title: 'Backup and restore dry-run proven',
    description: 'Browser export is not enough. A real database/storage restore dry-run should be documented.',
    ownerLabel: 'IT / Supabase Admin',
    severity: 'critical',
    status: 'blocked',
    evidenceRequired: true,
    evidenceNote: 'Restore dry-run job with result and notes',
    goLiveBlocking: true,
  },
  {
    id: 'arabic-rtl',
    controlCode: 'FF-005',
    controlGroup: 'Bilingual',
    title: 'Arabic / RTL screen pass',
    description: 'Review major pages in Arabic, including tables, modals, forms, OVR, reports and dashboard cards.',
    ownerLabel: 'Governance + Key Users',
    severity: 'high',
    status: 'warning',
    evidenceRequired: true,
    evidenceNote: 'Arabic QA checklist',
    goLiveBlocking: true,
  },
  {
    id: 'pilot-signoff',
    controlCode: 'FF-006',
    controlGroup: 'Pilot',
    title: 'Pilot acceptance sign-off',
    description: 'Run a limited pilot with Governance, Quality, Finance, HR, IT and selected departments before all-staff launch.',
    ownerLabel: 'Executive Sponsor',
    severity: 'high',
    status: 'pending',
    evidenceRequired: true,
    evidenceNote: 'Pilot sign-off note',
    goLiveBlocking: true,
  },
];

const fallbackModules: ModuleReadiness[] = [
  { id: 'executive', moduleKey: 'executive', moduleName: 'Executive Command', workspaceGroup: 'Executive Control', readinessPercent: 82, status: 'needs_review', remainingWork: 'Prioritize executive cards after real data is loaded.', ownerLabel: 'Executive Sponsor' },
  { id: 'work', moduleKey: 'work', moduleName: 'Projects / Work Execution', workspaceGroup: 'Work Execution', readinessPercent: 84, status: 'needs_review', remainingWork: 'Test create/edit/close with evidence in staging.', ownerLabel: 'Governance Admin' },
  { id: 'risk', moduleKey: 'risk', moduleName: 'Risk / KRI / Compliance', workspaceGroup: 'GRC & Audit', readinessPercent: 80, status: 'pilot_only', remainingWork: 'Load actual risk appetite thresholds and compliance obligations.', ownerLabel: 'Risk Owner' },
  { id: 'quality', moduleKey: 'quality', moduleName: 'OVR / Quality', workspaceGroup: 'Quality & OVR', readinessPercent: 86, status: 'needs_review', remainingWork: 'Quality team must approve the real closure rules.', ownerLabel: 'Quality Manager' },
  { id: 'reports', moduleKey: 'reports', moduleName: 'Reports / Export / Backup', workspaceGroup: 'Reports & Data', readinessPercent: 78, status: 'needs_review', remainingWork: 'Add production DB/storage backup outside browser export.', ownerLabel: 'IT / Finance' },
  { id: 'admin', moduleKey: 'admin', moduleName: 'Admin / Release / Security', workspaceGroup: 'Admin & Release', readinessPercent: 76, status: 'blocked', remainingWork: 'RLS tests and admin safety gates must be passed.', ownerLabel: 'System Admin' },
];

const fallbackHandover: SupportHandover[] = [
  { id: 'governance-support', supportArea: 'Governance workflow support', ownerLabel: 'Governance Admin', backupOwnerLabel: 'Audit Lead', runbookReady: true, escalationPathReady: true, status: 'ready', notes: 'Owns daily action-plan and evidence discipline.' },
  { id: 'quality-support', supportArea: 'OVR / Quality support', ownerLabel: 'Quality Manager', backupOwnerLabel: 'Quality Officer', runbookReady: true, escalationPathReady: true, status: 'ready', notes: 'Owns OVR review, classification and closure rules.' },
  { id: 'technical-support', supportArea: 'Supabase / app technical support', ownerLabel: 'IT Admin', backupOwnerLabel: 'External Developer', runbookReady: false, escalationPathReady: true, status: 'pending', notes: 'Needs production environment details and backup procedure.' },
  { id: 'executive-support', supportArea: 'Executive reporting support', ownerLabel: 'CEO Office', backupOwnerLabel: 'Finance Lead', runbookReady: false, escalationPathReady: false, status: 'pending', notes: 'Board pack rhythm and report owners need final confirmation.' },
];

const fallbackPilot: PilotAcceptance[] = [
  { id: 'quality-pilot', pilotArea: 'Quality / OVR pilot', acceptanceOwner: 'Quality Manager', targetDate: null, status: 'not_started', acceptanceNote: 'Run at least three test OVRs with different severity levels.' },
  { id: 'governance-pilot', pilotArea: 'Governance action tracking pilot', acceptanceOwner: 'Governance Manager', targetDate: null, status: 'not_started', acceptanceNote: 'Create one executive decision, one risk mitigation project and one approval flow.' },
  { id: 'department-pilot', pilotArea: 'Department manager pilot', acceptanceOwner: 'Selected Department Managers', targetDate: null, status: 'not_started', acceptanceNote: 'Confirm department-only scope and task ownership experience.' },
];

function computeFallbackScorecard(): ProductionScorecard {
  const blockingItems = fallbackControls.filter(c => c.goLiveBlocking && c.status === 'blocked').length;
  const warnings = fallbackControls.filter(c => ['warning', 'pending'].includes(c.status)).length;
  const passedItems = fallbackControls.filter(c => c.status === 'pass' || c.status === 'accepted_risk').length;
  const pendingItems = fallbackControls.filter(c => c.status === 'pending').length;
  const modulesReady = fallbackModules.filter(m => m.status === 'ready').length;
  const supportOwnersReady = fallbackHandover.filter(h => h.status === 'ready').length;
  const totalSignals = fallbackControls.length + fallbackModules.length + fallbackHandover.length + fallbackPilot.length;
  const positiveSignals = passedItems + fallbackModules.filter(m => m.status === 'ready' || m.status === 'pilot_only').length + supportOwnersReady + fallbackPilot.filter(p => p.status === 'accepted').length;
  const goLiveScore = Math.round((positiveSignals / Math.max(totalSignals, 1)) * 100);
  return {
    goLiveScore,
    readinessSignal: blockingItems ? 'blocked' : warnings ? 'conditional' : 'go',
    blockingItems,
    warnings,
    passedItems,
    pendingItems,
    modulesReady,
    modulesTotal: fallbackModules.length,
    supportOwnersReady,
    supportOwnersTotal: fallbackHandover.length,
  };
}

function fallbackData(): ProductionFinishData {
  return {
    scorecard: computeFallbackScorecard(),
    controls: fallbackControls,
    modules: fallbackModules,
    handover: fallbackHandover,
    pilot: fallbackPilot,
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
  const { data, error } = await supabase.rpc('seed_v31_finish_fast_defaults');
  if (error) throw error;
  return data;
}

export async function getProductionFinishData(): Promise<ProductionFinishData> {
  if (!isSupabaseConfigured || !supabase) return fallbackData();

  try {
    const [scoreRes, controlsRes, modulesRes, handoverRes, pilotRes] = await Promise.all([
      supabase.from('v_v31_go_live_scorecard').select('*').maybeSingle(),
      supabase.from('v_v31_final_controls').select('*').order('go_live_blocking', { ascending: false }).order('severity_rank', { ascending: true }).order('control_code', { ascending: true }),
      supabase.from('v_v31_module_readiness').select('*').order('readiness_percent', { ascending: true }),
      supabase.from('v_v31_support_handover').select('*').order('status_rank', { ascending: true }).order('support_area', { ascending: true }),
      supabase.from('v_v31_pilot_acceptance').select('*').order('status_rank', { ascending: true }).order('pilot_area', { ascending: true }),
    ]);

    if (scoreRes.error || controlsRes.error || modulesRes.error || handoverRes.error || pilotRes.error) {
      console.warn('Production finish data fallback:', scoreRes.error || controlsRes.error || modulesRes.error || handoverRes.error || pilotRes.error);
      return fallbackData();
    }

    const controls = (controlsRes.data ?? []).map(mapControl);
    const modules = (modulesRes.data ?? []).map(mapModule);
    const handover = (handoverRes.data ?? []).map(mapHandover);
    const pilot = (pilotRes.data ?? []).map(mapPilot);
    const row: any = scoreRes.data ?? {};

    return {
      scorecard: {
        goLiveScore: Number(row.go_live_score ?? computeFallbackScorecard().goLiveScore),
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
    console.warn('Production finish data fallback:', error);
    return fallbackData();
  }
}
