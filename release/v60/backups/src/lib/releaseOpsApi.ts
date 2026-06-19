import { supabase } from './supabase';

export type UltraReleaseSummary = {
  releaseScore: number;
  blockerCount: number;
  warningCount: number;
  lastBackupAt: string | null;
  lastRestoreDryRunAt: string | null;
  migrationsExpected: number;
  migrationsVerified: number;
  translationCoverage: number;
  adminLocksActive: number;
};

export type ProductionChecklistItem = {
  id: string;
  phase: string;
  item: string;
  status: 'pass' | 'warning' | 'blocked' | 'pending';
  owner: string;
  evidence: string;
  notes: string;
  sortOrder: number;
};

export type MigrationVerificationItem = {
  sequenceNo: number;
  migrationFile: string;
  purpose: string;
  expected: boolean;
  verified: boolean;
  status: 'verified' | 'missing' | 'warning' | 'pending';
  verificationNote: string;
};

export type RestoreDryRunItem = {
  id: string;
  backupPackageId: string;
  scenarioName: string;
  status: 'planned' | 'running' | 'passed' | 'failed' | 'cancelled';
  startedAt: string | null;
  finishedAt: string | null;
  resultSummary: string;
  evidenceFile: string | null;
};

export type AdminSafetyFinding = {
  id: string;
  area: string;
  finding: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'reviewed' | 'accepted' | 'closed';
  recommendation: string;
  owner: string;
};

export type TranslationDictionaryRow = {
  key: string;
  englishLabel: string;
  arabicLabel: string;
  category: string;
  isCore: boolean;
  status: 'complete' | 'missing_ar' | 'missing_en' | 'needs_review';
};

const fallbackSummary: UltraReleaseSummary = {
  releaseScore: 88,
  blockerCount: 1,
  warningCount: 5,
  lastBackupAt: '2026-06-17T15:30:00+03:00',
  lastRestoreDryRunAt: null,
  migrationsExpected: 22,
  migrationsVerified: 21,
  translationCoverage: 92,
  adminLocksActive: 3
};

const fallbackChecklist: ProductionChecklistItem[] = [
  {
    id: 'cutover-1',
    phase: 'Data safety',
    item: 'Create export package before applying production migration',
    status: 'pass',
    owner: 'System Admin',
    evidence: 'Backup package JSON / CSV export logs',
    notes: 'Required before any import, restore test or migration.',
    sortOrder: 1
  },
  {
    id: 'cutover-2',
    phase: 'Restore assurance',
    item: 'Run restore dry-run using latest backup package',
    status: 'blocked',
    owner: 'Governance Admin',
    evidence: 'Restore dry-run record and result notes',
    notes: 'Do not go live until a restore dry-run is documented.',
    sortOrder: 2
  },
  {
    id: 'cutover-3',
    phase: 'Access safety',
    item: 'Review global roles and department-scoped managers',
    status: 'warning',
    owner: 'Access Control Admin',
    evidence: 'Access Control Center export',
    notes: 'Resolve broad viewer/employee scope before employee rollout.',
    sortOrder: 3
  },
  {
    id: 'cutover-4',
    phase: 'Workflow controls',
    item: 'Confirm closure blockers are active',
    status: 'pass',
    owner: 'QA Lead',
    evidence: 'QA test run results',
    notes: 'Evidence, delay reason, self-approval and OVR closure checks should pass.',
    sortOrder: 4
  }
];

const fallbackMigrations: MigrationVerificationItem[] = Array.from({ length: 22 }).map((_, index) => {
  const number = index + 1;
  const padded = String(number).padStart(3, '0');
  return {
    sequenceNo: number,
    migrationFile: `${padded}_migration_${number}.sql`,
    purpose: number === 22 ? 'Ultra release verification, restore drill and admin safety controls' : 'Previously delivered platform migration',
    expected: true,
    verified: number < 22,
    status: number < 22 ? 'verified' : 'pending',
    verificationNote: number < 22 ? 'Expected migration available in release order.' : 'Apply after v1.9 and verify views/RPCs.'
  };
});

