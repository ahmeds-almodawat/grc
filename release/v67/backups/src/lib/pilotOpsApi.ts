import { supabase } from './supabaseClient';

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

const fallbackPilot: PilotSummary[] = [
  {
    wave_name: 'Pilot Wave 1 - Core Governance Users',
    status: 'ready',
    readiness_score: 72,
    included_departments: 8,
    target_departments: 8,
    participants: 60,
    target_users: 60,
    trained_users: 34,
    rls_verified_users: 20,
    open_issues: 5,
    critical_open_issues: 0,
    approved_signoffs: 2,
    required_signoffs: 6,
  },
  {
    wave_name: 'Pilot Wave 2 - Department Managers',
    status: 'draft',
    readiness_score: 38,
    included_departments: 20,
    target_departments: 20,
    participants: 220,
    target_users: 220,
    trained_users: 0,
    rls_verified_users: 0,
    open_issues: 0,
    critical_open_issues: 0,
    approved_signoffs: 0,
    required_signoffs: 6,
  },
];

const fallbackImport: ImportReadiness[] = [
  {
    import_area: 'departments',
    status: 'mapping',
    expected_rows: 50,
    validated_rows: 0,
    rejected_rows: 0,
    duplicate_warnings: 0,
    missing_required_warnings: 0,
    readiness_signal: 'in_progress',
    validation_percent: 0,
    notes: 'Confirm final department list.',
  },
  {
    import_area: 'units_stations',
    status: 'mapping',
    expected_rows: 120,
    validated_rows: 0,
    rejected_rows: 0,
    duplicate_warnings: 0,
    missing_required_warnings: 0,
    readiness_signal: 'in_progress',
    validation_percent: 0,
    notes: 'Check duplicate active unit/station codes.',
  },
  {
    import_area: 'employees',
    status: 'mapping',
    expected_rows: 1000,
    validated_rows: 0,
    rejected_rows: 0,
    duplicate_warnings: 0,
    missing_required_warnings: 0,
    readiness_signal: 'in_progress',
    validation_percent: 0,
    notes: 'Validate roles and scope before import.',
  },
];

const fallbackIssues: PilotIssue[] = [
  {
    title: 'Arabic label review needed in legacy reports',
    module_area: 'Bilingual',
    severity: 'medium',
    status: 'open',
    board_signal: 'normal',
  },
  {
    title: 'Run RLS persona test for department manager',
    module_area: 'Access Control',
    severity: 'high',
    status: 'triaged',
    board_signal: 'high',
  },
  {
    title: 'OVR closure evidence test pending',
    module_area: 'OVR',
    severity: 'high',
    status: 'in_progress',
    board_signal: 'high',
  },
];

const fallbackRollout: RolloutReadiness = {
  organization_name_en: 'Al Modawat Specialized Medical Company',
  pilot_waves: 2,
  completed_waves: 0,
  open_pilot_issues: 5,
  critical_pilot_issues: 0,
  ready_import_areas: 0,
  total_import_areas: 6,
  passed_rehearsals: 0,
  total_rehearsals: 1,
  rollout_signal: 'warning',
};

/**
 * Supabase query builders are PromiseLike/thenable but their generated type is
 * not always assignable to a native Promise in strict TypeScript mode. Keeping
 * this helper query-agnostic prevents false TS2345 errors while preserving the
 * live-data-first / fallback-data-second behavior.
 */
async function safeQuery<T>(query: unknown, fallback: T[]): Promise<T[]> {
  try {
    const { data, error } = (await query) as SupabaseResult<T>;
    if (error || !data) return fallback;
    return data;
  } catch {
    return fallback;
  }
}

async function safeMaybeSingle<T>(query: unknown, fallback: T): Promise<T> {
  try {
    const { data, error } = (await query) as SupabaseMaybeSingleResult<T>;
    if (error || !data) return fallback;
    return data;
  } catch {
    return fallback;
  }
}

export async function getPilotWaveSummary(): Promise<PilotSummary[]> {
  return safeQuery<PilotSummary>(
    supabase.from('v_v34_pilot_wave_summary').select('*').order('wave_name'),
    fallbackPilot,
  );
}

export async function getImportReadiness(): Promise<ImportReadiness[]> {
  return safeQuery<ImportReadiness>(
    supabase.from('v_v34_real_data_import_readiness').select('*').order('import_area'),
    fallbackImport,
  );
}

export async function getPilotIssueBoard(): Promise<PilotIssue[]> {
  return safeQuery<PilotIssue>(
    supabase
      .from('v_v34_pilot_issue_board')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100),
    fallbackIssues,
  );
}

export async function getRolloutReadiness(): Promise<RolloutReadiness> {
  return safeMaybeSingle<RolloutReadiness>(
    supabase.from('v_v34_company_rollout_readiness').select('*').limit(1).maybeSingle(),
    fallbackRollout,
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
