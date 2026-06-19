import { supabase } from './supabase';
import { emptyLiveObject, emptyLiveArray } from './liveData';
import { requireServerBridge } from './privilegedAction';

export type QaReadinessSummary = {
  organization_id: string;
  total_gates: number;
  passed_gates: number;
  warning_gates: number;
  blocked_gates: number;
  critical_blockers: number;
  high_blockers: number;
  permission_warnings: number;
  workflow_blockers: number;
  active_test_runs: number;
  completed_test_runs: number;
  failed_test_results: number;
  readiness_score: number;
  last_test_run_at: string | null;
};

export type DeploymentGate = {
  organization_id: string;
  gate_key: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | string;
  status: 'passed' | 'warning' | 'blocked' | 'not_tested' | string;
  title_en: string;
  title_ar: string;
  details_en: string;
  details_ar: string;
  record_count: number;
  action_path: string | null;
};

export type QaTestCase = {
  id: string;
  category: string;
  test_key: string;
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  expected_result_en: string;
  expected_result_ar: string;
  priority: 'critical' | 'high' | 'medium' | 'low' | string;
  test_type: 'manual' | 'sql_check' | 'workflow_check' | 'permission_check' | string;
  is_active: boolean;
};

export type PermissionPersona = {
  persona_key: string;
  role_name: string;
  scope_name: string;
  expected_visibility_en: string;
  expected_visibility_ar: string;
  must_block_en: string;
  must_block_ar: string;
  test_steps_en: string;
  test_steps_ar: string;
  risk_level: 'critical' | 'high' | 'medium' | 'low' | string;
};

export type QaRun = {
  id: string;
  title: string;
  scope: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  total_cases: number;
  passed_cases: number;
  failed_cases: number;
  blocked_cases: number;
};

const now = new Date().toISOString();

const liveEmptySummary: QaReadinessSummary = emptyLiveObject<QaReadinessSummary>('liveEmptySummary');

const liveEmptyGates: DeploymentGate[] = emptyLiveArray<DeploymentGate>();

const liveEmptyCases: QaTestCase[] = emptyLiveArray<QaTestCase>();

const liveEmptyPersonas: PermissionPersona[] = emptyLiveArray<PermissionPersona>();

const liveEmptyRuns: QaRun[] = emptyLiveArray<QaRun>();

function logFallback(label: string, error: unknown) {
  // eslint-disable-next-line no-console
  console.warn(`[GRC QA emptyRows] ${label}`, error);
}

export async function getQaReadinessSummary(): Promise<QaReadinessSummary> {
  if (!supabase) return emptyLiveObject<QaReadinessSummary>('getQaReadinessSummary');
  try {
    const { data, error } = await supabase.from('v_qa_readiness_summary').select('*').limit(1).maybeSingle();
    if (error) throw error;
    return (data as QaReadinessSummary | null) ?? liveEmptySummary;
  } catch (error) {
    logFallback('summary', error);
    return emptyLiveObject<QaReadinessSummary>('getQaReadinessSummary');
  }
}

export async function getDeploymentGates(): Promise<DeploymentGate[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('v_deployment_readiness_gates')
      .select('*')
      .order('status', { ascending: true })
      .order('severity', { ascending: true });
    if (error) throw error;
    return (data as DeploymentGate[] | null) ?? [];
  } catch (error) {
    logFallback('deployment gates', error);
    return [];
  }
}

export async function getQaTestCases(): Promise<QaTestCase[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('v_qa_test_case_library')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('priority', { ascending: true });
    if (error) throw error;
    return (data as QaTestCase[] | null) ?? [];
  } catch (error) {
    logFallback('test cases', error);
    return [];
  }
}

export async function getPermissionPersonas(): Promise<PermissionPersona[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.from('v_permission_test_personas').select('*');
    if (error) throw error;
    return (data as PermissionPersona[] | null) ?? [];
  } catch (error) {
    logFallback('permission personas', error);
    return [];
  }
}

export async function getQaRuns(): Promise<QaRun[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('v_qa_test_runs_summary')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(10);
    if (error) throw error;
    return (data as QaRun[] | null) ?? [];
  } catch (error) {
    logFallback('qa runs', error);
    return [];
  }
}

export async function seedDefaultQaTestPlan(): Promise<number> {
  if (!supabase) return liveEmptyCases.length;
  return requireServerBridge(
    'Default QA test-plan seeding',
    'seed_default_qa_test_cases',
  );
}

export function exportRowsAsCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const keys = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach(key => set.add(key));
    return set;
  }, new Set<string>()));

  const escape = (value: unknown) => {
    if (value === null || value === undefined) return '';
    const raw = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return /[",\n]/.test(raw) ? `"${raw.replaceAll('"', '""')}"` : raw;
  };

  const csv = [keys.join(','), ...rows.map(row => keys.map(key => escape(row[key])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