const fallbackRestore: RestoreDryRunItem[] = [
  {
    id: 'restore-1',
    backupPackageId: 'latest-browser-export',
    scenarioName: 'Restore dry-run from latest export package',
    status: 'planned',
    startedAt: null,
    finishedAt: null,
    resultSummary: 'Create a clean Supabase test project, apply migrations, import exported rows, then compare KPI counts.',
    evidenceFile: null
  },
  {
    id: 'restore-2',
    backupPackageId: 'sample-demo-seed',
    scenarioName: 'Demo data restore drill',
    status: 'passed',
    startedAt: '2026-06-16T09:00:00+03:00',
    finishedAt: '2026-06-16T10:15:00+03:00',
    resultSummary: 'Demo data created, dashboards loaded, OVR workflow queue visible.',
    evidenceFile: 'restore-demo-evidence.pdf'
  }
];

const fallbackSafety: AdminSafetyFinding[] = [
  {
    id: 'safety-1',
    area: 'Dangerous reset',
    finding: 'Production reset controls must remain locked after go-live.',
    severity: 'critical',
    status: 'open',
    recommendation: 'Require dual approval, backup and typed confirmation before destructive actions.',
    owner: 'Super Admin'
  },
  {
    id: 'safety-2',
    area: 'Bulk import',
    finding: 'Large employee imports should run only after validation report is clean.',
    severity: 'high',
    status: 'reviewed',
    recommendation: 'Use staging tables and export validation report before applying imports.',
    owner: 'HR / System Admin'
  },
  {
    id: 'safety-3',
    area: 'Access control',
    finding: 'Sensitive global roles must be reviewed monthly.',
    severity: 'high',
    status: 'open',
    recommendation: 'Schedule access review cycle and export sensitive role list.',
    owner: 'Governance Admin'
  }
];

export const fallbackDictionary: TranslationDictionaryRow[] = [
  { key: 'role.super_admin', englishLabel: 'Super Admin', arabicLabel: 'مدير النظام الأعلى', category: 'role', isCore: true, status: 'complete' },
  { key: 'role.executive', englishLabel: 'Executive', arabicLabel: 'تنفيذي', category: 'role', isCore: true, status: 'complete' },
  { key: 'role.governance_admin', englishLabel: 'Governance Admin', arabicLabel: 'مسؤول الحوكمة', category: 'role', isCore: true, status: 'complete' },
  { key: 'role.department_manager', englishLabel: 'Department Manager', arabicLabel: 'مدير إدارة', category: 'role', isCore: true, status: 'complete' },
  { key: 'role.quality_manager', englishLabel: 'Quality Manager', arabicLabel: 'مدير الجودة', category: 'role', isCore: true, status: 'complete' },
  { key: 'status.pending_quality_review', englishLabel: 'Pending Quality review', arabicLabel: 'بانتظار مراجعة الجودة', category: 'status', isCore: true, status: 'complete' },
  { key: 'status.evidence_submitted', englishLabel: 'Evidence submitted', arabicLabel: 'تم تقديم الدليل', category: 'status', isCore: true, status: 'complete' },
  { key: 'source.audit_finding', englishLabel: 'Audit finding', arabicLabel: 'ملاحظة مراجعة', category: 'source', isCore: true, status: 'complete' },
  { key: 'source.incident_ovr', englishLabel: 'OVR / incident', arabicLabel: 'بلاغ OVR / حادث', category: 'source', isCore: true, status: 'complete' },
  { key: 'workflow.returned_for_clarification', englishLabel: 'Returned for clarification', arabicLabel: 'معاد للتوضيح', category: 'workflow', isCore: true, status: 'complete' }
];

function warnFallback(context: string, error: unknown) {
  console.warn(`[GRC] Using fallback ${context}`, error);
}

export async function getUltraReleaseSummary(): Promise<UltraReleaseSummary> {
  if (!supabase) return fallbackSummary;
  try {
    const { data, error } = await supabase.from('v_ultra_release_summary').select('*').limit(1);
    if (error) throw error;
    const row = data?.[0] as any;
    if (!row) return fallbackSummary;
    return {
      releaseScore: row.release_score ?? 0,
      blockerCount: row.blocker_count ?? 0,
      warningCount: row.warning_count ?? 0,
      lastBackupAt: row.last_backup_at,
      lastRestoreDryRunAt: row.last_restore_dry_run_at,
      migrationsExpected: row.migrations_expected ?? 0,
      migrationsVerified: row.migrations_verified ?? 0,
      translationCoverage: row.translation_coverage ?? 0,
      adminLocksActive: row.admin_locks_active ?? 0
    };
  } catch (error) {
    warnFallback('ultra release summary', error);
    return fallbackSummary;
  }
}

