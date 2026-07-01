import { isSupabaseConfigured, supabase } from './supabase';
import {
  configurationErrorResult,
  emptyResult,
  liveResult,
  queryErrorResult,
  type LiveResult,
} from './liveResult';

export const realDataImportInputFolder = 'C:\\Users\\molte\\Downloads\\grc_import_ready_pack_after_review';

export const realDataImportFiles = [
  { order: 1, file: '01_departments.csv', area: 'Departments', target: 'departments, real_department_master' },
  { order: 2, file: '02_committees.csv', area: 'Committees', target: 'real_committee_master' },
  { order: 3, file: '03_role_matrix.csv', area: 'Role matrix', target: 'real_role_matrix, user_roles' },
  { order: 4, file: '04_users_owners.csv', area: 'Users and owners', target: 'profiles, patch20_pending_auth_users' },
  { order: 5, file: '05_evidence_taxonomy.csv', area: 'Evidence taxonomy', target: 'real_evidence_taxonomy' },
  { order: 6, file: '06_control_library.csv', area: 'Control library', target: 'real_control_library' },
  { order: 7, file: '07_kpi_indicators.csv', area: 'KPI indicators', target: 'real_indicator_catalog' },
  { order: 8, file: '08_tracer_templates.csv', area: 'Tracer templates', target: 'real_tracer_templates' },
  { order: 9, file: '09_audit_universe.csv', area: 'Audit universe', target: 'patch20_real_import_rows' },
  { order: 10, file: '10_compliance_obligations.csv', area: 'Compliance obligations', target: 'compliance_obligations' },
  { order: 11, file: '11_document_register.csv', area: 'Document register', target: 'real_document_register' },
  { order: 12, file: '12_standards_metadata.csv', area: 'Standards metadata', target: 'real_standard_libraries' },
  { order: 13, file: '13_uat_scenarios.csv', area: 'UAT scenarios', target: 'patch20_real_import_rows' },
  { order: 14, file: '14_go_no_go_signoffs.csv', area: 'Go/no-go signoffs', target: 'patch20_real_import_rows' },
  { order: 15, file: '15_payroll_department_map.csv', area: 'Payroll department map', target: 'patch20_real_import_rows' },
];

export const realDataImportReportPaths = {
  dryRunSummary: 'release/import/patch20-dry-run-summary.json',
  dryRunSummaryCsv: 'release/import/patch20-dry-run-summary.csv',
  validationErrors: 'release/import/patch20-validation-errors.csv',
  validationWarnings: 'release/import/patch20-validation-warnings.csv',
  pendingAuthUsers: 'release/import/patch20-pending-auth-users.csv',
  generatedEmailReview: 'release/import/patch20-generated-email-review.csv',
  payrollDepartments: 'release/import/patch20-payroll-discovered-departments-review.csv',
  importPlan: 'release/import/patch20-import-plan.json',
  applySummary: 'release/import/patch20-apply-summary.json',
  applySummaryCsv: 'release/import/patch20-apply-summary.csv',
  createdRecords: 'release/import/patch20-created-records.csv',
  updatedRecords: 'release/import/patch20-updated-records.csv',
  skippedRecords: 'release/import/patch20-skipped-records.csv',
  pendingAuthAfterApply: 'release/import/patch20-pending-auth-users-after-apply.csv',
  postImportChecks: 'release/import/patch20-post-import-checks.json',
  preImportSnapshot: 'release/import/patch20-pre-import-snapshot.json',
};

export type Patch20ImportSummary = {
  generated_at?: string;
  mode?: string;
  input_folder?: string;
  input_available?: boolean;
  environment_precheck_only?: boolean;
  required_file_count?: number;
  present_file_count?: number;
  total_rows?: number;
  blocking_error_count?: number;
  warning_count?: number;
  can_apply?: boolean;
  create_auth_users_requested?: boolean;
  create_auth_users_effective?: boolean;
  created_count?: number;
  updated_count?: number;
  staged_count?: number;
  skipped_count?: number;
  pending_auth_user_count?: number;
  failed_count?: number;
  status?: string;
  error?: string;
  note?: string;
  files?: Array<{
    file: string;
    dataset_key: string;
    present: boolean;
    row_count: number;
    column_count: number;
    target_table: string;
  }>;
};

export type Patch20ImportPlanRow = {
  order: number;
  file: string;
  dataset_key: string;
  label: string;
  target_table: string;
  dependency_note: string;
};

export type Patch20CsvRow = Record<string, string>;

export type Patch20ReportFile<T> = {
  path: string;
  status: 'loading' | 'found' | 'missing' | 'error';
  data: T | null;
  message?: string;
};

export type Patch20ImportRunRow = {
  id: string;
  organization_id: string | null;
  mode: 'dry_run' | 'apply';
  status: string;
  source_folder: string | null;
  input_available: boolean;
  create_auth_users: boolean;
  dry_run_blocking_error_count: number;
  warning_count: number;
  report_paths: Record<string, unknown>;
  import_plan: Record<string, unknown>;
  pre_import_snapshot: Record<string, unknown> | null;
  rollback_note: string | null;
  created_at: string;
  completed_at: string | null;
};

export type Patch20PendingAuthUserRow = {
  id: string;
  organization_id: string;
  email: string;
  employee_no: string | null;
  full_name_en: string | null;
  department_code: string | null;
  requested_role: string | null;
  status: string;
  reason: string;
  created_at: string;
};

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

