import { supabase } from './supabaseClient';
import { emptyLiveObject } from './liveData';

export type V35Status = 'not_started' | 'in_progress' | 'blocked' | 'ready' | 'passed' | 'failed' | 'deferred' | 'closed';
export type V35Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface V35Scorecard {
  patches_registered: number;
  patches_verified: number;
  patches_not_verified: number;
  open_defects: number;
  critical_open_defects: number;
  open_data_repairs: number;
  sop_steps_remaining: number;
  consolidation_readiness_score: number;
}

export interface V35Blocker {
  blocker_area: string;
  reference: string | null;
  title: string;
  status: string;
  severity: string;
  note: string | null;
}

export interface V35OperatorConsole {
  business_date: string;
  readiness_score: number;
  active_blockers: number;
  active_freeze_windows: number;
  today_operator_logs: number;
  active_fix_sprints: number;
}

export interface V35DataQualityRadarRow {
  source_area: string;
  total_issues: number;
  high_issues: number;
  closed_issues: number;
  open_issues: number;
  closure_percent: number;
}

export interface V35PatchManifestRow {
  id: string;
  patch_version: string;
  patch_name: string;
  patch_order: number;
  expected_zip_name: string | null;
  expected_migration: string | null;
  required: boolean;
  applied_status: V35Status;
  verification_note: string | null;
}

export interface V35SopStep {
  id: string;
  step_order: number;
  step_group: string;
  step_title: string;
  step_description: string | null;
  required: boolean;
  owner_role: string | null;
  status: V35Status;
  evidence_required: boolean;
  evidence_note: string | null;
}

export interface V35Defect {
  id: string;
  defect_code: string | null;
  title: string;
  description: string | null;
  domain: string;
  severity: V35Severity;
  status: V35Status;
  source_patch: string | null;
  affected_path: string | null;
  due_date: string | null;
}

const fallbackScorecard: V35Scorecard = {
  patches_registered: 35,
  patches_verified: 0,
  patches_not_verified: 35,
  open_defects: 0,
  critical_open_defects: 0,
  open_data_repairs: 0,
  sop_steps_remaining: 8,
  consolidation_readiness_score: 58,
};

const fallbackOperator: V35OperatorConsole = {
  business_date: new Date().toISOString().slice(0, 10),
  readiness_score: 58,
  active_blockers: 8,
  active_freeze_windows: 0,
  today_operator_logs: 0,
  active_fix_sprints: 2,
};

const fallbackBlockers: V35Blocker[] = [
  { blocker_area: 'Fresh install', reference: 'MIG-001-031', title: 'Run migrations in a fresh Supabase project', status: 'not_started', severity: 'high', note: 'Required before pilot.' },
  { blocker_area: 'RLS proof', reference: 'RLS-PERSONA', title: 'Run CEO / manager / employee / Quality / Auditor persona tests', status: 'not_started', severity: 'high', note: 'Required before real users.' },
  { blocker_area: 'OVR proof', reference: 'OVR-E2E', title: 'Complete OVR from report to Quality closure', status: 'not_started', severity: 'high', note: 'Required for healthcare rollout.' },
  { blocker_area: 'Backup proof', reference: 'BACKUP-RESTORE', title: 'Complete backup and restore dry-run evidence', status: 'not_started', severity: 'high', note: 'Required before data import.' },
];

export async function getV35Scorecard(): Promise<V35Scorecard> {
  const { data, error } = await supabase.from('v35_consolidation_scorecard').select('*').maybeSingle();
  if (error || !data) return emptyLiveObject<V35Scorecard>('getV35Scorecard');
  return data as V35Scorecard;
}

export async function getV35OperatorConsole(): Promise<V35OperatorConsole> {
  const { data, error } = await supabase.from('v35_operator_console').select('*').maybeSingle();
  if (error || !data) return emptyLiveObject<V35OperatorConsole>('getV35OperatorConsole');
  return data as V35OperatorConsole;
}

export async function listV35Blockers(): Promise<V35Blocker[]> {
  const { data, error } = await supabase.from('v35_final_blocker_board').select('*').limit(100);
  if (error || !data) return [];
  return data as V35Blocker[];
}

export async function listV35PatchManifest(): Promise<V35PatchManifestRow[]> {
  const { data, error } = await supabase
    .from('consolidation_patch_manifest')
    .select('id, patch_version, patch_name, patch_order, expected_zip_name, expected_migration, required, applied_status, verification_note')
    .order('patch_order', { ascending: true });
  if (error || !data) return [];
  return data as V35PatchManifestRow[];
}

export async function listV35SopSteps(): Promise<V35SopStep[]> {
  const { data, error } = await supabase
    .from('go_live_sop_steps')
    .select('id, step_order, step_group, step_title, step_description, required, owner_role, status, evidence_required, evidence_note')
    .order('step_order', { ascending: true });
  if (error || !data) return [];
  return data as V35SopStep[];
}

export async function listV35Defects(): Promise<V35Defect[]> {
  const { data, error } = await supabase
    .from('consolidation_defects')
    .select('id, defect_code, title, description, domain, severity, status, source_patch, affected_path, due_date')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error || !data) return [];
  return data as V35Defect[];
}

export async function listV35DataQualityRadar(): Promise<V35DataQualityRadarRow[]> {
  const { data, error } = await supabase.from('v35_data_quality_radar').select('*').limit(30);
  if (error || !data) return [];
  return data as V35DataQualityRadarRow[];
}

export async function createV35Defect(input: {
  title: string;
  description?: string;
  domain?: string;
  severity?: V35Severity;
  source_patch?: string;
  affected_path?: string;
}): Promise<void> {
  const { error } = await supabase.from('consolidation_defects').insert({
    title: input.title,
    description: input.description ?? null,
    domain: input.domain ?? 'other',
    severity: input.severity ?? 'medium',
    source_patch: input.source_patch ?? null,
    affected_path: input.affected_path ?? null,
  });
  if (error) throw error;
}

export async function updateV35Status(table: string, id: string, status: V35Status): Promise<void> {
  const allowed = new Set(['consolidation_patch_manifest', 'consolidation_defects', 'real_data_repair_queue', 'pilot_fix_sprints', 'go_live_sop_steps']);
  if (!allowed.has(table)) throw new Error('Unsupported v3.5 status update table');
  const { error } = await supabase.from(table).update({ status }).eq('id', id);
  if (error) throw error;
}

export async function exportV35ConsolidationPack() {
  const [scorecard, operator, blockers, manifest, sop, defects, radar] = await Promise.all([
    getV35Scorecard(),
    getV35OperatorConsole(),
    listV35Blockers(),
    listV35PatchManifest(),
    listV35SopSteps(),
    listV35Defects(),
    listV35DataQualityRadar(),
  ]);

  return {
    generated_at: new Date().toISOString(),
    version: 'v3.5',
    scorecard,
    operator,
    blockers,
    manifest,
    sop,
    defects,
    data_quality_radar: radar,
  };
}