export async function getProductionChecklist(): Promise<ProductionChecklistItem[]> {
  if (!supabase) return fallbackChecklist;
  try {
    const { data, error } = await supabase.from('v_production_cutover_checklist').select('*').order('sort_order');
    if (error) throw error;
    if (!data?.length) return fallbackChecklist;
    return (data as any[]).map(row => ({
      id: row.id,
      phase: row.phase,
      item: row.item,
      status: row.status,
      owner: row.owner || 'Unassigned',
      evidence: row.evidence || '—',
      notes: row.notes || '',
      sortOrder: row.sort_order ?? 99
    }));
  } catch (error) {
    warnFallback('production checklist', error);
    return fallbackChecklist;
  }
}

export async function getMigrationVerification(): Promise<MigrationVerificationItem[]> {
  if (!supabase) return fallbackMigrations;
  try {
    const { data, error } = await supabase.from('v_migration_verification_matrix').select('*').order('sequence_no');
    if (error) throw error;
    if (!data?.length) return fallbackMigrations;
    return (data as any[]).map(row => ({
      sequenceNo: row.sequence_no,
      migrationFile: row.migration_file,
      purpose: row.purpose || '',
      expected: Boolean(row.expected),
      verified: Boolean(row.verified),
      status: row.status || 'pending',
      verificationNote: row.verification_note || ''
    }));
  } catch (error) {
    warnFallback('migration verification', error);
    return fallbackMigrations;
  }
}

export async function getRestoreDryRuns(): Promise<RestoreDryRunItem[]> {
  if (!supabase) return fallbackRestore;
  try {
    const { data, error } = await supabase.from('v_backup_restore_drillboard').select('*').order('started_at', { ascending: false, nullsFirst: false }).limit(100);
    if (error) throw error;
    if (!data?.length) return fallbackRestore;
    return (data as any[]).map(row => ({
      id: row.id,
      backupPackageId: row.backup_package_id || '—',
      scenarioName: row.scenario_name || 'Restore dry-run',
      status: row.status || 'planned',
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      resultSummary: row.result_summary || '',
      evidenceFile: row.evidence_file || null
    }));
  } catch (error) {
    warnFallback('restore dry-runs', error);
    return fallbackRestore;
  }
}

export async function getAdminSafetyFindings(): Promise<AdminSafetyFinding[]> {
  if (!supabase) return fallbackSafety;
  try {
    const { data, error } = await supabase.from('v_admin_safety_console').select('*').order('severity_rank');
    if (error) throw error;
    if (!data?.length) return fallbackSafety;
    return (data as any[]).map(row => ({
      id: row.id,
      area: row.area,
      finding: row.finding,
      severity: row.severity || 'medium',
      status: row.status || 'open',
      recommendation: row.recommendation || '',
      owner: row.owner || 'Unassigned'
    }));
  } catch (error) {
    warnFallback('admin safety findings', error);
    return fallbackSafety;
  }
}

export async function getTranslationDictionary(): Promise<TranslationDictionaryRow[]> {
  if (!supabase) return fallbackDictionary;
  try {
    const { data, error } = await supabase.from('v_bilingual_dictionary_status').select('*').order('category').order('key');
    if (error) throw error;
    if (!data?.length) return fallbackDictionary;
    return (data as any[]).map(row => ({
      key: row.key,
      englishLabel: row.english_label || '',
      arabicLabel: row.arabic_label || '',
      category: row.category || 'general',
      isCore: Boolean(row.is_core),
      status: row.status || 'needs_review'
    }));
  } catch (error) {
    warnFallback('translation dictionary', error);
    return fallbackDictionary;
  }
}

export async function startRestoreDryRun(scenarioName: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('start_restore_dry_run', { p_scenario_name: scenarioName });
  if (error) throw error;
}

export async function runReleasePreflight(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('run_ultra_release_preflight');
  if (error) throw error;
}