export function parsePatch20Csv(text: string): Patch20CsvRow[] {
  const rows = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
  if (!rows.length) return [];
  const headers = splitCsvLine(rows[0]).map(header => header.trim());
  return rows.slice(1).map(line => {
    const values = splitCsvLine(line);
    const row: Patch20CsvRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() ?? '';
    });
    return row;
  });
}

async function readReportJson<T>(path: string): Promise<Patch20ReportFile<T>> {
  try {
    const response = await fetch(`/${path}`, { cache: 'no-store' });
    if (!response.ok) return { path, status: 'missing', data: null, message: `HTTP ${response.status}` };
    return { path, status: 'found', data: await response.json() as T };
  } catch (error) {
    return { path, status: 'error', data: null, message: error instanceof Error ? error.message : String(error) };
  }
}

async function readReportCsv(path: string): Promise<Patch20ReportFile<Patch20CsvRow[]>> {
  try {
    const response = await fetch(`/${path}`, { cache: 'no-store' });
    if (!response.ok) return { path, status: 'missing', data: [], message: `HTTP ${response.status}` };
    return { path, status: 'found', data: parsePatch20Csv(await response.text()) };
  } catch (error) {
    return { path, status: 'error', data: [], message: error instanceof Error ? error.message : String(error) };
  }
}

export function buildPatch20DryRunCommand() {
  return `$env:GRC_IMPORT_FOLDER = "${realDataImportInputFolder}"\nnode scripts/import-real-grc-pack.mjs --dry-run --folder "$env:GRC_IMPORT_FOLDER"`;
}

export function buildPatch20ApplyCommand(createAuthUsers = false) {
  const authFlag = createAuthUsers ? '--create-auth-users true' : '--skip-auth-user-creation';
  return `$env:GRC_IMPORT_FOLDER = "${realDataImportInputFolder}"\n$env:GRC_ORGANIZATION_ID = "paste-real-organization-uuid-here"\nnode scripts/import-real-grc-pack.mjs --apply --folder "$env:GRC_IMPORT_FOLDER" --organization-id "$env:GRC_ORGANIZATION_ID" ${authFlag}`;
}

export async function getPatch20ReportBundle() {
  const [
    dryRunSummary,
    applySummary,
    importPlan,
    validationErrors,
    validationWarnings,
    pendingAuthUsers,
    generatedEmailReview,
    payrollDepartments,
    createdRecords,
    updatedRecords,
    skippedRecords,
    pendingAuthAfterApply,
    preImportSnapshot,
    postImportChecks,
  ] = await Promise.all([
    readReportJson<Patch20ImportSummary>(realDataImportReportPaths.dryRunSummary),
    readReportJson<Patch20ImportSummary>(realDataImportReportPaths.applySummary),
    readReportJson<Patch20ImportPlanRow[]>(realDataImportReportPaths.importPlan),
    readReportCsv(realDataImportReportPaths.validationErrors),
    readReportCsv(realDataImportReportPaths.validationWarnings),
    readReportCsv(realDataImportReportPaths.pendingAuthUsers),
    readReportCsv(realDataImportReportPaths.generatedEmailReview),
    readReportCsv(realDataImportReportPaths.payrollDepartments),
    readReportCsv(realDataImportReportPaths.createdRecords),
    readReportCsv(realDataImportReportPaths.updatedRecords),
    readReportCsv(realDataImportReportPaths.skippedRecords),
    readReportCsv(realDataImportReportPaths.pendingAuthAfterApply),
    readReportJson<Record<string, unknown>>(realDataImportReportPaths.preImportSnapshot),
    readReportJson<Record<string, unknown>>(realDataImportReportPaths.postImportChecks),
  ]);
  return {
    dryRunSummary,
    applySummary,
    importPlan,
    validationErrors,
    validationWarnings,
    pendingAuthUsers,
    generatedEmailReview,
    payrollDepartments,
    createdRecords,
    updatedRecords,
    skippedRecords,
    pendingAuthAfterApply,
    preImportSnapshot,
    postImportChecks,
  };
}

export async function getPatch20LatestRuns(): Promise<LiveResult<Patch20ImportRunRow[]>> {
  if (!isSupabaseConfigured || !supabase) {
    return configurationErrorResult<Patch20ImportRunRow[]>('Supabase is not configured for Patch 20 import run ledger.');
  }
  const { data, error } = await supabase
    .from('patch20_real_import_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) return queryErrorResult<Patch20ImportRunRow[]>(error, 'Unable to load Patch 20 import run ledger.');
  return data?.length ? liveResult(data as Patch20ImportRunRow[]) : emptyResult<Patch20ImportRunRow[]>('No Patch 20 import runs are available yet.');
}

export async function getPatch20PendingAuthUsers(): Promise<LiveResult<Patch20PendingAuthUserRow[]>> {
  if (!isSupabaseConfigured || !supabase) {
    return configurationErrorResult<Patch20PendingAuthUserRow[]>('Supabase is not configured for Patch 20 pending auth-user review.');
  }
  const { data, error } = await supabase
    .from('patch20_pending_auth_users')
    .select('id,organization_id,email,employee_no,full_name_en,department_code,requested_role,status,reason,created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return queryErrorResult<Patch20PendingAuthUserRow[]>(error, 'Unable to load Patch 20 pending auth-user review queue.');
  return data?.length ? liveResult(data as Patch20PendingAuthUserRow[]) : emptyResult<Patch20PendingAuthUserRow[]>('No pending auth-user records are available yet.');
}
