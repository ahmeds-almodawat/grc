import { supabase } from './supabaseClient';
import { emptyLiveArray, emptyLiveObject } from './liveData';

export type PilotSummary = {
  pilot_wave_id?: string;
  wave_name: string;
  status: string;
  readiness_score: number;
  included_departments: number;
  target_departments: number;
  participants: number;
  target_users: number;
  trained_users: number;
  rls_verified_users: number;
  open_issues: number;
  critical_open_issues: number;
  approved_signoffs: number;
  required_signoffs: number;
};

export type ImportReadiness = {
  import_area: string;
  status: string;
  expected_rows: number;
  validated_rows: number;
  rejected_rows: number;
  duplicate_warnings: number;
  missing_required_warnings: number;
  readiness_signal: string;
  validation_percent: number;
  notes?: string;
};

export type PilotIssue = {
  id?: string;
  title: string;
  module_area?: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | string;
  status: string;
  due_date?: string | null;
  wave_name?: string;
  department_name_en?: string;
  department_name_ar?: string;
  assigned_to_name?: string;
  board_signal?: string;
};

export type RolloutReadiness = {
  organization_name_en?: string;
  pilot_waves: number;
  completed_waves: number;
  open_pilot_issues: number;
  critical_pilot_issues: number;
  ready_import_areas: number;
  total_import_areas: number;
  passed_rehearsals: number;
  total_rehearsals: number;
  rollout_signal: string;
};

type SupabaseResult<T> = { data: T[] | null; error: unknown };
type SupabaseMaybeSingleResult<T> = { data: T | null; error: unknown };

const liveEmptyPilot: PilotSummary[] = emptyLiveArray<PilotSummary>();

const liveEmptyImport: ImportReadiness[] = emptyLiveArray<ImportReadiness>();

const liveEmptyIssues: PilotIssue[] = emptyLiveArray<PilotIssue>();

const liveEmptyRollout: RolloutReadiness = emptyLiveObject<RolloutReadiness>('liveEmptyRollout');

/**
 * Supabase query builders are PromiseLike/thenable but their generated type is
 * not always assignable to a native Promise in strict TypeScript mode. Keeping
 * this helper query-agnostic prevents false TS2345 errors while preserving the
 * live-data-first / emptyRows-data-second behavior.
 */
async function safeQuery<T>(query: unknown, emptyRows: T[]): Promise<T[]> {
  try {
    const { data, error } = (await query) as SupabaseResult<T>;
    if (error || !data) return emptyRows;
    return data;
  } catch {
    return emptyRows;
  }
}

async function safeMaybeSingle<T>(query: unknown, emptyRows: T): Promise<T> {
  try {
    const { data, error } = (await query) as SupabaseMaybeSingleResult<T>;
    if (error || !data) return emptyRows;
    return data;
  } catch {
    return emptyRows;
  }
}

export async function getPilotWaveSummary(): Promise<PilotSummary[]> {
  return safeQuery<PilotSummary>(
    supabase.from('v_v34_pilot_wave_summary').select('*').order('wave_name'),
    liveEmptyPilot,
  );
}

export async function getImportReadiness(): Promise<ImportReadiness[]> {
  return safeQuery<ImportReadiness>(
    supabase.from('v_v34_real_data_import_readiness').select('*').order('import_area'),
    liveEmptyImport,
  );
}

export async function getPilotIssueBoard(): Promise<PilotIssue[]> {
  return safeQuery<PilotIssue>(
    supabase
      .from('v_v34_pilot_issue_board')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100),
    liveEmptyIssues,
  );
}

export async function getRolloutReadiness(): Promise<RolloutReadiness> {
  return safeMaybeSingle<RolloutReadiness>(
    supabase.from('v_v34_company_rollout_readiness').select('*').limit(1).maybeSingle(),
    liveEmptyRollout,
  );
}

export async function createPilotIssue(input: Partial<PilotIssue> & { description?: string }) {
  const payload = {
    title: input.title || 'Untitled pilot issue',
    description: input.description || null,
    module_area: input.module_area || 'General',
    severity: input.severity || 'medium',
    status: input.status || 'open',
    due_date: input.due_date || null,
  };
  const { data, error } = await supabase.from('pilot_issues').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function exportPilotPack() {
  const [waves, imports, issues, rollout] = await Promise.all([
    getPilotWaveSummary(),
    getImportReadiness(),
    getPilotIssueBoard(),
    getRolloutReadiness(),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    package: 'v3.4 pilot operations pack',
    rollout,
    waves,
    imports,
    issues,
  };
}
